-- SPRINT 17.2 — Aperçus de partage : une image par dossier, générée UNE FOIS.
--
-- ⚠️ POURQUOI UN FICHIER ET NON UNE GÉNÉRATION À LA VOLÉE.
-- La première tentative rendait l'image à chaque requête depuis une fonction
-- Vercel. Quatre corrections successives (runtime edge refusé,
-- ERR_REQUIRE_ESM, signature Node, traçage des .wasm) n'ont jamais abouti, et
-- pendant ce temps `og:image` pointait sur une URL en 500 : **les aperçus de
-- partage étaient cassés en production**. Une image calculée une fois et
-- déposée dans un fichier ne peut pas tomber au moment précis où quelqu'un
-- partage un lien.
--
-- Le bucket est PUBLIC, et c'est nécessaire : un robot d'aperçu (WhatsApp,
-- Facebook) ne porte aucun jeton. Il ne contient donc QUE ce que la page
-- publique affiche déjà — marque, modèle, année, tampon, score.

insert into storage.buckets (id, name, public)
values ('apercus', 'apercus', true)
on conflict (id) do nothing;

-- Écriture réservée au service role : aucune policy n'est créée, donc ni anon
-- ni authenticated ne peuvent déposer. La lecture passe par le caractère
-- public du bucket, pas par une policy.
-- ⚠️ Ne PAS écrire de policy qui interrogerait `public.analyses` : cette table
-- a la RLS active et zéro policy, donc une telle policy serait TOUJOURS
-- fausse — la leçon du bucket `rapports` au sprint 8, qui rendait invisibles
-- à 100 % et en silence les photos d'un rapport payé 179 €.

-- Date de dépôt de l'aperçu. Sert au script de génération pour savoir ce qui
-- reste à faire ; l'affichage, lui, vérifie l'existence du FICHIER.
alter table public.analyses
  add column if not exists apercu_le timestamptz;

-- Analyses RÉELLES dont l'aperçu reste à produire, les plus récentes d'abord.
-- Les analyses d'éval en sont exclues : personne ne partage un dossier de test.
create or replace function public.analyses_sans_apercu(p_limite integer default 20)
returns table (id uuid, created_at timestamptz, verdict text, score integer)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.created_at, a.verdict, a.score
  from public.analyses a
  where a.is_eval = false
    and a.apercu_le is null
    and a.result_json is not null
    -- ⚠️ Les deux seules valeurs sont 'en_cours' et 'terminee'. Voir plus bas :
    -- écrire « = 'fini' » rend la condition TOUJOURS fausse, en silence.
    and coalesce(a.result_json->>'statut_analyse', 'terminee') <> 'en_cours'
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limite, 20), 200));
$$;

revoke all on function public.analyses_sans_apercu(integer) from public, anon, authenticated;
grant execute on function public.analyses_sans_apercu(integer) to service_role;

create or replace function public.apercu_depose(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.analyses set apercu_le = now() where id = p_id;
$$;

revoke all on function public.apercu_depose(uuid) from public, anon, authenticated;
grant execute on function public.apercu_depose(uuid) to service_role;


-- ---------------------------------------------------------------------------
-- ⚠️ CORRECTIF : `analyses_a_verifier` ne rendait JAMAIS rien
-- ---------------------------------------------------------------------------
-- Posée au sprint 15, elle filtrait sur
-- `coalesce(result_json->>'statut_analyse', 'fini') = 'fini'`. Or les deux
-- seules valeurs écrites par `score` sont **'en_cours'** et **'terminee'** :
-- la condition était TOUJOURS fausse, et la liste « à vérifier » de l'onglet
-- Fiabilité restait vide — sans erreur, sans message, sans rien.
--
-- Personne ne l'a vu parce qu'aucune campagne de vérification n'était encore
-- passée par cet écran. Un filtre qui ne rend rien ressemble exactement à
-- « il n'y a rien à faire ».
--
-- L'idiome correct existait déjà dans le projet depuis le sprint 3
-- (`get_analysis_etape`) : comparer à 'en_cours', jamais à la valeur de
-- succès. On n'énumère pas le succès, on exclut l'échec.
--
-- Redéfinie depuis sa dernière définition (20261116120000), ce seul filtre
-- changé. Mêmes colonnes rendues, mêmes droits.
create or replace function public.analyses_a_verifier(p_limite integer default 10)
returns table (id uuid, created_at timestamptz, marque text, modele text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.created_at,
         a.result_json->'vehicule'->>'marque',
         a.result_json->'vehicule'->>'modele'
  from public.analyses a
  where a.is_eval = false
    and a.result_json is not null
    and coalesce(a.result_json->>'statut_analyse', 'terminee') <> 'en_cours'
    and not exists (select 1 from public.verifications v where v.analysis_id = a.id)
  order by a.created_at desc
  limit greatest(1, least(coalesce(p_limite, 10), 100));
$$;

revoke all on function public.analyses_a_verifier(integer) from public, anon, authenticated;
grant execute on function public.analyses_a_verifier(integer) to service_role;
