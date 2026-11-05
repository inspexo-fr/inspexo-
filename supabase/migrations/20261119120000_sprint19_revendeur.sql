-- SPRINT 19 — Mode revendeur : paramètres, tarifs de carte grise, région.
--
-- Tout ce qui chiffre vit en base, pas dans le code : les tarifs de carte
-- grise changent chaque année par délibération régionale, et un tarif figé
-- dans un déploiement devient faux en silence le 1er janvier.

-- ---------------------------------------------------------------------------
-- 1. PARAMÈTRES DU CALCUL
-- ---------------------------------------------------------------------------
-- Valeurs par défaut décidées avec Utku. Chacune est modifiable à l'écran par
-- l'utilisateur pour SON calcul ; celles-ci ne sont que le point de départ.
insert into public.config (cle, valeur, description) values
  ('revendeur_marge_negociation_pct', '8'::jsonb,
   'Marge que l''acheteur final négociera sur le prix affiché, en %.'),
  ('revendeur_marge_voulue_eur', '500'::jsonb,
   'Marge visée par le revendeur, en euros.'),
  ('revendeur_imprevus_pct_travaux', '15'::jsonb,
   'Imprévus : pourcentage des travaux chiffrés.'),
  ('revendeur_imprevus_vehicule_ancien_eur', '150'::jsonb,
   'Imprévus : forfait ajouté au-delà de 10 ans.'),
  ('revendeur_decote_zfe_pct', '10'::jsonb,
   'Décote appliquée au prix de revente si le véhicule est interdit dans la ZFE de revente.'),
  ('revendeur_offre_retrait_pct', '15'::jsonb,
   'Retrait appliqué au prix d''achat maximum pour composer l''offre d''ouverture.')
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- 2. TARIFS DE CARTE GRISE — DATÉS, SOURCÉS, MODIFIABLES SANS DÉPLOIEMENT
-- ---------------------------------------------------------------------------
-- ⚠️ LE PRIX DU CHEVAL FISCAL EST VOTÉ CHAQUE ANNÉE PAR CHAQUE RÉGION.
-- Figé dans le code, il serait faux dès la première délibération et personne
-- ne le verrait. Il vit donc ici, avec sa date de relevé — que l'écran
-- affiche, pour que le lecteur sache de quand datent les chiffres.
--
-- ⚠️ CE QUI N'EST PAS DÉCIDÉ ICI : les exonérations pour véhicules propres.
-- Elles varient d'une région à l'autre (0 %, 50 % ou 100 %) et plusieurs les
-- ont supprimées depuis 2025. Les appliquer d'office donnerait un coût faux
-- dans un sens, les ignorer dans l'autre. La ligne « carte grise » reste donc
-- MODIFIABLE à l'écran, et la mention invite à vérifier au simulateur
-- officiel. Mieux vaut un chiffre que l'utilisateur corrige qu'un chiffre
-- qu'il croit exact.
insert into public.config (cle, valeur, description) values
  ('carte_grise_tarifs', jsonb_build_object(
    'maj', '2026-11-05',
    'source', 'Tarifs régionaux du cheval fiscal 2026, relevés le 05/11/2026. Montant exact à confirmer au simulateur officiel ANTS.',
    'frais_fixes_eur', 13.76,
    'regions', jsonb_build_object(
      'Auvergne-Rhône-Alpes', 43,
      'Bourgogne-Franche-Comté', 60,
      'Bretagne', 60,
      'Centre-Val de Loire', 60,
      'Corse', 53,
      'Grand Est', 60,
      'Hauts-de-France', 43,
      'Île-de-France', 68.95,
      'Normandie', 60,
      'Nouvelle-Aquitaine', 58,
      'Occitanie', 59.5,
      'Pays de la Loire', 51,
      'Provence-Alpes-Côte d''Azur', 60,
      'Guadeloupe', 41,
      'Guyane', 42.5,
      'La Réunion', 60,
      'Martinique', 53,
      'Mayotte', 30
    )
  ), 'Prix du cheval fiscal par région + frais fixes. Datés : à revoir chaque janvier.')
on conflict (cle) do nothing;

-- Lecture publique de CE réglage uniquement : le calcul se fait dans le
-- navigateur de l'utilisateur, il lui faut donc la table.
-- ⚠️ Rien d'autre de `config` n'est exposé — les seuils d'alerte et le
-- plafond de coût IA restent au service role.
create or replace function public.get_config_publique()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(cle, valeur), '{}'::jsonb)
  from public.config
  where cle = 'carte_grise_tarifs' or cle like 'revendeur\_%';
$$;

revoke all on function public.get_config_publique() from public;
grant execute on function public.get_config_publique() to anon, authenticated, service_role;

comment on function public.get_config_publique() is
  'Réglages du mode revendeur, lisibles par le navigateur. Liste fermée : rien d''autre de `config` ne sort.';

