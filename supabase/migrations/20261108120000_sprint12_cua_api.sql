-- ===========================================================================
-- SPRINT 12 — Compléments aux conditions d'utilisation de l'API. ADDITIVE.
--
-- Deux décisions des CUA v0 qui touchent au COMPORTEMENT, donc implémentées
-- ici et pas seulement rédigées — une règle écrite que le code n'applique pas
-- serait un engagement faux :
--
--   1. CONSERVATION (art. 6.4). Le texte d'une annonce reçue par API est
--      effacé à 30 jours, mais le RÉSULTAT et une EMPREINTE sha256 du texte
--      reçu sont conservés CINQ ANS. C'est la seule façon de prouver, en cas
--      de litige, quel verdict a été rendu sur quel texte, sans conserver le
--      texte lui-même (art. L110-4 du code de commerce).
--
--   2. PART D'UN CLIENT D'API DANS UN SEGMENT DE PRIX (art. 6.3). Un segment
--      n'est publié que s'il atteint 15 relevés ET si aucun client d'API ne
--      pèse plus de 20 % de ce segment. Sans ce second verrou, un seul client
--      au contrat « prix partagés » pourrait, à lui seul, faire le prix que
--      nous publions — et nous publierions son catalogue en l'appelant
--      « prix observés ».
--
-- ⚠️ L'empreinte du texte est un sha256 NON SALÉ, et c'est VOULU : sa valeur
-- de preuve vient de ce que le client peut la recalculer à partir du texte
-- qu'il a envoyé. Une empreinte salée ne prouverait rien à personne. Rien à
-- voir avec l'empreinte d'IP du sprint 11, salée parce que les 4 milliards
-- d'adresses IPv4 s'énumèrent : un texte d'annonce, lui, ne s'énumère pas.
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. CONSERVATION — empreinte du texte et horizon de cinq ans.
-- ---------------------------------------------------------------------------
alter table public.analyses add column if not exists texte_sha256 text;
alter table public.analyses add column if not exists texte_purge_le timestamptz;
alter table public.analyses add column if not exists preuve_purgee_le timestamptz;

comment on column public.analyses.texte_sha256 is
  'Empreinte sha256 NON SALÉE du texte reçu, pour les analyses via API. '
  'Non salée à dessein : elle doit rester reproductible par le client à '
  'partir de son propre texte, c''est là toute sa valeur de preuve '
  '(CUA art. 6.4, art. L110-4 C. com.).';

comment on column public.analyses.texte_purge_le is
  'Date d''effacement du texte (30 jours après réception, analyses API).';

comment on column public.analyses.preuve_purgee_le is
  'Date d''effacement de la preuve elle-même (5 ans après réception).';

-- Index de travail des deux passes de purge.
create index if not exists analyses_api_sans_empreinte_idx
  on public.analyses (created_at) where via_api and texte_sha256 is null;

-- ---------------------------------------------------------------------------
-- purger_textes_api — DEUX PASSES, et l'ordre EST la garantie.
--
-- Passe 1 : poser l'empreinte, dès que la ligne existe, sans attendre les
--           30 jours.
-- Passe 2 : effacer le texte, UNIQUEMENT sur les lignes qui portent déjà leur
--           empreinte.
--
-- Écrites dans cet ordre, les deux passes rendent structurellement impossible
-- d'effacer un texte dont l'empreinte n'a pas été conservée. Un effacement
-- d'abord, une empreinte ensuite, aurait perdu la preuve pour toujours.
-- ---------------------------------------------------------------------------
create or replace function public.purger_textes_api()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_n integer;
  v_empreintes integer;
begin
  -- PASSE 1 — empreinte avant toute suppression.
  with marquees as (
    update public.analyses
       set texte_sha256 = encode(extensions.digest(input_text, 'sha256'), 'hex')
     where via_api
       and texte_sha256 is null
       and input_text is not null
       and input_text not like '[texte effacé%'
    returning 1
  )
  select count(*)::integer into v_empreintes from marquees;

  -- PASSE 2 — effacement, réservé aux lignes déjà munies de leur empreinte.
  with purgees as (
    update public.analyses
       set input_text = '[texte effacé — conservation 30 jours pour les analyses reçues par API]',
           texte_purge_le = now()
     where via_api
       and created_at < now() - interval '30 days'
       and input_text not like '[texte effacé%'
       and texte_sha256 is not null
    returning 1
  )
  select count(*)::integer into v_n from purgees;

  if v_n > 0 or v_empreintes > 0 then
    insert into public.events (name, props_json)
    values ('api_textes_purges', jsonb_build_object(
      'analyses', v_n, 'empreintes_posees', v_empreintes));
  end if;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- purger_preuves_api — l'horizon de cinq ans.
