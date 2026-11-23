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

## 2 bis. Déploiement gratuit : Render (Free) + Neon (Free)
Coût : **0 €**, sans carte bancaire. Limites : veille après 15 min sans visite (réveil ≈ 1 min), 512 Mo de mémoire (mesuré : ≈ 140 Mo avec PostgreSQL), base de 1 Go, pas de MQTT ; les calculs Python sont plus lents qu'en local.

1. **Neon** (neon.com, offre Free) : créer un projet, région *AWS Europe Central 1 (Frankfurt)*, PostgreSQL 16 ou 17. Copier l'adresse de connexion **avec pooling** (`…-pooler…`, elle contient `sslmode=require`).
2. **GitHub** : dans Render → *Account Settings → GitHub*, autoriser l'accès au dépôt `niang01/xamxam-lab-`.
3. **Render** → *New → Blueprint* → dépôt `niang01/xamxam-lab-`, branche `main` : Render lit `render.yaml`. **Vérifier que le plan affiché est « Free »** et qu'aucune base Render n'est proposée. Saisir dans les champs sécurisés : `DATABASE_URL` (adresse Neon) et `XX_ADMIN_EMAILS` (votre adresse). `SESSION_SECRET` et `XX_ENCRYPTION_KEY` sont générés par Render.
4. Premier déploiement : les migrations s'appliquent automatiquement sur Neon au démarrage. Santé : `https://<service>.onrender.com/api/health` doit afficher `"db":"postgres"`.
5. Créer votre compte avec l'adresse déclarée dans `XX_ADMIN_EMAILS` (vous devenez administrateur).
6. **Sauvegardes gratuites** : dans GitHub → *Settings → Secrets and variables → Actions*, créer le secret `PRODUCTION_DATABASE_URL` (même adresse Neon) ; le workflow « Sauvegarde de la base » s'exécute chaque jour et conserve 30 jours de sauvegardes vérifiables.

À ne pas faire pour rester gratuit : ne pas créer de base PostgreSQL sur Render (payante ou expirant après 30 jours), ne pas changer le plan du service, ne pas ajouter de disque, ne pas lancer la compilation iOS sur macOS sans nécessité (minutes décomptées 10 fois plus vite).

### Variables facultatives (toutes gratuites à configurer ; aucun service payant imposé)
| Variable | Rôle |
|---|---|
| `SESSION_SECRET`, `XX_ENCRYPTION_KEY` | Recommandées. Absentes : clés aléatoires générées une fois et conservées dans la base (`server_keys`). |
| `XX_ADMIN_EMAILS` | Adresse(s) de l'administrateur principal (promu à l'inscription ou à la connexion). Secours : code d'initialisation dans les journaux, page `/installation`. |
| `XX_MAIL_PROVIDER` (`brevo` ou `resend`), `XX_MAIL_API_KEY`, `XX_MAIL_FROM` | Envoi des liens de réinitialisation et de vérification. Absent : liens générés par l'administrateur. |
| `AI_PROVIDER` (`anthropic` ou `openai_compatible`), `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` / `ANTHROPIC_API_KEY` | Fournisseur d'IA d'Aláji. Absent : mode sans clé (règles déterministes). |
| `XX_APP_URL` | Adresse publique utilisée dans les liens envoyés (Render fournit `RENDER_EXTERNAL_URL`). |

## 3. Production avec Docker Compose (recommandé)
Prérequis serveur : Docker 24+ avec Compose, ports 80 et 443 ouverts, un nom de domaine dont l'enregistrement DNS pointe vers le serveur.
```bash
git clone https://github.com/niang01/xamxam-lab-.git xamxam-lab && cd xamxam-lab
cp .env.example .env                  # renseigner les valeurs (voir ci-dessous)
node scripts/verifier-config.mjs      # contrôle avant mise en ligne : doit afficher « Configuration acceptable »
docker compose --profile https up -d --build
docker compose ps                     # db et app « healthy », backup et https « Up »
```
À renseigner dans `.env` : `POSTGRES_PASSWORD`, `SESSION_SECRET` et `XX_ENCRYPTION_KEY` (deux valeurs différentes : `openssl rand -base64 48`), `XX_ADMIN_EMAILS`, `XX_DOMAIN` (ex. `lab.mondomaine.sn`). Facultatif : `ANTHROPIC_API_KEY`, `METEOMATICS_USERNAME/PASSWORD`, `XX_TURN_*`.

| Service | Rôle |
|---|---|
| `db` | PostgreSQL 16, volume `db-data` |
| `app` | plateforme web (port interne 3100 ; `APP_PORT` pour un accès direct) |
| `https` (profil `https`) | Caddy : certificat Let's Encrypt obtenu et renouvelé automatiquement, HTTP/2 et HTTP/3, redirection HTTP → HTTPS |
| `backup` | sauvegarde complète vérifiable toutes les `XX_BACKUP_INTERVAL_S` secondes (24 h par défaut), conservée `XX_BACKUP_RETENTION_DAYS` jours (14) ; récupération : `docker compose cp backup:/app/backups ./sauvegardes` |
| `mqtt` (profil `iot`) | passerelle MQTT des appareils ; exige TLS (`MQTTS_PORT=8883`, `MQTT_TLS_CERT`, `MQTT_TLS_KEY`) ou, sur un banc d'essai local, `MQTT_ALLOW_INSECURE=true` : `docker compose --profile https --profile iot up -d` |

- Mise à jour : `git pull && docker compose --profile https up -d --build` (les migrations de base s'appliquent au démarrage, sans perte de données).
- Sans le profil `https` : placer votre propre mandataire HTTPS devant le port 3100.
- Registre d'images indisponible ou limité : `IMAGE_REGISTRY=mirror.gcr.io/library`.
- Proxy d'entreprise qui intercepte TLS : `EXTRA_CA_FILE=chemin/vers/ca.pem` (fichier dans le dossier du projet ; utilisé seulement pendant la construction).
- Essai local du HTTPS : `XX_DOMAIN=localhost`, `HTTP_PORT=8080`, `HTTPS_PORT=8443` (certificat de l'autorité locale de Caddy, non reconnu par les navigateurs ; la redirection HTTP → HTTPS vise alors le port 443).

**Vérifié le 18/11/2026** : `verifier-config` accepte la configuration ; pile `db`, `app`, `backup`, `https` démarrée ; HTTPS par Caddy (HTTP/2, HTTP/3 annoncé, HSTS, CSP, redirection 308) ; sauvegardes produites à l'intervalle demandé et rétention appliquée (fichier de plus de 14 jours supprimé) ; **10/10 parcours Playwright à travers HTTPS** (cookies `Secure`), 0 erreur dans les journaux.

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
