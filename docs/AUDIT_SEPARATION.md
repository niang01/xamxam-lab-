# Audit de séparation — XAM-XAM LAB / SUUF SPACE NAZA / BOUTIQUE E-COMMERCE (17/11/2026)

Audit demandé par l'exploitant. Règle suivie : **rien n'a été supprimé ni modifié avant la fin de l'audit et la sauvegarde des états**. Aucun fichier de SUUF n'a été modifié par la correction ; aucun dépôt n'a été supprimé.

## 1. Sauvegardes préalables (avant toute correction)
| Sauvegarde | Contenu | SHA-256 |
|---|---|---|
| `suuf-space-naza-complet.bundle` | Dépôt SUUF-SPACE-NAZA, toutes branches | `07de397a47dc354ad8dc2bf21fff22209d06ca26c7c0ef87a2199e51994fc206` |
| `branche-xamxam-avant-separation.bundle` | Branche XAM-XAM avant correction (commit `f05a256`, étiquette locale `audit-avant-separation-xamxam`) | `b25a566c09f60bf2219dda99286c4e346d119cb0a104deeca68013a0aea50d36` |

Ces paquets Git sont dans l'espace de travail de la session (non versionnés : le premier contient le code de SUUF, qui ne doit pas entrer dans le dépôt XAM-XAM). Le commit `f05a256` reste par ailleurs dans l'historique poussé de la branche `ccr-859cc6b2-lvx9c5`.

## 2. Dépôts et branches examinés
| Élément | Constat |
|---|---|
| `niang01/SUUF-SPACE-NAZA` | Seul dépôt accessible à la session. `main` : 412 fichiers (SUUF). |
| `niang01/boutique-Ecommerce` | **Inaccessible** à la session (introuvable ou application GitHub non autorisée) : non audité directement. |
| Branche `ccr-e359298f-8n1s94` | Contient un dossier `boutique-ecommerce/` (267 fichiers, développé par une autre session : marketplace multivendeurs, Wave/PayDunya, Capacitor). |
| Branche `ccr-8dfb2230-hif2m5` | Dernier commit « Séparation : BOUTIQUE E-COMMERCE déplacé dans son dépôt indépendant » ; 7 fichiers SUUF diffèrent de `main`. |
| Branche `ccr-859cc6b2-lvx9c5` | SUUF (`main`) + dossier `xamxam-lab/` (333 fichiers) + 3 lignes d'exclusion dans les outils de SUUF. |

## 3. Fichiers identiques octet pour octet
| Comparaison | Fichiers identiques | Nature |
|---|---|---|
| XAM-XAM ∩ SUUF | 1 | `AGENTS.md`, texte généré par Next.js (`generate-agent-files.js`) |
| XAM-XAM ∩ BOUTIQUE | 24 | Gabarits officiels de `@capacitor/cli` (Android/iOS), identiques dans tout projet Capacitor |
| BOUTIQUE ∩ SUUF | 2 | `tsconfig.json`, `vitest.config.ts` |

Le chiffre de « 290 fichiers identiques » entre la boutique et SUUF n'a **pas pu être reproduit** à partir des données accessibles (le dépôt `boutique-Ecommerce` lui-même n'est pas accessible). Il n'a jamais été produit par cette session.

## 4. Ce qui venait de SUUF dans XAM-XAM (avant correction)
- **Historique Git** : les premiers commits de la branche contenaient des fichiers copiés de SUUF (commit `8f47b57`), réécrits ensuite (`0e5e9b4`). → L'extraction se fait **sans historique** (un seul commit) : ces versions n'existent pas dans le dépôt dédié.
- **Conception de la couche API** : `src/server/http.ts` reprenait les signatures de celle de SUUF (`route`, `json`, `parseBody`, `requireUser`, `requireAdmin`, `idParam`, `HttpError`), ainsi que les assistants de base `q`/`q1`. 79 routes répétaient la même ligne d'ouverture.
- **Configuration** : `next.config.ts` (6 lignes sur 11 identiques), `src/proxy.ts`, et quelques noms (`useApi`, `ApiError`, `AppShell`, `clientIp`).
- **Connecteur NASA POWER** : libellés et construction d'URL rédigés comme dans SUUF.

