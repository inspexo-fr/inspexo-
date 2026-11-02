-- SPRINT 8 — Correctifs de l'audit de sécurité adversarial (2 nov. 2026).
-- 127 agents, 40 findings bruts, 18 survivants : rien de critique, 6 majeurs.
-- Cette migration corrige ce qui relève du SQL ; le reste est dans les
-- fonctions edge du même commit.

-- ============================================================
-- 1. La policy « rapports lecture parties » était TOUJOURS FAUSSE
-- ============================================================
-- Son USING interrogeait inspection_photos, inspections et inspecteurs — qui
-- ont RLS active et AUCUNE policy, donc zéro ligne visible pour le rôle
-- authenticated — et public.admins, dont l'EXECUTE est révoqué. Résultat :
-- l'acheteur qui venait de payer 179 € ne voyait JAMAIS les photos de son
-- rapport, et l'interface n'affichait même pas d'erreur.
--
-- Une policy ne peut pas faire ce travail ici : la décision exige de lire des
-- tables volontairement fermées. On la retire, et la signature d'URL passe
-- par la fonction edge `inspection-photo`, qui vérifie en service role que
-- l'appelant est l'acheteur ou l'inspecteur assigné.
drop policy if exists "rapports lecture parties" on storage.objects;

-- ============================================================
-- 2. Un inspecteur sans compte de versement opérationnel ne doit pas
--    recevoir de mission (il livrerait sans pouvoir être payé)
-- ============================================================
-- …ni un inspecteur dont l'assurance RC professionnelle a expiré : l'écran
-- d'achat promet « un professionnel indépendant assuré ».
create or replace function public.inspecteur_missions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
begin
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found
     or v.statut <> 'valide'
     or not v.stripe_paiements_actifs
     or v.rc_pro_echeance is null
     or v.rc_pro_echeance < current_date then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(x order by x->>'created_at' desc) from (
      select jsonb_build_object(
        'id', i.id,
        'ref_num', i.ref_num,
        'statut', i.statut,
        'a_moi', (i.inspecteur_id = v.id),
        'code_postal', i.code_postal,
        'departement', i.departement,
        'creneau_souhaite', i.creneau_souhaite,
        'creneau_confirme', i.creneau_confirme,
        'part_inspecteur_cents', i.part_inspecteur_cents,
        'marque', a.marque, 'modele', a.modele, 'annee', a.annee,
        'analysis_id', i.analysis_id,
        'verdict', a.verdict, 'score', a.score,
        'vendeur_nom', case when i.inspecteur_id = v.id then i.vendeur_nom end,
        'vendeur_telephone', case when i.inspecteur_id = v.id then i.vendeur_telephone end,
        'vendeur_adresse', case when i.inspecteur_id = v.id then i.vendeur_adresse end,
        'photos_consentement_le', i.photos_consentement_le,
        'rapport_rendu_le', i.rapport_rendu_le,
        'created_at', i.created_at
      ) as x
      from public.inspections i
      join public.analyses a on a.id = i.analysis_id
      where (
        (i.statut in ('a_attribuer', 'refusee')
         and i.departement = any (v.departements)
         and not exists (
           select 1 from public.inspection_refus r
           where r.inspection_id = i.id and r.inspecteur_id = v.id
         ))
        or (i.inspecteur_id = v.id and i.statut in ('acceptee', 'faite'))
      )
    ) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.inspecteur_missions() from public, anon;
grant execute on function public.inspecteur_missions() to authenticated;

