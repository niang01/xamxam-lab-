# CLAUDE.md — XAM-XAM LAB

@AGENTS.md

## Projet
Plateforme d'ingénierie, de simulation et d'innovation (Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, PostgreSQL 16 / PGlite).
Projet **autonome** : aucun code, donnée, compte, clé ou service d'une autre application (voir `docs/AUDIT_SEPARATION.md`).
Langue de l'interface et de la documentation : français (rédaction), anglais ; wolof = langue de référence, **uniquement** via les traductions validées par des locuteurs natifs.

## Règles non négociables
- Ne jamais inventer de mesure, de donnée satellite/NASA, de coefficient normatif ni de traduction wolof. Valeur absente → `null` et paramètre signalé.
- Toujours distinguer la nature d'une valeur : calculé, simulé, mesuré, modélisé, prédiction, estimation.
- Calculs dans `src/lib/**` (fonctions pures testées) ou les moteurs (`workers/`) ; l'IA appelle des outils (`src/server/ai/tools.ts`) et ne calcule rien elle-même.
- Commandes physiques : l'IA propose, une personne habilitée confirme ; durée maximale ; « exécutée » seulement sur accusé de l'appareil ; arrêt d'urgence toujours permis.
- Aucun secret côté client ; tests sans succès d'API simulé (`fetchImpl` explicites).
- Aucune fonctionnalité factice dans l'interface : ce qui n'existe pas est affiché « non disponible ».

## Organisation
- `db/migrations/*.sql` — schéma ; nouvelle table → nouvelle migration numérotée (jamais modifier une migration publiée).
- `src/server/api.ts` — `endpoint()`, `ok()`, `ApiFailure`, `readInput` (zod), `uuidParam`, `throttle`, `mustBeSignedIn` / `mustBeAdmin`. Base : `sql` / `sqlOne` (`src/server/db.ts`).
- `src/app/api/**/route.ts` — routes (toujours via `endpoint`) ; `src/app/**/page.tsx` — pages client (`useData`).
- `src/lib/i18n/messages.ts` — catalogue FR/EN typé (toute clé `t("…")` doit y exister ; test unitaire).
- `design/identite/` — identité visuelle (scripts de génération, SVG, jetons) ; `docs/IDENTITE_VISUELLE.md`.
- `mobile/` (Capacitor Android/iOS), `firmware/xamxam-node` (PlatformIO), `services/` (MQTT, agent série), `workers/` (ngspice, Python).

## Vérifications avant commit
```bash
npm run typecheck && npm run lint && XX_PYTHON=.venv/bin/python npm test
npm run build && npm run test:e2e
```
Mettre à jour `docs/ETAT_REALISATION.md` (et `docs/RAPPORT_DE_TESTS.md` si les tests changent) à chaque fonctionnalité.

## Pièges connus
- Next.js insère un annonceur `role="alert"` : cibler `[role=alert]:not(#__next-route-announcer__)`.
- `eecircuit-engine` pollue `globalThis.window` : il tourne dans `workers/spice-worker.mjs` (processus séparé).
- Chemins dynamiques (`spawn`, fichiers) : commentaire `/* turbopackIgnore: true */`.
- Polices et images servies localement (CSP sans ressource tierce).
