# Soumission Chrome Web Store — Inspexo

## Identité
- **Nom** : Inspexo — Analyser une annonce auto
- **Catégorie** : Shopping (ou Outils de productivité)
- **Langue** : Français
- **Version** : 1.0.0
- **Zip de soumission** : `extension/inspexo-extension-1.0.0.zip` (régénérer avec
  `cd extension && zip -r inspexo-extension-$(jq -r .version manifest.json).zip . -x 'STORE.md' -x '*.zip' -x 'sites/common.js.orig' -x '.*'`)

## Objet unique (single purpose) — champ obligatoire
> L'extension ajoute un bouton « Analyser avec Inspexo » sur les pages d'annonce
> de voitures d'occasion de leboncoin.fr, lacentrale.fr et autoscout24.fr. Au
> clic, elle envoie le contenu de l'annonce (texte et photos) à inspexo.io, qui
> renvoie une analyse gratuite : rappels constructeur, airbags Takata, pannes
> connues du moteur, incohérences et questions à poser au vendeur.

## Description courte (132 caractères max)
> Verdict gratuit sur une annonce de voiture d'occasion : rappels, airbags
> Takata, pannes connues. Un bouton, une minute.

## Description longue
Acheter une voiture d'occasion sans mauvaise surprise : Inspexo analyse
l'annonce que vous êtes en train de lire, en un clic.

Sur chaque page d'annonce de Leboncoin, La Centrale et AutoScout24, un bouton
« Analyser avec Inspexo » apparaît. Cliquez : l'extension envoie le texte de
l'annonce et jusqu'à 6 photos à inspexo.io, et ouvre votre verdict en moins
d'une minute :

- Rappels constructeur officiels (RappelConso + codes constructeur, ex. Audi 21H7)
- Véhicule concerné ou non par la campagne d'airbags Takata (liste officielle du ministère)
- Pannes connues du moteur, chacune avec sa source consultable
- Ce que montrent les photos : compteur, pneus, carrosserie, contrôle technique photographié
- Incohérences de l'annonce (dont kilométrage affiché vs compteur photographié)
- Cadre juridique du vendeur (pro, particulier, intermédiaire) et vos garanties
- Questions précises à poser au vendeur, message prêt à envoyer, checklist d'inspection

Gratuit, sans compte, 5 analyses par 24 heures. 100 % côté acheteur : Inspexo
n'a aucun lien avec les vendeurs. Ce qui n'est pas prouvé n'apparaît pas.

Confidentialité : aucune collecte, aucun tracking. L'extension ne lit la page
qu'au moment du clic et ne communique qu'avec inspexo.io. Les photos sont
redimensionnées dans votre navigateur, leurs métadonnées EXIF supprimées, et ne
sont jamais conservées.
Politique de confidentialité : https://www.inspexo.io/extension/confidentialite

## Justification des permissions — champs du formulaire
| Permission | Justification à coller |
|---|---|
| `activeTab` | Lire la page d'annonce active uniquement lorsque l'utilisateur clique sur le bouton « Analyser avec Inspexo ». |
| `scripting` | Injecter le bouton d'analyse et le style associé sur les pages d'annonce des trois sites supportés. |
| `host_permissions` (leboncoin.fr, lacentrale.fr, autoscout24.fr) | Afficher le bouton sur les pages d'annonce de ces trois sites et télécharger les photos de l'annonce (hébergées sur leurs sous-domaines, ex. img.leboncoin.fr) afin de les redimensionner localement avant analyse. L'extension est inerte sur tout autre site. |
| `storage` | Mémoriser localement (24 h max) les comparables de prix que l'utilisateur choisit d'ajouter depuis une page de résultats (titre, année, km, prix), joints à sa prochaine analyse puis effacés. Aucune synchronisation, aucune donnée de navigation. |
| Code distant | Aucun : tout le code est dans le paquet. |

Note : les photos AutoScout24 sont servies depuis `pictures.autoscout24.net`
(hors host_permissions). Leur téléchargement peut donc échouer selon les
en-têtes CORS du CDN ; dans ce cas l'analyse part sans photos — choix assumé
pour garder des permissions minimales. Élargir à `*.autoscout24.net` si le
Web Store l'accepte sans friction.

## Captures à fournir (1280×800, 3 à 5)
1. Page d'annonce Leboncoin avec le bouton flottant « Analyser avec Inspexo » visible.
2. Le verdict /a/:id affiché après le clic (bandeau rouge « Signaux rouges 33/100 » de la démo S7).
3. Le bloc « Points de défaillance connus » avec badge « rappel constructeur officiel » et sources cliquables.
4. Le bloc « Ce que montrent les photos » avec pastilles ok/attention/rouge.
5. (Optionnel) La page /extension du site.

Fond uni ou capture d'écran réelle, pas de texte promotionnel surimprimé
(règles du Web Store). Icône du store : `icons/icon128.png`.

## Champs confidentialité du formulaire développeur
- Collecte de données : **aucune** (cocher « This item does not collect user data » ;
  le texte de l'annonce et les photos sont transmis à inspexo.io à la demande
  explicite de l'utilisateur pour fournir la fonctionnalité — case « website
  content », usage « app functionality », pas de revente, pas de pub, pas de
  profilage, si le formulaire l'exige).
- URL de la politique de confidentialité : https://www.inspexo.io/extension/confidentialite
- Site : https://www.inspexo.io/extension

## Rappels avant soumission
- Vérifier que `STORE_URL` dans `src/pages/ExtensionPage.jsx` est renseigné après publication.
- Tester en local : chrome://extensions → mode développeur → « Charger l'extension non empaquetée » → dossier `extension/`.
