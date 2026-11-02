-- ===========================================================================
-- SPRINT 9 — PRIX DE MARCHÉ : agrégats uniquement (migration ADDITIVE).
--
-- POURQUOI UNE NOUVELLE TABLE PLUTÔT QUE `comparables_agregats` :
-- la migration 20261028150000 (sprint 4B) avait créé `comparables_agregats`,
-- fondu les lignes brutes de `comparables_prix` puis vidé cette dernière, en
-- annonçant que la fonction `score` écrirait désormais dans les agrégats. Ce
-- changement de code est resté sur la branche `sprint4b`, JAMAIS mergée :
-- depuis, `score` a continué d'insérer des LIGNES BRUTES d'annonces dans
-- `comparables_prix` (avec `analysis_id`, donc rattachables à une analyse) et
-- `comparables_agregats` est une table morte. Cette migration ferme l'écart.
--
-- `marche_agregats` porte les dimensions du sprint 9 (génération, boîte,
-- région) ; la clé primaire de `comparables_agregats` ne peut pas les
-- accueillir sans être refaite, ce qui violerait la règle « migrations
-- strictement additives, jamais modifier une table existante ».
--
-- Ce que la base conserve : un HISTOGRAMME de prix par segment. Les
-- histogrammes se fusionnent par simple somme, ce qui permet de recalculer
-- médiane / P25 / P75 / effectif sur n'importe quelle combinaison — chose
-- impossible avec des quantiles stockés. Aucun titre, aucune URL, aucune date
-- plus fine que le mois, aucun lien vers une analyse, aucune ligne d'annonce.
-- ===========================================================================

create table if not exists public.marche_agregats (
  marque_norm text not null,            -- écriture CANONIQUE (cf. brandAliases.ts)
  modele_norm text not null,
  generation_norm text not null default '', -- '' = inconnue (jamais devinée)
  techno text not null default '',      -- jeton motorisation ('' = inconnu)
  cyl text not null default '',          -- cylindrée « 1.2 » ('' = inconnue)
  boite text not null default '',        -- 'manuelle' | 'automatique' | ''
  annee integer not null default 0,      -- 0 = inconnue
  km_tranche integer not null default -1, -- floor(km / 20 000), -1 = inconnu
  region text not null default '',       -- code de région ('' = inconnue)
  mois text not null,                    -- 'YYYY-MM' (fenêtre 3 mois en lecture)
  prix_tranche integer not null,         -- floor(prix / 250) * 250
  effectif integer not null default 0,
  maj timestamptz not null default now(),
  primary key (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
               annee, km_tranche, region, mois, prix_tranche),
  constraint marche_agregats_boite_chk check (boite in ('', 'manuelle', 'automatique')),
  constraint marche_agregats_mois_chk check (mois ~ '^\d{4}-\d{2}$'),
  constraint marche_agregats_prix_chk check (prix_tranche >= 0 and prix_tranche <= 1000000),
  constraint marche_agregats_effectif_chk check (effectif >= 0)
);

-- Lecture par modèle sur la fenêtre de relevé (les deux seuls accès).
create index if not exists marche_agregats_modele_idx
  on public.marche_agregats (marque_norm, modele_norm, mois);

alter table public.marche_agregats enable row level security;
revoke all on public.marche_agregats from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Incrément d'agrégats par lot. Appelée en service role UNIQUEMENT (fonctions
-- `score` et `marche`). Toute ligne incomplète est ignorée en silence plutôt
-- que de faire échouer le lot : une contribution partielle vaut mieux qu'une
-- contribution perdue.
-- ---------------------------------------------------------------------------
create or replace function public.agreger_marche(p_lignes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_n integer := 0;
  v_boite text;
begin
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) > 200 then
    raise exception 'lot invalide';
  end if;
  for l in select * from jsonb_array_elements(p_lignes) loop
    if coalesce(l->>'marque_norm', '') = '' or coalesce(l->>'modele_norm', '') = ''
       or coalesce(l->>'mois', '') !~ '^\d{4}-\d{2}$'
       or coalesce((l->>'prix_tranche')::integer, -1) < 0 then
      continue;
    end if;
    v_boite := coalesce(l->>'boite', '');
    if v_boite not in ('', 'manuelle', 'automatique') then v_boite := ''; end if;
    insert into public.marche_agregats
      (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
       annee, km_tranche, region, mois, prix_tranche, effectif)
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
      -- Plafond par ligne : une contribution ne peut pas peser arbitrairement
      -- lourd dans un segment, même si l'appelant annonce un gros effectif.
      least(25, greatest(1, coalesce((l->>'n')::integer, 1)))
    )
    on conflict (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
                 annee, km_tranche, region, mois, prix_tranche)
    do update set effectif = marche_agregats.effectif + excluded.effectif, maj = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.agreger_marche(jsonb) from public, anon, authenticated;
grant execute on function public.agreger_marche(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- get_prix_segments : histogrammes de prix pour une liste de couples
-- (marque, modèle). Sert les pages publiques /moteur.
--
-- La fonction ne calcule PAS les quantiles : elle rend l'histogramme replié
-- (toutes dimensions sommées sur la fenêtre de relevé) et le client applique
-- `fourchetteDepuisAgregats` du module partagé. Une seule implémentation des
-- quantiles dans le projet, donc aucune dérive possible entre SQL et TS.
--
-- Le seuil de publication (15, = SEUIL_FOURCHETTE côté TS) est appliqué ICI
-- aussi : sous le seuil, aucun histogramme ne sort de la base.
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

    if v_total < v_seuil then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'marque', v_marque, 'modele', v_modele, 'n', v_total, 'lignes', '[]'::jsonb));
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
      'marque', v_marque, 'modele', v_modele, 'n', v_total, 'lignes', v_lignes));
  end loop;

  return v_out;
