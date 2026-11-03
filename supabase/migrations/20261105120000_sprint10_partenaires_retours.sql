-- ===========================================================================
-- SPRINT 10 — Le moment du verdict : mise en relation partenaires et retour
-- d'issue. Migration ADDITIVE.
--
-- CADRE JURIDIQUE, à ne pas défaire :
--  - La garantie panne est une ASSURANCE. Sans immatriculation ORIAS, Inspexo
--    est un simple INDICATEUR : il met en relation, il ne conseille pas, il
--    ne décrit aucun contrat. Aucun contenu de contrat n'est stocké ici —
--    `texte_valide` est le texte fourni ET validé par le partenaire, dont le
--    contenu est contrôlé par `_shared/partenaires.ts` à l'enregistrement.
--  - Le crédit relève du statut d'indicateur (art. R519-2 CMF). Aucun
--    simulateur, aucune mensualité, aucun taux ne transite par cette base.
--  - Les deux sont ÉTEINTS par défaut : `actif` vaut false, et aucune ligne
--    n'est semée. Rien n'apparaît tant qu'un humain n'a pas activé.
--
-- INDÉPENDANCE : aucune de ces tables n'est lue par le calcul du score, du
-- barème ou du verdict. `tests/independance-score.test.mjs` le vérifie.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. partenaires
-- ---------------------------------------------------------------------------
create table if not exists public.partenaires (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('assurance', 'credit')),
  -- Identifiant de la route /go/<slug> : jamais l'id technique dans une URL.
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  nom text not null check (length(nom) between 2 and 80),
  -- URL de destination : elle n'est JAMAIS exposée au navigateur. Le client
  -- reçoit le slug, la redirection se fait côté serveur — sans quoi la
  -- mise en relation ne serait pas comptée.
  url text not null check (url ~ '^https://'),
  -- Texte FOURNI ET VALIDÉ PAR LE PARTENAIRE, affiché tel quel. Contrôlé par
  -- _shared/partenaires.ts avant toute écriture (fonction admin).
  texte_valide text not null check (length(texte_valide) between 20 and 600),
  valide_le date not null,
  actif boolean not null default false,
  maj timestamptz not null default now()
);

alter table public.partenaires enable row level security;
revoke all on public.partenaires from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. mises_en_relation — une ligne par passage sur /go/<slug>.
--    `robot` est posé par la fonction edge à partir du user-agent : on garde
--    la ligne (pour voir ce qui frappe) mais elle ne compte jamais dans le
--    chiffre net. Aucune donnée personnelle : pas d'email, pas de nom, pas
--    d'IP en clair — seulement une empreinte salée.
-- ---------------------------------------------------------------------------
create table if not exists public.mises_en_relation (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  partenaire_id uuid not null references public.partenaires (id) on delete cascade,
  analysis_id uuid references public.analyses (id) on delete set null,
  source text not null default 'web' check (source in ('web', 'app', 'ext')),
  ip_hash text,
  robot boolean not null default false
);

create index if not exists mises_en_relation_partenaire_idx
  on public.mises_en_relation (partenaire_id, created_at desc);

alter table public.mises_en_relation enable row level security;
revoke all on public.mises_en_relation from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. retours — INVITATIONS au retour d'issue (les réponses vont dans outcomes).
--
--    Règle posée pour ce sprint : UNE SEULE invitation par dossier et par
--    email, jamais de relance. L'unicité (analysis_id, email_hash) la rend
--    structurelle : l'union des sources (dossier, Pass, inspection, opt-in)
--    est dédoublonnée par la base, pas par la bonne volonté du cron.
-- ---------------------------------------------------------------------------
create table if not exists public.retours (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  -- Empreinte de l'email : suffit à dédoublonner et à mesurer, sans conserver
  -- l'adresse une deuxième fois dans la base.
  email_hash text not null,
  -- Empreinte du jeton du lien signé : le jeton lui-même n'est jamais stocké.
  token_hash text not null,
  source text not null check (source in ('dossier', 'pass', 'inspection', 'lead')),
  envoye_le timestamptz,
  repondu_le timestamptz,
  unique (analysis_id, email_hash)
);

create index if not exists retours_token_idx on public.retours (token_hash);

