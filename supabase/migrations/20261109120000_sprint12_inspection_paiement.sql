-- ===========================================================================
-- SPRINT 12 — Paiement en deux temps de l'inspection, expiration, annulation.
-- Migration ADDITIVE.
--
-- Ce que ce sprint corrige, et pourquoi c'était grave :
--
--  1. Le paiement était ENCAISSÉ à la commande. Un acheteur payait 179 € pour
--     une mission que personne n'avait prise, et que rien n'obligeait à
--     prendre. Désormais : autorisation à la commande, débit à la
--     confirmation par un inspecteur.
--     ⚠️ Décision déjà actée (« Autorisation Stripe avant confirmation »)
--     mais jamais appliquée à l'inspection.
--
--  2. Rien n'expirait. Une inspection restait « à attribuer » indéfiniment,
--     argent encaissé. Désormais : au-delà de 48 h sans confirmation,
--     l'autorisation est relâchée et l'acheteur prévenu.
--     ⚠️ 48 h et pas plus : une autorisation de carte ne tient que 7 JOURS.
--
--  3. Aucune annulation n'existait, ni pour l'acheteur, ni pour le cas du
--     vendeur absent. Le barème vit dans `_shared/inspection.ts`
--     (`decisionAnnulation`, fonction pure testée hors ligne) ; ces RPC ne
--     font que la transition d'état ATOMIQUE et rendent l'instruction
--     d'argent à exécuter côté Stripe.
--
--  4. Aucune demande expresse d'exécution immédiate. Sans elle, l'acheteur
--     conservait ses 14 jours de rétractation APRÈS l'inspection réalisée :
--     inspecteur payé, acheteur remboursé. Désormais exigée, horodatée, avec
--     la version des CGV acceptées.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Colonnes.
-- ---------------------------------------------------------------------------
alter table public.inspections
  -- Paiement en deux temps.
  add column if not exists autorisee_le timestamptz,
  add column if not exists capturee_le timestamptz,
  add column if not exists autorisation_annulee_le timestamptz,
  -- Rétractation : demande expresse d'exécution immédiate (L221-25/28).
  add column if not exists execution_immediate_le timestamptz,
  add column if not exists cgv_version text,
  -- Barème d'annulation.
  add column if not exists retenue_cents integer not null default 0,
  add column if not exists retenue_transfer_id text,
  -- Vrai dès que NOUS avons piloté le remboursement : le webhook ne doit
  -- alors PAS appliquer sa reprise proportionnelle de transfert (sans ce
  -- drapeau, un remboursement de 139 € reprendrait une part du transfert de
  -- 40 € que le barème vient justement d'accorder à l'inspecteur).
  add column if not exists remboursement_pilote boolean not null default false,
  add column if not exists annulee_par text,
  add column if not exists annulee_le timestamptz,
  add column if not exists annulation_motif text,
  -- Constat d'absence : une PHOTO horodatée prise sur place est exigée.
  add column if not exists absence_constatee_le timestamptz,
  add column if not exists absence_photo_path text,
  -- Arbitrage exploitant en cas de contestation.
  add column if not exists arbitrage_decision text,
  add column if not exists arbitrage_note text,
  add column if not exists arbitre_le timestamptz,
  -- Alerte « rapport non remis » : posée une seule fois.
  add column if not exists rapport_alerte_le timestamptz;

alter table public.inspections
  drop constraint if exists inspections_annulee_par_check;
alter table public.inspections
  add constraint inspections_annulee_par_check check (
    annulee_par is null or annulee_par in
      ('acheteur', 'absence_vendeur', 'expiration', 'admin', 'inspecteur')
  );

comment on column public.inspections.autorisee_le is
  'Autorisation de paiement obtenue (capture_method manual). Le compte à '
  'rebours des 48 heures de confirmation part de là.';
comment on column public.inspections.remboursement_pilote is
  'Remboursement effectué par NOTRE code selon le barème. Le webhook '
  'charge.refunded doit alors sauter sa reprise proportionnelle de transfert.';
comment on column public.inspections.execution_immediate_le is
  'Demande expresse d''exécution avant la fin des 14 jours (L221-25). Sans '
  'elle, la commande est refusée.';

create index if not exists inspections_a_expirer_idx
  on public.inspections (autorisee_le) where statut = 'a_attribuer';
create index if not exists inspections_rapport_retard_idx
  on public.inspections (creneau_confirme) where statut = 'acceptee';

