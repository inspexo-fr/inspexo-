-- ===========================================================================
-- SPRINT 13 — Drapeaux de fonctionnalité, modifiables depuis l'admin.
-- Migration ADDITIVE.
--
-- Besoin immédiat : pouvoir éprouver la lecture HistoVec EN PRODUCTION, sur un
-- vrai certificat, AVANT de l'ouvrir au public. D'où trois états et pas deux :
--
--   eteint          — la fonction n'existe pas pour le visiteur
--   admin_uniquement— seuls les comptes de la table `admins` y ont accès
--   public          — ouverte à tous (selon les règles propres de la fonction)
--
-- ⚠️ Le drapeau est lu CÔTÉ SERVEUR à chaque appel. Un drapeau qu'on lirait au
-- navigateur ne ferait que cacher un bouton : la fonction resterait appelable.
-- C'est la même leçon que le masquage de la négociation au sprint 7.
--
-- ⚠️ Défaut à `eteint` : une fonctionnalité nouvelle ne s'ouvre pas parce qu'on
-- a oublié de la fermer.
-- ===========================================================================

create table if not exists public.drapeaux (
  cle text primary key,
  etat text not null default 'eteint' check (etat in ('eteint', 'admin_uniquement', 'public')),
  description text,
  maj_le timestamptz not null default now(),
  maj_par text
);

alter table public.drapeaux enable row level security;
revoke all on public.drapeaux from anon, authenticated;

comment on table public.drapeaux is
  'Drapeaux de fonctionnalité. RLS active, AUCUNE policy : lecture et écriture '
  'par RPC SECURITY DEFINER uniquement. Défaut « eteint » (cf. migration).';

insert into public.drapeaux (cle, etat, description) values (
  'lecture_histovec',
  'eteint',
  'Dépôt et lecture du certificat de situation administrative HistoVec. À ouvrir seulement après validation sur un vrai certificat récent.'
) on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- Lecture. Rend l'ÉTAT EFFECTIF pour l'appelant, pas l'état brut : c'est le
-- serveur qui tranche « admin_uniquement », jamais le client.
-- ---------------------------------------------------------------------------
create or replace function public.drapeau_actif(p_cle text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_etat text;
  v_email text;
begin
  select etat into v_etat from public.drapeaux where cle = p_cle;
  -- Clé inconnue : éteint. On n'ouvre pas une fonction par faute de frappe.
  if v_etat is null or v_etat = 'eteint' then
    return false;
  end if;
  if v_etat = 'public' then
    return true;
  end if;

  -- admin_uniquement
  if auth.uid() is null then
    return false;
  end if;
  select email into v_email from auth.users where id = auth.uid();
  return exists (select 1 from public.admins where lower(email) = lower(coalesce(v_email, '')));
end;
$$;

/** État brut, pour l'écran d'administration. */
create or replace function public.drapeaux_liste()
returns setof public.drapeaux
language sql
security definer
stable
set search_path = public
as $$ select * from public.drapeaux order by cle $$;

create or replace function public.drapeau_definir(
  p_cle text,
  p_etat text,
  p_par text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  if p_etat not in ('eteint', 'admin_uniquement', 'public') then
    return jsonb_build_object('ok', false, 'raison', 'etat_inconnu');
  end if;
  update public.drapeaux
     set etat = p_etat, maj_le = now(), maj_par = left(coalesce(p_par, ''), 160)
   where cle = p_cle
  returning true into v_ok;
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'raison', 'cle_inconnue');
  end if;
  insert into public.events (name, props_json)
  values ('drapeau_change', jsonb_build_object('cle', p_cle, 'etat', p_etat, 'par', p_par));
  return jsonb_build_object('ok', true, 'cle', p_cle, 'etat', p_etat);
end;
$$;

-- `drapeau_actif` est appelée avec le JETON DE L'UTILISATEUR (elle a besoin de
-- auth.uid() pour trancher « admin_uniquement ») : elle est donc ouverte à
-- authenticated et anon. Les deux autres restent au service role.
revoke all on function public.drapeau_actif(text) from public;
grant execute on function public.drapeau_actif(text) to anon, authenticated, service_role;

revoke all on function public.drapeaux_liste() from public, anon, authenticated;
revoke all on function public.drapeau_definir(text, text, text) from public, anon, authenticated;
grant execute on function public.drapeaux_liste() to service_role;
grant execute on function public.drapeau_definir(text, text, text) to service_role;
