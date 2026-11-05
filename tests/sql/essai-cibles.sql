-- Épreuve de bout en bout du carnet de cibles, EN LOCAL, en transaction
-- annulée. On fabrique un utilisateur, un Pass actif et deux analyses, puis on
-- appelle les RPC comme le ferait le navigateur.
begin;

create temporary table r (n serial, quoi text, ok boolean, detail text);
create or replace function pg_temp.v(p_quoi text, p_ok boolean, p_detail text default null)
returns void language sql as $f$ insert into r (quoi, ok, detail) values (p_quoi, coalesce(p_ok,false), p_detail); $f$;

do $e$
declare
  v_uid uuid := gen_random_uuid();
  v_a1 uuid := gen_random_uuid();
  v_a2 uuid := gen_random_uuid();
  v_res jsonb;
  v_lu jsonb;
  v_histo jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'revendeur-essai@exemple.test', '', now(), now(), now());

  -- Deux analyses du MÊME segment, relevées en deux fois : l'addition doit
  -- donner exactement le même carnet que si elles avaient été relevées d'un
  -- coup. C'est toute la raison d'être de l'histogramme.
  insert into public.analyses (id, input_text, verdict, score, result_json, is_eval) values
    (v_a1, 'annonce d essai', 'orange', 46, jsonb_build_object('revendeur', jsonb_build_object(
      'segment', jsonb_build_object('marque','renault','modele','clio','energie','Diesel'),
      'retenus', jsonb_build_array(
        jsonb_build_object('prix',2600,'annee',2004,'km',178000),
        jsonb_build_object('prix',2200,'annee',2005,'km',195000),
        jsonb_build_object('prix',2900,'annee',2003,'km',168000),
        jsonb_build_object('prix',1950,'annee',2004,'km',201000)))), false),
    (v_a2, 'annonce d essai 2', 'orange', 46, jsonb_build_object('revendeur', jsonb_build_object(
      'segment', jsonb_build_object('marque','renault','modele','clio','energie','Diesel'),
      'retenus', jsonb_build_array(
        jsonb_build_object('prix',3200,'annee',2006,'km',155000),
        jsonb_build_object('prix',2450,'annee',2005,'km',188000),
        jsonb_build_object('prix',2750,'annee',2004,'km',172000)))), false);

  -- 1. SANS PASS : refus. C'est une fonction de l'offre payante.
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
  begin
    perform public.revendeur_cible_maj(v_a1);
    perform pg_temp.v('sans Pass, le carnet refuse', false, 'la RPC a accepte');
  exception when others then
    perform pg_temp.v('sans Pass, le carnet refuse', sqlerrm like '%pass%', sqlerrm);
  end;

  -- 2. Avec un Pass actif.
  insert into public.passes (email, user_id, stripe_session, montant_cents, mode, statut, debut, fin)
  values ('revendeur-essai@exemple.test', v_uid, 'sess_essai_'||v_uid, 2900, 'vente', 'actif',
          now() - interval '1 day', now() + interval '20 days');

  v_res := public.revendeur_cible_maj(v_a1);
  perform pg_temp.v('premier versement : 4 releves', (v_res->>'enregistre')::boolean
    and (v_res->>'effectif')::int = 4, v_res::text);

  v_res := public.revendeur_cible_maj(v_a2);
  perform pg_temp.v('second versement : 7 releves cumules', (v_res->>'effectif')::int = 7, v_res::text);

  select prix_tranches into v_histo from public.revendeur_cibles where user_id = v_uid;
  perform pg_temp.v('histogramme : 2 900 et 2 750 dans la meme tranche de 250 EUR',
    (v_histo->>'2750')::int = 2, v_histo::text);
  perform pg_temp.v('histogramme : somme des effectifs = 7',
    (select sum(value::text::int) from jsonb_each(v_histo)) = 7, v_histo::text);

  -- ⚠️ Aucune annonce, aucune URL, aucun identifiant d'analyse dans le carnet.
  perform pg_temp.v('le carnet ne contient NI annonce NI lien vers une analyse',
    position('http' in v_histo::text) = 0
    and (select count(*) from information_schema.columns
          where table_schema='public' and table_name='revendeur_cibles'
            and column_name in ('analysis_id','url','titre')) = 0);

  -- 3. Lecture : histogramme replié, jamais de quantile.
  v_lu := public.revendeur_cibles_lire();
  -- ⚠️ TROIS HISTOGRAMMES, AUCUNE MOYENNE. La base rend les tranches
  -- REPLIEES ; medianes et quartiles sont lus par l unique implementation du
  -- projet, dans la fonction edge. Annees relevees : 2003, 2004x3, 2005x2,
  -- 2006 → sept tranches, dont 2004 a trois.
  perform pg_temp.v('lecture : trois histogrammes fusionnes, aucune moyenne',
    jsonb_array_length(v_lu) = 1
    and (v_lu->0->>'effectif')::int = 7
    and (v_lu->0->'annee_tranches'->>'2004')::int = 3
    and (v_lu->0->'annee_tranches'->>'2005')::int = 2
    and (v_lu->0->'km_tranches'->>'170000')::int = 2
    and (select sum(value::text::int) from jsonb_each(v_lu->0->'km_tranches')) = 7
    and not (v_lu->0 ? 'annee_moyenne')
    and not (v_lu->0 ? 'km_moyen'), v_lu::text);
  perform pg_temp.v('lecture : AUCUN quantile rendu par la base',
    not (v_lu->0 ? 'p25') and not (v_lu->0 ? 'p50'), v_lu::text);

  -- 4. Une analyse d'EVAL n'entre jamais dans le carnet d'un utilisateur.
  update public.analyses set is_eval = true where id = v_a1;
  v_res := public.revendeur_cible_maj(v_a1);
  perform pg_temp.v('une analyse d eval est refusee',
    (v_res->>'enregistre')::boolean is false
    and v_res->>'motif' = 'analyse_sans_segment', v_res::text);

  -- 5. Retrait.
  perform public.revendeur_cible_retirer('renault','clio','Diesel');
  perform pg_temp.v('retrait : le carnet est vide',
    jsonb_array_length(public.revendeur_cibles_lire()) = 0);

  -- 6. Profil : la ville de revente est ecrite ET relue.
  perform public.preferences_revendeur_ecrire('Occitanie', '{"cv": 5}'::jsonb, 'Toulouse');
  v_lu := public.preferences_revendeur_lire();
  perform pg_temp.v('profil : region, ville de revente et parametres relus',
    v_lu->>'region' = 'Occitanie'
    and v_lu->>'ville_revente' = 'Toulouse'
    and (v_lu->'parametres'->>'cv')::int = 5, v_lu::text);

  -- Une ecriture partielle ne doit pas EFFACER la ville deja posee.
  perform public.preferences_revendeur_ecrire('Bretagne', null, null);
  v_lu := public.preferences_revendeur_lire();
  perform pg_temp.v('une ecriture partielle ne perd pas la ville de revente',
    v_lu->>'region' = 'Bretagne' and v_lu->>'ville_revente' = 'Toulouse', v_lu::text);
end
$e$;

do $verdict$
declare v_ko int; v_total int; v_liste text;
begin
  select count(*) filter (where not ok), count(*) into v_ko, v_total from r;
  if v_ko > 0 then
    select string_agg(format('  - %s%s', quoi, coalesce(' ['||detail||']','')), E'\n' order by n)
      into v_liste from r where not ok;
    raise exception E'ESSAI CIBLES ECHOUE : %/% en echec\n%', v_ko, v_total, v_liste;
  end if;
  raise notice 'ESSAI CIBLES CONCLUANT : %/% controles passes', v_total, v_total;
end
$verdict$;

select n, quoi, ok from r order by n;
rollback;
