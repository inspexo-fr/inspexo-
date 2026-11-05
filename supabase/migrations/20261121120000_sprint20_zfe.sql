-- SPRINT 20 — Crit'Air et zones à faibles émissions dans TOUTES les analyses.
--
-- Le classement Crit'Air est réglementaire (arrêté du 21 juin 2016) : il reste
-- dans le code, il ne change pas. La LISTE DES ZFE, elle, bouge par arrêté
-- local — et le cadre national lui-même a été remis en cause deux fois en
-- 2026. Elle passe donc en base, DATÉE et avec la source de chaque zone,
-- exactement comme les tarifs du cheval fiscal au sprint 19 : un seuil figé
-- dans un déploiement devient faux en silence, et personne ne s'en aperçoit.
--
-- ⚠️ La liste du code (`_shared/critair.ts`) reste le SOCLE, pas un doublon :
-- si la config est absente ou illisible, c'est elle qui sert. Sans ce socle,
-- une config vide ferait disparaître TOUS les avertissements ZFE sans aucune
-- erreur — le pire des deux mondes. `tests/critair.test.mjs` vérifie que les
-- deux disent exactement la même chose au moment du seed.

-- ---------------------------------------------------------------------------
-- 1. LA LISTE DES ZFE, EN CONFIG
-- ---------------------------------------------------------------------------
-- ⚠️ Liste VOLONTAIREMENT COURTE : seules les zones dont le seuil est stable
-- et documenté y figurent. Une ZFE omise ne fait rien de faux (aucun
-- avertissement) ; une ZFE inventée ou au mauvais seuil ferait dire à un
-- acheteur que sa future voiture est interdite là où elle ne l'est pas.
insert into public.config (cle, valeur, description) values
  ('zfe', jsonb_build_object(
    'maj', '2026-11-05',
    'zones', jsonb_build_array(
      jsonb_build_object('ville', 'Paris', 'interdits', jsonb_build_array('non_classe', '5', '4', '3'), 'source', 'https://www.paris.fr/pages/la-zone-a-faibles-emissions-zfe-16799'),
      jsonb_build_object('ville', 'Lyon', 'interdits', jsonb_build_array('non_classe', '5', '4', '3'), 'source', 'https://www.grandlyon.com/services/la-zone-a-faibles-emissions'),
      jsonb_build_object('ville', 'Grenoble', 'interdits', jsonb_build_array('non_classe', '5', '4', '3'), 'source', 'https://www.grenoblealpesmetropole.fr/878-zone-a-faibles-emissions.htm'),
      jsonb_build_object('ville', 'Montpellier', 'interdits', jsonb_build_array('non_classe', '5', '4'), 'source', 'https://www.montpellier3m.fr/zfe'),
      jsonb_build_object('ville', 'Strasbourg', 'interdits', jsonb_build_array('non_classe', '5', '4'), 'source', 'https://www.strasbourg.eu/zfe'),
      jsonb_build_object('ville', 'Marseille', 'interdits', jsonb_build_array('non_classe', '5', '4'), 'source', 'https://www.ampmetropole.fr/zfe'),
      jsonb_build_object('ville', 'Toulouse', 'interdits', jsonb_build_array('non_classe', '5', '4'), 'source', 'https://www.toulouse-metropole.fr/zfe'),
      jsonb_build_object('ville', 'Nice', 'interdits', jsonb_build_array('non_classe', '5'), 'source', 'https://www.nicecotedazur.org/zfe'),
      jsonb_build_object('ville', 'Rouen', 'interdits', jsonb_build_array('non_classe', '5'), 'source', 'https://www.metropole-rouen-normandie.fr/zfe'),
      jsonb_build_object('ville', 'Reims', 'interdits', jsonb_build_array('non_classe', '5'), 'source', 'https://www.grandreims.fr/zfe'),
      jsonb_build_object('ville', 'Saint-Étienne', 'interdits', jsonb_build_array('non_classe', '5'), 'source', 'https://www.saint-etienne-metropole.fr/zfe'),
      jsonb_build_object('ville', 'Rennes', 'interdits', jsonb_build_array('non_classe'), 'source', 'https://metropole.rennes.fr/zfe'),
      jsonb_build_object('ville', 'Nantes', 'interdits', jsonb_build_array('non_classe'), 'source', 'https://metropole.nantes.fr/zfe'),
      jsonb_build_object('ville', 'Lille', 'interdits', jsonb_build_array('non_classe'), 'source', 'https://www.lillemetropole.fr/zfe')
    )
  ),
   'Zones à faibles émissions et vignettes Crit''Air interdites, par ville. Datée : la liste bouge par arrêté local, et la date est affichée à l''écran.')
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- 2. get_config_publique — la liste fermée s'ouvre à « zfe »
-- ---------------------------------------------------------------------------
-- Corps repris de sa DERNIÈRE définition (20261119120000), ce seul filtre
-- changé. Les seuils d'alerte et le plafond de coût IA restent au service
-- role : « zfe » est un texte réglementaire public, pas un réglage interne.
create or replace function public.get_config_publique()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(cle, valeur), '{}'::jsonb)
  from public.config
  where cle in ('carte_grise_tarifs', 'zfe') or cle like 'revendeur\_%';
$$;

revoke all on function public.get_config_publique() from public;
grant execute on function public.get_config_publique() to anon, authenticated, service_role;

comment on function public.get_config_publique() is
  'Réglages du mode revendeur et liste des ZFE, lisibles par le navigateur. Liste fermée : rien d''autre de `config` ne sort.';

-- ---------------------------------------------------------------------------
-- 3. EMPREINTE DU VIN DE L'ANNONCE (sprint 20c)
-- ---------------------------------------------------------------------------
-- ⚠️ UNE COLONNE, ET SURTOUT PAS `result_json`. Le dossier /a/:id est public :
-- y publier un VIN exposerait un identifiant rattachable à son titulaire par
-- le SIV, et y publier même un jeton dérivé permettrait de reconnaître deux
-- dossiers portant la même voiture. La colonne n'est exposée par AUCUNE RPC.
--
-- L'empreinte est un sha256 SALÉ avec `IP_HASH_SALT` et préfixé « vin: »
-- (séparateur de domaine, pour qu'elle ne puisse pas être confondue avec une
-- empreinte d'IP). Un sha256 nu ne conviendrait pas : connaissant la marque,
-- l'usine et l'année, le numéro de série se réduit à quelques millions de
-- possibilités — énumérables en quelques secondes. Rien à voir avec
-- l'empreinte de TEXTE d'annonce du sprint 12, qui est volontairement non
-- salée parce que sa valeur de preuve vient de ce que le client peut la
-- recalculer.
--
-- À quoi elle sert : la règle 0 d'HistoVec (sprint 13) compare le VIN du
-- certificat de situation administrative à celui de l'annonce. Ce second
-- terme était TOUJOURS nul — rien n'extrayait le VIN de l'annonce. Le contrôle
-- existait et ne contrôlait rien ; c'est exactement la famille de défauts que
-- ce projet a déjà trouvée trois fois.
alter table public.analyses add column if not exists vin_empreinte text;

comment on column public.analyses.vin_empreinte is
  'sha256(IP_HASH_SALT || ''vin:'' || VIN) du VIN écrit dans l''annonce. Jamais exposée par une RPC : sert à comparer le VIN d''un certificat HistoVec à celui de l''annonce.';
