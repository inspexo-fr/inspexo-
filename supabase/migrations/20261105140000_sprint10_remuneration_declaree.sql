-- ===========================================================================
-- SPRINT 10 (ajustement) — Une rémunération NON DÉCLARÉE n'est jamais lue
-- comme « aucune » : le partenaire n'est alors pas publié du tout.
--
-- Pourquoi une migration séparée plutôt qu'une correction de la précédente :
-- `20261105120000` est DÉJÀ APPLIQUÉE en production. La modifier ne la
-- rejouerait pas, et le fichier ne décrirait plus ce qui a réellement tourné.
--
-- Pourquoi ce filtre alors que la contrainte CHECK garantit déjà l'une des
-- deux valeurs : c'est une garantie INDÉPENDANTE de la contrainte. Afficher
-- « Inspexo ne perçoit aucune rémunération » sans que personne ne l'ait
-- affirmé serait une allégation fausse — une pratique commerciale trompeuse
-- au sens de l'article L121-2 du code de la consommation. Le silence
-- n'affirme rien, et aucune voie d'écriture ne doit pouvoir produire cet
-- affichage.
-- ===========================================================================

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
           'valide_le', valide_le,
           'remuneration', remuneration
         ) order by type, nom), '[]'::jsonb)
  from public.partenaires
  where actif and remuneration in ('commission', 'aucune');
$$;

grant execute on function public.get_partenaires_actifs() to anon, authenticated;
