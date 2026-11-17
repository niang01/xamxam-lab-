# XAM-XAM LAB

**Global AI Engineering, Simulation, Innovation & Startup Ecosystem** — « De l'idée à la conception, de la conception à la simulation, de la simulation à la réalisation. »

Plateforme autonome d'ingénierie, d'IA, de simulation, de formation et d'innovation : application web (PWA), applications Android et iOS (Capacitor), XAM-XAM AI CORE et ses agents, laboratoires (ngspice, pvlib, CoolProp), IoT (HTTPS, MQTT, agent local), Automation Studio, Remote Control Center, Earth & Space, Academy, visioconférence, écosystème startups — en **wolof (référence), français et anglais**.

> Principes : aucune mesure, donnée satellitaire, caractéristique de composant, coefficient normatif ni traduction wolof n'est inventé ; chaque résultat porte sa nature ; l'IA appelle des outils et ne commande jamais un équipement elle-même ; une commande n'est « exécutée » que sur accusé de l'appareil ; toute fonction non disponible est affichée comme telle.

## Documentation
| Document | Contenu |
|---|---|
| [docs/GUIDE_INSTALLATION.md](docs/GUIDE_INSTALLATION.md) | Installation, Docker, systemd, HTTPS, vérifications |
| [docs/GUIDE_UTILISATEUR.md](docs/GUIDE_UTILISATEUR.md) | Utilisation de chaque rubrique |
| [docs/GUIDE_ADMINISTRATEUR.md](docs/GUIDE_ADMINISTRATEUR.md) | Comptes, habilitations, traductions, Command Center, modération |
| [docs/DOCUMENTATION_TECHNIQUE.md](docs/DOCUMENTATION_TECHNIQUE.md) | Architecture, sécurité, données, IA |
| [docs/API.md](docs/API.md) | 82 routes (généré : `npm run docs:api`) |
| [docs/AUDIT_SEPARATION.md](docs/AUDIT_SEPARATION.md) | Audit de séparation SUUF / boutique, corrections et preuves d'indépendance |
| [docs/IDENTITE_VISUELLE.md](docs/IDENTITE_VISUELLE.md) | Logos, icônes, palette, typographie, maquettes (en attente de validation) |
| [docs/SAUVEGARDE_RESTAURATION.md](docs/SAUVEGARDE_RESTAURATION.md) | Procédures testées |
| [docs/RAPPORT_DE_TESTS.md](docs/RAPPORT_DE_TESTS.md) | Résultats réels des tests |
| [docs/ETAT_REALISATION.md](docs/ETAT_REALISATION.md) | Terminé / partiel / en attente / non réalisé |
| [docs/PREREQUIS_EXTERNES.md](docs/PREREQUIS_EXTERNES.md) | Clés, comptes, équipements à fournir |
| [docs/RAPPORT_DE_REPRISE.md](docs/RAPPORT_DE_REPRISE.md) | Reprise du développement, dépôt dédié |
| [mobile/README.md](mobile/README.md) · [firmware/xamxam-node/README.md](firmware/xamxam-node/README.md) | Applications mobiles · nœud IoT |
| [docs/README.md](docs/README.md) | Dossier de conception (vision, spécifications, architecture cible) |

## Démarrage
```bash
cd xamxam-lab
npm install
XX_ADMIN_EMAILS=vous@exemple.sn npm run dev     # http://localhost:3100 — base PGlite créée dans ./data
```
Créez votre compte avec l'adresse déclarée dans `XX_ADMIN_EMAILS` pour obtenir le rôle administrateur. Variables : [`.env.example`](.env.example).

## Production
```bash
npm run build
SESSION_SECRET=… XX_ADMIN_EMAILS=… DATABASE_URL=postgres://… npm start   # port 3100
```
Les dossiers `workers/` (ngspice, Python) et `services/` (MQTT, agent local) accompagnent l'application. Derrière un mandataire HTTPS (Caddy, Nginx). Recommandé : `docker compose up -d --build` (vérifié : PostgreSQL 16, application, passerelle MQTT) — voir le guide d'installation.

## Vérifications
```bash
npm run typecheck && npm run lint && XX_PYTHON=.venv/bin/python npm test   # 83 tests (PGlite, ngspice, pvlib, CoolProp)
npm run build && npm run test:e2e                 # 7 parcours Playwright (ordinateur + Pixel 7, MQTT, agent série, WebRTC)
pio run -d firmware/xamxam-node -e xiao_esp32s3   # firmware du nœud (PlatformIO)
```

## Organisation
| Chemin | Rôle |
|---|---|
| `src/app/**/page.tsx` | 27 écrans (26 rubriques + Automation Studio), administration, pages publiques `/p/…` |
| `src/app/api/**/route.ts` | 82 routes ; `endpoint()` erreurs uniformes, `readInput` zod, contrôle d'accès revérifié en base |
| `src/lib/eng/` | calculs purs testés : électrotechnique, solaire, mécanique, thermique, réseau |
| `src/lib/spice/` | schéma → netlist SPICE, ERC, filtrage anti-injection |
| `src/lib/{autonomy,commands,automation}.ts` | gouvernance de l'IA, sécurité des commandes, scénarios |
| `src/lib/i18n/` | catalogue FR/EN (878 textes), résolution wolof (traductions validées seulement), CSV |
| `src/server/ai/` | XAM-XAM AI CORE : agents, outils, orchestration, moteur de règles |
| `src/server/iot.ts` | ingestion, cycle de vie des commandes, arrêt d'urgence, automatisations |
| `src/server/integrations/geo.ts` | NASA POWER (climatologie, journalier), Meteomatics |
| `workers/spice-worker.mjs`, `workers/compute.py` | ngspice 45 (WebAssembly), pvlib et CoolProp en processus isolés |
| `services/mqtt-gateway.mjs`, `services/local-agent.mjs` | passerelle MQTT (`npm run mqtt`), agent local série/USB (`npm run agent`) |
| `mobile/` | applications Android et iOS (Capacitor 7) |
| `firmware/xamxam-node/` | nœud ESP32 / XIAO ESP32-S3 avec sécurités locales |
| `db/migrations/` | schéma PostgreSQL (aussi PGlite) |
