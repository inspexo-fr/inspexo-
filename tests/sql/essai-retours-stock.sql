-- Épreuve du journal des retours (formule pro), EN LOCAL, transaction annulée.
-- Chaque pro ne voit que ses retours ; un non-abonné est refusé ; la vue
-- agrégée est réservée à l'admin.
begin;

create temporary table r (n serial, quoi text, ok boolean, detail text);
create or replace function pg_temp.v(p_quoi text, p_ok boolean, p_detail text default null)
returns void language sql as $f$ insert into r (quoi, ok, detail) values (p_quoi, coalesce(p_ok,false), p_detail); $f$;

do $e$
declare
  v_pro uuid := gen_random_uuid();
  v_autre uuid := gen_random_uuid();
  v_rien uuid := gen_random_uuid();
  v_id uuid;
  v_n int;
  v_refus boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  select x, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x::text || '@exemple.test', '', now(), now(), now()
  from unnest(array[v_pro, v_autre, v_rien]) as x;
  insert into public.abonnements_pro (user_id, email, siret, stripe_subscription, statut, periode_fin, cgv_version)
  values (v_pro, 'pro@exemple.test', '73282932000074', 'sub_essai_1', 'actif', now() + interval '20 days', 'brouillon-v0'),
         (v_autre, 'autre@exemple.test', '73282932000074', 'sub_essai_2', 'actif', now() + interval '20 days', 'brouillon-v0');
  insert into public.defect_sheets (marque, marque_norm, famille_moteur, famille_norm, statut, pannes)
  values ('Renault', 'renault', 'K9K', 'K9K', 'generee', '[]'::jsonb);

  -- 1. Le pro ajoute un retour.
  perform set_config('request.jwt.claims', json_build_object('sub', v_pro::text, 'role', 'authenticated')::text, true);
  v_id := public.retour_stock_ajouter('STK-12', current_date - 3, 151000, 'K9K', 'injecteur', 1280, 'marchand', 'injecteur 3 fuyard');
  perform pg_temp.v('un pro abonné ajoute un retour', v_id is not null);
  select count(*) into v_n from public.retours_stock_lister();
  perform pg_temp.v('il voit son retour', v_n = 1, v_n::text);

  -- 2. Famille inconnue, pièce hors liste, date future : refusés.
  begin perform public.retour_stock_ajouter('STK-13', current_date, 1000, 'ZZZ999', 'injecteur', 10, 'marchand', null); v_refus := false;
  exception when others then v_refus := true; end;
  perform pg_temp.v('famille moteur inconnue refusée', v_refus);
  begin perform public.retour_stock_ajouter('STK-13', current_date, 1000, 'K9K', 'soupape magique', 10, 'marchand', null); v_refus := false;
  exception when others then v_refus := true; end;
  perform pg_temp.v('pièce hors liste refusée', v_refus);
  begin perform public.retour_stock_ajouter('STK-13', current_date + 2, 1000, 'K9K', 'turbo', 10, 'marchand', null); v_refus := false;
  exception when others then v_refus := true; end;
  perform pg_temp.v('date future refusée', v_refus);

  -- 3. Un autre pro ne voit rien et ne peut pas supprimer.
  perform set_config('request.jwt.claims', json_build_object('sub', v_autre::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.retours_stock_lister();
  perform pg_temp.v('un autre pro ne voit PAS les retours du premier', v_n = 0, v_n::text);
  perform pg_temp.v('un autre pro ne peut pas supprimer', public.retour_stock_supprimer(v_id) = false);

  -- 4. Sans abonnement : refus à l'écriture, rien à la lecture.
  perform set_config('request.jwt.claims', json_build_object('sub', v_rien::text, 'role', 'authenticated')::text, true);
  begin perform public.retour_stock_ajouter('X', current_date, 1, 'K9K', 'turbo', 1, 'marchand', null); v_refus := false;
  exception when others then v_refus := true; end;
  perform pg_temp.v('sans formule pro : écriture refusée', v_refus);
  select count(*) into v_n from public.retours_stock_lister();
  perform pg_temp.v('sans formule pro : lecture vide', v_n = 0);

  -- 5. Vue agrégée : refusée à un pro, ouverte à l'admin.
  begin perform * from public.retours_stock_agreges(); v_refus := false;
  exception when others then v_refus := true; end;
  perform pg_temp.v('vue agrégée refusée à un non-admin', v_refus);
  insert into public.admins (user_id, email) values (v_rien, 'admin@exemple.test');
  select count(*) into v_n from public.retours_stock_agreges();
  perform pg_temp.v('vue agrégée ouverte à l’admin, sans retour individuel', v_n = 1, v_n::text);

  -- 6. Lecture directe de la table : refusée à authenticated.
  begin
    set local role authenticated;
    perform count(*) from public.retours_stock;
    v_refus := false;
  exception when others then v_refus := true; end;
  reset role;
  perform pg_temp.v('lecture directe de la table refusée', v_refus);
end
$e$;

do $verdict$
declare v_ko int; v_total int; v_liste text;
begin
  select count(*) filter (where not ok), count(*) into v_ko, v_total from r;
  if v_ko > 0 then
    select string_agg(format('  - %s%s', quoi, coalesce(' ['||detail||']','')), E'\n' order by n)
      into v_liste from r where not ok;
    raise exception E'ESSAI RETOURS STOCK ECHOUE : %/% en echec\n%', v_ko, v_total, v_liste;
  end if;
  raise notice 'ESSAI RETOURS STOCK CONCLUANT : %/% controles passes', v_total, v_total;
end
$verdict$;

select n, quoi, ok from r order by n;
rollback;
