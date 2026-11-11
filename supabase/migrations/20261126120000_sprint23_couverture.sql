-- SPRINT 23 — Fiches multi-marques : couverture EXPLICITE d'une fiche moteur.
--
-- Décision d'Utku du 10 nov. 2026 : une fiche par moteur, avec la liste
-- explicite des marques et modèles qu'elle couvre, bornée par années. Ni une
-- fiche par marque, ni une recherche par groupe entier.
--
-- ⚠️ ADDITIVE ET SANS EFFET SUR LE SCORE À ELLE SEULE : la colonne vaut '[]'
-- par défaut, et une couverture vide ne change rien à la recherche de fiche
-- (`couvre` rend faux). C'est l'ÉCRITURE des couvertures — par l'admin, avec
-- relecture — qui change des scores : changement (e) de la séquence, seul,
-- avec ses 3 passages.
alter table public.defect_sheets
  add column if not exists couverture jsonb not null default '[]'::jsonb;

-- Chaque entrée : { marque, modele, annee_debut, annee_fin } (marque et modèle
-- canoniques, bornes nullables). La forme est contrôlée côté fonction
-- (`couvertureValide`) ; ici, seulement le type tableau.
alter table public.defect_sheets
  add constraint defect_sheets_couverture_tableau check (jsonb_typeof(couverture) = 'array');

-- La recherche filtre par « couverture @> [{marque}] ».
create index if not exists defect_sheets_couverture on public.defect_sheets using gin (couverture jsonb_path_ops);
