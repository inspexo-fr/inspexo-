-- SPRINT 6 — Pages publiques par famille moteur (/moteur/<slug>).
-- Migration ADDITIVE : deux RPC SECURITY DEFINER en lecture seule, aucune
-- table modifiée. Les pages publiques n'ont AUCUN accès direct aux tables :
-- elles lisent ces deux fonctions, comme le reste du site.
--
-- Seuil de publication : une page n'existe que si la fiche porte au moins
-- 3 pannes ET que chacune cite au moins une source. Une fiche plus pauvre
-- resterait une page vide de preuves — on ne la publie pas.

-- Fiche complète d'une famille moteur pour la page publique.
create or replace function public.get_moteur_public(p_marque text, p_famille text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_row public.defect_sheets%rowtype;
begin
  if p_marque is null or p_famille is null then
    return null;
  end if;

  select * into v_row
  from public.defect_sheets
  where marque_norm = regexp_replace(lower(extensions.unaccent(p_marque)), '\s+', ' ', 'g')
    and famille_norm = upper(regexp_replace(p_famille, '[^A-Za-z0-9]', '', 'g'))
  order by (statut = 'validee') desc, updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'marque', v_row.marque,
    'famille_moteur', v_row.famille_moteur,
    'moteur_label', v_row.moteur_label,
    'annee_debut', v_row.annee_debut,
    'annee_fin', v_row.annee_fin,
    'statut', v_row.statut,
    'pannes', v_row.pannes,
    'plan_entretien', coalesce(v_row.plan_entretien, '[]'::jsonb),
    'programmes', coalesce(v_row.programmes, '[]'::jsonb),
    'updated_at', v_row.updated_at
  );
end;
$$;
grant execute on function public.get_moteur_public(text, text) to anon, authenticated;

-- Familles dont la fiche est publiable : alimente le pré-rendu, le sitemap
-- et les liens internes depuis /a/:id.
create or replace function public.list_moteurs_publies()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'marque', marque,
           'famille_moteur', famille_moteur,
           'moteur_label', moteur_label,
           'pannes', jsonb_array_length(pannes),
           'updated_at', updated_at
         ) order by marque, famille_moteur), '[]'::jsonb)
  from public.defect_sheets d
  where jsonb_array_length(coalesce(pannes, '[]'::jsonb)) >= 3
    -- Chaque panne doit citer au moins une source : une page publique
    -- n'affirme jamais rien qui ne soit rattaché à un document.
    and not exists (
      select 1
      from jsonb_array_elements(d.pannes) p
      where jsonb_array_length(coalesce(p->'url_source', '[]'::jsonb)) = 0
    );
$$;
grant execute on function public.list_moteurs_publies() to anon, authenticated;