alter table public.retours enable row level security;
revoke all on public.retours from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. outcomes — extension ADDITIVE pour la réponse sans compte.
--    L'existant (sprint 3) exigeait un compte ET un dossier marqué « acheté » :
--    il présupposait l'achat au lieu de le demander. On garde la table et on
--    ouvre la voie du lien signé.
-- ---------------------------------------------------------------------------
alter table public.outcomes add column if not exists achete boolean;
alter table public.outcomes add column if not exists points_confirmes_choix text;
alter table public.outcomes add column if not exists retour_id uuid references public.retours (id) on delete set null;
alter table public.outcomes add column if not exists source text not null default 'compte';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outcomes_points_choix_chk') then
    alter table public.outcomes add constraint outcomes_points_choix_chk
      check (points_confirmes_choix is null or points_confirmes_choix in ('oui', 'non', 'pas_verifie'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'outcomes_source_chk') then
    alter table public.outcomes add constraint outcomes_source_chk
      check (source in ('compte', 'lien_signe'));
  end if;
end $$;

-- L'unicité historique (user_id, analysis_id) ne dédoublonne PAS les réponses
-- sans compte : en SQL, deux NULL sont distincts. Index partiel explicite.
create unique index if not exists outcomes_anonyme_unique
  on public.outcomes (analysis_id) where user_id is null;

-- ---------------------------------------------------------------------------
-- 5. leads.code_postal — la carte de la demande hors zone.
--    Le code postal sert à savoir OÙ recruter des inspecteurs. Il n'est pas
--    une donnée d'identification : il désigne une commune, pas une personne.
-- ---------------------------------------------------------------------------
alter table public.leads add column if not exists code_postal text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_code_postal_chk') then
    alter table public.leads add constraint leads_code_postal_chk
      check (code_postal is null or code_postal ~ '^[0-9]{5}$');
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 6. desinscriptions — opposition par EMPREINTE D'EMAIL.
--
--    La désinscription existante (sprint 3.1) coupe les alertes d'un COMPTE
--    (`dossier.alertes`). Or une invitation au retour d'issue peut partir vers
--    quelqu'un qui n'a pas de compte : acheteur de Pass rattaché par email,
--    opt-in « recevoir ce rapport ». Sans cette table, son « STOP » n'aurait
--    nulle part où s'inscrire. L'adresse n'est jamais stockée en clair.
-- ---------------------------------------------------------------------------
create table if not exists public.desinscriptions (
  email_hash text primary key,
  created_at timestamptz not null default now(),
  origine text not null default 'lien' check (origine in ('lien', 'admin'))
);

alter table public.desinscriptions enable row level security;
revoke all on public.desinscriptions from anon, authenticated;

comment on table public.desinscriptions is
  'Opposition aux emails par empreinte d''adresse (pas de compte requis). '
  'Consultée AVANT toute invitation au retour d''issue.';

-- ---------------------------------------------------------------------------
-- RPC publique : partenaires actifs, SANS leur URL.
--
-- L'URL reste côté serveur : le navigateur ne reçoit que le slug, et la
-- redirection passe obligatoirement par /go/<slug>. Sans cela, le lien
-- pourrait être suivi sans être compté, et le chiffre affiché à l'admin
-- serait faux.
-- ---------------------------------------------------------------------------
create or replace function public.get_partenaires_actifs()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', slug,
           'type', type,
           'nom', nom,
           'texte_valide', texte_valide,
           'valide_le', valide_le
         ) order by type, nom), '[]'::jsonb)
  from public.partenaires
  where actif;
$$;

