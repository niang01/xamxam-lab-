# Rapport de reprise — XAM-XAM LAB (17/11/2026)

Objectif : permettre de reprendre le développement sans perte, par l'exploitant ou une autre session.

## Où se trouve le code
Dépôt dédié **`niang01/xamxam-lab-`** (branche `main`), créé par l'exploitant le 17/11/2026. Premier commit `16eeabc` « XAM-XAM LAB — import initial » sans parent : aucun historique d'un autre projet. Preuves : [AUDIT_SEPARATION.md](AUDIT_SEPARATION.md).

## État
Voir [ETAT_REALISATION.md](ETAT_REALISATION.md) (rubrique par rubrique) et [RAPPORT_DE_TESTS.md](RAPPORT_DE_TESTS.md).

## Reprendre le travail
```bash
cd xamxam-lab && npm ci && python3 -m venv .venv && .venv/bin/pip install -r workers/requirements.txt
XX_PYTHON=$PWD/.venv/bin/python npm test && npm run build && npm run test:e2e
```
Environnement cloud utilisé : « xamxam-lab » (hôtes autorisés : power.larc.nasa.gov, dl.google.com, registres PlatformIO ; gestionnaires de paquets). SDK Android installé dans `~/android-sdk` (à réinstaller dans une nouvelle machine : `cmdline-tools`, `platforms;android-35`, `build-tools;35.0.0`).

## Prochaines étapes, par priorité
2. Déployer (Docker Compose + HTTPS) ; renseigner `SESSION_SECRET`, `XX_ADMIN_EMAILS`, `ANTHROPIC_API_KEY` ; valider le mode Claude sur des demandes réelles WO/FR/EN.
3. Recompiler l'APK avec l'adresse réelle (`XX_APP_URL`) et la clé de signature de l'exploitant ; tester sur téléphones.
4. Importer les premières traductions wolof validées et le glossaire `gloss.*`.
5. Saisir les tableaux normatifs ; ajouter des composants réels vérifiés et leurs modèles SPICE.
6. Banc d'essai matériel avec le firmware fourni ; TLS MQTT ; serveur TURN.
7. Fonctions encore non réalisées : CAO (OpenCascade) et éléments finis, physique temps réel, émulation réseau, MAVLink/PX4 (SITL), BLE/LoRa/Modbus, édition simultanée (CRDT), SMAP/NDVI/GIBS, notifications push natives, double authentification (TOTP/WebAuthn), paiements.