-- ---------------------------------------------------------------------------
-- 3. RÉGION DE L'UTILISATEUR — demandée une fois, mémorisée
-- ---------------------------------------------------------------------------
-- ⚠️ Pour un visiteur SANS COMPTE, la région reste dans son navigateur
-- (localStorage) : elle n'a pas à être envoyée, et une préférence
-- d'affichage ne justifie pas de créer une ligne en base pour un anonyme.
-- Pour un utilisateur connecté, elle suit son compte d'un appareil à
-- l'autre — c'est le seul cas où elle est stockée.
create table if not exists public.preferences_revendeur (
  user_id uuid primary key references auth.users (id) on delete cascade,
  region text,
  parametres jsonb not null default '{}'::jsonb,
  maj_le timestamptz not null default now()
);

alter table public.preferences_revendeur enable row level security;
revoke all on public.preferences_revendeur from anon, authenticated;

create or replace function public.preferences_revendeur_lire()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('region', region, 'parametres', parametres)
       from public.preferences_revendeur where user_id = auth.uid()),
    '{}'::jsonb);
$$;

create or replace function public.preferences_revendeur_ecrire(
  p_region text default null,
  p_parametres jsonb default null
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
  insert into public.preferences_revendeur (user_id, region, parametres, maj_le)
  values (
    auth.uid(),
    left(nullif(btrim(coalesce(p_region, '')), ''), 60),
    coalesce(p_parametres, '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update
    set region = coalesce(excluded.region, public.preferences_revendeur.region),
        parametres = case when p_parametres is null
                          then public.preferences_revendeur.parametres
                          else excluded.parametres end,
        maj_le = now();
end;
$$;

revoke all on function public.preferences_revendeur_lire() from public, anon;
grant execute on function public.preferences_revendeur_lire() to authenticated;
revoke all on function public.preferences_revendeur_ecrire(text, jsonb) from public, anon;
grant execute on function public.preferences_revendeur_ecrire(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. COÛT DU CONTRÔLE TECHNIQUE — fourchette publiée, vérifiée
-- ---------------------------------------------------------------------------
-- Le mode revendeur déduit le contrôle technique du prix d'achat maximum
-- quand le dernier a plus de six mois. Un poste n'entre dans le calcul que si
-- son coût est SOURCÉ (règle du sprint 3) : il fallait donc une fourchette
-- publiée, et le projet n'en avait aucune pour le contrôle technique.
--
-- Les deux montants figurent LITTÉRALEMENT sur la page citée, relevée le
-- 05/11/2026 — même exigence que les onze fourchettes semées au sprint 3.
insert into public.repair_costs
  (marque_norm, famille_norm, operation, operation_norm, cout_min_eur, cout_max_eur, url_source, extrait_source, source_date, statut)
values
  ('', '', 'Contrôle technique (voiture légère)', 'controle technique (voiture legere)', 45, 150,
   '["https://www.groupama.fr/assurance-auto/conseils/prix-controle-technique/"]'::jsonb,
   'le même service peut vous coûter de 45€ à 150€ en fonction du centre de contrôle technique que vous choisissez',
   '2026-11-05', 'source')
on conflict (marque_norm, famille_norm, operation_norm) do nothing;

-- ---------------------------------------------------------------------------
-- 5. VERROU PASS — masquage SERVEUR du mode revendeur
-- ---------------------------------------------------------------------------
-- Miroir exact de `revendeurPublique` dans _shared/revendeur.ts.
--
-- ⚠️ POURQUOI EN SQL AUSSI. `score` masque sa propre réponse, mais `/a/:id`
-- relit l'analyse par `get_public_analysis` : sans ce masque, il suffirait de
-- recharger la page pour recevoir le détail. C'est exactement la correction du
-- sprint 7 pour la négociation, et elle vaut mot pour mot ici.
--
-- Gratuit = le prix de revente réaliste. Tout le reste — prix d'achat
-- maximum, lignes de coût, arguments chiffrés, message vendeur — NE QUITTE
-- PAS le serveur.
create or replace function public._revendeur_publique(r jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when r is null or jsonb_typeof(r) <> 'object' then r
    else jsonb_build_object(
      'comparables', r -> 'comparables',
      -- Le prix de revente réaliste est l'appât du produit : il est gratuit.
      'revente', r -> 'revente',
      'achat_max', 'null'::jsonb,
      'offre', 'null'::jsonb,
      'parametres', r -> 'parametres',
      'carte_grise', 'null'::jsonb,
      'critair', r -> 'critair',
      'zfe', r -> 'zfe',
      'arguments', '[]'::jsonb,
      'message_vendeur', '""'::jsonb,
      'mention', r -> 'mention',
      'masque', true,
      'nb_lignes_masquees', coalesce(
        jsonb_array_length(coalesce(r -> 'achat_max' -> 'lignes', '[]'::jsonb)), 0),
      'nb_arguments_masques', coalesce(
        jsonb_array_length(coalesce(r -> 'arguments', '[]'::jsonb)), 0)
    )
  end;
$$;

comment on function public._revendeur_publique(jsonb) is
  'Projection publique du mode revendeur : le prix de revente réaliste est '
  'gratuit, le prix d''achat maximum et le message vendeur sont réservés au '
  'Pass. Miroir de `revendeurPublique` dans _shared/revendeur.ts.';

revoke all on function public._revendeur_publique(jsonb) from public, anon, authenticated;
grant execute on function public._revendeur_publique(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- `get_public_analysis` REDÉCLARÉE à l'identique, avec le seul ajout du
-- masquage du mode revendeur.
--
-- ⚠️ Le corps n'a pas été retapé : il est EXTRAIT par script du fichier de la
-- dernière définition (20261111120000_sprint13_histovec.sql), et dix
-- marqueurs y sont vérifiés avant écriture (ref_num, claims_dropped,
-- _negociation_publique, _histovec_publique, _request_ip_hash, _pass_actif,
-- result_viewed, share_views, le filtre anti-injection, claim_dropped).
-- C'est la règle 0 quinquies, et elle a déjà été enfreinte trois fois : au
-- sprint 13 sur cette fonction même, puis au sprint 14 sur
-- `inspecteur_missions` et `inspection_accepter`, où reprendre une définition
-- plus ancienne avait fait disparaître le garde-fou « assurance RC pro
-- expirée ».
-- ---------------------------------------------------------------------------
create or replace function public.get_public_analysis(p_id uuid, p_track boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.analyses%rowtype;
  v_ip_hash text := public._request_ip_hash('view:');
  v_deja_vu boolean;
  v_dropped_count integer;
  v_dropped jsonb;
  v_pass boolean := false;
  v_result jsonb;
begin
  select * into v_row from public.analyses where id = p_id;
  if not found then
    return null;
  end if;

  if p_track then
    select exists (
      select 1 from public.events
      where name = 'result_viewed'
        and analysis_id = p_id
        and ip_hash = v_ip_hash
        and created_at > now() - interval '1 hour'
    ) into v_deja_vu;

    if not v_deja_vu then
      update public.analyses set share_views = share_views + 1 where id = p_id;
      insert into public.events (name, analysis_id, ip_hash) values ('result_viewed', p_id, v_ip_hash);
      v_row.share_views := v_row.share_views + 1;
    end if;
  end if;

  select count(*) into v_dropped_count
  from public.events
  where name = 'claim_dropped' and analysis_id = p_id;

  -- Liste publique : jamais le contenu d'une injection de prompt.
  select coalesce(jsonb_agg(jsonb_build_object(
           'texte', left(coalesce(props_json->>'texte', ''), 300),
           'justification', left(coalesce(props_json->>'justification', ''), 300)
         ) order by created_at), '[]'::jsonb)
    into v_dropped
  from (
    select props_json, created_at
    from public.events
    where name = 'claim_dropped'
      and analysis_id = p_id
      and coalesce(props_json->>'texte', '') !~* '(injection|ignore.{0,30}(instruction|consigne)|prompt|note\s*(de\s*)?100)'
      and coalesce(props_json->>'justification', '') !~* '(injection|prompt)'
    order by created_at
    limit 20
  ) t;

  if auth.uid() is not null then
    v_pass := public._pass_actif(auth.uid());
  end if;

  v_result := v_row.result_json;
  if not v_pass and v_result is not null and v_result ? 'negociation' then
    v_result := jsonb_set(
      v_result, '{negociation}',
      coalesce(public._negociation_publique(v_result->'negociation'), 'null'::jsonb)
    );
  end if;

  -- SPRINT 13 — Masquage de la lecture HistoVec, au MÊME endroit et selon la
  -- MÊME logique que la négociation : un masquage côté client ne masque rien.
  -- Un signal ROUGE passe toujours (cf. _histovec_publique) : on ne cache pas
  -- un vol, un gage ou une procédure non levée derrière un paiement.
  if not v_pass and v_result is not null and v_result ? 'histovec' then
    v_result := jsonb_set(
      v_result, '{histovec}',
      coalesce(public._histovec_publique(v_result->'histovec'), 'null'::jsonb)
    );
  end if;
  -- SPRINT 19 — Masquage du mode revendeur, au MÊME endroit et selon la MÊME
  -- logique que la négociation et HistoVec. Sans Pass, le prix de revente
  -- réaliste est gratuit ; le prix d'achat maximum, les lignes de coût, les
  -- arguments et le message vendeur ne quittent pas le serveur.
  --
  -- ⚠️ Le masquage client ne masque rien : la leçon est celle du sprint 7, où
  -- le flou CSS envoyait quand même toute la négociation au navigateur.
  if not v_pass and v_result is not null and v_result ? 'revendeur' then
    v_result := jsonb_set(
      v_result, '{revendeur}',
      coalesce(public._revendeur_publique(v_result->'revendeur'), 'null'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'created_at', v_row.created_at,
    'ref_num', v_row.ref_num,
    'verdict', v_row.verdict,
    'score', v_row.score,
    'result_json', v_result,
    'marque', v_row.marque,
    'modele', v_row.modele,
    'motorisation', v_row.motorisation,
    'annee', v_row.annee,
    'famille_moteur', v_row.famille_moteur,
    'images_count', v_row.images_count,
    'share_views', v_row.share_views,
    'claims_dropped_count', v_dropped_count,
    'claims_dropped', v_dropped,
    'pass', v_pass
  );
end;
$$;
grant execute on function public.get_public_analysis(uuid, boolean) to anon, authenticated;
