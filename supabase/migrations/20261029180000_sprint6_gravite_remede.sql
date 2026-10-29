-- SPRINT 6 — Gravité jugée sur le REMÈDE, appliquée aux fiches existantes.
--
-- Règle générale (arbitrage du 28/10/2026) : la gravité d'un défaut se juge
-- sur le remède du défaut tel qu'il se présente, jamais sur ce qui arriverait
-- si on l'ignorait. La campagne de couverture a montré que le modèle y déroge
-- régulièrement : des pannes de chaîne, de courroie ou de tendeur revenaient
-- classées « casse » parce que leur CONSÉQUENCE est une casse moteur.
--
-- Le garde-fou déterministe est désormais dans _shared/graviteRemede.ts et
-- s'applique à chaque génération. Cette migration répare les fiches déjà en
-- base. Elle vise des pannes NOMMÉMENT, pas un motif général : une correction
-- en masse sur des libellés libres mérite d'être relue une par une.
--
-- Sauvegarde préalable : ~/inspexo-backups/fiches-avant-gravite-remede-*.json

-- 1. L'arbitrage humain prime sur l'heuristique. Les turbocompresseurs de
--    l'EA824 ont été tranchés à la main en « casse » (pièce d'origine au-delà
--    de 3 500 £ par turbo, source relue) : on le marque pour que le garde-fou
--    ne les rétrograde jamais.
update public.defect_sheets d
set pannes = (
  select jsonb_agg(
    case when p->>'titre' ilike '%crépine%' and p->>'titre' ilike '%turbo%'
      then p || jsonb_build_object('gravite_arbitree', true)
      else p end
    order by ord)
  from jsonb_array_elements(d.pannes) with ordinality as t(p, ord)
)
where d.famille_moteur = 'EA824'
  and exists (
    select 1 from jsonb_array_elements(d.pannes) p
    where p->>'titre' ilike '%crépine%' and p->>'titre' ilike '%turbo%'
  );

-- 2. Rétrogradation des pannes dont le remède est un organe, pas le moteur.
--    Chaîne, courroie, tendeur : leur remplacement coûte cher, mais ce n'est
--    ni un moteur ni une boîte, et aucun coût sourcé ne dépasse 3 000 €.
update public.defect_sheets d
set pannes = (
  select jsonb_agg(
    case
      when p->>'gravite' = 'casse'
       and coalesce((p->>'gravite_arbitree')::boolean, false) = false
       and (p->>'titre') ~* '(cha[îi]ne|courroie|tendeur)'
       and (p->>'titre') !~* '(segment|piston|vilebrequin|coussinet|bielle|cylindre)'
       and coalesce((p->>'cout_indicatif_eur_max')::numeric, 0) <= 3000
       and coalesce((p->>'cout_indicatif_eur_min')::numeric, 0) <= 3000
      then p || jsonb_build_object('gravite', 'majeure')
      else p end
    order by ord)
  from jsonb_array_elements(d.pannes) with ordinality as t(p, ord)
)
where exists (
  select 1 from jsonb_array_elements(d.pannes) p
  where p->>'gravite' = 'casse'
    and coalesce((p->>'gravite_arbitree')::boolean, false) = false
    and (p->>'titre') ~* '(cha[îi]ne|courroie|tendeur)'
    and (p->>'titre') !~* '(segment|piston|vilebrequin|coussinet|bielle|cylindre)'
    and coalesce((p->>'cout_indicatif_eur_max')::numeric, 0) <= 3000
    and coalesce((p->>'cout_indicatif_eur_min')::numeric, 0) <= 3000
);
