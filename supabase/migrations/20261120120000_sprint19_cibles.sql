-- SPRINT 19.1 — Alertes rentables : cibles du revendeur et profil mémorisé.
--
-- ⚠️ CE QUI EST STOCKÉ, ET CE QUI NE L'EST PAS. Un revendeur veut retrouver,
-- d'une session à l'autre, les modèles sur lesquels il a assez de relevés.
-- On conserve donc, PAR UTILISATEUR et PAR SEGMENT, un simple HISTOGRAMME de
-- prix : aucune annonce, aucun titre, aucune URL, aucun lien vers une
-- analyse. Un histogramme se fusionne par somme — relever quatre annonces
-- aujourd'hui et trois demain donne exactement le même segment que sept d'un
-- coup — et il ne permet de reconstituer aucune annonce particulière.
--
-- ⚠️ ET CE N'EST PAS `marche_agregats`. Celui-là est le relevé COLLECTIF,
-- anonyme et sans attribution, qui alimente les fourchettes publiques. Celui-ci
-- est le carnet PRIVÉ d'un utilisateur, réservé au Pass, qui ne sort jamais de
-- son compte et ne pèse sur aucun prix affiché à quiconque. Les mélanger
-- reviendrait à attribuer le relevé public à des personnes.

-- ---------------------------------------------------------------------------
-- 1. LES CIBLES D'UN UTILISATEUR
-- ---------------------------------------------------------------------------
create table if not exists public.revendeur_cibles (
  user_id uuid not null references auth.users (id) on delete cascade,
  marque text not null,
  modele text not null,
  energie text not null,
  -- Histogramme {tranche_de_250_euros: effectif}. Jamais de prix individuel.
  prix_tranches jsonb not null default '{}'::jsonb,
  effectif integer not null default 0,
  -- ⚠️ SOMME et COMPTE, pas une médiane : une médiane ne se fusionne pas
  -- d un lot à l autre, une somme si. On en rend la MOYENNE.
  annee_somme integer not null default 0,
  annee_n integer not null default 0,
  km_somme bigint not null default 0,
  km_n integer not null default 0,
  maj_le timestamptz not null default now(),
  primary key (user_id, marque, modele, energie)
);

alter table public.revendeur_cibles enable row level security;
revoke all on public.revendeur_cibles from anon, authenticated;

comment on table public.revendeur_cibles is
  'Carnet PRIVÉ du revendeur : histogramme de prix par segment, par compte. '
  'Aucune annonce, aucune URL, aucun lien vers une analyse. Sans rapport avec '
  'marche_agregats, qui est le relevé collectif et anonyme.';

