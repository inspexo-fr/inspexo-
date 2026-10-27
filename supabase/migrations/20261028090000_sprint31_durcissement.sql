-- SPRINT 3.1 — Durcissement avant presse (migration ADDITIVE).
-- 1. Rôle admin stocké en base (table admins) : les fonctions admin-* ne se
--    fondent plus sur une égalité d'email codée en dur.
-- 2. Policies du bucket privé « devis » VERSIONNÉES ici (lecture réservée aux
--    admins ; aucune policy d'écriture : seules les edge functions service
--    role écrivent).
-- 3. submit_outcome réservé aux analyses marquées « acheté » dans le dossier.

-- ============================================================
-- 1. Table admins
-- ============================================================
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  cree_par text
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
-- Aucune policy : lecture exclusivement via service role (edge functions).

-- Seed : l'administrateur actuel (compte auth existant de contact@inspexo.io).
insert into public.admins (user_id, email, cree_par)
select id, email, 'migration sprint3.1'
from auth.users
where lower(email) = 'contact@inspexo.io'
on conflict (user_id) do nothing;

-- ============================================================
-- 2. Policies storage du bucket « devis » (versionnées)
-- ============================================================
-- RLS est active par défaut sur storage.objects chez Supabase : sans policy,
-- ni anon ni authenticated n'accèdent au bucket (le service role bypasse).
-- On versionne ici la SEULE ouverture voulue : lecture par les admins.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'devis lecture admins'
  ) then
    create policy "devis lecture admins"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'devis'
        and exists (select 1 from public.admins a where a.user_id = auth.uid())
      );
  end if;
end $$;

-- ============================================================
-- 3. submit_outcome : réservé aux analyses au statut « acheté »
-- ============================================================
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
  -- Un retour d'issue n'a de sens que sur un véhicule effectivement acheté.
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
            jsonb_build_object('user_id', v_uid));
  end if;
end;
$$;

grant execute on function public.submit_outcome(uuid, integer, text, text) to authenticated;
revoke all on function public.submit_outcome(uuid, integer, text, text) from public, anon;
