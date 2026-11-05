-- Épreuve de bout en bout des PRIX PAYÉS déclarés, EN LOCAL, en transaction
-- annulée. On fabrique des analyses et on appelle `agreger_prix_paye` comme le
-- feraient `submit_retour_signe` et `submit_outcome`.
--
-- ⚠️ POURQUOI UNE ÉPREUVE DE COMPORTEMENT EN PLUS DES ASSERTIONS DE FORME.
-- Au sprint 19.1, la même démarche a trouvé deux vrais défauts dès sa première
-- exécution : un `RETURNING` qui voyait la ligne APRÈS insertion et comptait le
-- lot deux fois, et une médiane de lot qui écrasait la précédente. Un contrôle
-- sur la forme du schéma n'aurait vu ni l'un ni l'autre.
begin;

create temporary table r (n serial, quoi text, ok boolean, detail text);
create or replace function pg_temp.v(p_quoi text, p_ok boolean, p_detail text default null)
returns void language sql as $f$ insert into r (quoi, ok, detail) values (p_quoi, coalesce(p_ok,false), p_detail); $f$;

do $e$
declare
  v_ids uuid[] := array[]::uuid[];
  v_id uuid;
  v_res jsonb;
  v_eff integer;
  v_histo jsonb;
  v_evals integer;
  i integer;
