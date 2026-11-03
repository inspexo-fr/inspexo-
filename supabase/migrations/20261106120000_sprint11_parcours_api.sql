-- ===========================================================================
-- SPRINT 11 — Mesure du parcours (sans traceur) et API de scoring v0.
-- Migration ADDITIVE.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. SEL D'IP ROTATIF QUOTIDIEN
--
-- ⚠️ DÉFAUT CORRIGÉ ICI : `_request_ip_hash` calculait jusqu'à présent
-- sha256(prefixe || ip), SANS AUCUN SEL SECRET. Les 4 milliards d'adresses
-- IPv4 s'énumèrent en quelques secondes : les empreintes stockées étaient
-- donc réversibles en pratique, ce qui n'était ni conforme à ce que dit la
-- politique de confidentialité, ni à l'exemption CNIL de mesure d'audience.
--
-- Désormais : un sel ALÉATOIRE PAR JOUR, créé à la demande, et les sels de
-- plus de deux jours sont effacés. Passé ce délai, retrouver l'IP d'une
-- empreinte devient impossible même pour nous — c'est ce qui rend
-- l'anonymisation effective plutôt que déclarative.
--
-- Conséquence assumée : les plafonds SQL comptés sur 24 h (leads,
-- track_event) se réinitialisent au changement de sel. Le plafond critique
-- — 5 analyses / 24 h — vit dans la fonction edge `score` avec IP_HASH_SALT
-- stable : il n'est PAS affecté.
-- ---------------------------------------------------------------------------
create table if not exists public.ip_salts (
  jour date primary key,
  sel text not null,
  created_at timestamptz not null default now()
);

alter table public.ip_salts enable row level security;
revoke all on public.ip_salts from anon, authenticated;

comment on table public.ip_salts is
  'Sel quotidien du hachage d''IP. Les entrées de plus de 2 jours sont '
  'effacées : au-delà, une empreinte n''est plus rattachable à une adresse.';

create or replace function public._sel_du_jour()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sel text;
begin
  select sel into v_sel from public.ip_salts where jour = current_date;
  if v_sel is null then
    v_sel := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.ip_salts (jour, sel) values (current_date, v_sel)
      on conflict (jour) do nothing;
    select sel into v_sel from public.ip_salts where jour = current_date;
    -- Purge : au-delà de deux jours, le sel disparaît et les empreintes
    -- qu'il a produites deviennent définitivement anonymes.
    delete from public.ip_salts where jour < current_date - 2;
  end if;
  return v_sel;
end;
$$;

revoke all on function public._sel_du_jour() from public, anon, authenticated;

create or replace function public._request_ip_hash(p_prefix text)
returns text
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      public._sel_du_jour() || ':' || p_prefix || coalesce(
        current_setting('request.headers', true)::json->>'cf-connecting-ip',
        split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)
      ),
      'sha256'
    ),
    'hex'
  );
$$;
revoke all on function public._request_ip_hash(text) from public, anon, authenticated;

-- Effacement des empreintes NON SALÉES déjà stockées : elles sont
-- réversibles, on ne les garde pas. Ciblage par NOM D'ÉVÉNEMENT — seuls les
-- events insérés par les RPC SQL portaient une empreinte sans sel ; ceux des
-- fonctions edge (score_started, visite_photo…) utilisaient déjà
-- IP_HASH_SALT et restent intacts.
update public.events set ip_hash = null
where ip_hash is not null
  and name in (
    'lead_submitted', 'result_viewed', 'outcome_submitted', 'dossier_added',
    'pending_analysis_queued', 'charte_signee', 'inspecteur_rc_renouvelee',
    'inspection_acceptee', 'inspection_refusee',
    'share_clicked', 'verdict_feedback', 'visite_started'
  );

-- ---------------------------------------------------------------------------
-- 2. ATTRIBUTION DE SOURCE (?src=)
--
-- Une étiquette de campagne, rien d'autre : pas d'identifiant, pas de
-- recoupement, format strictement contraint. Elle n'est lue qu'en AGRÉGÉ
-- dans l'admin et ne figure dans aucun export à côté d'un email.
-- ---------------------------------------------------------------------------
alter table public.analyses add column if not exists src text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analyses_src_chk') then
    alter table public.analyses add constraint analyses_src_chk
      check (src is null or src ~ '^[a-z0-9][a-z0-9-]{0,39}$');
  end if;
