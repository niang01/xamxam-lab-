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

## 8. Ce qui reste à faire par l'exploitant
1. **Créer le dépôt vide `xamxam-lab`** sur GitHub et y autoriser l'application Claude (la session n'a pas le droit de créer un dépôt). La session poussera alors l'extraction et vérifiera le lien.
2. Après vérification du nouveau dépôt, et seulement sur décision de l'exploitant : retirer `xamxam-lab/` de la branche de travail du dépôt SUUF (le dossier n'a jamais été fusionné dans `main`).
3. Donner accès à `boutique-Ecommerce` si son audit direct est souhaité.
