**VERDICT GLOBAL : rien de critique.** Aucun vol d'argent possible par un tiers, aucune prise de contrôle d'un compte de versement, aucune fuite de données personnelles vers un non-ayant droit. En revanche **6 défauts majeurs**, dont deux qui cassent le produit de façon déterministe dès la première vente. Ne pas ouvrir la vente avant d'avoir corrigé les points 1 à 3.

---

## MAJEUR

### 1. Les photos du rapport payé sont invisibles — 100 % des cas, en silence
`supabase/migrations/20261101120000_sprint8_inspection.sql:146-160`

La policy `rapports lecture parties` est **toujours fausse**. Son `USING` interroge `public.inspection_photos`, `public.inspections`, `public.inspecteurs` (RLS active, **zéro policy** → 0 ligne pour `authenticated`) et `public.admins` (`revoke all … from authenticated`, `20261028090000:20` → `permission denied`). Or le seul chemin de lecture est côté client : `src/lib/inspectionApi.js:83` `createSignedUrl('rapports', 300)` sous le JWT de l'acheteur — aucune fonction edge ne signe ce bucket, contrairement à ce qu'annonce le commentaire de la migration l.283. `RapportInspection.jsx:26` fait `return null` sur erreur : la grille disparaît sans message, l'acheteur conclut qu'il n'y a pas eu de photos.

**Correctif** : créer une edge function `inspection-photo` qui vérifie en service role que l'appelant est l'acheteur ou l'inspecteur assigné puis renvoie `createSignedUrl` (modèle `admin-inspecteurs/index.ts:45`), retirer `createSignedUrl` du client, supprimer la policy. À défaut, déplacer la jointure dans un helper `security definer` appelé depuis la policy. Et faire remonter l'erreur à l'écran au lieu de `return null`.

### 2. L'inspecteur livre et n'est jamais payé, sans aucun signal
`supabase/functions/inspecteur-connect/index.ts:99-100`, `migration:351 & 409`, `supabase/functions/inspection-rapport/index.ts:192`

`stripe_paiements_actifs` (défaut `false`) n'est écrit que par `inspecteur-connect` action `etat`, appelée **uniquement** depuis `InspecteurInscription.jsx:74` quand `?stripe=` est présent. Or `return_url`/`refresh_url` pointent vers `/inspecteur?stripe=ok` → `InspecteurPage`, qui n'appelle jamais `etatConnect`. **Un inspecteur qui termine correctement son KYC garde donc le drapeau à `false`.** `admin-inspecteurs:93-102` ne l'exige pas pour valider, `inspecteur_missions` (l.351) et `inspection_accepter` (l.409) ne testent que le statut : il voit la mission, l'accepte, se déplace, et `inspection-rapport:192` saute le `transfers.create` **en laissant `versementErreur` à `null`** → réponse `{ok:true, verse:false}` sans message, aucune alerte admin. 107,40 € à virer à la main, contre la règle actée « JAMAIS de virement manuel ». Aucun webhook `account.updated` n'existe non plus (`scripts/configurer-stripe-inspection.mjs:18`), donc le drapeau ne repasse jamais à `false` quand Stripe restreint le compte.

