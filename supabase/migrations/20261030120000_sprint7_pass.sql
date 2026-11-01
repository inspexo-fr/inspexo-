-- SPRINT 7 — Pass achat : paiement Stripe Checkout, accès lié au compte du
-- dossier d'achat, déblocage CÔTÉ SERVEUR de la négociation détaillée.
-- Migration ADDITIVE : une table nouvelle (passes), des fonctions nouvelles,
-- et le remplacement de get_public_analysis (le détail de négociation partait
-- jusqu'ici ENTIER au navigateur, simplement flouté en CSS — il est désormais
-- retenu côté serveur tant que l'appelant n'a pas de Pass actif).
-- Aucune table existante modifiée.

-- ---------------------------------------------------------------------------
-- Table passes : un achat de Pass. Écrite UNIQUEMENT par les edge functions
-- (service role : webhook Stripe, admin). RLS activée, AUCUNE policy — comme
-- toutes les tables du projet, l'accès public passe par des RPC
-- SECURITY DEFINER.
-- ---------------------------------------------------------------------------
create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Compte du dossier d'achat (lien magique). Null tant que l'email Stripe
  -- n'a pas encore de compte : get_mon_pass() rattache au premier login.
  user_id uuid references auth.users (id) on delete set null,
  stripe_session text not null unique,
  stripe_payment_intent text,
  montant_cents integer not null,
  devise text not null default 'eur',
  mode text not null check (mode in ('precommande', 'vente')),
  statut text not null default 'actif' check (statut in ('actif', 'rembourse')),
  -- Droit de rétractation (14 j) : l'acheteur peut y renoncer expressément
  -- pour utiliser le service immédiatement (case dédiée au paiement).
  retractation_renoncee boolean not null default false,
  cgv_version text,
  debut timestamptz not null default now(),
  fin timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.passes enable row level security;

create index if not exists passes_user_idx on public.passes (user_id);
create index if not exists passes_email_idx on public.passes (lower(email));

-- ---------------------------------------------------------------------------
-- Helper interne : le Pass de cet utilisateur est-il actif MAINTENANT ?
-- (statut actif + fenêtre debut/fin — l'expiration est portée par la date,
-- jamais par un cron). Réservé aux fonctions SECURITY DEFINER.
-- ---------------------------------------------------------------------------
create or replace function public._pass_actif(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.passes
    where user_id = p_user
      and statut = 'actif'
      and now() >= debut
      and now() < fin
  );
$$;
revoke all on function public._pass_actif(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper interne : version PUBLIQUE (sans Pass) du bloc négociation.
-- Gratuit = fourchette totale + les 2 postes principaux (avec leurs sources).
-- Retenu côté serveur : autres postes, arguments sans montant, argumentaire
-- prêt à dire. Les compteurs restent exposés pour que l'interface puisse
-- annoncer ce que le Pass débloque, sans jamais recevoir le contenu.
-- ---------------------------------------------------------------------------
create or replace function public._negociation_publique(n jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when n is null or jsonb_typeof(n) <> 'object' then n
    else jsonb_build_object(
      'total_min_eur', n->'total_min_eur',
      'total_max_eur', n->'total_max_eur',
      'nb_postes_chiffres', n->'nb_postes_chiffres',
      'mention', n->'mention',
      'postes', coalesce((
        select jsonb_agg(value) from (
          select value from jsonb_array_elements(coalesce(n->'postes', '[]'::jsonb))
          limit 2
        ) t
      ), '[]'::jsonb),
      'arguments_sans_montant', '[]'::jsonb,
      'argumentaire', null,
      'masque', true,
      'nb_postes_masques',
        greatest(coalesce(jsonb_array_length(n->'postes'), 0) - 2, 0),
      'nb_arguments_masques',
        coalesce(jsonb_array_length(n->'arguments_sans_montant'), 0)
    )
  end;
$$;
revoke all on function public._negociation_publique(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_mon_pass() : rattache les Pass achetés avec cet email (l'email Stripe
-- crée ou précède le compte) puis renvoie le Pass actif, ou null.
-- ---------------------------------------------------------------------------
create or replace function public.get_mon_pass()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_pass public.passes%rowtype;
begin
  if v_uid is null then
    return null;
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is not null then
    update public.passes
    set user_id = v_uid
    where user_id is null and lower(email) = v_email;
  end if;

  select * into v_pass
  from public.passes
  where user_id = v_uid and statut = 'actif' and now() >= debut and now() < fin
  order by fin desc
  limit 1;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'mode', v_pass.mode,
    'debut', v_pass.debut,
    'fin', v_pass.fin
  );
end;
$$;
revoke all on function public.get_mon_pass() from public, anon;
grant execute on function public.get_mon_pass() to authenticated;

-- ---------------------------------------------------------------------------
-- get_public_analysis : même corps qu'au sprint 5, plus :
--  - masquage serveur du détail de négociation sans Pass actif,
--  - drapeau 'pass' dans le payload (l'interface sait ce qui est débloqué).
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

-- ---------------------------------------------------------------------------
-- get_kit_signature : données de pré-remplissage du contrat de cession
-- (kit « Avant de signer »). Réservé aux utilisateurs connectés avec Pass
-- actif — le déblocage est serveur, jamais côté client.
-- ---------------------------------------------------------------------------
create or replace function public.get_kit_signature(p_analysis_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.analyses%rowtype;
begin
  if v_uid is null or not public._pass_actif(v_uid) then
    return jsonb_build_object('pass', false);
  end if;

  select * into v_row from public.analyses where id = p_analysis_id;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'pass', true,
    'ref_num', v_row.ref_num,
    'created_at', v_row.created_at,
    'vehicule', jsonb_build_object(
      'marque', v_row.marque,
      'modele', v_row.modele,
      'motorisation', v_row.motorisation,
      'annee', v_row.annee,
      'kilometrage', v_row.result_json->'vehicule'->'kilometrage',
      'prix_affiche', v_row.result_json->'vehicule'->'prix_affiche'
    )
  );
end;
$$;
revoke all on function public.get_kit_signature(uuid) from public, anon;
grant execute on function public.get_kit_signature(uuid) to authenticated;