end $$;

create index if not exists analyses_src_idx on public.analyses (src, created_at desc)
  where src is not null;

-- ---------------------------------------------------------------------------
-- 3. ÉVÉNEMENTS DE PARCOURS
--
-- Deux noms manquaient pour fermer le tunnel. Ils sont reliés par
-- analysis_id SEUL : `track_event` n'y écrit aucune empreinte d'IP pour ces
-- deux-là, conformément à l'exemption de mesure d'audience.
-- ---------------------------------------------------------------------------
create or replace function public.track_event(p_name text, p_analysis_id uuid default null, p_props jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text;
  -- Événements de MESURE DE PARCOURS : aucun identifiant navigateur, aucune
  -- empreinte d'IP. Reliés à l'analyse, et c'est tout.
  v_parcours boolean := p_name in ('pass_clicked', 'inspection_clicked');
begin
  if p_name not in ('share_clicked', 'verdict_feedback', 'visite_started',
                    'pass_clicked', 'inspection_clicked') then
    raise exception 'event non autorisé';
  end if;
  if p_props is not null and pg_column_size(p_props) > 2048 then
    raise exception 'props trop volumineux';
  end if;
  if p_name = 'verdict_feedback' then
    if p_props is null or not (p_props ? 'utile')
       or jsonb_typeof(p_props->'utile') <> 'boolean'
       or (select count(*) from jsonb_object_keys(p_props)) > 1 then
      raise exception 'props invalides';
    end if;
  end if;

  if v_parcours then
    -- Plafond par analyse, pas par IP : on ne veut pas d'identifiant ici.
    if (select count(*) from public.events
        where name = p_name and analysis_id = p_analysis_id) >= 20 then
      return;
    end if;
    insert into public.events (name, analysis_id, ip_hash, props_json)
    values (p_name, p_analysis_id, null, null);
    return;
  end if;

  v_ip_hash := public._request_ip_hash('evt:');
  if (select count(*) from public.events
      where ip_hash = v_ip_hash and created_at > now() - interval '24 hours') >= 120 then
    raise exception 'trop d''événements';
  end if;
  insert into public.events (name, analysis_id, ip_hash, props_json)
  values (p_name, p_analysis_id, v_ip_hash, p_props);
end;
$$;

grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. CLIENTS D'API
--
-- La clé n'est JAMAIS stockée en clair : seule son empreinte salée l'est
-- (sel secret API_KEY_SALT, détenu par la fonction edge). Elle est montrée
-- une fois à sa création puis irrécupérable.
-- ---------------------------------------------------------------------------
create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null check (length(nom) between 2 and 80),
  cle_hash text not null unique check (cle_hash ~ '^[0-9a-f]{64}$'),
  -- Début de clé, pour reconnaître une ligne dans l'admin. Insuffisant pour
  -- reconstituer la clé.
  cle_apercu text not null,
  quota_mensuel integer not null default 100 check (quota_mensuel >= 0 and quota_mensuel <= 100000),
  actif boolean not null default true,
  revoque_le timestamptz,
  contact text
);

alter table public.api_clients enable row level security;
revoke all on public.api_clients from anon, authenticated;

create table if not exists public.api_usage (
  client_id uuid not null references public.api_clients (id) on delete cascade,
  mois text not null check (mois ~ '^\d{4}-\d{2}$'),
  appels integer not null default 0,
  dernier_appel timestamptz,
  primary key (client_id, mois)
);

alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

-- Plafond JOURNALIER GLOBAL, séparé du trafic public : une rafale côté API
-- ne doit jamais fermer le service gratuit, et inversement.
create table if not exists public.api_quota_jour (
  jour date primary key,
  appels integer not null default 0
);

alter table public.api_quota_jour enable row level security;
revoke all on public.api_quota_jour from anon, authenticated;

