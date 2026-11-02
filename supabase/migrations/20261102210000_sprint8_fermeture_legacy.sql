-- SPRINT 8 — Fermeture de l'ancien parcours experts.
--
-- Les huit tables du modèle d'avant le pivot (experts, expert_applications,
-- missions, profiles, messages, chat_files, reviews, price_data) sont les
-- SEULES du projet à porter des policies RLS ouvertes au rôle `public`
-- (donc à anon ET authenticated) : elles datent du dashboard, avant que la
-- règle « RLS sans policy + RPC SECURITY DEFINER » ne soit posée au sprint 1.
--
-- Elles sont VIDES (2 lignes de test dans missions, 2 dans profiles, 1 dans
-- chat_files) et plus aucun écran ni aucune fonction edge ne les sert :
-- /dashboard et /expert sont démontés, les onglets admin retirés, et les
-- fonctions create-checkout, stripe-webhook, ai-chat, upload-chat-file,
-- send-email, admin-missions et admin-applications répondent 410.
--
-- CE QUE FAIT CETTE MIGRATION : elle supprime TOUTES leurs policies. Les
-- tables restent en place avec leurs données (sauvegarde hors dépôt :
-- ~/inspexo-backups/tables-heritees-*.sql), mais plus personne n'y accède
-- directement — seul le service role, qui contourne RLS, pourrait encore les
-- lire si on en avait besoin.
--
-- Parmi les accès ainsi fermés, deux méritaient de l'être depuis longtemps :
--   « Anyone can insert applications » (expert_applications) — insertion
--   publique sans aucun contrôle ;
--   « Anyone can view approved experts » (experts) — lecture publique de
--   fiches comportant email et téléphone.

do $$
declare
  v_table text;
  v_policy text;
  v_n integer := 0;
begin
  for v_table, v_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'experts', 'expert_applications', 'missions', 'profiles',
        'messages', 'chat_files', 'reviews', 'price_data'
      )
  loop
    execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    v_n := v_n + 1;
  end loop;
  raise notice 'Policies héritées supprimées : %', v_n;
end $$;

-- RLS reste active : sans policy, anon et authenticated n'ont AUCUN accès.
-- (Une table RLS active sans policy rejette tout, sauf pour le service role.)
--
-- ⚠️ Ces huit tables ne sont créées par AUCUNE migration : elles n'existent
-- que dans la base de production, où elles ont été créées au dashboard avant
-- le sprint 1. Sur un environnement neuf (supabase db reset, Postgres de
-- test), elles sont absentes — d'où le test d'existence, sans lequel cette
-- migration casserait tout rejeu depuis zéro.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'experts', 'expert_applications', 'missions', 'profiles',
    'messages', 'chat_files', 'reviews', 'price_data'
  ] loop
    if to_regclass('public.' || quote_ident(v_table)) is not null then
      execute format('alter table public.%I enable row level security', v_table);
    end if;
  end loop;
end $$;

-- Les buckets du chat IA d'avant le pivot : plus aucun écran n'y accède.
do $$
declare
  v_policy text;
begin
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (qual like '%chat-files%' or with_check like '%chat-files%'
           or qual like '%chat_files%' or with_check like '%chat_files%')
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy);
  end loop;
end $$;
