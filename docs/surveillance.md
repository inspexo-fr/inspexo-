# Surveillance d'Inspexo — ce qui alerte, et comment le brancher

Sprint 17. Deux niveaux, et ils ne se remplacent pas : les **alertes internes**
disent *pourquoi* quelque chose va mal, le **moniteur externe** dit que le site
ne répond plus — y compris quand c'est Supabase ou Vercel qui est tombé, auquel
cas aucune alerte interne ne pourrait partir.

## 1. Alertes internes (email, automatiques)

Quatre motifs, **une alerte par motif et par heure**, objet préfixé
`[URGENT] Inspexo — `.

| Motif | Déclencheur | Où |
|---|---|---|
| Crédit ou clé | l'API Anthropic refuse pour solde ou authentification | `score`, à chaque échec |
| Échecs répétés | plus de 3 `pipeline_error` en 15 min | `score`, à chaque échec |
| Fonction en erreur | `/api/sante` détecte une brique injoignable | à chaque passage du moniteur |
| Coût du jour | coût IA cumulé > seuil | `score`, après chaque analyse |

⚠️ **Une surcharge passagère n'alerte pas** (429, 529, « overloaded ») : elle se
résout seule. Seuls le crédit épuisé et la clé invalide alertent, parce qu'ils
**ne se résolvent pas** sans intervention. Confondre les deux, c'est soit crier
au loup, soit rester muet pendant une panne totale.

**Les seuils vivent en base**, table `config`, modifiables sans redéploiement :

```sql
update public.config set valeur = '8'::jsonb, maj_le = now()
 where cle = 'cout_ia_seuil_jour_eur';
```

Clés : `cout_ia_seuil_jour_eur` (5), `echecs_fenetre_minutes` (15),
`echecs_seuil` (3).

## 2. Bilan quotidien

Objet `[Bilan] Inspexo — JJ/MM/AAAA`, porté par le cron **existant**
(`/api/alertes`) : un second cron serait une seconde chose capable de s'arrêter
sans bruit.

Contenu : analyses réelles, ventilation par `?src=`, verdicts, clics
Pass/inspection/partage, paiements, listes d'attente, erreurs par étape, coût IA.

⚠️ **Le coût inclut les analyses d'éval, les volumes non.** L'éval est de
l'argent réellement dépensé — le taire fausserait la note ; mais la compter
comme trafic fausserait la mesure.

⚠️ **Le cron tourne à 07:00 UTC** : 8 h en heure d'hiver, **9 h en heure d'été**.
Vercel ne planifie qu'en UTC. Plutôt que de déplacer l'heure deux fois par an —
une occasion d'oublier — le bilan **porte son heure d'envoi** en pied.

## 3. Moniteur externe — à configurer (15 minutes)

### UptimeRobot (recommandé)

Gratuit, 50 moniteurs, contrôle toutes les 5 minutes, alerte email, page de
statut publique si besoin. C'est le palier gratuit le plus large du marché et
il suffit très largement ici.

1. Créer un compte sur `uptimerobot.com` avec `contact@inspexo.io`.
2. **Add New Monitor** :
   - *Monitor Type* : **HTTP(s)**
   - *Friendly Name* : `Inspexo — santé`
   - *URL* : `https://www.inspexo.io/api/sante`
   - *Monitoring Interval* : **5 minutes**
3. **Advanced** → *Monitor Timeout* : 30 s. Laisser « Alert when down ».
4. *Alert Contacts To Notify* : cocher l'email, et régler **« Send notification
   when down » après 2 échecs consécutifs** — un seul échec peut n'être qu'un
   hoquet réseau du moniteur lui-même.

Le point de contrôle rend **200** quand tout va, **503** sinon. Il ne rend
**aucune donnée d'affaires** : ni volume, ni chiffre, ni date de dernière
analyse. C'est délibéré — une URL publique ne doit pas laisser déduire le
trafic d'Inspexo.

⚠️ Il **ne juge pas sur le volume**. Un contrôle qui passerait au rouge faute
d'analyse récente serait rouge en permanence aujourd'hui (treize analyses
réelles depuis le 18 octobre), et un voyant toujours rouge ne se regarde plus.

### Healthchecks.io — le cron, en complément (5 minutes)

**Un cron qui cesse de tourner ne produit aucune erreur.** Rien ne le signale :
le bilan n'arrive plus, et on s'en aperçoit au bout d'une semaine. Un
dead-man's switch est le seul dispositif qui voit une absence.

1. Compte gratuit sur `healthchecks.io` (20 contrôles).
2. Créer un check `Inspexo — cron quotidien`, *Period* **1 day**, *Grace Time*
   **2 hours**.
3. Copier son URL de ping, et l'ajouter en fin de `api/alertes.js` :
   `await fetch(process.env.HEALTHCHECK_URL)` après une exécution réussie,
   avec `HEALTHCHECK_URL` en variable Vercel.

⬜ **Non fait** : ce branchement demande l'URL de ping, qui n'existe qu'une fois
le compte créé. À faire après la création du compte.

### Alternative

**Better Stack** (ex-Better Uptime) : 10 moniteurs gratuits, contrôle toutes les
3 minutes, alertes mieux faites. Plus confortable, moins généreux en nombre. Si
vous ne surveillez qu'une URL, c'est un choix défendable.

## 4. Vérifier que ça marche

```sh
curl -s https://www.inspexo.io/api/sante | python3 -m json.tool
```

Attendu : `{"ok": true, "base": "ok", "fonctions": {"score": "ok", "rappels": "ok"}, …}`.

Pour éprouver l'alerte « fonction en erreur » sans rien casser : il n'y a pas de
moyen sûr de le faire en production. Le chemin est couvert hors ligne par
`tests/alerting.test.mjs` (étranglement, objets, base muette).
