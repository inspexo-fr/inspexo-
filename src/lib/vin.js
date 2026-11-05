// SPRINT 20 — ré-export du miroir généré.
//
// L'implémentation vit dans `supabase/functions/_shared/vin.ts` (source
// UNIQUE, serveur comprise) et `src/data/vin.gen.js` en est la traduction
// mécanique. Ce fichier ne garde que le chemin d'import historique, pour que
// `VinBloc` et `tests/vin.test.mjs` continuent de pointer au même endroit.
//
// ⚠️ L'extension `.js` est OBLIGATOIRE ici : ce fichier est chargé par Node
// (tests/vin.test.mjs), qui ne résout pas les imports sans extension — alors
// que webpack, lui, les accepte. Un import sans extension passerait le build
// du site et casserait la suite de tests.
//
// ⚠️ Ne rien réécrire ici : `node scripts/generer-miroir-revendeur.mjs
// --verifier` échoue si le miroir est périmé ou retouché à la main.
export { anneesPossibles, cleControle, concordanceVin, decoderVin, incoherenceConstructeur, trouverVin } from '../data/vin.gen.js'
