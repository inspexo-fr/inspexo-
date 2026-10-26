-- SPRINT 2 stabilité — cache d'analyse par empreinte d'annonce.
-- Migration ADDITIVE : deux colonnes + deux index sur `analyses`.
-- Objectif : la même annonce (texte normalisé + URL) rend le MÊME verdict
-- pendant 7 jours ; une annonce modifiée (prix, km, texte) est réanalysée et
-- l'ancien score est rappelé à l'écran.

alter table public.analyses
  add column if not exists input_hash text,
  add column if not exists source_url text;

create index if not exists analyses_input_hash_idx
  on public.analyses (input_hash, created_at desc);

create index if not exists analyses_source_url_idx
  on public.analyses (source_url, created_at desc)
  where source_url is not null;
