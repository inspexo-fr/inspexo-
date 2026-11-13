-- SPRINT 24 lot 3 (A) — Journal des retours (formule pro).
--
-- Décision d'Utku du 13 nov. 2026 : chaque pro ne voit QUE ses retours ; une
-- vue agrégée pour l'admin seulement ; aucune statistique publique ni
-- affichée au pro. Fidèle à la règle du projet : RLS active, AUCUNE policy,
-- accès par RPC SECURITY DEFINER filtrées sur auth.uid().
-- Listes fermées : identiques à src/data/retoursStock.js (testé).

create table if not exists public.retours_stock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Référence de stock du professionnel (texte libre court, jamais le VIN).
  stock_ref text not null check (char_length(stock_ref) between 1 and 40),
  date_retour date not null,
  km integer not null check (km between 0 and 1500000),
  famille_moteur text not null check (char_length(famille_moteur) between 1 and 20),
  piece text not null check (piece in ('moteur','distribution','turbo','injecteur','egr','fap','boite','embrayage','refroidissement',
    'frein','direction','amortisseur','electronique','batterie','clim','echappement','carrosserie','pneu','autre')),
  cout_ttc numeric(10,2) not null check (cout_ttc >= 0 and cout_ttc < 100000),
  paye_par text not null check (paye_par in ('marchand','constructeur','garantie_commerciale','autre')),
  commentaire text check (commentaire is null or char_length(commentaire) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists retours_stock_user on public.retours_stock (user_id, date_retour desc);
alter table public.retours_stock enable row level security;
revoke all on public.retours_stock from anon, authenticated;

-- Pro actif ou admin ? (même règle que la fonction edge `stock`).
create or replace function public._acces_pro(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = p_user)
      or exists (select 1 from public.abonnements_pro
                 where user_id = p_user and statut = 'actif' and periode_fin > now());
$$;
revoke all on function public._acces_pro(uuid) from public, anon, authenticated;

create or replace function public.retour_stock_ajouter(
  p_stock_ref text, p_date date, p_km integer, p_famille text, p_piece text,
  p_cout_ttc numeric, p_paye_par text, p_commentaire text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public._acces_pro(auth.uid()) then
    raise exception 'pro_requis' using errcode = '42501';
  end if;
  -- La famille doit être une famille moteur EXISTANTE (fiches en base).
  if not exists (select 1 from public.defect_sheets
                 where famille_norm = upper(regexp_replace(coalesce(p_famille, ''), '[^A-Za-z0-9]', '', 'g'))) then
    raise exception 'famille_inconnue' using errcode = '22023';
  end if;
  if p_date > current_date then
    raise exception 'date_future' using errcode = '22023';
  end if;
  insert into public.retours_stock (user_id, stock_ref, date_retour, km, famille_moteur, piece, cout_ttc, paye_par, commentaire)
  values (auth.uid(), btrim(p_stock_ref), p_date, p_km, upper(btrim(p_famille)), p_piece, p_cout_ttc, p_paye_par, nullif(btrim(p_commentaire), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.retours_stock_lister()
returns setof public.retours_stock language sql stable security definer set search_path = public as $$
  select * from public.retours_stock
  where user_id = auth.uid() and public._acces_pro(auth.uid())
  order by date_retour desc, created_at desc limit 500;
$$;

create or replace function public.retour_stock_supprimer(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.retours_stock where id = p_id and user_id = auth.uid();
  return found;
end $$;

-- Vue AGRÉGÉE, admin seulement : aucun retour individuel, aucun utilisateur.
create or replace function public.retours_stock_agreges()
returns table (famille_moteur text, piece text, paye_par text, nb bigint, cout_median numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'admin_requis' using errcode = '42501';
  end if;
  return query
    select r.famille_moteur, r.piece, r.paye_par, count(*),
           percentile_cont(0.5) within group (order by r.cout_ttc)::numeric
    from public.retours_stock r group by 1, 2, 3 order by 4 desc;
end $$;

-- Accès public : décisions ÉCRITES (règle 0 quater).
revoke all on function public.retour_stock_ajouter(text, date, integer, text, text, numeric, text, text) from public, anon;
revoke all on function public.retours_stock_lister() from public, anon;
revoke all on function public.retour_stock_supprimer(uuid) from public, anon;
revoke all on function public.retours_stock_agreges() from public, anon;
grant execute on function public.retour_stock_ajouter(text, date, integer, text, text, numeric, text, text) to authenticated;
grant execute on function public.retours_stock_lister() to authenticated;
grant execute on function public.retour_stock_supprimer(uuid) to authenticated;
grant execute on function public.retours_stock_agreges() to authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.retours_stock', 'select')
     or has_table_privilege('authenticated', 'public.retours_stock', 'select') then
    raise exception 'retours_stock lisible en direct';
  end if;
end $$;