**Correctif** : corriger `return_url`/`refresh_url` vers `/inspecteur/inscription?stripe=…` ; ajouter `and stripe_paiements_actifs` aux lignes 351 et 409 ; dans `inspection-rapport`, renseigner `versementErreur` explicitement quand le drapeau est faux (et le remonter dans la réponse + un event d'alerte) ; abonner `account.updated` et router sur `metadata.inspecteur_id`.

### 3. `charge.refunded` : handler aveugle — pas de reprise, partiel traité comme total, statut `faite` écrasé
`supabase/functions/inspection-webhook/index.ts:128-147`

L'update ne filtre que `.neq('statut','annulee')` et ne lit ni `transfer_id`, ni `verse_le`, ni `charge.refunded`, ni `amount_refunded`. Trois conséquences cumulées, toutes vérifiées :
- **Aucun `transfers.createReversal`** nulle part dans le dépôt, et la charge est une charge plateforme (`inspection-checkout:217-221`, pas de `transfer_data`) : un remboursement ne touche jamais le Transfer. Perte sèche de 107,40 € par occurrence, l'event `inspection_remboursee` ne portant ni montant ni mention du versement.
- **Un remboursement partiel** (geste commercial de 30 €) passe l'inspection en `annulee`. Si elle était `acceptee`, `inspection-rapport:107` renvoie 409 et **aucun chemin ne ramène vers `acceptee`** : mission payée définitivement morte. Si elle était `faite`, `RapportInspection.jsx:50` (`statut === 'faite'`) fait **disparaître le rapport payé** de l'écran acheteur.
- **`charge.dispute.*` n'est ni traité ni même abonné** (`scripts/configurer-stripe-inspection.mjs:18`) : un chargeback ne laisse aucune trace en base.

**Correctif** : ne basculer en `annulee` que si `charge.refunded === true` (ou `amount_refunded >= amount`) ; si `transfer_id` est non nul, ne pas écraser `faite` — poser `rembourse_le` + un statut distinct et appeler `stripe.transfers.createReversal({transfer, amount})` avec `idempotencyKey` (ou journaliser une créance explicite) ; journaliser `amount_refunded` dans l'event ; ajouter `charge.dispute.created` / `funds_withdrawn` au switch **et** à `EVENTS` du script de configuration.

### 4. `inspecteur-dossier` : aucun rate limit + course lecture/écriture → orphelins permanents dans le bucket
`supabase/functions/inspecteur-dossier/index.ts:41-78`

Seule fonction du sprint sans limitation de débit (`inspection-checkout:159-170` fait pourtant le comptage anti-TOCTOU). Elle n'exige que `statut !== 'suspendu'`, donc tout utilisateur authentifié ayant appelé `inspecteur_candidater` (SIRET = simple regex 14 chiffres en base) peut y pousser ~6 Mo par appel sans plafond. L'ancien chemin est lu l.41 mais supprimé l.76 **après** l'upload : N appels concurrents laissent N-1 objets sous un chemin `rc-pro-${Date.now()}` que rien ne référence et que **aucun code ne supprime jamais**. Le quota de stockage est partagé avec le bucket `rapports` (livrable payé 179 €).

**Correctif** : chemin déterministe `${ins.id}/rc-pro.${ext}` avec `upsert: true` (supprime structurellement les orphelins) ; ajouter un compteur par inspecteur/IP sur `events` (tentative insérée avant comptage) ; poser `file_size_limit` et `allowed_mime_types` sur le bucket.

### 5. RC pro gelée à vie et jamais revérifiée
`supabase/migrations/20261101120000_sprint8_inspection.sql:541`

Le `where … statut in ('candidat','refuse')` du `ON CONFLICT` empêche un inspecteur **validé** de mettre à jour `rc_pro_echeance` : il n'existe donc **aucun chemin de renouvellement**. Et l'échéance n'est lue nulle part en dehors de `admin-inspecteurs:67/95` : ni `_inspecteur_dispo`, ni `inspecteur_missions`, ni `inspection_accepter`, ni `inspection-rapport:85`, ni aucun cron (`vercel.json` n'a que `/api/alertes`). Passée la date, l'inspecteur continue d'accepter et d'être payé alors que `InspectionBloc.jsx:229` promet à l'acheteur « un professionnel indépendant assuré ».

