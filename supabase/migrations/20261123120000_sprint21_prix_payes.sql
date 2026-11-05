-- SPRINT 21 — PRIX PAYÉS DÉCLARÉS, relevé SÉPARÉ des prix demandés.
--
-- Tout ce que le projet publie depuis le sprint 9 porte sur des PRIX DEMANDÉS,
-- et le libellé le dit à chaque fois : « les prix de vente réels sont souvent
-- inférieurs ». Les retours d'issue apportent justement l'autre chiffre — ce
-- que l'acheteur a réellement payé.
--
-- ⚠️ LES DEUX RELEVÉS NE SE MÉLANGENT JAMAIS, et c'est la raison d'être de
-- cette table. Fondre quelques prix payés dans un relevé de prix demandés
-- rendrait le libellé FAUX sans que rien ne le signale, et sur un effectif de
-- six déclarations contre plusieurs dizaines d'annonces, l'effet serait
-- invisible dans le chiffre et bien réel dans le sens.
--
-- ⚠️ AUCUNE MOYENNE, NULLE PART — règle du sprint 19.1. Des histogrammes, qui
-- se fusionnent par somme ET se lisent par quantiles. Aucune colonne de somme
-- ou de moyenne n'existe : le stockage INTERDIT la moyenne, il ne se contente
-- pas de ne pas l'afficher.

-- ---------------------------------------------------------------------------
-- 1. LA TABLE
-- ---------------------------------------------------------------------------
-- Le segment est volontairement PLUS LARGE que celui du relevé agrégé :
-- marque, modèle, énergie — sans génération, sans boîte, sans région. Avec un
-- seuil de six déclarations, ajouter des dimensions reviendrait à n'en publier
-- aucune. L'année et le kilométrage sont donc stockés comme CONTEXTE (deux
-- histogrammes qu'on affiche), pas comme clé.
create table if not exists public.marche_payes (
  marque_norm text not null,
  modele_norm text not null,
  energie text not null,
  -- Histogrammes : {tranche: effectif}. Prix par tranches de 250 €, années
  -- par tranches de 1, kilométrages par tranches de 10 000 — mêmes largeurs
  -- que le carnet de cibles du sprint 19.1, lues par `quantileHisto`.
  prix_histo jsonb not null default '{}'::jsonb,
  annee_histo jsonb not null default '{}'::jsonb,
  km_histo jsonb not null default '{}'::jsonb,
  effectif integer not null default 0,
  maj_le timestamptz not null default now(),
  primary key (marque_norm, modele_norm, energie)
);

alter table public.marche_payes enable row level security;
revoke all on public.marche_payes from anon, authenticated;

comment on table public.marche_payes is
  'Prix PAYÉS déclarés dans les retours d''issue, agrégés en histogrammes. SÉPARÉ de marche_agregats (prix demandés) : les deux ne se mélangent jamais. Aucune colonne de somme ni de moyenne.';

-- ---------------------------------------------------------------------------
-- 2. SEUIL DE PUBLICATION
-- ---------------------------------------------------------------------------
-- Six déclarations par segment. En dessous, rien n'est publié — pas une
-- fourchette large « faute de mieux » : un prix payé calculé sur trois ventes
-- a l'air d'un relevé et n'en est pas un.
create or replace function public.seuil_prix_payes()
returns integer language sql immutable set search_path = public
as $$ select 6 $$;

revoke all on function public.seuil_prix_payes() from public, anon, authenticated;
grant execute on function public.seuil_prix_payes() to service_role;

