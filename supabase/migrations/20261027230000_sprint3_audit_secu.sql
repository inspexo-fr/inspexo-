-- SPRINT 3 — Correctifs de l'audit sécurité (finding C2) :
-- dossier_add / submit_outcome inséraient un event à CHAQUE appel, même no-op,
-- sans ip_hash — amplification d'écriture illimitée sur `events` par tout
-- compte lien-magique. Désormais : event UNIQUEMENT quand une ligne est
-- réellement créée, avec ip_hash, et garde-fou d'appels par utilisateur.

create or replace function public.dossier_add(p_analysis_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_insere boolean;
begin
  if v_uid is null then raise exception 'non connecté'; end if;
  if not exists (select 1 from public.analyses where id = p_analysis_id) then
    raise exception 'analyse introuvable';
  end if;
  if (select count(*) from public.dossier where user_id = v_uid) >= 100 then
    raise exception 'dossier plein';
  end if;

  insert into public.dossier (user_id, analysis_id)
  values (v_uid, p_analysis_id)
  on conflict (user_id, analysis_id) do nothing;
  get diagnostics v_insere = row_count;

  -- Un appel répété sur un doublon est un no-op total : aucune ligne event.
  if v_insere then
    insert into public.events (name, analysis_id, ip_hash, props_json)
    values ('dossier_added', p_analysis_id, public._request_ip_hash('dossier:'),
            jsonb_build_object('user_id', v_uid));
  end if;
end;
$$;

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
    select 1 from public.dossier where user_id = v_uid and analysis_id = p_analysis_id
  ) then
    raise exception 'analyse absente du dossier';
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

  -- Event au PREMIER retour seulement (les mises à jour n'en créent pas).
  if v_nouveau then
    insert into public.events (name, analysis_id, ip_hash, props_json)
    values ('outcome_submitted', p_analysis_id, public._request_ip_hash('outcome:'),
            jsonb_build_object('user_id', v_uid));
  end if;
end;
$$;

grant execute on function public.dossier_add(uuid) to authenticated;
grant execute on function public.submit_outcome(uuid, integer, text, text) to authenticated;
revoke all on function public.dossier_add(uuid) from public, anon;
revoke all on function public.submit_outcome(uuid, integer, text, text) from public, anon;