**Correctif** : autoriser la mise à jour de `rc_pro_echeance`/`rc_pro_numero`/attestation en statut `valide` en repassant le dossier en revue (statut `revalidation` bloquant l'acceptation), ajouter `rc_pro_echeance >= current_date` aux lignes 351, 409 et dans `inspection-rapport:85`, et une relance email J-30 sur le cron existant. Au passage : `inspecteur-dossier:78` ne journalise aucun event au remplacement de l'attestation — en ajouter un.

### 6. Charte d'indépendance : version fournie par le client, re-signature libre
`supabase/migrations/20261101120000_sprint8_inspection.sql:549-577`

Le commentaire l.549-551 (« la VERSION est imposée par le serveur, constante de la fonction edge ») est **faux** : aucune fonction edge n'intervient, `src/lib/inspectionApi.js:113` appelle la RPC depuis le navigateur, `p_version` n'est que tronquée à 40 caractères, et `CHARTE_VERSION` de `_shared/inspection.ts:118` n'est lu par aucun code serveur. L'`update` n'a **aucun filtre de statut** (contrairement à `inspecteur_candidater` l.541) : un inspecteur déjà `valide` peut réécrire `charte_version`, `charte_signee_le` et `charte_ip_hash` après une mission litigieuse. `admin-inspecteurs:99` ne teste que la présence de l'horodatage.

**Correctif** : rejeter toute `p_version` différente de la constante serveur (ou supprimer le paramètre et écrire la constante en SQL) ; ajouter `and (charte_signee_le is null or statut in ('candidat','refuse'))` à la clause `where` l.567 ; comparer `charte_version` à la version en vigueur dans le garde-fou `valider` ; mettre `v_uid` dans le `props_json` de l'event l.571 (aujourd'hui non attribuable). Corriger le commentaire.

---

## MINEUR (à traiter, sans bloquer)

| # | Fichier / ligne | Défaut | Correctif |
|---|---|---|---|
| 7 | `inspection-checkout:200-230` + `inspection-webhook:49` | Pas de `payment_method_types`. Si un moyen à notification différée est activé au dashboard (SEPA), `async_payment_succeeded` n'est ni traité ni abonné → acheteur débité, ligne bloquée `a_payer`, invisible (`mes_inspections` l.277) | Poser `payment_method_types: ['card']` (le produit promet 48 h) **ou** traiter `async_payment_succeeded`/`failed`/`expired` et les ajouter à `EVENTS` |
| 8 | `migration:475` | `inspection_consentement_photos` ne teste que `if not found`, pas `v.statut <> 'valide'` (ses 3 sœurs le font l.351/409/444) : un suspendu horodate la preuve d'information du vendeur | Aligner sur l.444 |
| 9 | `migration:416` | `creneau_confirme = coalesce(p_creneau, …)` sans borne ; `validerCreneau` (`_shared/inspection.ts:97`) n'est appliqué qu'à la commande, `inspecteur-mission:68` relaie brut → fausse date envoyée à l'acheteur | Borner dans la RPC (`now() + 1h` … `now() + 72h`) et valider `body.creneau` dans `inspecteur-mission` |
| 10 | `inspection-rapport:146-159` | Objets du bucket `rapports` : aucun chemin d'effacement, et la cascade (`migration:62/121`) détruit `inspection_photos.chemin`, seul lien entre un objet et une personne. Photos d'un **tiers** (le vendeur), catégorie absente de `PolitiqueConfidentialite.jsx` §5 | Trigger `before delete` sur `inspection_photos` + purge via le cron existant ; borne de rétention explicite ; déclarer la catégorie/finalité/durée |
| 11 | `inspection-rapport:144-182` | Uploads et insert `inspection_photos` **avant** la bascule atomique `acceptee → faite`, aucun rate limit : N appels concurrents laissent des photos rattachées au rapport sans appartenir à la version validée | Faire la transition `acceptee → faite` **d'abord**, puis téléverser ; plafond de photos par inspection |

---

**Écartés après vérification** : rien d'ajouté aux réfutés. Je confirme en particulier que le `transfers.create` est bien doublement protégé contre le double versement (`!insp.transfer_id` + `idempotencyKey: inspection-transfer-${id}` + CAS `.eq('statut','acceptee')`), que `inspection_refuser` (l.451-453) **remet** bien une mission au pot commun, et que les 3 RPC inspecteur hors consentement vérifient correctement `statut = 'valide'`.