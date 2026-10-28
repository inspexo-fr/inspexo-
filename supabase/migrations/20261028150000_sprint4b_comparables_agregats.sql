-- SPRINT 4B — Comparables de prix : AGRÉGATS UNIQUEMENT (migration additive).
-- La base ne conserve plus AUCUNE ligne d'annonce : chaque comparable est fondu
-- à l'écriture dans un histogramme de prix par segment. Les histogrammes se
-- fusionnent par somme → médiane / P25 / P75 / effectif restent calculables sur
-- toute combinaison de segments (±2 ans, ±30 % km, < 3 mois). Les lignes brutes
-- existantes sont fondues puis SUPPRIMÉES. Aucune donnée d'annonce (titre, URL,
-- lien vers l'analyse) n'est conservée ni republiée.

create table if not exists public.comparables_agregats (
  marque_norm text not null,
  modele_norm text not null,
  techno text not null default '',      -- jeton motorisation ('' = inconnu)
  cyl text not null default '',          -- cylindrée « 1.2 » ('' = inconnue)
  annee integer not null default 0,      -- 0 = inconnue
  km_tranche integer not null default -1, -- floor(km / 20 000), -1 = inconnu
  mois text not null,                    -- 'YYYY-MM' (fenêtre < 3 mois en lecture)
  prix_tranche integer not null,         -- floor(prix / 250) * 250
  effectif integer not null default 0,
  maj timestamptz not null default now(),
  primary key (marque_norm, modele_norm, techno, cyl, annee, km_tranche, mois, prix_tranche)
);

alter table public.comparables_agregats enable row level security;
revoke all on public.comparables_agregats from anon, authenticated;

-- Incrément d'agrégats par lot (appelée en service role par la fonction score).
create or replace function public.agreger_comparables(p_lignes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l jsonb;
begin
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) > 200 then
    raise exception 'lot invalide';
  end if;
  for l in select * from jsonb_array_elements(p_lignes) loop
    if coalesce(l->>'marque_norm', '') = '' or coalesce(l->>'modele_norm', '') = ''
       or l->>'mois' !~ '^\d{4}-\d{2}$' then
      continue;
    end if;
    insert into public.comparables_agregats
      (marque_norm, modele_norm, techno, cyl, annee, km_tranche, mois, prix_tranche, effectif)
    values (
      left(l->>'marque_norm', 60),
      left(l->>'modele_norm', 60),
      left(coalesce(l->>'techno', ''), 20),
      left(coalesce(l->>'cyl', ''), 5),
      coalesce((l->>'annee')::integer, 0),
      coalesce((l->>'km_tranche')::integer, -1),
      l->>'mois',
      greatest(0, coalesce((l->>'prix_tranche')::integer, 0)),
      least(50, greatest(1, coalesce((l->>'n')::integer, 1)))
    )
    on conflict (marque_norm, modele_norm, techno, cyl, annee, km_tranche, mois, prix_tranche)
    do update set effectif = comparables_agregats.effectif + excluded.effectif, maj = now();
  end loop;
end;
$$;

revoke all on function public.agreger_comparables(jsonb) from public, anon, authenticated;
grant execute on function public.agreger_comparables(jsonb) to service_role;

-- ---- Fonte des lignes brutes existantes, puis PURGE ----
insert into public.comparables_agregats
  (marque_norm, modele_norm, techno, cyl, annee, km_tranche, mois, prix_tranche, effectif)
select
  btrim(regexp_replace(lower(extensions.unaccent(marque)), '\s+', ' ', 'g')),
  btrim(regexp_replace(lower(extensions.unaccent(modele)), '\s+', ' ', 'g')),
  coalesce(substring(lower(extensions.unaccent(coalesce(motorisation, titre, '')))
    from 'puretech|bluehdi|hdi|tdi|tsi|tfsi|tce|dci|crdi|vti|thp|hybride|electrique'), ''),
  coalesce(substring(coalesce(motorisation, titre, '') from '\d\.\d'), ''),
  coalesce(annee, 0),
  case when km is null then -1 else floor(km / 20000)::integer end,
  to_char(created_at, 'YYYY-MM'),
  (floor(prix / 250) * 250)::integer,
  count(*)::integer
from public.comparables_prix
where prix between 200 and 1000000
group by 1, 2, 3, 4, 5, 6, 7, 8
on conflict (marque_norm, modele_norm, techno, cyl, annee, km_tranche, mois, prix_tranche)
do update set effectif = comparables_agregats.effectif + excluded.effectif, maj = now();

-- Plus aucune ligne brute : la table est vidée et n'est plus alimentée
-- (la fonction score écrit désormais directement dans les agrégats).
delete from public.comparables_prix;
