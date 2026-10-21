-- SPRINT 1.5 finitions — lecture publique d'une fiche famille moteur.
-- Permet à /a/:id de charger les pannes dès que la fiche (générée en
-- arrière-plan) est prête, sans recharger la page. Ne expose que le contenu
-- déjà destiné à l'affichage public (statut + pannes sourcées).

create extension if not exists unaccent with schema extensions;

create or replace function public.get_defect_sheet(p_marque text, p_famille text)
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

  return jsonb_build_object('statut', v_row.statut, 'pannes', v_row.pannes);
end;
$$;

grant execute on function public.get_defect_sheet(text, text) to anon, authenticated;
