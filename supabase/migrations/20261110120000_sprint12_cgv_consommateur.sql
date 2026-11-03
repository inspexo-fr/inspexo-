-- ===========================================================================
-- SPRINT 12 (suite) — Mise en conformité consommateur des CGV de l'inspection.
-- Migration ADDITIVE.
--
-- Relecture juridique du 3 novembre 2026. Trois changements touchent au CODE :
--
--  1. HEURE DE GRÂCE. L'acheteur peut revenir sur sa commande dans l'heure qui
--     suit la confirmation, quel que soit le créneau. Sans elle, un créneau
--     choisi à +3 h rendait l'annulation payante AVANT que l'acheteur ait pu
--     réagir à la confirmation qu'il venait de recevoir.
--
--  2. ÉCHÉANCE DE CONFIRMATION À DEUX BORNES. Le créneau peut être à 2 h de la
--     commande alors que la confirmation a 48 h pour arriver. L'autorisation
--     est donc relâchée au PREMIER des deux termes : 2 h avant le créneau, ou
--     48 h après l'autorisation. Avant ce correctif, une mission restait
--     confirmable après l'heure du rendez-vous.
--
--  3. PHOTO DE CONSTAT D'ABSENCE : conservée UN AN (litiges et contestations
--     de paiement), puis supprimée. Elle était conservée sans durée annoncée,
--     ce qui rendait fausse la phrase « seule situation où Inspexo conserve
--     des photographies » des CGV et de la politique de confidentialité.
--
-- Le barème lui-même reste dans `_shared/inspection.ts` (`decisionAnnulation`,
-- fonction pure testée hors ligne) ; le SQL en est la transcription.
-- ===========================================================================

alter table public.inspections
  -- Instant de la confirmation par l'inspecteur : ouvre l'heure de grâce.
  -- `creneau_confirme` est le RENDEZ-VOUS, pas l'instant de la confirmation :
  -- les confondre faisait démarrer la grâce au mauvais moment.
  add column if not exists confirmee_le timestamptz,
  add column if not exists absence_photo_purgee_le timestamptz;

comment on column public.inspections.confirmee_le is
  'Instant où un inspecteur a confirmé la mission. Ouvre le délai de grâce '
  'd''une heure pendant lequel l''annulation reste intégralement remboursée '
  '(CGV inspection art. 6).';

-- ---------------------------------------------------------------------------
-- 1 + 2. Annulation par l'acheteur : heure de grâce intégrée.
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
  v_depuis_confirmation numeric;
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
    -- Rien n'a été encaissé : on relâche, aucune retenue possible.
    v_action := 'annuler_autorisation';
  else
    v_depuis_confirmation := extract(epoch from (now() - v_insp.confirmee_le)) / 3600;
    v_heures := extract(epoch from (coalesce(v_insp.creneau_confirme, v_insp.creneau_souhaite) - now())) / 3600;
    if v_depuis_confirmation is not null
       and v_depuis_confirmation >= 0
       and v_depuis_confirmation <= 1 then
      -- Heure de grâce (miroir de DELAI_GRACE_CONFIRMATION_HEURES).
      v_action := 'rembourser_integral';
    elsif v_heures is null or v_heures > 24 then
      -- Créneau inconnu ⇒ au plus favorable pour l'acheteur.
      v_action := 'rembourser_integral';
    else
      v_action := 'retenue_deplacement';
      -- Jamais plus que l'encaissé : sinon le remboursement devient négatif.
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
-- 2. File d'expiration : le PREMIER des deux termes.
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
     -- 2 h avant le créneau, ou 48 h après l'autorisation : le plus proche.
     and now() >= least(
           autorisee_le + interval '48 hours',
           coalesce(creneau_souhaite, autorisee_le + interval '48 hours') - interval '2 hours'
         )
   order by autorisee_le
   limit greatest(1, least(500, coalesce(p_limite, 50)));
$$;

-- ---------------------------------------------------------------------------
-- 3. Photo de constat d'absence : un an, puis suppression.
--    Elle sert aux litiges et aux contestations de paiement — pas au-delà.
-- ---------------------------------------------------------------------------
create or replace function public.inspections_preuves_a_purger(p_limite integer default 20)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'inspection_id', id, 'chemin', absence_photo_path)), '[]'::jsonb)
  from (
    select id, absence_photo_path
    from public.inspections
    where absence_photo_path is not null
      and absence_photo_purgee_le is null
      and coalesce(absence_constatee_le, annulee_le, created_at) < now() - interval '1 year'
    order by id
    limit greatest(1, least(100, coalesce(p_limite, 20)))
  ) t;
$$;

create or replace function public.inspection_noter_preuve_purgee(p_inspection_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.inspections
     set absence_photo_path = null, absence_photo_purgee_le = now(), maj_le = now()
   where id = p_inspection_id and absence_photo_purgee_le is null;
$$;

-- ---------------------------------------------------------------------------
-- 4. La charte gagne le devoir d'information du vendeur (art. 14 RGPD).
--    Même version de date : ce texte n'a jamais été ni déployé ni signé —
--    la version 2026-11-03 n'existe que sur cette branche.
-- ---------------------------------------------------------------------------
-- (charte_version_courante() reste à '2026-11-03', posée par la migration
--  20261109120000 ; seul le TEXTE des engagements change, et aucune signature
--  n'a encore été déposée contre lui.)

revoke all on function public.inspections_preuves_a_purger(integer) from public, anon, authenticated;
revoke all on function public.inspection_noter_preuve_purgee(uuid) from public, anon, authenticated;
grant execute on function public.inspections_preuves_a_purger(integer) to service_role;
grant execute on function public.inspection_noter_preuve_purgee(uuid) to service_role;
