-- SPRINT 14 (correctif) — le barème d'annulation en SQL ignorait le type.
--
-- ⚠️ CE QUE LE SPRINT 14 A OUBLIÉ. Les montants ont été factorisés par
-- prestation côté TypeScript (`PRESTATIONS` dans `_shared/inspection.ts`),
-- mais les deux fonctions SQL qui décident de l'argent ont gardé les
-- constantes de l'INSPECTION en dur : `24` heures d'annulation gratuite et
-- `least(4000, prix_cents)` de retenue.
--
-- Conséquences sur une VISIO (59 €), si le drapeau avait été allumé :
--   · annulation à moins de 24 h du créneau  → 40 € retenus,
--     alors que la visio s'annule LIBREMENT jusqu'au créneau (aucun
--     déplacement n'est engagé) : la retenue devait être de 0 € ;
--   · absence constatée de l'acheteur        → 40 € retenus sur 59 €,
--     au lieu des 20 € annoncés aux CGV.
-- Dans les deux cas, un montant contractuel faux, au détriment de l'acheteur.
--
-- Trouvé le 4 novembre 2026 en vérifiant une affirmation que j'avais faite au
-- rapport de mise en ligne — `scripts/fonctions-a-redeployer.mjs` contredisait
-- ma liste de fonctions à redéployer, et c'est le script qui avait raison.
-- Jamais atteint en production : le drapeau `visio_guidee` est éteint depuis
-- le premier jour et aucune visio n'a pu être commandée.
--
-- Le correctif ne recopie pas les nombres une troisième fois : il crée UNE
-- source SQL, `prestation_bareme`, et `tests/inspection.test.mjs` vérifie
-- qu'elle dit exactement ce que dit `PRESTATIONS`. Deux tables de constantes
-- qui se recopient finissent toujours par diverger — c'est précisément ce qui
-- vient d'arriver.

-- Source SQL unique du barème monétaire, miroir de PRESTATIONS.
-- Aucun grant : elle n'est appelée que depuis des fonctions SECURITY DEFINER,
-- où current_user est le propriétaire (règle 0 quater de CLAUDE.md).
create or replace function public.prestation_bareme(p_type text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case when coalesce(p_type, 'inspection') = 'visio'
    then jsonb_build_object('retenue_cents', 2000, 'annulation_gratuite_heures', 0)
    else jsonb_build_object('retenue_cents', 4000, 'annulation_gratuite_heures', 24)
  end;
$$;
revoke all on function public.prestation_bareme(text) from public, anon, authenticated;

-- Redéfinie depuis sa DERNIÈRE définition (20261110120000), barème mis à part.
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
  v_bareme jsonb;
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

  -- Barème de LA PRESTATION, plus les constantes de l'inspection.
  v_bareme := public.prestation_bareme(v_insp.type);

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
    elsif v_heures is null or v_heures > (v_bareme->>'annulation_gratuite_heures')::numeric then
      -- Créneau inconnu ⇒ au plus favorable pour l'acheteur.
      v_action := 'rembourser_integral';
    else
      v_action := 'retenue_deplacement';
      -- Jamais plus que l'encaissé : sinon le remboursement devient négatif.
      v_retenue := least((v_bareme->>'retenue_cents')::integer, v_insp.prix_cents);
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

-- Redéfinie depuis sa DERNIÈRE définition (20261114120000). Deux changements,
-- tous deux nommés : la retenue vient du barème de la prestation, et le
-- contrôle « introuvable » repasse AVANT le contrôle de la photo — il lisait
-- `v_insp.type` sur une ligne qui pouvait ne pas exister.
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
  v_retenue integer;
begin
  select id into v_moi from public.inspecteurs
   where user_id = auth.uid() and statut = 'valide';
  if v_moi is null then
    return jsonb_build_object('ok', false, 'raison', 'non_inspecteur');
  end if;

  select * into v_insp from public.inspections
   where id = p_inspection_id and inspecteur_id = v_moi;

  if not found then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;

  -- ⚠️ LA PREUVE N'EST PAS LA MÊME SELON LA PRESTATION.
  --
  -- Inspection sur place : une PHOTO horodatée est exigée. La retenue de 40 €
  -- est prélevée sur l'acheteur, elle ne peut pas reposer sur la seule parole
  -- de celui qui la touche.
  --
  -- Visio : l'inspecteur ne peut pas photographier une voiture qu'il ne voit
  -- pas. La preuve est ailleurs — le délai d'attente de 15 minutes, vérifié
  -- par la fonction edge (`absenceConstatable`), et l'arbitrage exploitant qui
  -- reste ouvert en cas de contestation. Exiger une photo ici aurait conduit à
  -- en fabriquer une, ce qui vaut moins qu'une absence de preuve assumée.
  if v_insp.type <> 'visio' and coalesce(btrim(p_photo_path), '') = '' then
    return jsonb_build_object('ok', false, 'raison', 'photo_requise');
  end if;
  if v_insp.statut <> 'acceptee' then
    return jsonb_build_object('ok', false, 'raison', 'statut_' || v_insp.statut);
  end if;

  v_retenue := least(
    (public.prestation_bareme(v_insp.type)->>'retenue_cents')::integer,
    v_insp.prix_cents
  );

  update public.inspections
     set statut = 'annulee',
         annulee_par = 'absence_vendeur',
         annulee_le = now(),
         annulation_motif = 'retenue_deplacement',
         absence_constatee_le = now(),
         absence_photo_path = left(p_photo_path, 300),
         -- Même garde-fou que ci-dessus : jamais plus que l'encaissé.
         retenue_cents = v_retenue,
         maj_le = now()
   where id = p_inspection_id and statut = 'acceptee';
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'conflit');
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', 'retenue_deplacement',
    'retenue_cents', v_retenue,
    'rembourse_cents', v_insp.prix_cents - v_retenue,
    'payment_intent', v_insp.stripe_payment_intent,
    'charge', v_insp.stripe_charge,
    'transfer_group', v_insp.transfer_group,
    'inspecteur_id', v_insp.inspecteur_id
  );
end;
$$;

revoke all on function public.inspection_annuler(uuid) from public, anon;
grant execute on function public.inspection_annuler(uuid) to authenticated;
revoke all on function public.inspection_constat_absence(uuid, text) from public, anon;
grant execute on function public.inspection_constat_absence(uuid, text) to authenticated;