## 5. Corrections réalisées (commit `1b9d75c`)
- Nouvelle couche `src/server/api.ts`, de conception propre : `endpoint()`, `ok()`, `ApiFailure`, `readInput`, `uuidParam`, `throttle`, `readCookie`, `sessionUser` / `mustBeSignedIn` / `mustBeAdmin` ; le cookie de session est posé sur une `Response` standard (`openSession` / `closeSession`), sans `NextResponse`.
- Base : `sql` / `sqlOne` ; requête de session à colonnes explicites (plus de `SELECT u.*`).
- `next.config.ts` (politique générée depuis une table), `src/proxy.ts`, connecteur NASA POWER réécrits ; renommages `useData`, `RequestError`, `LabShell`, `callerAddress`.
- 98 fichiers migrés ; `src/server/http.ts` supprimé.

## 6. Preuves après correction
**Similarité de lignes** (lignes ≥ 25 caractères, espaces normalisés, comparées à SUUF `main` et à `boutique-ecommerce/`) :

| Mesure | Avant | Après |
|---|---|---|
| Fichiers XAM-XAM avec > 20 % de lignes communes | 60 | **15** |
| Fichiers avec au moins une ligne commune | 153 | 139 |

Les lignes communes restantes sont des idiomes de bibliothèques et de frameworks (`import Link from "next/link"`, `import { useState } from "react"`, `type Ctx = { params: Promise<{ id: string }> }` imposé par Next.js 16, appels PGlite, configurations Vitest/ESLint/Capacitor par défaut, codes de paramètres de l'API NASA POWER). Aucune logique métier de SUUF (agronomie, parcelles, irrigation, SMS, pompes) n'est présente dans XAM-XAM.

**Indépendance vérifiée** (commandes exécutées le 17/11/2026) :
| Point | Résultat |
|---|---|
| Mentions de SUUF, NAZA, `snz_`, boutique, onrender dans le code et la configuration | Aucune |
| Cookie de session | `xx_session` (SUUF : cookies `snz_*`) |
| Base de données | Propre : `data/pglite` du projet ou `DATABASE_URL` propre ; table de suivi `xx_migrations` ; 2 migrations propres |
| Variables d'environnement | `SESSION_SECRET`, `XX_*`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `METEOMATICS_*`, `MQTT_*`, `NASA_POWER_BASE_URL` — aucune variable de SUUF |
| Services externes appelés | `power.larc.nasa.gov`, `api.meteomatics.com` (compte XAM-XAM à fournir), API Anthropic (clé XAM-XAM à fournir). Aucun service interne de SUUF. |
| Comptes | Comptes propres (inscription XAM-XAM, administrateurs par `XX_ADMIN_EMAILS`) ; aucun compte importé |
| Dépendances | `package.json` propre ; aucune dépendance vers un paquet de SUUF ou de la boutique |
| Environnement cloud | Environnement « xamxam-lab » dédié ; les accès Meteomatics / Hugging Face de l'environnement de SUUF ne sont plus utilisés |

**Vérifications fonctionnelles après correction** : typage ✅, lint 0 avertissement ✅, **83/83 tests** ✅, build sans avertissement ✅, **7/7 parcours e2e** ✅.

**Dépôt dédié prêt** : `scripts/extraire-depot.sh` produit un dépôt d'**un seul commit** (« XAM-XAM LAB — import initial »), sans historique ni fichier de SUUF : 333 fichiers après la correction du code, **441** après l'ajout de l'identité visuelle (`design/`). Dans cette copie, depuis zéro : `npm ci`, typage, lint, **83/83 tests**, build web de production et **APK Android de débogage** (`mobile/scripts/build-android.sh debug`) réussis.

## 7. XAM-XAM MARKETPLACE
La marketplace de XAM-XAM est un **module de XAM-XAM LAB** (rubrique *Tech News & Marketplace* : annonces `eco_items` de type `listing`, modération, sponsorisé identifié — commit `94e169d`). Elle ne dérive pas de BOUTIQUE E-COMMERCE : aucun fichier ni table en commun hormis les gabarits Capacitor ; aucun paiement n'y est implémenté.

## 8. Transfert réalisé (17/11/2026)
Dépôt privé **`niang01/xamxam-lab-`** créé par l'exploitant. Extraction poussée sur `main` : commit **`16eeabc32606b2b7f3363217f5ae8b9c53612f61`** « XAM-XAM LAB — import initial », **sans parent**, 441 fichiers. Vérifié depuis un **clone neuf** : 1 seul commit ; commits de la branche d'origine (`f05a256`, `8f47b57`, `70fcc11`) **absents** ; installation `npm ci`, typage, lint, 83/83 tests, build, 7/7 parcours e2e et APK Android réussis.

## 9. Séparation définitive (18/11/2026)

### 9.1 Vérifications du projet XAM-XAM LAB dans trois environnements sans SUUF
| Environnement | Ce qui a été exécuté | Résultat |
|---|---|---|
| **Session cloud distincte** (`session_013BZ2Jh1SupuisFs4NETCfv`, environnement « xamxam-lab », seul dépôt rattaché : `niang01/xamxam-lab-`) | `ls -d /home/user/*/` → **uniquement `xamxam-lab-`** (aucun dossier SUUF) ; `npm ci`, typage, lint, `npm test`, build, `next start` + santé, inscription et tableau de bord, `npm run test:e2e` | ✅ 106/106 tests, build OK, démarrage OK (base PGlite neuve), **10/10** parcours |
| **Clone neuf local** dans une racine séparée (`/home/user/xamxam-lab-verif`, `.git` propre, `node_modules` et `.venv` installés de zéro) | mêmes étapes | ✅ 106/106, build, démarrage (santé, inscription, tableau de bord, page d'accueil HTTP 200), **10/10** parcours |
| **GitHub Actions** du dépôt indépendant (`.github/workflows/ci.yml`) | intégration continue à chaque envoi | ✅ 6/6 exécutions réussies, dont `9e158a6` |

Également vérifié le 18/11 sur PostgreSQL 16 (Docker Compose propre au projet) : 4 migrations, 10/10 parcours, 0 erreur, sauvegarde complète.

### 9.2 Indépendance Git
| Contrôle | Résultat |
|---|---|
| Racine, `.git`, `origin` | `/home/user/xamxam-lab-verif/.git` ; `origin = https://github.com/niang01/xamxam-lab-` (seul distant) |
| Branches | `main` seulement (localement et sur GitHub) |
| Historique | 6 commits, **une seule racine** `16eeabc` sans parent ; aucun ancêtre commun avec SUUF (`git merge-base` impossible) ; commits de l'ancienne branche (`f05a256`, `8f47b57`, `70fcc11`) absents |
| Synchronisation | `main` local = `origin/main` = `9e158a60e41c8512e5227c59d740ca3e69fad06f` |
| Fichiers | Tout fichier suivi de l'ancien dossier existe dans le dépôt indépendant (sauf `src/server/http.ts`, volontairement remplacé) — aucun fichier perdu |

### 9.3 Aucune dépendance vers SUUF
| Domaine | XAM-XAM LAB | SUUF SPACE NAZA |
|---|---|---|
| Paquet | `xamxam-lab` (29 dépendances npm publiques, 0 `file:`/`link:`/`git:`) | `suuf-space-naza` |
| Code | 0 mention de SUUF/NAZA/`snz_`/onrender hors documentation d'audit ; 0 chemin absolu ; 0 import hors de la racine | 0 mention de XAM-XAM (vérifié sur `main` et la branche de travail) |
| Base | `xamxam` (PostgreSQL) ou `./data/pglite` ; table `xx_migrations` | `suuf` (PostGIS) ; table `schema_migrations` |
| Sessions | cookie `xx_session` | cookies `snz_user`, `snz_admin`, `snz_pilot` |
| Variables | `SESSION_SECRET`, `XX_*`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `METEOMATICS_*`, `MQTT_*` — **valeurs propres à fournir**, aucune n'est définie dans l'environnement XAM-XAM | propres à SUUF |
| Déploiement | `Dockerfile`, `docker-compose.yml` (db `xamxam`, app, mqtt), `.env.example`, port 3100 | `deploy/` (PostGIS, Caddy), Render |
| Environnement cloud | « xamxam-lab » : **aucune variable, aucun secret réseau** ; hôtes NASA POWER, Google (SDK Android), PlatformIO | « SUUF-SPACE-NAZA » : secrets Meteomatics et Hugging Face, hôtes propres à SUUF |

**Identifiants de SUUF non réutilisables** : depuis l'environnement XAM-XAM, le proxy refuse (HTTP 403) `api.meteomatics.com`, `router.huggingface.co` et `suuf-naza.onrender.com` ; les secrets enregistrés sur l'environnement SUUF ne sont donc jamais transmis. Le code XAM-XAM n'envoie d'identifiants Meteomatics que s'ils sont configurés dans **son** `METEOMATICS_USERNAME/PASSWORD` (aucun aujourd'hui → fonction signalée « en attente d'un compte »).

### 9.4 Retrait de l'ancien dossier (après les vérifications ci-dessus)
- Sauvegarde préalable : paquet Git de la branche SUUF avant retrait (SHA-256 `f9bd6ff386db7e444de4b5472507a64b4a86232046ac52d7cf2b4c797f537a8a`, sommet `70fcc11`).
- Commit `9ff8a29` sur la branche de travail `ccr-859cc6b2-lvx9c5` du dépôt SUUF : suppression de `xamxam-lab/` et retour des 3 fichiers d'outillage (`tsconfig.json`, `eslint.config.mjs`, `.dockerignore`) à leur version de `main`. **L'arbre de la branche est strictement identique à celui de `main` de SUUF** (`e7a1243`, même empreinte d'arbre Git) : aucun fichier de SUUF n'est modifié ou supprimé. La branche `main` de SUUF n'a jamais contenu XAM-XAM et n'a pas été touchée.
- SUUF vérifié seul avant et après le retrait : typage ✅, lint ✅, **301 tests** réussis (3 ignorés, identique), build ✅.

**Conclusion** : les deux projets s'installent, se compilent, se testent, démarrent et se déploient séparément, chacun avec son dépôt, son environnement, sa base, ses comptes et ses secrets.

## 10. Confirmation technique définitive (18/11/2026)
| # | Exigence | Preuve | Verdict |
|---|---|---|---|
| 1 | Le dépôt contient tout le projet | Dépôt **`niang01/xamxam-lab-`** (le nom sans tiret n'existe pas : `git ls-remote` le refuse) ; clone neuf : 484 fichiers, 7 commits, une seule racine `16eeabc` sans parent, aucun sous-module, aucun lien symbolique ; tout fichier de l'ancien dossier y figure | ✅ |
| 2 | Claude Code travaille sur XAM-XAM sans ouvrir SUUF | Session `session_013BZ2Jh1SupuisFs4NETCfv` : environnement « xamxam-lab », **seul dépôt rattaché `niang01/xamxam-lab-`**, `ls -d /home/user/*/` → uniquement `xamxam-lab-` ; installation, tests, build, démarrage et 10/10 parcours réussis ; le dépôt fournit ses propres instructions (`CLAUDE.md`) | ✅ |
| 3 | Base, variables, clés API, environnement cloud propres | Base `xamxam` / `./data/pglite`, table `xx_migrations` ; variables `XX_*`, `SESSION_SECRET`, `XX_ENCRYPTION_KEY`… (`.env.example`) ; environnement cloud « xamxam-lab » sans aucune variable ni secret ; **aucune clé API de SUUF accessible** (proxy : 403 vers Meteomatics, Hugging Face, serveur SUUF). Les clés propres à XAM-XAM (Anthropic, Meteomatics) **restent à créer par l'exploitant** : sans elles, les fonctions concernées sont signalées « en attente » | ✅ (clés à fournir) |
| 4 | Installation, compilation, démarrage depuis un clone neuf | `/home/user/xamxam-lab-neuf`, `npm ci` avec **cache vide**, `pip --no-cache-dir` : typage ✅, lint ✅, **106/106** ✅, build ✅ (83 pages) ; `next start` sur base neuve : santé, inscription, pages `/`, `/marketplace`, `/lab/electronics`, `/settings` en HTTP 200, calcul réel (loi d'Ohm), 0 erreur ; **10/10** parcours e2e | ✅ |
| 5 | Aucun fichier de SUUF nécessaire | Clone hors de tout dossier SUUF ; 0 import hors de la racine, 0 chemin absolu, 0 dépendance `file:`/`git:`, 0 mention de SUUF dans le code ; session distincte sans SUUF dans le conteneur | ✅ |
| 6 | Modifier XAM-XAM ne peut pas modifier SUUF | Seul distant : `niang01/xamxam-lab-` ; aucun ancêtre commun avec SUUF ; CI limitée à `actions/checkout` du dépôt lui-même, sans jeton ni autre dépôt ; SUUF inchangé pendant ces vérifications (`main` = `7dbfab8`, branche de travail = `9ff8a29`, arbre de travail propre) | ✅ |

**Recommandation d'exploitation** : pour garantir mécaniquement l'étanchéité, poursuivre le développement dans une session Claude Code ouverte **uniquement** sur `niang01/xamxam-lab-` dans l'environnement « xamxam-lab » (comme la session de vérification ci-dessus) : SUUF n'y est ni cloné ni accessible en écriture.

## 11. Ce qui reste à décider par l'exploitant
1. Nom du dépôt : il s'appelle `niang01/xamxam-lab-` (avec un tiret final). Pour `niang01/xamxam-lab`, le renommer sur GitHub (Settings → Repository name) ; GitHub redirige l'ancienne adresse.
2. Branches de travail du dépôt SUUF créées par les sessions de développement (`ccr-…`) : leur historique contient encore les anciennes versions de `xamxam-lab/` ; les supprimer est une décision de l'exploitant (opération irréversible, non effectuée).
3. Donner accès à `boutique-Ecommerce` si son audit direct est souhaité.
