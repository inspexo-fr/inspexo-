// Tests hors ligne : signaux d'arnaque par règles fixes (sprint 23, lot 2).
// Usage : node tests/securite-transaction.test.mjs
import fs from 'node:fs'
import { detecterSignauxArnaque, SEUIL_PRIX_TRES_BAS } from '../supabase/functions/_shared/securiteTransaction.ts'

let ok_ = 0, ko = 0
const ok = (c, l) => { if (c) { ok_++; console.log(`PASS — ${l}`) } else { ko++; console.log(`FAIL — ${l}`) } }
const codes = (t, prix = null, f = null) => detecterSignauxArnaque(t, prix, f).map((s) => s.code)
const a = (t, code, l) => ok(codes(t).includes(code), `${l} → ${code}`)
const n = (t, code, l) => ok(!codes(t).includes(code), `${l} → pas de ${code}`)

// Paiement à distance
a('Paiement par mandat cash uniquement.', 'paiement_distance', 'mandat cash')
a('Règlement via Western Union avant envoi.', 'paiement_distance', 'Western Union')
a('Je souhaite être payé en coupons PCS.', 'paiement_distance', 'coupons PCS')
n('Paiement par virement ou chèque de banque à la remise des clés.', 'paiement_distance', 'virement à la remise')
n("Pas de Western Union, pas de mandat cash.", 'paiement_distance', 'négation explicite')

// Vendeur à l'étranger
a('Je suis actuellement en Espagne pour le travail.', 'vendeur_etranger', 'en Espagne')
a("Vendeur expatrié, la voiture est chez un ami.", 'vendeur_etranger', 'expatrié')
a("Je suis muté à l'étranger, vente rapide.", 'vendeur_etranger', "muté à l'étranger")
n('Véhicule importé d\'Allemagne en 2019, carte grise française.', 'vendeur_etranger', 'import (le véhicule, pas le vendeur)')
n('Je suis à Toulouse, visible sur rendez-vous.', 'vendeur_etranger', 'ville française')

// Livraison
a('Livraison par transporteur agréé à vos frais.', 'livraison_transporteur', 'transporteur')
a("Le paiement passe par une société de séquestre.", 'livraison_transporteur', 'séquestre')
n('Pas de livraison par transporteur, à venir chercher.', 'livraison_transporteur', 'négation')

// Refus de visite (la négation EST le signal)
a('Pas de visite possible, je suis absent.', 'refus_visite', 'pas de visite possible')
a("Essai impossible, la voiture est sur cales.", 'refus_visite', 'essai impossible')
a('Vendue sans visite préalable.', 'refus_visite', 'vendue sans visite')
n('Visite possible le samedi.', 'refus_visite', 'visite possible')
n('Pas de visite le dimanche.', 'refus_visite', 'jour exclu')
n('Pas de visite sans rendez-vous.', 'refus_visite', 'sur rendez-vous')

// Acompte
a("Un acompte de 500 € est demandé pour réserver.", 'acompte', 'acompte')
a('Réservation contre versement de 300 €.', 'acompte', 'réservation payante')
a('Frais de transport à régler avant la livraison.', 'acompte', 'frais avant livraison')
n("Aucun acompte demandé, paiement à la vente.", 'acompte', 'aucun acompte')
n('Pas d\'acompte.', 'acompte', "pas d'acompte")

// Contact
a('Contact uniquement par mail.', 'contact_hors_plateforme', 'mail seulement')
a('Pas d\'appels, je réponds par WhatsApp.', 'contact_hors_plateforme', "pas d'appels")
n('Contact par téléphone ou par mail.', 'contact_hors_plateforme', 'téléphone possible')

// Prix très bas : uniquement avec une fourchette observée
ok(codes('Clio IV 2017', 4000, { p25: 9000 }).includes('prix_tres_bas'), 'prix < 60 % du P25 → signal')
ok(!codes('Clio IV 2017', 6000, { p25: 9000 }).includes('prix_tres_bas'), 'prix à 67 % du P25 → pas de signal')
ok(!codes('Clio IV 2017', 1000, null).includes('prix_tres_bas'), 'sans fourchette → JAMAIS de signal de prix')
ok(SEUIL_PRIX_TRES_BAS === 0.6, 'seuil 60 %')

// Annonce honnête : zéro signal
const honnete = "Clio IV 1.5 dCi 90, 2017, 98 000 km. Distribution faite à 90 000 km, factures. Visible à Toulouse, essai possible. Paiement par virement à la remise des clés."
ok(codes(honnete).length === 0, 'annonce honnête : aucun signal')

// Citation : extrait court, sans numéro ni email
const s = detecterSignauxArnaque('Paiement par mandat cash, écrivez à arnaque@exemple.com ou au 06 12 34 56 78 pour réserver la voiture aujourd\'hui même sans attendre demain matin.', null, null)[0]
ok(s && !/@/.test(s.extrait) && !/06 12/.test(s.extrait), 'extrait nettoyé (ni email ni téléphone)')
ok(s && s.extrait.split(/\s+/).length <= 16, 'extrait ≤ 15 mots')
ok(codes('Western Union. Western Union encore.').filter((c) => c === 'paiement_distance').length === 1, 'un signal par code au plus')

// Indépendance : ni le barème ni le chemin de notation n'importent le module
const bareme = fs.readFileSync(new URL('../supabase/functions/_shared/bareme.ts', import.meta.url), 'utf8')
ok(!/securiteTransaction|signaux_arnaque|securite_transaction/.test(bareme), 'le barème ignore les signaux d\'arnaque')
const score = fs.readFileSync(new URL('../supabase/functions/score/index.ts', import.meta.url), 'utf8')
const lignes = score.split('\n').filter((l) => /signaux_arnaque|detecterSignauxArnaque/.test(l))
ok(lignes.length > 0, 'le score calcule bien les signaux (contre-épreuve : le motif mord)')
ok(lignes.every((l) => !/faits|calculerAxes|score\s*[:=]|verdict/.test(l)), 'aucune ligne portant les signaux ne touche aux faits, au score ni au verdict')

console.log(`\n${ok_} PASS, ${ko} FAIL`)
if (ko > 0) process.exit(1)