-- ---------------------------------------------------------------------------
-- 2. ALIMENTATION — depuis une analyse, et RIEN d'autre
-- ---------------------------------------------------------------------------
-- ⚠️ L'APPELANT NE FOURNIT QU'UN IDENTIFIANT D'ANALYSE. Le segment et les
-- prix sont relus dans `result_json.revendeur`, écrit par le serveur : le
-- client ne décide donc ni du segment où ses prix atterrissent, ni des prix
-- eux-mêmes. C'est la règle posée au sprint 9 pour le relevé collectif, et
-- elle vaut ici — même si le carnet est privé, un segment faux rendrait le
-- conseil faux.
create or replace function public.revendeur_cible_maj(p_analysis_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rev jsonb;
  v_marque text;
  v_modele text;
  v_energie text;
  v_prix numeric[];
  v_histo jsonb := '{}'::jsonb;
  v_n integer := 0;
  v_annee_somme integer;
  v_annee_n integer;
  v_km_somme integer;
  v_km_n integer;
begin
  if v_uid is null then
    raise exception 'connexion requise';
  end if;
  -- Réservé au Pass : c'est une fonction de l'offre payante.
  if not public._pass_actif(v_uid) then
    raise exception 'pass requis';
  end if;

  select a.result_json -> 'revendeur' into v_rev
  from public.analyses a
  where a.id = p_analysis_id
    -- Une analyse d'éval n'entre jamais dans le carnet d'un utilisateur.
    and coalesce(a.is_eval, false) = false;
  if v_rev is null or jsonb_typeof(v_rev) <> 'object' then
    return jsonb_build_object('enregistre', false, 'motif', 'analyse_sans_segment');
  end if;

  v_marque := nullif(btrim(coalesce(v_rev -> 'segment' ->> 'marque', '')), '');
  v_modele := nullif(btrim(coalesce(v_rev -> 'segment' ->> 'modele', '')), '');
  v_energie := nullif(btrim(coalesce(v_rev -> 'segment' ->> 'energie', '')), '');
  if v_marque is null or v_modele is null or v_energie is null then
    return jsonb_build_object('enregistre', false, 'motif', 'segment_incomplet');
  end if;

  -- Les prix RETENUS par le filtre serveur (même modèle, même énergie,
  -- ±2 ans, ±40 000 km) — pas les prix reçus.
  select array_agg((e ->> 'prix')::numeric)
    into v_prix
  from jsonb_array_elements(coalesce(v_rev -> 'retenus', '[]'::jsonb)) e
  where (e ->> 'prix') ~ '^[0-9]+(\.[0-9]+)?$'
    and (e ->> 'prix')::numeric between 200 and 1000000;

  if v_prix is null or array_length(v_prix, 1) is null then
    return jsonb_build_object('enregistre', false, 'motif', 'aucun_prix_retenu');
  end if;

  -- Histogramme par tranches de 250 €, miroir de `histogrammeDePrix` côté TS.
  select coalesce(jsonb_object_agg(t, n), '{}'::jsonb), coalesce(sum(n)::int, 0)
    into v_histo, v_n
  from (
    select (floor(p / 250) * 250)::int::text as t, count(*)::int as n
    from unnest(v_prix) p
    group by 1
  ) h;

  -- ⚠️ SOMME ET COMPTE, PAS UNE MÉDIANE. Première version : on stockait la
  -- médiane du LOT, et chaque nouveau versement l'écrasait — le carnet
  -- décrivait donc le dernier relevé, pas l'ensemble. Une médiane ne se
  -- fusionne pas ; une somme, si. On conserve donc la somme et le compte, et
  -- on en rend la MOYENNE, qui est exactement calculable d'un lot à l'autre.
  select coalesce(sum((e ->> 'annee')::numeric), 0)::int, count(*)::int
    into v_annee_somme, v_annee_n
  from jsonb_array_elements(coalesce(v_rev -> 'retenus', '[]'::jsonb)) e
  where (e ->> 'annee') ~ '^[0-9]+$';

  select coalesce(sum((e ->> 'km')::numeric), 0)::int, count(*)::int
    into v_km_somme, v_km_n
  from jsonb_array_elements(coalesce(v_rev -> 'retenus', '[]'::jsonb)) e
  where (e ->> 'km') ~ '^[0-9]+$';

  insert into public.revendeur_cibles as c
    (user_id, marque, modele, energie, prix_tranches, effectif,
     annee_somme, annee_n, km_somme, km_n, maj_le)
  values (v_uid, v_marque, v_modele, v_energie, v_histo, v_n,
          v_annee_somme, v_annee_n, v_km_somme, v_km_n, now())
  on conflict (user_id, marque, modele, energie) do update
    set prix_tranches = (
          -- Fusion par SOMME, miroir de `fusionnerHistogrammes` côté TS.
          select coalesce(jsonb_object_agg(cle, total), '{}'::jsonb)
          from (
            select cle, sum(valeur) as total
            from (
              select key as cle, value::text::int as valeur from jsonb_each(c.prix_tranches)
              union all
              select key as cle, value::text::int as valeur from jsonb_each(excluded.prix_tranches)
            ) u
            group by cle
          ) f
        ),
        effectif = c.effectif + excluded.effectif,
        annee_somme = c.annee_somme + excluded.annee_somme,
        annee_n = c.annee_n + excluded.annee_n,
        km_somme = c.km_somme + excluded.km_somme,
        km_n = c.km_n + excluded.km_n,
        maj_le = now()
  -- ⚠️ RETURNING voit la ligne APRÈS l insertion ou la mise à jour :
  -- `c.effectif + v_n` comptait donc le lot deux fois. L essai local a rendu
  -- 8 là où il y avait 4 relevés.
  returning jsonb_build_object('enregistre', true, 'effectif', c.effectif) into v_rev;

  return coalesce(v_rev, jsonb_build_object('enregistre', true, 'effectif', v_n));
end;
$$;

revoke all on function public.revendeur_cible_maj(uuid) from public, anon;
grant execute on function public.revendeur_cible_maj(uuid) to authenticated;

comment on function public.revendeur_cible_maj(uuid) is
  'Verse les prix RETENUS d''une analyse dans le carnet privé du revendeur. '
  'L''appelant ne fournit qu''un identifiant : le segment et les prix sont '
  'relus dans result_json, écrit par le serveur.';

-- ---------------------------------------------------------------------------
-- 3. LECTURE — les quantiles sont calculés AILLEURS
-- ---------------------------------------------------------------------------
-- ⚠️ Cette fonction rend l'histogramme REPLIÉ, jamais les quantiles. Il
-- n'existe qu'une implémentation des quantiles dans le projet
-- (`quantileHisto`, _shared/marche.ts) : en écrire une en SQL ferait diverger
-- deux chiffres qui doivent être le même. Même règle qu'au sprint 9 pour
-- `get_prix_segments`.
create or replace function public.revendeur_cibles_lire()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'connexion requise';
  end if;
  if not public._pass_actif(v_uid) then
    raise exception 'pass requis';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'marque', marque, 'modele', modele, 'energie', energie,
             'prix_tranches', prix_tranches, 'effectif', effectif,
             'annee_moyenne', case when annee_n > 0 then round(annee_somme::numeric / annee_n)::int end,
             'km_moyen', case when km_n > 0 then round(km_somme::numeric / km_n)::int end,
             'maj', to_char(maj_le, 'YYYY-MM-DD'))
           order by effectif desc)
    from public.revendeur_cibles
    where user_id = v_uid
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.revendeur_cibles_lire() from public, anon;
grant execute on function public.revendeur_cibles_lire() to authenticated;