--
-- Passé ce délai, la preuve elle-même s'en va : le résultat ET l'empreinte.
-- Conserver au-delà de la durée qu'on a annoncée serait une rétention sans
-- base légale. Le comptage (date, clé, nombre d'appels) reste, lui, dans
-- `api_appels` : c'est une pièce comptable, pas une donnée d'analyse.
-- ---------------------------------------------------------------------------
create or replace function public.purger_preuves_api()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  with purgees as (
    update public.analyses
       set result_json = jsonb_build_object(
             'statut_analyse', 'preuve_expiree',
             'avertissement', 'Résultat effacé : la durée de conservation de cinq ans est écoulée.'),
           texte_sha256 = null,
           preuve_purgee_le = now()
     where via_api
       and created_at < now() - interval '5 years'
       and preuve_purgee_le is null
    returning 1
  )
  select count(*)::integer into v_n from purgees;
  if v_n > 0 then
    insert into public.events (name, props_json)
    values ('api_preuves_purgees', jsonb_build_object('analyses', v_n));
  end if;
  return v_n;
end;
$$;

revoke all on function public.purger_textes_api() from public, anon, authenticated;
revoke all on function public.purger_preuves_api() from public, anon, authenticated;
grant execute on function public.purger_textes_api() to service_role;
grant execute on function public.purger_preuves_api() to service_role;

-- ---------------------------------------------------------------------------
-- 2. PART D'UN CLIENT D'API DANS UN SEGMENT.
--
-- `marche_agregats` ne disait pas D'OÙ venait un effectif : impossible, donc,
-- de vérifier qu'aucun client ne pèse trop lourd. On ajoute la ventilation —
-- et seulement elle : `parts_api` ne porte QUE les contributions reçues par
-- API, jamais les relevés publics de l'extension, qui n'ont pas de client.
--
-- Une carte {client_id → effectif} plutôt que des colonnes de clé en plus :
-- la clé primaire du segment ne change pas, et la carte reste vide (le cas
-- normal, puisque le partage des prix est éteint par défaut).
-- ---------------------------------------------------------------------------
alter table public.marche_agregats
  add column if not exists parts_api jsonb not null default '{}'::jsonb;

comment on column public.marche_agregats.parts_api is
  'Ventilation {client_api → effectif} des SEULES contributions reçues par '
  'API. Sert le verrou des 20 % : un segment n''est publié que si aucun '
  'client ne pèse plus d''un cinquième (CUA art. 6.3).';

-- Le seuil, en un seul endroit côté base. Le miroir TS est `PART_API_MAX`
-- dans `_shared/marche.ts`, et le test vérifie que les deux concordent.
create or replace function public.part_api_max()
returns numeric
language sql
immutable
as $$ select 0.20::numeric $$;

-- ---------------------------------------------------------------------------
-- agreger_marche — gagne l'attribution de la contribution.
--
-- Signature remplacée (et non surchargée) : laisser vivre la version à un
-- seul argument rouvrirait un chemin d'écriture SANS attribution, donc une
-- façon de faire entrer des prix d'API dans un segment sans qu'ils y soient
-- comptés. Un verrou qu'on peut contourner par l'ancienne porte n'est pas un
-- verrou.
-- ---------------------------------------------------------------------------
drop function if exists public.agreger_marche(jsonb);

create function public.agreger_marche(p_lignes jsonb, p_client_id text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_n integer := 0;
  v_boite text;
  v_eff integer;
  v_parts jsonb;
begin
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) > 200 then
    raise exception 'lot invalide';
  end if;
  -- Un identifiant de client inutilisable fait ÉCHOUER le lot, il ne le fait
  -- pas basculer en « public » : sans quoi une erreur d'appel blanchirait des
  -- prix d'API en prix publics, exactement ce que le verrou doit empêcher.
  if p_client_id is not null and p_client_id !~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'identifiant de client invalide';
  end if;

  for l in select * from jsonb_array_elements(p_lignes) loop
    if coalesce(l->>'marque_norm', '') = '' or coalesce(l->>'modele_norm', '') = ''
       or coalesce(l->>'mois', '') !~ '^\d{4}-\d{2}$'
       or coalesce((l->>'prix_tranche')::integer, -1) < 0 then
      continue;
    end if;
    v_boite := coalesce(l->>'boite', '');
    if v_boite not in ('', 'manuelle', 'automatique') then v_boite := ''; end if;
    -- Plafond par ligne : une contribution ne peut pas peser arbitrairement
    -- lourd dans un segment, même si l'appelant annonce un gros effectif.
    v_eff := least(25, greatest(1, coalesce((l->>'n')::integer, 1)));
    v_parts := case
      when p_client_id is null then '{}'::jsonb
      else jsonb_build_object(p_client_id, v_eff)
    end;

    insert into public.marche_agregats
      (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
       annee, km_tranche, region, mois, prix_tranche, effectif, parts_api)
    values (
      left(l->>'marque_norm', 60),
      left(l->>'modele_norm', 60),
      left(coalesce(l->>'generation_norm', ''), 20),
      left(coalesce(l->>'techno', ''), 20),
      left(coalesce(l->>'cyl', ''), 5),
      v_boite,
      coalesce((l->>'annee')::integer, 0),
      coalesce((l->>'km_tranche')::integer, -1),
      left(coalesce(l->>'region', ''), 40),
      l->>'mois',
      least(1000000, greatest(0, coalesce((l->>'prix_tranche')::integer, 0))),
      v_eff,
      v_parts
    )
    on conflict (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
                 annee, km_tranche, region, mois, prix_tranche)
    do update set
      effectif = marche_agregats.effectif + excluded.effectif,
      parts_api = case
        when p_client_id is null then marche_agregats.parts_api
        else jsonb_set(
          marche_agregats.parts_api,
          array[p_client_id],
          to_jsonb(
            coalesce((marche_agregats.parts_api->>p_client_id)::integer, 0)
            + excluded.effectif
          ),
          true)
      end,
      maj = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.agreger_marche(jsonb, text) from public, anon, authenticated;
grant execute on function public.agreger_marche(jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- get_prix_segments — le verrou des 20 % s'applique AUSSI ici.
--
-- Les pages /moteur publient par modèle, sans cibler un véhicule : c'est la
-- publication la plus large, donc celle où la domination d'un client serait
-- la plus visible. Le seuil de 15 et celui des 20 % sont appliqués côté base,
-- pour qu'aucun histogramme non publiable ne sorte, quel que soit l'appelant.
-- ---------------------------------------------------------------------------
create or replace function public.get_prix_segments(p_segments jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_seuil constant integer := 15;
  v_mois text[];
  v_out jsonb := '[]'::jsonb;
  s jsonb;
  v_marque text;
  v_modele text;
  v_total integer;
  v_part_api integer;
  v_lignes jsonb;
begin
  if jsonb_typeof(p_segments) <> 'array' or jsonb_array_length(p_segments) > 30 then
    return v_out;
  end if;

  -- Fenêtre de 3 mois glissants, mois courant inclus (= MOIS_FENETRE côté TS).
  select array_agg(to_char((date_trunc('month', now()) - (n || ' month')::interval), 'YYYY-MM'))
    into v_mois
  from generate_series(0, 2) as n;

  for s in select * from jsonb_array_elements(p_segments) loop
    v_marque := left(lower(btrim(coalesce(s->>'marque', ''))), 60);
    v_modele := left(lower(btrim(coalesce(s->>'modele', ''))), 60);
    if v_marque = '' or v_modele = '' then
      continue;
    end if;

    select coalesce(sum(effectif), 0) into v_total
    from public.marche_agregats
    where marque_norm = v_marque and modele_norm = v_modele and mois = any(v_mois);

    -- Poids du client d'API le PLUS lourd sur exactement cette population.
    select coalesce(max(somme), 0) into v_part_api
    from (
      -- `#>> '{}'` extrait le scalaire en texte avant le cast : forme valable
      -- sur toutes les versions, là où un cast jsonb→integer direct dépend de
      -- la version du serveur. Non vérifiable en local, donc écrit prudent.
      select sum((kv.value #>> '{}')::integer) as somme
      from public.marche_agregats a
           cross join lateral jsonb_each(a.parts_api) as kv
      where a.marque_norm = v_marque and a.modele_norm = v_modele
        and a.mois = any(v_mois)
      group by kv.key
    ) t;

    if v_total < v_seuil
       or (v_total > 0 and v_part_api::numeric / v_total::numeric > public.part_api_max()) then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'marque', v_marque, 'modele', v_modele, 'n', v_total, 'lignes', '[]'::jsonb,
        'part_api_excessive', (v_total >= v_seuil)));
      continue;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'prix_tranche', prix_tranche, 'effectif', n,
             -- Les dimensions sont repliées : la page /moteur ne cible pas un
             -- véhicule précis, elle situe le MODÈLE. Les champs attendus par
             -- le module partagé sont donc neutres.
             'techno', '', 'cyl', '', 'annee', 0, 'km_tranche', -1)
           order by prix_tranche), '[]'::jsonb)
      into v_lignes
    from (
      select prix_tranche, sum(effectif)::integer as n
      from public.marche_agregats
      where marque_norm = v_marque and modele_norm = v_modele and mois = any(v_mois)
      group by prix_tranche
    ) h;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'marque', v_marque, 'modele', v_modele, 'n', v_total, 'lignes', v_lignes,
      'part_api_excessive', false));
  end loop;

  return v_out;
end;
$$;

grant execute on function public.get_prix_segments(jsonb) to anon, authenticated;
