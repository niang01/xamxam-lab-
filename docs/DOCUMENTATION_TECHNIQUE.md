# Documentation technique — XAM-XAM LAB

## Architecture
```
Navigateur / PWA / applications Capacitor (Android, iOS)
  └─ Next.js 16 (React 19, TypeScript strict, Tailwind 4) — 36 pages, 82 routes API (docs/API.md)
       ├─ src/proxy.ts                session exigée pour /api/** (sauf routes publiques et appareils)
       ├─ src/server/api.ts           endpoint() : erreurs uniformes, quota d'écriture ; readInput (zod) ; session revérifiée en base
       ├─ src/server/ai/              XAM-XAM AI CORE : 17 agents, 17 outils, gouvernance, moteur de règles, Claude
       ├─ src/server/iot.ts           ingestion, cycle de vie des commandes, arrêt d'urgence, automatisations
       ├─ src/server/spice.ts         ngspice 45 (WebAssembly) — processus isolé workers/spice-worker.mjs
       ├─ src/server/compute.ts       pvlib / CoolProp — processus isolé workers/compute.py (XX_PYTHON)
       ├─ src/server/integrations/    NASA POWER (climatologie, journalier, horaire), Meteomatics
       ├─ src/server/rtc.ts           signalisation WebRTC (réunions pair à pair)
       ├─ src/server/backup.ts        sauvegarde/restauration JSON
       └─ src/lib/                    fonctions pures testées : calculs, netlist SPICE, autonomie, commandes, scénarios, i18n
PostgreSQL 16 (production) ou PGlite (développement, tests) — db/migrations
services/mqtt-gateway.mjs   broker MQTT (Aedes) → API des appareils (aucun accès direct à la base)
services/local-agent.mjs    agent série/USB → API des appareils
firmware/xamxam-node        ESP32 / XIAO ESP32-S3 (PlatformIO)
mobile/                     Capacitor 7 (android/, ios/)
```

## Principes
- **Indépendance** : code, base, comptes, API et configuration propres ; aucune dépendance à un autre produit.
- **Aucune donnée inventée** : un paramètre absent est signalé (`missing`) ; aucun coefficient normatif, caractéristique de composant ou traduction wolof n'est codé en dur.
- **Nature de l'information** partout (`measurement`, `calculation`, `simulation`, `modelled`, `prediction`…).
- **L'IA n'exécute rien elle-même** : elle appelle des outils typés ; la gouvernance (hors modèle) décide : exécuter, mettre en attente d'approbation, bloquer. Le compte rendu provient du journal `ai_steps`.
- **Sécurité physique hors IA** : durées maximales fixées par le propriétaire, habilitations, commandes expirantes, exécution sur accusé, arrêt d'urgence prioritaire, limites appliquées aussi par le firmware.

## Modèle de données (principales tables)
`users`, `clearances` · `projects`, `project_members`, `project_tasks`, `project_messages` · `schematics`, `schematic_versions`, `calc_runs`, `simulations`, `normative_tables`, `components` · `ai_agents`, `ai_conversations`, `ai_messages`, `ai_steps`, `ai_memory` · `devices`, `measurements`, `device_commands`, `automations`, `automation_runs`, `rc_sessions`, `rc_events` · `geo_requests`, `geo_observations` · `courses`, `enrollments`, `certificates` · `eco_items`, `eco_links` · `translations`, `notifications`, `settings`, `audit_log` · `rtc_peers`, `rtc_signals`. Schéma complet : `db/migrations/*.sql` ; migrations numérotées appliquées une fois, en transaction (`xx_migrations`).

## Sécurité
Mots de passe scrypt (N=2¹⁴, sel 16 octets) ; sessions `xx1.<charge>.<HMAC-SHA256>` dans un cookie httpOnly/SameSite=Lax/Secure, révocables (`session_version`) ; jetons d'appareils 256 bits stockés hachés (SHA-256) ; requêtes SQL paramétrées ; validation zod ; limitation de débit (seau à jetons) ; CSP stricte, HSTS, X-Frame-Options DENY, nosniff ; netlists SPICE filtrées (aucune directive injectable) ; moteurs de calcul en processus isolés avec délai ; journal d'audit chaîné SHA-256 ; projets privés par défaut, accès « introuvable » pour les non-membres ; profils publics sur consentement explicite.

## IA (Claude)
`src/server/ai/core.ts` : SDK officiel `@anthropic-ai/sdk`, `client.beta.messages.create`, modèle `AI_MODEL` (défaut `claude-opus-5-5`), `output_config.effort: "medium"`, repli serveur `fallbacks: "default"` (en-tête `server-side-fallback-2026-07-01`), boucle d'outils ≤ 10 tours, contenu de l'assistant renvoyé intégralement, arrêt sur `refusal`, plafond `AI_DAILY_LIMIT`, repli signalé sur le moteur de règles en cas d'erreur (clé refusée, quota, réseau).

## Tests
`npm test` (Vitest : unitaires + intégration sur PGlite, ngspice réel, Python si disponible), `npm run test:e2e` (Playwright : ordinateur + Pixel 7, MQTT, agent série, WebRTC). Détail : [RAPPORT_DE_TESTS.md](RAPPORT_DE_TESTS.md).