-- Retirer une cible : son carnet lui appartient.
create or replace function public.revendeur_cible_retirer(
  p_marque text, p_modele text, p_energie text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'connexion requise';
  end if;
  delete from public.revendeur_cibles
   where user_id = auth.uid()
     and marque = p_marque and modele = p_modele and energie = p_energie;
end;
$$;

revoke all on function public.revendeur_cible_retirer(text, text, text) from public, anon;
grant execute on function public.revendeur_cible_retirer(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. PROFIL REVENDEUR — la ville de revente rejoint la région
-- ---------------------------------------------------------------------------
-- ⚠️ La ville de revente sert UNIQUEMENT à dire si la ZFE de cette ville
-- interdit le véhicule. Elle n'est ni une adresse, ni une localisation : c'est
-- le choix commercial de l'utilisateur, qu'il déclare lui-même.
alter table public.preferences_revendeur
  add column if not exists ville_revente text;

-- ⚠️ DROP puis CREATE, et pas une surcharge. Ajouter un paramètre à valeur
-- par défaut créerait une SECONDE fonction, et l'appel à deux arguments
-- resterait résoluble : une écriture pourrait alors passer sans ville, en
-- silence. Même raisonnement qu'au sprint 12 pour `agreger_marche` et au
-- sprint 15 pour `submit_lead_pro`.
drop function if exists public.preferences_revendeur_ecrire(text, jsonb);

create or replace function public.preferences_revendeur_ecrire(
  p_region text default null,
  p_parametres jsonb default null,
  p_ville_revente text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'connexion requise';
  end if;
  insert into public.preferences_revendeur (user_id, region, parametres, ville_revente, maj_le)
  values (
    auth.uid(),
    left(nullif(btrim(coalesce(p_region, '')), ''), 60),
    coalesce(p_parametres, '{}'::jsonb),
    left(nullif(btrim(coalesce(p_ville_revente, '')), ''), 60),
    now()
  )
  on conflict (user_id) do update
    set region = coalesce(excluded.region, public.preferences_revendeur.region),
        parametres = case when p_parametres is null
                          then public.preferences_revendeur.parametres
                          else excluded.parametres end,
        ville_revente = coalesce(excluded.ville_revente, public.preferences_revendeur.ville_revente),
        maj_le = now();
end;
$$;

revoke all on function public.preferences_revendeur_ecrire(text, jsonb, text) from public, anon;
grant execute on function public.preferences_revendeur_ecrire(text, jsonb, text) to authenticated;

create or replace function public.preferences_revendeur_lire()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
              'region', region,
              'ville_revente', ville_revente,
              'parametres', parametres)
       from public.preferences_revendeur where user_id = auth.uid()),
    '{}'::jsonb);
$$;

revoke all on function public.preferences_revendeur_lire() from public, anon;
grant execute on function public.preferences_revendeur_lire() to authenticated;
