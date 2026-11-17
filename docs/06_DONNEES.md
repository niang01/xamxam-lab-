# 6. Schéma de base de données

PostgreSQL 16 + PostGIS + TimescaleDB + pgvector. Migrations SQL numérotées, idempotentes, jamais modifiées après publication. Identifiants UUID v7. Toutes les tables métier ont `created_at`, `updated_at`, `created_by`, et `deleted_at` lorsqu'une suppression logique est requise.

## 6.1 Domaines et tables

### Identité et droits
| Table | Colonnes clés |
|---|---|
| `users` | id, email/phone (uniques), password_hash (scrypt), display_name, locale (`wo`/`fr`/`en`), status |
| `user_profiles` | user_id, profile_kind (15 profils), bio, country, skills jsonb, visibility |
| `mfa_factors` | user_id, kind (`totp`/`webauthn`), secret_enc, credential_id |
| `sessions` | id, user_id, device, expires_at, revoked_at |
| `organizations` | id, kind (school, company, startup, lab, sponsor), name, country |
| `memberships` | org_id, user_id, role |
| `roles`, `permissions`, `role_permissions` | RBAC plateforme |
| `clearances` | user_id, kind (`operation_reelle`, `telepilote_drone`, `validateur_traduction_wo`…), evidence_file, valid_until, granted_by |

### Projets et objets
| Table | Colonnes clés |
|---|---|
| `projects` | id, owner_org/user, title, description, objectives, problem, specs jsonb, visibility (`private` défaut) |
| `project_members` | project_id, user_id, role (`owner`/`editor`/`commenter`/`viewer`) |
| `documents` | project_id, kind, title, storage_key, yjs_doc_id |
| `schematics` | project_id, lab (`electrical`, `electronics`…), yjs_doc_id, current_version |
| `schematic_versions` | schematic_id, n, snapshot jsonb, checksum, message |
| `models_3d` | project_id, format (STEP/GLB), storage_key, version |
| `tasks`, `milestones` | project_id, assignee, due, status |
| `reports` | project_id, sources jsonb (objets inclus), checksum |
| `object_provenance` | object_id, nature (`fact`…`outcome` + `simulation`), source, engine, engine_version, input_hash |

### Bibliothèque de composants
| Table | Colonnes clés |
|---|---|
| `components` | id, category, name, manufacturer, mpn, description, function, status (`verified`/`to_verify`), source_license |
| `component_specs` | component_id, key, value numeric, unit, min, max, source_ref |
| `component_pins` | component_id, n, name, kind |
| `component_assets` | component_id, kind (`symbol`/`footprint`/`model3d`/`image`/`spice`), storage_key, license |

### Calcul, simulation
| Table | Colonnes clés |
|---|---|
| `calc_runs` | project_id, calc_kind, inputs jsonb, outputs jsonb, missing_params jsonb, references jsonb, lib_version |
| `simulations` | project_id, engine (`ngspice`, `pvlib`, `coolprop`, `calculix`, `px4_sitl`…), engine_version, kind (`visual_animation`/`physics_realtime`/`numerical_solver`), input_ref, input_hash, status, started/finished, cpu_s, result_key, logs_key, validity jsonb |
| `normative_tables` | standard, edition, table_ref, data jsonb, entered_by, validated_by |
| `digital_twins` | project_id, model_ref, device_ids, mapping jsonb |

### IA
| Table | Colonnes clés |
|---|---|
| `ai_agents` | key, version, system_prompt_ref, tools text[], limits jsonb, enabled |
| `ai_conversations`, `ai_messages` | user, project, lang, role, content, model |
| `ai_plans` | conversation_id, plan jsonb, status (`proposed`/`approved`/`rejected`/`running`/`done`/`failed`/`suspended`), approved_by |
| `ai_steps` | plan_id, agent_key, tool, input, output, status, cost, started/finished |
| `ai_memory` | project_id, content, embedding vector, source, author, visibility |
| `autonomy_grants` | scope (`user`/`project`/`device`/`operation`), scope_id, level, limits jsonb, granted_by, expires_at, revoked_at |

### IoT, automatisation, télépilotage
| Table | Colonnes clés |
|---|---|
| `devices` | id, owner, org, kind, protocol, capabilities jsonb, status, token_hash, firmware_version, last_seen |
| `device_permissions` | device_id, user_id, can_read, can_command, max_level |
| `measurements` (hypertable Timescale) | device_id, metric, ts, value, unit, quality (`valid`/`suspect`/`simulated`) |
| `device_commands` | device_id, action, params, proposed_by (`ai`/`user`), confirmed_by, status (`proposed`/`confirmed`/`sent`/`acknowledged`/`expired`/`failed`/`refused`), expires_at, ack_payload |
| `local_agents` | user_id, pairing_code_hash, platform, last_seen |
| `automations` | project_id, graph jsonb, status, level_required, dry_run_report |
| `automation_runs` | automation_id, trigger, steps jsonb, outcome |
| `rc_sessions` | mode (`virtual`/`bench`/`real`), vehicle_device_id, pilot_id, started/ended, authorization_ref |
| `rc_events` (hypertable) | session_id, ts, kind (`telemetry`/`command`/`handover`/`estop`/`alert`), payload |

### Earth & Space
`geo_datasets` (source, licence, résolution), `geo_observations` (source, variable, geom, observed_at, retrieved_at, value, unit, nature `modelled`/`observation`), `geo_forecasts` (séparées, `issued_at`, horizon, fourchette — `weather_forecasts`).

### Académie, écosystème
`courses`, `lessons`, `exercises`, `lab_templates`, `classes`, `class_members`, `submissions`, `grades`, `certificates` (empreinte vérifiable) ; `startups`, `startup_members`, `connections` (demandes acceptées des deux côtés) ; `challenges`, `challenge_teams`, `entries` (version figée), `jury_members` (conflits déclarés), `scores` ; `mentors`, `availability`, `bookings` ; `job_offers`, `applications`, `portfolios` ; `posts` (`sponsored` booléen), `listings`, `moderation_queue`.

### Langues
`translations` (namespace, key, lang, text, status `missing`/`draft`/`validated`/`machine_translated`, validated_by, validated_at, sensitive), `glossary_terms` (terme scientifique, langue, équivalent validé ou « conserver le terme »), `audio_messages`.

### Gouvernance
`audit_log` (append-only : acteur humain/IA/agent, action, objet, avant/après résumés, raison, ip, résultat ; chaînage d'empreintes), `incidents`, `quotas`, `usage_records`, `consents` (finalité, date, retrait).

## 6.2 Règles d'intégrité
- `measurements.quality = 'simulated'` exclue des calculs réels, alertes et automatisations.
- `device_commands.status = 'acknowledged'` uniquement si `ack_payload` présent.
- `simulations` sans `engine_version` ni `input_hash` refusée.
- Ligne de rangée (RLS) PostgreSQL sur les tables de projet comme seconde barrière derrière les contrôles applicatifs.