-- Même exigence à l'acceptation, et le créneau confirmé est BORNÉ : il était
-- repris tel quel du client, donc une date arbitraire pouvait être envoyée à
-- l'acheteur par email.
create or replace function public.inspection_accepter(
  p_inspection_id uuid,
  p_creneau timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
  v_maj integer;
  v_creneau timestamptz;
begin
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found or v.statut <> 'valide' then
    raise exception 'inspecteur non validé';
  end if;
  if not v.stripe_paiements_actifs then
    return jsonb_build_object('ok', false, 'raison', 'connect_incomplet');
  end if;
  if v.rc_pro_echeance is null or v.rc_pro_echeance < current_date then
    return jsonb_build_object('ok', false, 'raison', 'assurance_expiree');
  end if;

  -- Créneau : entre +1 h et +72 h. Au-delà, ce n'est plus l'offre vendue
  -- (« sous 48 h ») et l'acheteur recevrait une date fantaisiste.
  v_creneau := coalesce(p_creneau, (
    select creneau_souhaite from public.inspections where id = p_inspection_id
  ));
  if v_creneau is null
     or v_creneau < now() + interval '1 hour'
     or v_creneau > now() + interval '72 hours' then
    return jsonb_build_object('ok', false, 'raison', 'creneau_invalide');
  end if;

  update public.inspections i
  set inspecteur_id = v.id,
      statut = 'acceptee',
      creneau_confirme = v_creneau,
      maj_le = now()
  where i.id = p_inspection_id
    and i.statut in ('a_attribuer', 'refusee')
    and i.departement = any (v.departements);
  get diagnostics v_maj = row_count;

  if v_maj = 0 then
    return jsonb_build_object('ok', false, 'raison', 'deja_prise');
  end if;
  insert into public.events (name, props_json)
  values ('inspection_acceptee', jsonb_build_object('inspection_id', p_inspection_id));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.inspection_accepter(uuid, timestamptz) from public, anon;
grant execute on function public.inspection_accepter(uuid, timestamptz) to authenticated;

-- ============================================================
-- 3. Consentement photos : exiger le statut « valide » comme ses sœurs
-- ============================================================
create or replace function public.inspection_consentement_photos(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.inspecteurs;
  v_maj integer;
begin
  select * into v from public.inspecteurs where user_id = auth.uid();
  if not found or v.statut <> 'valide' then
    raise exception 'inspecteur non validé';
  end if;
  update public.inspections
  set photos_consentement_le = now(), maj_le = now()
  where id = p_inspection_id and inspecteur_id = v.id and statut = 'acceptee';
  get diagnostics v_maj = row_count;
  return jsonb_build_object('ok', v_maj > 0);
end;
$$;
revoke all on function public.inspection_consentement_photos(uuid) from public, anon;
grant execute on function public.inspection_consentement_photos(uuid) to authenticated;

-- ============================================================
-- 4. Charte d'indépendance : la version est imposée par le SERVEUR
-- ============================================================
-- Le commentaire d'origine l'affirmait, mais c'était faux : la version
-- arrivait du navigateur et n'était que tronquée. Et l'absence de filtre de
-- statut permettait à un inspecteur validé de réécrire la date de signature
-- après coup — exactement la preuve qu'on veut conserver en cas de litige.
--
-- La version en vigueur devient une constante SQL : la changer exige une
-- migration, ce qui est la bonne granularité pour un texte signé.
create or replace function public.charte_version_courante()
returns text
language sql
immutable
as $$ select '2026-11-01'::text $$;
grant execute on function public.charte_version_courante() to anon, authenticated;

create or replace function public.inspecteur_signer_charte(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_maj integer;
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  -- La version signée DOIT être celle que le serveur publie : on refuse tout
  -- le reste plutôt que d'enregistrer une signature sur un texte inconnu.
  if coalesce(p_version, '') <> public.charte_version_courante() then
    raise exception 'version de charte inconnue';
  end if;

  update public.inspecteurs
  set charte_version = public.charte_version_courante(),
      charte_signee_le = now(),
      charte_ip_hash = public._request_ip_hash('charte:')
  where user_id = v_uid
    -- Une signature déjà posée ne se réécrit pas : c'est une preuve.
    and (charte_signee_le is null or statut in ('candidat', 'refuse'));
  get diagnostics v_maj = row_count;
  if v_maj = 0 then
    return jsonb_build_object('ok', false, 'raison', 'deja_signee');
  end if;
  insert into public.events (name, props_json)
  values ('charte_signee', jsonb_build_object(
    'version', public.charte_version_courante(), 'user_id', v_uid));
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.inspecteur_signer_charte(text) from public, anon;
grant execute on function public.inspecteur_signer_charte(text) to authenticated;

-- ============================================================
-- 5. Assurance RC pro : rendre le RENOUVELLEMENT possible
-- ============================================================
-- Le ON CONFLICT d'origine gelait TOUTE la fiche dès la validation : un
-- inspecteur validé ne pouvait plus mettre à jour son attestation, donc
-- l'assurance expirait sans recours. Désormais les champs d'assurance et le
-- téléphone restent modifiables (ils doivent l'être), tandis que l'identité
-- (nom, SIRET, raison sociale) et la zone restent figées après validation.
create or replace function public.inspecteur_candidater(
  p_nom text,
  p_telephone text,
  p_siret text,
  p_raison_sociale text,
  p_rc_assureur text,
  p_rc_numero text,
  p_rc_echeance date,
  p_departements text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_depts text[];
  v_siret text := regexp_replace(coalesce(p_siret, ''), '\s', '', 'g');
  v_statut text;
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if v_siret !~ '^[0-9]{14}$' then raise exception 'SIRET invalide'; end if;
  select email into v_email from auth.users where id = v_uid;
  select statut into v_statut from public.inspecteurs where user_id = v_uid;

  select coalesce(array_agg(d), '{}') into v_depts
  from (
    select distinct substring(trim(x) from 1 for 3) d
    from unnest(coalesce(p_departements, '{}')) x
    where trim(x) ~ '^[0-9]{2,3}$'
    limit 8
  ) t;

  if v_statut is null then
    insert into public.inspecteurs (
      user_id, email, nom, telephone, siret, raison_sociale,
      rc_pro_assureur, rc_pro_numero, rc_pro_echeance, departements
    ) values (
      v_uid, v_email, left(p_nom, 120), left(p_telephone, 30), v_siret, left(p_raison_sociale, 160),
      left(p_rc_assureur, 120), left(p_rc_numero, 60), p_rc_echeance, v_depts
    );
  elsif v_statut in ('candidat', 'refuse') then
    update public.inspecteurs set
      nom = left(p_nom, 120), telephone = left(p_telephone, 30), siret = v_siret,
      raison_sociale = left(p_raison_sociale, 160),
      rc_pro_assureur = left(p_rc_assureur, 120), rc_pro_numero = left(p_rc_numero, 60),
      rc_pro_echeance = p_rc_echeance, departements = v_depts
    where user_id = v_uid;
  elsif v_statut = 'valide' then
    -- Renouvellement d'assurance et coordonnées : autorisés sans repasser par
    -- la validation. L'identité et la zone, elles, ne bougent pas.
    update public.inspecteurs set
      telephone = left(p_telephone, 30),
      rc_pro_assureur = left(p_rc_assureur, 120),
      rc_pro_numero = left(p_rc_numero, 60),
      rc_pro_echeance = greatest(coalesce(rc_pro_echeance, p_rc_echeance), p_rc_echeance)
    where user_id = v_uid;
    insert into public.events (name, props_json)
    values ('inspecteur_rc_renouvelee', jsonb_build_object('user_id', v_uid, 'echeance', p_rc_echeance));
  else
    raise exception 'compte suspendu';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.inspecteur_candidater(text, text, text, text, text, text, date, text[]) from public, anon;
grant execute on function public.inspecteur_candidater(text, text, text, text, text, text, date, text[]) to authenticated;

-- Disponibilité d'un département : mêmes exigences que l'acceptation.
create or replace function public._inspecteur_dispo(p_dept text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.inspecteurs
    where statut = 'valide'
      and stripe_paiements_actifs
      and rc_pro_echeance is not null
      and rc_pro_echeance >= current_date
      and p_dept = any (departements)
  );
$$;
revoke all on function public._inspecteur_dispo(text) from public, anon, authenticated;

-- ============================================================
-- 6. Photos du rapport : effacer l'objet quand sa ligne disparaît
-- ============================================================
-- La cascade sur inspection_photos détruisait le seul lien entre un objet du
-- bucket et une personne : les fichiers devenaient des orphelins que plus
-- rien ne pouvait rattacher ni supprimer. Le trigger les efface avec la ligne.
create or replace function public._supprimer_objet_rapport()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from storage.objects
  where bucket_id = 'rapports' and name = old.chemin;
  return old;
end;
$$;
revoke all on function public._supprimer_objet_rapport() from public, anon, authenticated;

drop trigger if exists trg_supprimer_objet_rapport on public.inspection_photos;
create trigger trg_supprimer_objet_rapport
  before delete on public.inspection_photos
  for each row execute function public._supprimer_objet_rapport();
