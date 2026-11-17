# 13. Matrice de traçabilité

Chaque exigence du cahier des charges (§ = section du prompt maître) est reliée à son module, son écran, son service backend, son agent IA, son test et sa phase. Les identifiants de tests sont ceux à créer ; colonne « État » mise à jour dans [ETAT_REALISATION.md](ETAT_REALISATION.md), qui fait foi.

| ID | Exigence (§) | Module | Écran | Service backend | Agent IA | Test | Phase | État |
|---|---|---|---|---|---|---|---|---|
| R01 | Web multi-OS, grands écrans (§3.1) | Plateforme | Toutes | `apps/web` | — | E2E-RESP-01 (bureau, tablette, mobile) | 1 | Spécifié |
| R02 | Application Android (§3.2) | Mobile | Shell mobile | `apps/mobile` | — | MOB-AND-01 | 1 | Spécifié |
| R03 | Application iOS (§3.3) | Mobile | Shell mobile | `apps/mobile` | — | MOB-IOS-01 | après MVP | Spécifié |
| R04 | Synchronisation multi-appareils (§3.4) | Sync | « Reprendre » | `apps/realtime` (Yjs), `/sync` | — | INT-SYNC-01, E2E-P8 | 1 | Spécifié |
| R05 | Hors connexion (§3.4) | Sync | Indicateur hors ligne | service worker, SQLite mobile | — | E2E-OFF-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R06 | WO langue de référence, FR, EN (§4) | i18n | Sélecteur langue, Langues | `/i18n/*` | tous | I18N-KEYS-01, E2E-LANG-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R07 | Aucun mot wolof inventé ; terme conservé (§4) | i18n | Glossaire | `glossary_terms` | tous | I18N-VALID-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R08 | Reconnaissance vocale wolof (§4) | Voix | Bouton Dicter | service ASR | — | ASR-WER-01 (corpus réel) | 2 | Spécifié (à évaluer) |
| R09 | Synthèse vocale wolof (§4) | Voix | Bouton Écouter | MMS-TTS | — | TTS-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R10 | Changer de langue sans perdre le travail (§4) | i18n | Toutes | client | — | E2E-LANG-02 | 1 | Spécifié |
| R11 | AI CORE : comprendre, planifier (§5.1, 5.2A) | AI CORE | Conversation, Plan | `packages/ai-core` planner | Reasoning | AI-PLAN-01..n | 1–2 | Réalisé (voir ETAT_REALISATION) |
| R12 | Orchestrateur multi-agents (§5.2B) | AI CORE | Suivi des opérations | orchestrateur | tous | AI-ORCH-01 | 2 | Spécifié |
| R13 | Exécution d'outils (§5.2C) | AI CORE | Suivi | registre d'outils | tous | AI-TOOL-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R14 | Connectivité appareils (§5.2D) | AI CORE / IoT | IoT Gateway | `iot-gateway` | IoT | AI-DEV-01 | 5 | Spécifié |
| R15 | Moteur d'automatisation (§5.2E, §7) | Automation Studio | Éditeur de scénarios | ordonnanceur | IoT, Software | AUTO-01, AUTO-DRYRUN-01 | 6 | Spécifié |
| R16 | Opérations à distance (§5.2F, §9) | Remote Control | Session RC | `rc` + pont MAVLink | Drone, Robotics | RC-SITL-01, RC-ESTOP-01 | 6 | Spécifié |
| R17 | Moteur de simulation IA (§5.2G) | AI CORE / Sim | Résultats | jobs | tous ingénieurs | AI-SIM-01 | 3 | Spécifié |
| R18 | Mémoire et connaissances (§5.2H) | AI CORE | Mémoire | pgvector | tous | AI-MEM-ACL-01 | 2 | Spécifié |
| R19 | Sécurité et gouvernance IA (§5.2I, §23) | Gouvernance | Command Center | moteur de politiques | — | SEC-POL-01, AI-INJ-01 | 1–2 | Réalisé (voir ETAT_REALISATION) |
| R20 | Communication (§5.2J) | Notifications | Notifications | gestionnaire unifié | — | NOTIF-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R21 | 15 agents spécialisés (§5.3) | AI CORE | Agents | `ai_agents` | 15 + vérificateur | AI-EVAL-<agent> | 2–9 | Spécifié |
| R22 | Exemple solaire/pompage/IoT/drone (§5.4) | AI CORE | Parcours P3 | orchestrateur | Solar, Electrical, IoT, Drone, GIS, Software | E2E-P3 | 3 (drone en SITL : 6) | Spécifié |
| R23 | 5 niveaux d'autonomie (§6) | Gouvernance | Paramètres d'autonomie | `autonomy_grants` | — | SEC-AUTO-LVL-01..05 | 2 | Spécifié |
| R24 | Passerelle IoT filaire/sans fil (§8) | IoT Gateway | Ajouter un appareil | broker MQTT, agent local | IoT | IOT-MQTT-01, IOT-SERIAL-01, IOT-BLE-01 | 5 | Réalisé (voir ETAT_REALISATION) |
| R25 | Agent local (§8) | IoT Gateway | Agent local | `apps/local-agent` | — | LA-PAIR-01 | 5 | Spécifié |
| R26 | Remote Control : vidéo, télémétrie, GPS, transfert, arrêt d'urgence (§9) | Remote Control | Session | média + `rc` | Drone | RC-VIDEO-01, RC-HANDOVER-01 | 6 | Spécifié |
| R27 | Distinction virtuel / banc / réel (§9) | Remote Control | Sélection du mode | `rc_sessions.mode` | — | RC-MODE-01 | 6 | Spécifié |
| R28 | Electrical Lab (§10.1) | Labs | Electrical Lab | `eng-core`, sim-spice | Electrical | CALC-ELEC-*, ERC-01 | 3 | Spécifié |
| R29 | Electronics Lab + SPICE (§10.2) | Labs | Electronics Lab | sim-spice | Electronics | SIM-SPICE-REF-* | 3 | Spécifié |
| R30 | Solar Energy Lab (§10.3) | Labs | Solar Lab | sim-solar, NASA POWER | Solar | SIM-PV-REF-* | 3 | Réalisé (voir ETAT_REALISATION) |
| R31 | IoT & Embedded Lab (§10.4) | Labs | IoT Lab | compilation firmware | IoT | FW-BUILD-01 | 3 | Réalisé (voir ETAT_REALISATION) |
| R32 | Mechanical & Mechatronics (§10.5) | Labs | Mechanical Lab | sim-fea, CAO | Mechanical | SIM-FEA-REF-* | 4 | Spécifié |
| R33 | Refrigeration & HVAC (§10.6) | Labs | Refrigeration Lab | sim-thermo | Refrigeration | SIM-COOLPROP-REF-* | 4 | Spécifié |
| R34 | Computer & Network (§10.7) | Labs | Network Lab | sim-net | Computer & Network, Cybersecurity | NET-LAB-01 | 4 | Spécifié |
| R35 | Component Library (§10.8) | Labs | Bibliothèque | `components*` | Electronics, Tutor | COMP-VERIFIED-01 | 3 | Spécifié |
| R36 | Studio 2D/3D/4D (§11) | Simulation Studio | Studio | rendu + jobs | — | STUDIO-NATURE-01 (badges) | 3–4 | Spécifié |
| R37 | Animation ≠ physique ≠ simulation (§11) | Simulation Studio | Badges | `simulations.kind` | — | STUDIO-NATURE-02 | 3 | Spécifié |
| R38 | Digital Twin, comparaison simulation/réalité (§11) | Simulation Studio | Digital Twin | `digital_twins` | IoT | TWIN-01 | 4 | Spécifié |
| R39 | Earth & Space (NASA, Meteomatics…) (§12) | Earth & Space | Carte, Climat, Sols, Végétation | `packages/integrations` | GIS & Satellite | GEO-FRESH-01 | 7 (base en MVP) | Réalisé (voir ETAT_REALISATION) |
| R40 | Ne jamais présenter une observation ancienne comme instantanée (§12) | Earth & Space | Fiche source | `geo_observations` | GIS | GEO-FRESH-02 | 1 | Réalisé (voir ETAT_REALISATION) |
| R41 | Project & Research Studio (§13) | Projets | Fiche projet, Tâches, Versions | `/projects/*` | Research | PROJ-01 | 1 | Spécifié |
| R42 | Mémoire de fin d'études ; calculé/simulé/mesuré (§13) | Projets | Parcours mémoire, Rapports | `reports` | Research, Tutor | E2E-P2, REP-NATURE-01 | 3 | Spécifié |
| R43 | Academy (§14) | Academy | Catalogue, Cours, Enseignant | `/courses/*` | Education Tutor | E2E-P1, E2E-P5 | 8 (TP de base en MVP) | Spécifié |
| R44 | Collaboration temps réel, visioconférence (§15) | Collaboration | Salle projet | `apps/realtime`, SFU | — | RT-CRDT-01, RTC-01 | 8 | Spécifié |
| R45 | Startup Network (§16) | Écosystème | Startups | `/startups` | Startup Mentor | ECO-START-01 | 9 | Spécifié |
| R46 | Global Challenges ; décision humaine (§17) | Écosystème | Concours, Jury | `/challenges` | — (assistance) | ECO-CHAL-01, ECO-JURY-HUMAN-01 | 9 | Spécifié |
| R47 | Mentor & Incubator (§18) | Écosystème | Mentors, Réservations | `/mentors`, `/bookings` | Startup Mentor | ECO-MENT-01 | 9 | Spécifié |
| R48 | Talent & Careers ; consentement, non-discrimination (§19) | Écosystème | Profil, Offres | `/jobs` | Talent | ECO-TAL-CONSENT-01, ECO-TAL-FAIR-01 | 9 | Spécifié |
| R49 | Tech News & Marketplace ; contenu sponsorisé identifié (§20) | Écosystème | Actualités, Annonces | `/posts`, `/listings` | — | ECO-NEWS-SPONSOR-01 | 9 | Spécifié |
| R50 | 15 profils et permissions (§21) | Identité | Tableaux de bord | RBAC | — | AUTHZ-MATRIX-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R51 | AI Command Center (§22) | Gouvernance | Command Center | `/command-center/*` | — | CC-KILL-01, CC-REVOKE-01 | 2 | Spécifié |
| R52 | Sécurité (§23) | Gouvernance | Paramètres sécurité | sécurité | Cybersecurity | doc 09 | 1–9 | Réalisé (voir ETAT_REALISATION) |
| R53 | Projets privés par défaut, propriété intellectuelle (§23) | Projets | Visibilité | RLS | — | AUTHZ-PRIV-01 | 1 | Spécifié |
| R54 | Architecture modulaire (§24) | Plateforme | — | monorepo | — | CI | 1 | Spécifié |
| R55 | Modèle économique, quotas (§25) | Abonnements | Paramètres → Offre | `quotas` | — | QUOTA-01 | 1 (quotas), paiement plus tard | Spécifié |
| R56 | Menu de 26 rubriques (§26) | Plateforme | Navigation | — | — | E2E-NAV-26 (chaque rubrique ouvre son écran ou son état « non disponible — phase N ») | 1 | Spécifié |
| R57 | Pas de bouton décoratif ; état affiché (§27) | Plateforme | Toutes | — | — | E2E-NODEAD-01 (tout bouton actif a un effet vérifié) | 1 | Spécifié |
| R58 | Données de démonstration signalées (§27) | Plateforme | Badges `DÉMO` | — | — | DEMO-FLAG-01 | 1 | Réalisé (voir ETAT_REALISATION) |
| R59 | Agents ne prétendent pas avoir agi (§27) | AI CORE | Compte rendu | rapport depuis journal | tous | AI-HONEST-01 | 1 | Spécifié |
| R60 | Tests et validation avant livraison (§30) | Qualité | — | CI | — | doc 11 §11.3 | toutes | Réalisé (voir ETAT_REALISATION) |