grant execute on function public.get_partenaires_actifs() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC service role : journalise une mise en relation et rend l'URL.
-- Appelée UNIQUEMENT par la fonction edge `go`.
-- ---------------------------------------------------------------------------
create or replace function public.enregistrer_mise_en_relation(
  p_slug text,
  p_analysis_id uuid,
  p_source text,
  p_ip_hash text,
  p_robot boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.partenaires%rowtype;
begin
  select * into v from public.partenaires where slug = p_slug and actif;
  if not found then
    return null; -- partenaire inconnu ou éteint : aucune redirection
  end if;
  insert into public.mises_en_relation (partenaire_id, analysis_id, source, ip_hash, robot)
  values (
    v.id,
    p_analysis_id,
    case when p_source in ('web', 'app', 'ext') then p_source else 'web' end,
    left(coalesce(p_ip_hash, ''), 64),
    coalesce(p_robot, false)
  );
  return jsonb_build_object('url', v.url, 'nom', v.nom, 'type', v.type);
end;
$$;

revoke all on function public.enregistrer_mise_en_relation(text, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.enregistrer_mise_en_relation(text, uuid, text, text, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- RPC publique : demande hors zone avec code postal (carte de la demande).
-- Même plafond que submit_lead : 10 par IP et par 24 h.
-- ---------------------------------------------------------------------------
create or replace function public.submit_demande_zone(
  p_email text,
  p_code_postal text,
  p_analysis_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_hash text := public._request_ip_hash('lead:');
  v_inserted boolean;
begin
  if p_email is null
     or length(p_email) > 320
     or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email invalide';
  end if;
  if p_code_postal is null or p_code_postal !~ '^[0-9]{5}$' then
    raise exception 'code postal invalide';
  end if;
  if (select count(*) from public.events
      where name = 'lead_submitted'
        and ip_hash = v_ip_hash
        and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'trop de demandes, réessayez plus tard';
  end if;

  insert into public.leads (email, analysis_id, source, code_postal)
  values (lower(trim(p_email)), p_analysis_id, 'expert_waitlist', p_code_postal)
  on conflict (lower(email), source) do update set code_postal = excluded.code_postal;
  get diagnostics v_inserted = row_count;

  insert into public.events (name, analysis_id, ip_hash, props_json)
  values ('lead_submitted', p_analysis_id, v_ip_hash,
          jsonb_build_object('source', 'expert_waitlist', 'zone', p_code_postal,
                             'deduplique', not v_inserted));
end;
$$;

grant execute on function public.submit_demande_zone(text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC service role : enregistre une réponse au retour d'issue (lien signé).
-- La signature est vérifiée par la fonction edge `retour`, qui seule détient
-- le secret ; la base ne fait confiance qu'au service role.
-- ---------------------------------------------------------------------------
create or replace function public.submit_retour_signe(
  p_token_hash text,
  p_achete boolean,
  p_prix_paye integer,
  p_points_confirmes text,
  p_commentaire text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.retours%rowtype;
begin
  select * into v from public.retours where token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('ok', false, 'erreur', 'lien_invalide');
  end if;
  if p_prix_paye is not null and (p_prix_paye <= 0 or p_prix_paye >= 1000000) then
    return jsonb_build_object('ok', false, 'erreur', 'prix_invalide');
  end if;
  if p_points_confirmes is not null and p_points_confirmes not in ('oui', 'non', 'pas_verifie') then
    return jsonb_build_object('ok', false, 'erreur', 'reponse_invalide');
  end if;

  insert into public.outcomes
    (user_id, analysis_id, prix_paye_eur, points_confirmes_choix, achete, commentaire, retour_id, source)
  values
    (null, v.analysis_id, p_prix_paye, p_points_confirmes, p_achete,
     left(p_commentaire, 1000), v.id, 'lien_signe')
  on conflict (analysis_id) where user_id is null do update
    set prix_paye_eur = excluded.prix_paye_eur,
        points_confirmes_choix = excluded.points_confirmes_choix,
        achete = excluded.achete,
        commentaire = excluded.commentaire,
        retour_id = excluded.retour_id;

  update public.retours set repondu_le = coalesce(repondu_le, now()) where id = v.id;

  insert into public.events (name, analysis_id, props_json)
  values ('outcome_submitted', v.analysis_id,
          jsonb_build_object('source', 'lien_signe', 'achete', p_achete));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_retour_signe(text, boolean, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_retour_signe(text, boolean, integer, text, text)
  to service_role;

comment on table public.partenaires is
  'Partenaires assurance / crédit. Inspexo est INDICATEUR (pas d''intermédiaire '
  'ORIAS) : aucun contenu de contrat, aucun chiffre commercial. Éteints par défaut.';
comment on table public.mises_en_relation is
  'Passages sur /go/<slug>. Aucune donnée personnelle ; `robot` exclut du compte net.';
comment on table public.retours is
  'Invitations au retour d''issue. Une seule par (analysis_id, email_hash), jamais de relance.';