-- ---------------------------------------------------------------------------
-- 2. La charte change : une personne RECONNAISSABLE ne se photographie pas.
--    Nouvelle version ⇒ les inspecteurs doivent re-signer. Une signature
--    posée ne se réécrit JAMAIS : on en pose une nouvelle.
-- ---------------------------------------------------------------------------
create or replace function public.charte_version_courante()
returns text
language sql
immutable
as $$ select '2026-11-03'::text $$;

-- ---------------------------------------------------------------------------
-- 3. Annulation par l'ACHETEUR.
--    La RPC ne touche pas à Stripe : elle verrouille l'état et dit quoi faire.
--    Transition atomique (filtre sur le statut dans l'UPDATE) : deux clics
--    simultanés ne peuvent pas rembourser deux fois.
-- ---------------------------------------------------------------------------
create or replace function public.inspection_annuler(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insp public.inspections;
  v_heures numeric;
  v_action text;
  v_retenue integer := 0;
begin
  select * into v_insp from public.inspections
   where id = p_inspection_id and acheteur_id = auth.uid();
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;
  if v_insp.statut = 'faite' then
    return jsonb_build_object('ok', false, 'raison', 'deja_faite');
  end if;
  if v_insp.statut = 'annulee' then
    return jsonb_build_object('ok', false, 'raison', 'deja_annulee');
  end if;

  if v_insp.statut in ('a_payer', 'a_attribuer', 'refusee') then
    v_action := 'annuler_autorisation';
  else
    v_heures := extract(epoch from (coalesce(v_insp.creneau_confirme, v_insp.creneau_souhaite) - now())) / 3600;
    -- Créneau inconnu ⇒ au plus favorable pour l'acheteur : un barème ne se
    -- déclenche pas sur une donnée manquante.
    if v_heures is null or v_heures > 24 then
      v_action := 'rembourser_integral';
    else
      v_action := 'retenue_deplacement';
      -- La retenue ne peut JAMAIS dépasser ce qui a été encaissé : sinon le
      -- remboursement devient négatif, c'est-à-dire qu'on redemanderait de
      -- l'argent à l'acheteur pour l'avoir annulé. Miroir du garde-fou de
      -- `decisionAnnulation` (_shared/inspection.ts), testé hors ligne.
      v_retenue := least(4000, v_insp.prix_cents);
    end if;
  end if;

  update public.inspections
     set statut = 'annulee',
         annulee_par = 'acheteur',
         annulee_le = now(),
         annulation_motif = v_action,
         retenue_cents = v_retenue,
         maj_le = now()
   where id = p_inspection_id
     and statut = v_insp.statut; -- CAS : personne n'a bougé entre-temps
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'conflit');
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'retenue_cents', v_retenue,
    'rembourse_cents', case when v_action = 'rembourser_integral' then v_insp.prix_cents
                            when v_action = 'retenue_deplacement' then v_insp.prix_cents - v_retenue
                            else 0 end,
    'payment_intent', v_insp.stripe_payment_intent,
    'charge', v_insp.stripe_charge,
    'transfer_group', v_insp.transfer_group,
    'inspecteur_id', v_insp.inspecteur_id,
    'statut_avant', v_insp.statut
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Constat d'ABSENCE par l'inspecteur — PHOTO HORODATÉE EXIGÉE.
--    Sans preuve déposée, pas de retenue : c'est une somme prélevée sur
--    l'acheteur, elle ne peut pas reposer sur la seule parole de celui qui
--    la touche.
-- ---------------------------------------------------------------------------
create or replace function public.inspection_constat_absence(
  p_inspection_id uuid,
  p_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insp public.inspections;
  v_moi uuid;
begin
  select id into v_moi from public.inspecteurs
   where user_id = auth.uid() and statut = 'valide';
  if v_moi is null then
    return jsonb_build_object('ok', false, 'raison', 'non_inspecteur');
  end if;
  if coalesce(btrim(p_photo_path), '') = '' then
    return jsonb_build_object('ok', false, 'raison', 'photo_requise');
  end if;

  select * into v_insp from public.inspections
   where id = p_inspection_id and inspecteur_id = v_moi;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;
  if v_insp.statut <> 'acceptee' then
    return jsonb_build_object('ok', false, 'raison', 'statut_' || v_insp.statut);
  end if;

  update public.inspections
     set statut = 'annulee',
         annulee_par = 'absence_vendeur',
         annulee_le = now(),
         annulation_motif = 'retenue_deplacement',
         absence_constatee_le = now(),
         absence_photo_path = left(p_photo_path, 300),
         -- Même garde-fou que ci-dessus : jamais plus que l'encaissé.
         retenue_cents = least(4000, v_insp.prix_cents),
         maj_le = now()
   where id = p_inspection_id and statut = 'acceptee';
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'conflit');
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', 'retenue_deplacement',
    'retenue_cents', least(4000, v_insp.prix_cents),
    'rembourse_cents', v_insp.prix_cents - least(4000, v_insp.prix_cents),
    'payment_intent', v_insp.stripe_payment_intent,
    'charge', v_insp.stripe_charge,
    'transfer_group', v_insp.transfer_group,
    'inspecteur_id', v_insp.inspecteur_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Enregistrement du sort de l'argent, après Stripe.
-- ---------------------------------------------------------------------------
create or replace function public.inspection_noter_argent(
  p_inspection_id uuid,
  p_capturee boolean default false,
  p_autorisation_annulee boolean default false,
  p_rembourse boolean default false,
  p_retenue_transfer_id text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inspections
     set capturee_le = case when p_capturee then coalesce(capturee_le, now()) else capturee_le end,
         autorisation_annulee_le = case when p_autorisation_annulee
                                        then coalesce(autorisation_annulee_le, now())
                                        else autorisation_annulee_le end,
         rembourse_le = case when p_rembourse then coalesce(rembourse_le, now()) else rembourse_le end,
         remboursement_pilote = case when p_rembourse then true else remboursement_pilote end,
         retenue_transfer_id = coalesce(retenue_transfer_id, p_retenue_transfer_id),
         maj_le = now()
   where id = p_inspection_id;
$$;

-- Remise en attribution quand la CAPTURE échoue après acceptation : la
-- mission ne peut pas rester « confirmée » sans argent encaissé.
create or replace function public.inspection_capture_echouee(p_inspection_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inspections
     set statut = 'a_attribuer', inspecteur_id = null, creneau_confirme = null, maj_le = now()
   where id = p_inspection_id and statut = 'acceptee';
$$;

-- ---------------------------------------------------------------------------
-- 6. Files de travail du cron.
-- ---------------------------------------------------------------------------
create or replace function public.inspections_a_expirer(p_limite integer default 50)
returns setof public.inspections
language sql
security definer
stable
set search_path = public
as $$
  select * from public.inspections
   where statut = 'a_attribuer'
     and autorisee_le is not null
     and autorisee_le < now() - interval '48 hours'
   order by autorisee_le
   limit greatest(1, least(500, coalesce(p_limite, 50)));
$$;

create or replace function public.inspection_expirer(p_inspection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  update public.inspections
     set statut = 'annulee',
         annulee_par = 'expiration',
         annulee_le = now(),
         annulation_motif = 'annuler_autorisation',
         maj_le = now()
   where id = p_inspection_id and statut = 'a_attribuer'
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.inspections_rapport_en_retard(p_limite integer default 50)
returns setof public.inspections
language sql
security definer
stable
set search_path = public
as $$
  select * from public.inspections
   where statut = 'acceptee'
     and rapport_rendu_le is null
     and rapport_alerte_le is null
     and creneau_confirme is not null
     and creneau_confirme < now() - interval '24 hours'
   order by creneau_confirme
   limit greatest(1, least(500, coalesce(p_limite, 50)));
$$;

create or replace function public.inspection_noter_alerte_rapport(p_inspection_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inspections set rapport_alerte_le = now(), maj_le = now()
   where id = p_inspection_id and rapport_alerte_le is null;
$$;

-- ---------------------------------------------------------------------------
-- 7. Arbitrage exploitant, en cas de contestation du barème.
--    Réservé au service role : l'appelant est `admin-inspecteurs`, qui a déjà
--    vérifié le rôle administrateur en base (`verifierAdmin`).
-- ---------------------------------------------------------------------------
create or replace function public.inspection_arbitrer(
  p_inspection_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insp public.inspections;
begin
  if coalesce(p_decision, '') not in ('rembourser_integral', 'confirmer_retenue') then
    return jsonb_build_object('ok', false, 'raison', 'decision_inconnue');
  end if;
  select * into v_insp from public.inspections where id = p_inspection_id;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;
  if v_insp.arbitre_le is not null then
    return jsonb_build_object('ok', false, 'raison', 'deja_arbitre');
  end if;

  update public.inspections
     set arbitrage_decision = p_decision,
         arbitrage_note = left(coalesce(p_note, ''), 500),
         arbitre_le = now(),
         maj_le = now()
   where id = p_inspection_id and arbitre_le is null;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'conflit');
  end if;

  return jsonb_build_object(
    'ok', true,
    'decision', p_decision,
    'retenue_cents', v_insp.retenue_cents,
    'retenue_transfer_id', v_insp.retenue_transfer_id,
    'charge', v_insp.stripe_charge,
    'payment_intent', v_insp.stripe_payment_intent,
    'prix_cents', v_insp.prix_cents
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Droits. Acheteur et inspecteur agissent avec LEUR jeton (auth.uid()) ;
--    tout le reste est réservé au service role.
-- ---------------------------------------------------------------------------
revoke all on function public.inspection_annuler(uuid) from public, anon;
grant execute on function public.inspection_annuler(uuid) to authenticated;

revoke all on function public.inspection_constat_absence(uuid, text) from public, anon;
grant execute on function public.inspection_constat_absence(uuid, text) to authenticated;

do $$
declare f text;
begin
  for f in
    select x from unnest(array[
      'inspection_noter_argent(uuid, boolean, boolean, boolean, text)',
      'inspection_capture_echouee(uuid)',
      'inspections_a_expirer(integer)',
      'inspection_expirer(uuid)',
      'inspections_rapport_en_retard(integer)',
      'inspection_noter_alerte_rapport(uuid)',
      'inspection_arbitrer(uuid, text, text)'
    ]) x
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. CONSERVATION — les durées annoncées doivent être APPLIQUÉES.
--
-- Les CGV et la politique de confidentialité annoncent : photos du rapport
-- 2 ans, constatations écrites 5 ans, coordonnées du vendeur 3 mois. Une durée
-- écrite que rien n'applique est une promesse fausse — et une rétention sans
-- base légale. Ces fonctions sont appelées chaque jour par le cron `alertes`.
--
-- La SUPPRESSION DES FICHIERS ne peut pas se faire en SQL : le stockage n'est
-- pas une table. La fonction rend donc les chemins à supprimer, et la fonction
-- edge les efface en service role avant de marquer la ligne.
-- ---------------------------------------------------------------------------
alter table public.inspections
  add column if not exists photos_purgees_le timestamptz,
  add column if not exists vendeur_purge_le timestamptz;

create or replace function public.inspections_photos_a_purger(p_limite integer default 20)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'inspection_id', t.id,
           'chemins', t.chemins)), '[]'::jsonb)
  from (
    select i.id,
           coalesce(jsonb_agg(p.chemin) filter (where p.chemin is not null), '[]'::jsonb) as chemins
    from public.inspections i
    left join public.inspection_photos p on p.inspection_id = i.id
    where i.rapport_rendu_le is not null
      and i.rapport_rendu_le < now() - interval '2 years'
      and i.photos_purgees_le is null
    group by i.id
    order by i.id
    limit greatest(1, least(100, coalesce(p_limite, 20)))
  ) t;
$$;

-- Marque la purge ET retire les lignes de photos : les constatations écrites
-- (`rapport_json`) restent, elles, jusqu'à cinq ans.
create or replace function public.inspection_noter_photos_purgees(p_inspection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.inspection_photos where inspection_id = p_inspection_id;
  update public.inspections
     set photos_purgees_le = now(), maj_le = now()
   where id = p_inspection_id and photos_purgees_le is null;
end;
$$;

-- Coordonnées du vendeur : 3 mois après l'inspection. Ce sont les données
-- personnelles d'un TIERS qui n'est pas notre client — la durée la plus courte
-- est la bonne.
create or replace function public.purger_coordonnees_vendeur()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  with purgees as (
    update public.inspections
       set vendeur_nom = null,
           vendeur_telephone = null,
           vendeur_adresse = null,
           vendeur_purge_le = now(),
           maj_le = now()
     where vendeur_purge_le is null
       and (vendeur_nom is not null or vendeur_telephone is not null or vendeur_adresse is not null)
       and coalesce(rapport_rendu_le, annulee_le, created_at) < now() - interval '3 months'
    returning 1
  )
  select count(*)::integer into v_n from purgees;
  if v_n > 0 then
    insert into public.events (name, props_json)
    values ('inspection_vendeur_purge', jsonb_build_object('inspections', v_n));
  end if;
  return v_n;
end;
$$;

-- Constatations écrites : cinq ans, puis le rapport s'en va aussi.
create or replace function public.purger_rapports_inspection()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  with purgees as (
    update public.inspections
       set rapport_json = null, maj_le = now()
     where rapport_json is not null
       and rapport_rendu_le is not null
       and rapport_rendu_le < now() - interval '5 years'
    returning 1
  )
  select count(*)::integer into v_n from purgees;
  return v_n;
end;
$$;

do $$
declare f text;
begin
  for f in
    select x from unnest(array[
      'inspections_photos_a_purger(integer)',
      'inspection_noter_photos_purgees(uuid)',
      'purger_coordonnees_vendeur()',
      'purger_rapports_inspection()'
    ]) x
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