begin
  -- Huit analyses du même segment, prix d'annonce 10 000 €.
  for i in 1..8 loop
    v_id := gen_random_uuid();
    v_ids := v_ids || v_id;
    insert into public.analyses (id, input_text, verdict, score, annee, result_json, is_eval)
    values (v_id, 'annonce d essai ' || i, 'orange', 55, 2016,
      jsonb_build_object(
        'vehicule', jsonb_build_object('prix_affiche', 10000, 'kilometrage', 120000),
        'revendeur', jsonb_build_object('segment',
          jsonb_build_object('marque','peugeot','modele','308','energie','Essence'))),
      false);
  end loop;

  -- ── Le contrôle de cohérence ────────────────────────────────────────────
  v_res := public.agreger_prix_paye(v_ids[1], 900);   -- 9 % de l'annonce
  perform pg_temp.v('un zero manquant (900 pour 10 000) est ECARTE',
    (v_res ->> 'verse')::boolean is false and v_res ->> 'motif' = 'hors_bornes', v_res::text);
  v_res := public.agreger_prix_paye(v_ids[1], 100000); -- 10 fois
  perform pg_temp.v('un zero de trop est ECARTE',
    (v_res ->> 'verse')::boolean is false, v_res::text);
  v_res := public.agreger_prix_paye(v_ids[1], 4999);  -- juste sous 50 %
  perform pg_temp.v('un euro sous 50 %% est ECARTE', (v_res ->> 'verse')::boolean is false);
  v_res := public.agreger_prix_paye(v_ids[1], 15001); -- juste au-dessus de 150 %
  perform pg_temp.v('un euro au-dessus de 150 %% est ECARTE', (v_res ->> 'verse')::boolean is false);

  -- ⚠️ Les écarts sont TRACES, jamais effaces en silence.
  perform pg_temp.v('chaque declaration ecartee laisse un event',
    (select count(*) from public.events where name = 'prix_paye_ecarte') = 4,
    (select count(*)::text from public.events where name = 'prix_paye_ecarte'));
  perform pg_temp.v('et rien n a ete verse',
    (select coalesce(sum(effectif), 0) from public.marche_payes) = 0);

  -- ── Le versement ────────────────────────────────────────────────────────
  v_res := public.agreger_prix_paye(v_ids[1], 9000);
  perform pg_temp.v('une declaration a 90 %% du prix est VERSEE',
    (v_res ->> 'verse')::boolean is true, v_res::text);
  -- ⚠️ L'EFFECTIF ANNONCE EST CELUI DE LA LIGNE, PAS LE DOUBLE. C'est le
  -- defaut exact du sprint 19.1 : `RETURNING` voyait la ligne apres insertion.
  perform pg_temp.v('l effectif annonce apres le premier versement vaut 1',
    (v_res ->> 'effectif')::integer = 1, v_res ->> 'effectif');

  -- Cinq de plus, pour atteindre le seuil de six.
  v_res := public.agreger_prix_paye(v_ids[2], 8800);
  v_res := public.agreger_prix_paye(v_ids[3], 9250);
  v_res := public.agreger_prix_paye(v_ids[4], 9500);
  v_res := public.agreger_prix_paye(v_ids[5], 9100);
  v_res := public.agreger_prix_paye(v_ids[6], 8600);
  perform pg_temp.v('six versements donnent un effectif de six',
    (v_res ->> 'effectif')::integer = 6, v_res ->> 'effectif');
  perform pg_temp.v('et le seuil annonce est bien 6', (v_res ->> 'seuil')::integer = 6);

  select effectif, prix_histo into v_eff, v_histo from public.marche_payes
   where marque_norm = 'peugeot' and modele_norm = '308' and energie = 'essence';
  perform pg_temp.v('une seule ligne porte le segment', v_eff = 6, v_eff::text);
  -- ⚠️ L'HISTOGRAMME ET LA COLONNE DOIVENT CONCORDER. S'ils divergeaient, la
  -- colonne pourrait annoncer six ventes sur un histogramme qui n'en porte que
  -- trois — et c'est l'histogramme que la lecture publie.
  perform pg_temp.v('la somme de l histogramme egale l effectif',
    (select sum(value::text::int) from jsonb_each(v_histo)) = v_eff,
    v_histo::text);
  -- Les tranches sont bien de 250 €.
  perform pg_temp.v('les prix sont ranges par tranches de 250 EUR',
    (select bool_and((key::int % 250) = 0) from jsonb_each(v_histo)), v_histo::text);

  -- ── Une analyse d'eval n'entre JAMAIS dans le releve ────────────────────
  v_id := gen_random_uuid();
  insert into public.analyses (id, input_text, verdict, score, annee, result_json, is_eval)
  values (v_id, 'annonce d eval', 'orange', 55, 2016,
    jsonb_build_object(
      'vehicule', jsonb_build_object('prix_affiche', 10000),
      'revendeur', jsonb_build_object('segment',
        jsonb_build_object('marque','peugeot','modele','308','energie','Essence'))),
    true);
  v_res := public.agreger_prix_paye(v_id, 9000);
  perform pg_temp.v('une analyse is_eval est refusee',
    (v_res ->> 'verse')::boolean is false and v_res ->> 'motif' = 'analyse_sans_segment',
    v_res::text);
  select effectif into v_eff from public.marche_payes
   where marque_norm = 'peugeot' and modele_norm = '308' and energie = 'essence';
  perform pg_temp.v('et l effectif n a pas bouge', v_eff = 6, v_eff::text);

  -- ── Un segment incomplet ne verse rien ──────────────────────────────────
  v_id := gen_random_uuid();
  insert into public.analyses (id, input_text, verdict, score, result_json, is_eval)
  values (v_id, 'annonce sans segment', 'orange', 55,
    jsonb_build_object('vehicule', jsonb_build_object('prix_affiche', 10000)), false);
  v_res := public.agreger_prix_paye(v_id, 9000);
  perform pg_temp.v('une analyse sans bloc revendeur ne verse rien',
    (v_res ->> 'verse')::boolean is false, v_res::text);

  -- ⚠️ Un prix d'annonce INCONNU est ecarte : le controle est defini par
  -- rapport a ce prix, sans lui il n'y a pas de controle.
  v_id := gen_random_uuid();
  insert into public.analyses (id, input_text, verdict, score, result_json, is_eval)
  values (v_id, 'annonce sans prix', 'orange', 55,
    jsonb_build_object('vehicule', jsonb_build_object('kilometrage', 90000),
      'revendeur', jsonb_build_object('segment',
        jsonb_build_object('marque','peugeot','modele','308','energie','Essence'))), false);
  v_res := public.agreger_prix_paye(v_id, 9000);
  perform pg_temp.v('un prix d annonce inconnu est ECARTE',
    (v_res ->> 'verse')::boolean is false and v_res ->> 'motif' = 'prix_annonce_inconnu',
    v_res::text);

  -- ── Deux segments ne se melangent pas ───────────────────────────────────
  v_id := gen_random_uuid();
  insert into public.analyses (id, input_text, verdict, score, annee, result_json, is_eval)
  values (v_id, 'annonce diesel', 'orange', 55, 2016,
    jsonb_build_object(
      'vehicule', jsonb_build_object('prix_affiche', 10000),
      'revendeur', jsonb_build_object('segment',
        jsonb_build_object('marque','peugeot','modele','308','energie','Diesel'))), false);
  v_res := public.agreger_prix_paye(v_id, 9000);
  perform pg_temp.v('la meme marque et le meme modele en DIESEL forment un autre segment',
    (v_res ->> 'effectif')::integer = 1, v_res::text);
  perform pg_temp.v('et le segment essence n a pas bouge',
    (select effectif from public.marche_payes
      where marque_norm='peugeot' and modele_norm='308' and energie='essence') = 6);

  -- ── Aucune moyenne stockee, nulle part ──────────────────────────────────
  perform pg_temp.v('la table ne porte aucune colonne de somme ni de moyenne',
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='marche_payes'
        and (column_name like '%somme%' or column_name like '%moyenne%')) = 0);
end
$e$;

do $verdict$
declare v_ko integer; v_total integer; v_liste text;
begin
  select count(*), count(*) filter (where not ok) into v_total, v_ko from r;
  if v_total = 0 then raise exception 'ESSAI INVALIDE : aucun controle enregistre'; end if;
  if v_ko > 0 then
    select string_agg(format('  - %s%s', quoi, coalesce(' [' || detail || ']', '')), E'\n' order by n)
      into v_liste from r where not ok;
    raise exception E'ESSAI PRIX PAYES ECHOUE : %/% en echec\n%', v_ko, v_total, v_liste;
  end if;
  raise notice 'ESSAI PRIX PAYES CONCLUANT : %/% controles passes', v_total, v_total;
end
$verdict$;

rollback;