-- ---------------------------------------------------------------------------
-- api_consommer : vérifie et débite EN UNE SEULE OPÉRATION ATOMIQUE.
-- Deux appels simultanés ne peuvent pas passer le même dernier crédit.
-- ---------------------------------------------------------------------------
create or replace function public.api_consommer(
  p_cle_hash text,
  p_plafond_jour integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.api_clients%rowtype;
  v_mois text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_appels_mois integer;
  v_appels_jour integer;
begin
  select * into c from public.api_clients where cle_hash = p_cle_hash;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'cle_inconnue');
  end if;
  if not c.actif then
    return jsonb_build_object('ok', false, 'raison', 'cle_revoquee');
  end if;

  -- Compteur journalier global d'abord : il protège la facture.
  insert into public.api_quota_jour (jour, appels) values (current_date, 0)
    on conflict (jour) do nothing;
  select appels into v_appels_jour from public.api_quota_jour
    where jour = current_date for update;
  if v_appels_jour >= p_plafond_jour then
    return jsonb_build_object('ok', false, 'raison', 'plafond_journalier',
                              'plafond', p_plafond_jour);
  end if;

  insert into public.api_usage (client_id, mois, appels) values (c.id, v_mois, 0)
    on conflict (client_id, mois) do nothing;
  select appels into v_appels_mois from public.api_usage
    where client_id = c.id and mois = v_mois for update;
  if v_appels_mois >= c.quota_mensuel then
    return jsonb_build_object('ok', false, 'raison', 'quota_mensuel',
                              'quota', c.quota_mensuel);
  end if;

  update public.api_usage set appels = appels + 1, dernier_appel = now()
    where client_id = c.id and mois = v_mois;
  update public.api_quota_jour set appels = appels + 1 where jour = current_date;

  return jsonb_build_object(
    'ok', true, 'client_id', c.id, 'nom', c.nom,
    'restant_mois', greatest(0, c.quota_mensuel - v_appels_mois - 1),
    'quota_mensuel', c.quota_mensuel
  );
end;
$$;

revoke all on function public.api_consommer(text, integer) from public, anon, authenticated;
grant execute on function public.api_consommer(text, integer) to service_role;