-- ---------------------------------------------------------------------------
-- 3. CONTRÔLE DE COHÉRENCE
-- ---------------------------------------------------------------------------
-- Une déclaration à moins de 50 % ou à plus de 150 % du prix de l'annonce est
-- ÉCARTÉE. Elle est presque toujours une faute de saisie (un zéro de trop, un
-- prix mensuel de crédit, un montant en milliers) et, sur un effectif de six,
-- une seule valeur aberrante déplacerait la médiane d'une tranche entière.
--
-- ⚠️ PRIX DE L'ANNONCE INCONNU ⇒ ÉCARTÉE AUSSI. Le contrôle est défini par
-- rapport à ce prix : sans lui, il n'y a pas de contrôle, et publier une
-- déclaration qu'on n'a pas pu vérifier serait publier sur rien.
create or replace function public.declaration_prix_acceptable(
  p_prix_paye integer,
  p_prix_annonce integer
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_prix_paye is not null
     and p_prix_paye > 0
     and p_prix_annonce is not null
     and p_prix_annonce > 0
     and p_prix_paye >= (p_prix_annonce * 0.5)
     and p_prix_paye <= (p_prix_annonce * 1.5)
$$;

revoke all on function public.declaration_prix_acceptable(integer, integer) from public, anon, authenticated;
grant execute on function public.declaration_prix_acceptable(integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4. VERSEMENT D'UNE DÉCLARATION
-- ---------------------------------------------------------------------------
-- ⚠️ L'APPELANT NE FOURNIT QU'UN IDENTIFIANT ET UN PRIX. Le segment, le prix
-- de l'annonce, l'année et le kilométrage sont RELUS dans `result_json`, écrit
-- par le serveur — règle du sprint 9, reprise au sprint 19.1 : le client ne
-- décide pas dans quel segment ses prix atterrissent. Un segment faux rendrait
-- le chiffre faux.
create or replace function public.agreger_prix_paye(
  p_analysis_id uuid,
  p_prix_paye integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rev jsonb;
  v_marque text;
  v_modele text;
  v_energie text;
  v_prix_annonce integer;
  v_annee integer;
  v_km integer;
  v_tranche_prix text;
  v_tranche_annee text;
  v_tranche_km text;
begin
  if p_prix_paye is null then
    return jsonb_build_object('verse', false, 'motif', 'aucun_prix');
  end if;

  select a.result_json -> 'revendeur',
         nullif((a.result_json -> 'vehicule' ->> 'prix_affiche'), '')::integer,
         a.annee,
         nullif((a.result_json -> 'vehicule' ->> 'kilometrage'), '')::integer
    into v_rev, v_prix_annonce, v_annee, v_km
  from public.analyses a
  where a.id = p_analysis_id
    -- ⚠️ Une analyse d'éval n'entre JAMAIS dans un relevé publié.
    and coalesce(a.is_eval, false) = false;

  if v_rev is null or jsonb_typeof(v_rev) <> 'object' then
    return jsonb_build_object('verse', false, 'motif', 'analyse_sans_segment');
  end if;

  v_marque := nullif(btrim(coalesce(v_rev -> 'segment' ->> 'marque', '')), '');
  v_modele := nullif(btrim(coalesce(v_rev -> 'segment' ->> 'modele', '')), '');
  v_energie := nullif(btrim(coalesce(v_rev -> 'segment' ->> 'energie', '')), '');
  if v_marque is null or v_modele is null or v_energie is null then
    return jsonb_build_object('verse', false, 'motif', 'segment_incomplet');
  end if;

  if not public.declaration_prix_acceptable(p_prix_paye, v_prix_annonce) then
    -- Tracé, jamais effacé en silence : l'admin doit pouvoir voir combien de
    -- déclarations sont écartées, et pourquoi.
    insert into public.events (name, analysis_id, props_json)
    values ('prix_paye_ecarte', p_analysis_id,
            jsonb_build_object('motif',
              case when v_prix_annonce is null then 'prix_annonce_inconnu' else 'hors_bornes' end));
    return jsonb_build_object('verse', false, 'motif',
      case when v_prix_annonce is null then 'prix_annonce_inconnu' else 'hors_bornes' end);
  end if;

  v_tranche_prix := ((p_prix_paye / 250) * 250)::text;
  v_tranche_annee := coalesce(v_annee::text, 'inconnue');
  v_tranche_km := coalesce(((v_km / 10000) * 10000)::text, 'inconnu');

  insert into public.marche_payes as c
    (marque_norm, modele_norm, energie, prix_histo, annee_histo, km_histo, effectif)
  values
    (lower(v_marque), lower(v_modele), lower(v_energie),
     jsonb_build_object(v_tranche_prix, 1),
     jsonb_build_object(v_tranche_annee, 1),
     jsonb_build_object(v_tranche_km, 1),
     1)
  on conflict (marque_norm, modele_norm, energie) do update
    set prix_histo = public._fusionner_histogrammes(c.prix_histo, jsonb_build_object(v_tranche_prix, 1)),
        annee_histo = public._fusionner_histogrammes(c.annee_histo, jsonb_build_object(v_tranche_annee, 1)),
        km_histo = public._fusionner_histogrammes(c.km_histo, jsonb_build_object(v_tranche_km, 1)),
        effectif = c.effectif + 1,
        maj_le = now();

  -- ⚠️ `c.effectif + 1` et non `effectif + 1` : dans un ON CONFLICT, le nom nu
  -- désignerait la valeur PROPOSÉE (1), pas celle de la ligne existante. Et on
  -- relit la ligne APRÈS coup plutôt que par RETURNING : au sprint 19.1,
  -- `RETURNING` voyait la ligne après insertion et le compte annoncé valait le
  -- double du compte réel.
  return jsonb_build_object(
    'verse', true,
    'effectif', (select effectif from public.marche_payes
                  where marque_norm = lower(v_marque) and modele_norm = lower(v_modele)
                    and energie = lower(v_energie)),
    'seuil', public.seuil_prix_payes()
  );
end;
$$;

revoke all on function public.agreger_prix_paye(uuid, integer) from public, anon, authenticated;
grant execute on function public.agreger_prix_paye(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. LES DEUX CHEMINS DE DÉCLARATION VERSENT
-- ---------------------------------------------------------------------------
-- `submit_retour_signe` (lien signé, sans compte) et `submit_outcome`
-- (formulaire de /dossier, avec compte). Les deux écrivent déjà dans
-- `outcomes` ; elles versent maintenant aussi au relevé.
--
-- ⚠️ Corps repris de leur DERNIÈRE définition, ce seul ajout en plus
-- (règle 0 quinquies). `submit_retour_signe` : 20261105120000.
create or replace function public.submit_retour_signe(
  p_token_hash text,
  p_achete boolean,
  p_prix_paye integer,
  p_points_confirmes text,
  p_commentaire text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.retours%rowtype;
begin
  select * into v from public.retours where token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('ok', false, 'erreur', 'lien_invalide');
  end if;
  if p_prix_paye is not null and (p_prix_paye <= 0 or p_prix_paye >= 1000000) then
    return jsonb_build_object('ok', false, 'erreur', 'prix_invalide');
  end if;
  if p_points_confirmes is not null and p_points_confirmes not in ('oui', 'non', 'pas_verifie') then
    return jsonb_build_object('ok', false, 'erreur', 'reponse_invalide');
  end if;

  insert into public.outcomes
    (user_id, analysis_id, prix_paye_eur, points_confirmes_choix, achete, commentaire, retour_id, source)
  values
    (null, v.analysis_id, p_prix_paye, p_points_confirmes, p_achete,
     left(p_commentaire, 1000), v.id, 'lien_signe')
  on conflict (analysis_id) where user_id is null do update
    set prix_paye_eur = excluded.prix_paye_eur,
        points_confirmes_choix = excluded.points_confirmes_choix,
        achete = excluded.achete,
        commentaire = excluded.commentaire,
        retour_id = excluded.retour_id;

  update public.retours set repondu_le = coalesce(repondu_le, now()) where id = v.id;

  insert into public.events (name, analysis_id, props_json)
  values ('outcome_submitted', v.analysis_id,
          jsonb_build_object('source', 'lien_signe', 'achete', p_achete));

  -- SPRINT 21 — le prix payé alimente le relevé SÉPARÉ. Un prix n'a de sens
  -- que si l'achat a eu lieu ; le contrôle de cohérence est dans la fonction
  -- de versement, pas ici.
  if p_achete is true and p_prix_paye is not null then
    perform public.agreger_prix_paye(v.analysis_id, p_prix_paye);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_retour_signe(text, boolean, integer, text, text) from public, anon, authenticated;
grant execute on function public.submit_retour_signe(text, boolean, integer, text, text) to service_role;

-- ⚠️ `submit_outcome` : corps repris de sa dernière définition
-- (20261028090000), ce seul ajout en plus. Elle est appelée par le front avec
-- le jeton de l'utilisateur : son grant à `authenticated` est conservé.
create or replace function public.submit_outcome(
  p_analysis_id uuid,
  p_prix_paye integer default null,
  p_pannes_confirmees text default null,
  p_commentaire text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nouveau boolean;
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if not exists (
    select 1 from public.dossier
    where user_id = v_uid and analysis_id = p_analysis_id and statut = 'achete'
  ) then
    raise exception 'réservé aux analyses marquées « acheté » dans votre dossier';
  end if;
  if p_prix_paye is not null and (p_prix_paye <= 0 or p_prix_paye >= 1000000) then
    raise exception 'prix invalide';
  end if;

  v_nouveau := not exists (
    select 1 from public.outcomes where user_id = v_uid and analysis_id = p_analysis_id
  );

  insert into public.outcomes (user_id, analysis_id, prix_paye_eur, pannes_confirmees, commentaire)
  values (v_uid, p_analysis_id, p_prix_paye, left(p_pannes_confirmees, 1000), left(p_commentaire, 1000))
  on conflict (user_id, analysis_id) do update
    set prix_paye_eur = excluded.prix_paye_eur,
        pannes_confirmees = excluded.pannes_confirmees,
        commentaire = excluded.commentaire;

  if v_nouveau then
    insert into public.events (name, analysis_id, ip_hash, props_json)
    values ('outcome_submitted', p_analysis_id, public._request_ip_hash('outcome:'),
            jsonb_build_object('source', 'dossier', 'user_id', v_uid));
  end if;

  -- SPRINT 21 — versement au relevé des prix payés. ⚠️ Seulement sur une
  -- création : sans ce garde, corriger son commentaire verserait une seconde
  -- fois le même prix. Le dossier exige déjà le statut « acheté », donc
  -- l'achat est acquis.
  if v_nouveau and p_prix_paye is not null then
    perform public.agreger_prix_paye(p_analysis_id, p_prix_paye);
  end if;
end;
$$;

revoke all on function public.submit_outcome(uuid, integer, text, text) from public, anon;
grant execute on function public.submit_outcome(uuid, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Contrôle d'arrivée
-- ---------------------------------------------------------------------------
do $$
begin
  -- ⚠️ Aucune colonne de somme ni de moyenne : le stockage doit INTERDIRE la
  -- moyenne, pas se contenter de ne pas l'afficher (règle du sprint 19.1).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'marche_payes'
      and (column_name like '%somme%' or column_name like '%moyenne%' or column_name like '%total%')
  ) then
    raise exception 'marche_payes porte une colonne de somme ou de moyenne';
  end if;
  if public.seuil_prix_payes() <> 6 then
    raise exception 'seuil_prix_payes() devrait valoir 6';
  end if;
  -- Les bornes du contrôle de cohérence, aux quatre cas limites.
  if not public.declaration_prix_acceptable(5000, 10000) then raise exception '50 %% doit être accepté'; end if;
  if not public.declaration_prix_acceptable(15000, 10000) then raise exception '150 %% doit être accepté'; end if;
  if public.declaration_prix_acceptable(4999, 10000) then raise exception 'sous 50 %% doit être écarté'; end if;
  if public.declaration_prix_acceptable(15001, 10000) then raise exception 'au-delà de 150 %% doit être écarté'; end if;
  if public.declaration_prix_acceptable(9000, null) then raise exception 'prix d''annonce inconnu doit être écarté'; end if;
end
$$;