end;
$$;

grant execute on function public.get_prix_segments(jsonb) to anon, authenticated;

-- ===========================================================================
-- FONTE DES DONNÉES EXISTANTES, PUIS FERMETURE DÉFINITIVE DES LIGNES BRUTES.
-- ===========================================================================

-- La table `comparables_agregats` (sprint 4B) n'a jamais été réalimentée : son
-- contenu est le backfill unique des lignes brutes d'octobre. On le récupère.
-- `_marque_fold` ci-dessous canonise les marques POUR CETTE FONTE UNIQUEMENT —
-- la table d'alias de référence est `_shared/brandAliases.ts` et c'est elle
-- qui s'applique à toutes les écritures futures. Cette fonction est supprimée
-- en fin de migration : elle ne doit pas devenir une seconde source de vérité.
create or replace function public._marque_fold(m text)
returns text
language sql
immutable
as $$
  select case btrim(lower(coalesce(m, '')))
    when 'vw' then 'volkswagen'
    when 'mercedes-benz' then 'mercedes'
    when 'mercedes benz' then 'mercedes'
    when 'mb' then 'mercedes'
    when 'citroën' then 'citroen'
    when 'ds automobiles' then 'ds'
    when 'opel/vauxhall' then 'opel'
    when 'vauxhall' then 'opel'
    when 'alfa-romeo' then 'alfa romeo'
    when 'alfa' then 'alfa romeo'
    when 'land-rover' then 'land rover'
    when 'landrover' then 'land rover'
    when 'škoda' then 'skoda'
    else btrim(regexp_replace(lower(extensions.unaccent(coalesce(m, ''))), '\s+', ' ', 'g'))
  end;
$$;

insert into public.marche_agregats
  (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
   annee, km_tranche, region, mois, prix_tranche, effectif)
select
  public._marque_fold(marque_norm),
  btrim(regexp_replace(modele_norm, '\s+', ' ', 'g')),
  '', techno, cyl, '',
  annee, km_tranche, '', mois, prix_tranche,
  sum(effectif)::integer
from public.comparables_agregats
where prix_tranche between 0 and 1000000
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
on conflict (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
             annee, km_tranche, region, mois, prix_tranche)
do update set effectif = marche_agregats.effectif + excluded.effectif, maj = now();

-- Lignes brutes accumulées depuis le 28/10 parce que le code de sprint 4B
-- n'avait pas été mergé : fondues ici, puis SUPPRIMÉES.
insert into public.marche_agregats
  (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
   annee, km_tranche, region, mois, prix_tranche, effectif)
select
  public._marque_fold(marque),
  btrim(regexp_replace(lower(extensions.unaccent(modele)), '\s+', ' ', 'g')),
  '',
  coalesce(substring(lower(extensions.unaccent(coalesce(motorisation, titre, '')))
    from 'puretech|bluehdi|hdi|tdi|tsi|tfsi|tce|dci|crdi|vti|thp|hybride|electrique'), ''),
  coalesce(substring(coalesce(motorisation, titre, '') from '\d\.\d'), ''),
  '',
  coalesce(annee, 0),
  case when km is null then -1 else floor(km / 20000)::integer end,
  '',
  to_char(created_at, 'YYYY-MM'),
  (floor(prix / 250) * 250)::integer,
  count(*)::integer
from public.comparables_prix
where prix between 200 and 1000000
  and coalesce(btrim(marque), '') <> '' and coalesce(btrim(modele), '') <> ''
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
on conflict (marque_norm, modele_norm, generation_norm, techno, cyl, boite,
             annee, km_tranche, region, mois, prix_tranche)
do update set effectif = marche_agregats.effectif + excluded.effectif, maj = now();

delete from public.comparables_prix;

drop function if exists public._marque_fold(text);

-- Verrou STRUCTUREL : plus personne n'écrit de ligne brute d'annonce. Si un
-- jour du code tentait de réalimenter cette table, il échouerait bruyamment au
-- lieu de rétablir en silence un stockage que nous nous sommes interdit.
-- SELECT reste ouvert au service role pour pouvoir vérifier qu'elle est vide.
revoke insert, update, truncate on public.comparables_prix from service_role;
revoke insert, update, truncate on public.comparables_agregats from service_role;

comment on table public.comparables_prix is
  'HORS SERVICE depuis le sprint 9 : lignes brutes d''annonces interdites. '
  'Vidée, INSERT révoqué. Les prix vivent en agrégats dans marche_agregats.';
comment on table public.comparables_agregats is
  'HORS SERVICE depuis le sprint 9 : remplacée par marche_agregats (qui porte '
  'en plus génération, boîte et région). Contenu fondu, INSERT révoqué.';
comment on table public.marche_agregats is
  'Histogrammes de prix par segment. Aucune ligne d''annonce, aucune URL, '
  'aucun lien vers une analyse ; granularité temporelle : le mois.';