-- api_rembourser : rend le crédit quand l'analyse n'a RIEN produit (panne du
-- fournisseur d'IA, délai dépassé). Facturer un appel sans résultat serait
-- indéfendable. Jamais en dessous de zéro.
create or replace function public.api_rembourser(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mois text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  update public.api_usage set appels = greatest(0, appels - 1)
    where client_id = p_client_id and mois = v_mois;
  update public.api_quota_jour set appels = greatest(0, appels - 1)
    where jour = current_date;
end;
$$;

revoke all on function public.api_rembourser(uuid) from public, anon, authenticated;
grant execute on function public.api_rembourser(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. CONTACTS PRO (page /pro, tarif sur devis)
-- ---------------------------------------------------------------------------
create table if not exists public.leads_pro (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  societe text,
  volume_estime text,
  message text,
  traite boolean not null default false
);

alter table public.leads_pro enable row level security;
revoke all on public.leads_pro from anon, authenticated;

create or replace function public.submit_lead_pro(
  p_email text,
  p_societe text default null,
  p_volume text default null,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text := public._request_ip_hash('pro:');
begin
  if p_email is null or length(p_email) > 320
     or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email invalide';
  end if;
  if (select count(*) from public.events
      where name = 'lead_pro_submitted' and ip_hash = v_ip_hash
        and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;
  insert into public.leads_pro (email, societe, volume_estime, message)
  values (lower(trim(p_email)), left(p_societe, 120), left(p_volume, 60), left(p_message, 2000));
  insert into public.events (name, ip_hash) values ('lead_pro_submitted', v_ip_hash);
end;
$$;

grant execute on function public.submit_lead_pro(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. get_parcours — le tunnel, par semaine et par source.
--
-- Réservée au service role : l'admin y accède par sa fonction edge. La
-- source n'apparaît qu'en AGRÉGÉ, jamais à côté d'une adresse email.
-- ---------------------------------------------------------------------------
create or replace function public.get_parcours(p_semaines integer default 12)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
with bornes as (
  select greatest(1, least(52, coalesce(p_semaines, 12))) as n
),
analyses_reelles as (
  select a.id, a.created_at, coalesce(a.src, '(direct)') as src,
         date_trunc('week', a.created_at)::date as semaine
  from public.analyses a, bornes b
  where not a.is_eval
    and a.created_at >= now() - (b.n || ' weeks')::interval
),
etapes as (
  select ar.semaine, ar.src, ar.id,
    true as analyse_lancee,
    exists (select 1 from public.events e where e.analysis_id = ar.id and e.name = 'result_viewed') as verdict_affiche,
    exists (select 1 from public.events e where e.analysis_id = ar.id and e.name = 'pass_clicked') as clic_pass,
    exists (select 1 from public.events e where e.analysis_id = ar.id and e.name = 'pass_checkout') as paiement_ouvert,
    exists (select 1 from public.events e where e.analysis_id = ar.id and e.name = 'pass_active') as paiement_reussi,
    exists (select 1 from public.events e where e.analysis_id = ar.id and e.name = 'inspection_clicked') as clic_inspection,
    exists (select 1 from public.leads l where l.analysis_id = ar.id and l.source = 'expert_waitlist') as liste_attente,
    exists (select 1 from public.mises_en_relation m where m.analysis_id = ar.id and not m.robot) as clic_partenaire,
    exists (select 1 from public.leads l where l.analysis_id = ar.id and l.source = 'rapport') as optin_rapport,
    exists (select 1 from public.outcomes o where o.analysis_id = ar.id) as retour_issue
  from analyses_reelles ar
),
delais as (
  -- Délai médian analyse → paiement réussi.
  select percentile_cont(0.5) within group (
           order by extract(epoch from (e.created_at - a.created_at))
         ) as median_s
  from public.analyses a
  join public.events e on e.analysis_id = a.id and e.name = 'pass_active'
  where not a.is_eval
)
select jsonb_build_object(
  'semaines', coalesce((
    select jsonb_agg(x order by x->>'semaine' desc) from (
      select jsonb_build_object(
        'semaine', semaine, 'src', src,
        'analyse_lancee', count(*),
        'verdict_affiche', count(*) filter (where verdict_affiche),
        'clic_pass', count(*) filter (where clic_pass),
        'paiement_ouvert', count(*) filter (where paiement_ouvert),
        'paiement_reussi', count(*) filter (where paiement_reussi),
        'clic_inspection', count(*) filter (where clic_inspection),
        'liste_attente', count(*) filter (where liste_attente),
        'clic_partenaire', count(*) filter (where clic_partenaire),
        'optin_rapport', count(*) filter (where optin_rapport),
        'retour_issue', count(*) filter (where retour_issue)
      ) as x
      from etapes group by semaine, src
    ) t
  ), '[]'::jsonb),
  'total', (select jsonb_build_object(
      'analyse_lancee', count(*),
      'verdict_affiche', count(*) filter (where verdict_affiche),
      'clic_pass', count(*) filter (where clic_pass),
      'paiement_ouvert', count(*) filter (where paiement_ouvert),
      'paiement_reussi', count(*) filter (where paiement_reussi),
      'clic_inspection', count(*) filter (where clic_inspection),
      'liste_attente', count(*) filter (where liste_attente),
      'clic_partenaire', count(*) filter (where clic_partenaire),
      'optin_rapport', count(*) filter (where optin_rapport),
      'retour_issue', count(*) filter (where retour_issue)
    ) from etapes),
  'delai_median_paiement_s', (select median_s from delais)
);
$$;

revoke all on function public.get_parcours(integer) from public, anon, authenticated;
grant execute on function public.get_parcours(integer) to service_role;

comment on table public.api_clients is
  'Clés d''API. La clé en clair n''est jamais stockée : empreinte salée '
  'uniquement, montrée une seule fois à la création.';
comment on table public.leads_pro is
  'Demandes de contact via /pro. Tarif sur devis, aucune facturation automatique.';
