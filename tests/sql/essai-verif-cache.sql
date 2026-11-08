-- Épreuve de comportement du cache du juge (sprint 22), EN LOCAL, en
-- transaction annulée. Les assertions de forme vérifient le schéma ; celles-ci
-- vérifient ce que la table ACCEPTE et REFUSE.
begin;

create temporary table r (n serial, quoi text, ok boolean, detail text);
create or replace function pg_temp.v(p_quoi text, p_ok boolean, p_detail text default null)
returns void language sql as $f$ insert into r (quoi, ok, detail) values (p_quoi, coalesce(p_ok,false), p_detail); $f$;
grant all on r to anon;
grant usage on sequence r_n_seq to anon;

do $e$
declare
  v_cle text := repeat('a', 64);
  v_n int;
begin
  insert into public.verif_cache (cle, url, affirmation, moteur, verdict, votes)
  values (v_cle, 'https://www.largus.fr/x', 'courroie humide', 'EB2DT', 'soutenue', '["soutenue","soutenue"]');
  perform pg_temp.v('un verdict valide s’enregistre', true);

  begin
    insert into public.verif_cache (cle, url, affirmation, verdict) values ('pas-un-sha256', 'u', 'a', 'soutenue');
    perform pg_temp.v('une clé qui n’est pas un sha256 est refusée', false, 'acceptée');
  exception when check_violation then perform pg_temp.v('une clé qui n’est pas un sha256 est refusée', true);
  end;

  begin
    insert into public.verif_cache (cle, url, affirmation, verdict) values (repeat('b', 64), 'u', 'a', 'source_injoignable');
    perform pg_temp.v('un constat (page injoignable) ne se met pas en cache comme un verdict', false, 'accepté');
  exception when check_violation then perform pg_temp.v('un constat (page injoignable) ne se met pas en cache comme un verdict', true);
  end;

  -- Un nouveau vote REMPLACE la ligne (même clé), il ne s'empile pas.
  insert into public.verif_cache (cle, url, affirmation, verdict, votes)
  values (v_cle, 'https://www.largus.fr/x', 'courroie humide', 'non_soutenue', '["non_soutenue","soutenue","non_soutenue"]')
  on conflict (cle) do update set verdict = excluded.verdict, votes = excluded.votes, juge_le = now();
  select count(*) into v_n from public.verif_cache where cle = v_cle;
  perform pg_temp.v('un nouveau vote remplace l’ancien, une seule ligne par couple', v_n = 1, v_n::text);
end
$e$;

-- Sous anon : aucune lecture, aucune écriture.
set local role anon;
do $anon$
begin
  begin
    perform 1 from public.verif_cache limit 1;
    perform pg_temp.v('anon ne lit pas le cache', false, 'lecture permise');
  exception when insufficient_privilege then perform pg_temp.v('anon ne lit pas le cache', true);
  end;
  begin
    insert into public.verif_cache (cle, url, affirmation, verdict) values (repeat('c', 64), 'u', 'a', 'soutenue');
    perform pg_temp.v('anon n’écrit pas dans le cache', false, 'écriture permise');
  exception when insufficient_privilege then perform pg_temp.v('anon n’écrit pas dans le cache', true);
  end;
end
$anon$;
reset role;

do $verdict$
declare v_ko int; v_total int; v_liste text;
begin
  select count(*) filter (where not ok), count(*) into v_ko, v_total from r;
  if v_total < 6 then raise exception 'ESSAI VERIF_CACHE INCOMPLET : % controles seulement', v_total; end if;
  if v_ko > 0 then
    select string_agg(format('  - %s%s', quoi, coalesce(' ['||detail||']','')), E'\n' order by n)
      into v_liste from r where not ok;
    raise exception E'ESSAI VERIF_CACHE ECHOUE : %/% en echec\n%', v_ko, v_total, v_liste;
  end if;
  raise notice 'ESSAI VERIF_CACHE CONCLUANT : %/% controles passes', v_total, v_total;
end
$verdict$;

rollback;
