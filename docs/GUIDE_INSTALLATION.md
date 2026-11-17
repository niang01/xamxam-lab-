# Guide d'installation et de déploiement — XAM-XAM LAB

## 1. Prérequis
| Composant | Version | Rôle |
|---|---|---|
| Node.js | 22 LTS | Plateforme web (Next.js 16), moteur ngspice (WebAssembly), passerelle MQTT, agent local |
| Python | 3.12 (3.10+) avec `workers/requirements.txt` | Moteurs pvlib et CoolProp (simulation PV horaire, fluides frigorigènes) |
| PostgreSQL | 16 | Base de production (sans `DATABASE_URL`, PGlite embarqué est utilisé) |
| Docker + Compose | 24+ | Déploiement recommandé (facultatif) |
| Mandataire HTTPS | Caddy ou Nginx | Obligatoire en production (cookies `secure`) |

## 2. Poste de développement
```bash
git clone <dépôt xamxam-lab> && cd xamxam-lab
npm ci
python3 -m venv .venv && .venv/bin/pip install -r workers/requirements.txt
XX_PYTHON=$PWD/.venv/bin/python XX_ADMIN_EMAILS=vous@exemple.sn npm run dev   # http://localhost:3100
```
Créez votre compte avec l'adresse de `XX_ADMIN_EMAILS` : il reçoit le rôle administrateur. Les données sont dans `./data/pglite`.

## 3. Production avec Docker Compose (recommandé)
```bash
cp .env.example .env        # renseigner au minimum POSTGRES_PASSWORD, SESSION_SECRET (openssl rand -base64 48), XX_ADMIN_EMAILS
docker compose up -d --build
docker compose ps           # db, app (healthy), mqtt
```
- Application : port `3100` (variable `APP_PORT`) à placer derrière HTTPS. Exemple Caddy : `lab.mondomaine.sn { reverse_proxy 127.0.0.1:3100 }`.
- MQTT : port `1883` ; en production, activer TLS (`MQTTS_PORT=8883`, `MQTT_TLS_CERT`, `MQTT_TLS_KEY`) et laisser `MQTT_ALLOW_INSECURE=false`.
- Registre d'images indisponible ou limité : `IMAGE_REGISTRY=mirror.gcr.io/library`.
- Proxy d'entreprise qui intercepte TLS : `EXTRA_CA_FILE=chemin/vers/ca.pem` (fichier dans le dossier du projet ; utilisé seulement pendant la construction).

**Vérifié le 17/11/2026** : pile construite et démarrée (PostgreSQL 16, application « healthy », passerelle MQTT), 7 parcours Playwright réussis contre ce déploiement, moteur Python opérationnel dans le conteneur.

## 4. Production sans Docker (systemd)
```bash
npm ci && npm run build
python3 -m venv /opt/xamxam/venv && /opt/xamxam/venv/bin/pip install -r workers/requirements.txt
```
Fichier `/etc/systemd/system/xamxam.service` :
```ini
[Unit]
Description=XAM-XAM LAB
After=network.target postgresql.service
[Service]
WorkingDirectory=/opt/xamxam/app
EnvironmentFile=/opt/xamxam/app/.env
Environment=NODE_ENV=production XX_PYTHON=/opt/xamxam/venv/bin/python
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3100
Restart=always
User=xamxam
[Install]
WantedBy=multi-user.target
```
Passerelle MQTT : même modèle avec `ExecStart=/usr/bin/node services/mqtt-gateway.mjs`.
Les dossiers `workers/`, `services/`, `db/` et `public/` doivent accompagner `.next/`.

## 5. Applications mobiles
Voir [mobile/README.md](../mobile/README.md) : `XX_APP_URL=https://lab.mondomaine.sn bash mobile/scripts/build-android.sh release` (APK + AAB signés) ; iOS avec Xcode sur macOS.

## 6. Firmware du nœud IoT
Voir [firmware/xamxam-node/README.md](../firmware/xamxam-node/README.md) (PlatformIO, ESP32 / XIAO ESP32-S3).

## 7. Vérifications après installation
```bash
curl -s https://lab.mondomaine.sn/api/health      # {"ok":true,"db":"postgres","session_secret":"configured",…}
npm run typecheck && npm run lint && npm test       # sur le poste de développement
XX_E2E_BASE_URL=https://lab.mondomaine.sn XX_E2E_ADMIN=<adresse admin> npx playwright test   # parcours contre le serveur (crée des comptes de test)
```
