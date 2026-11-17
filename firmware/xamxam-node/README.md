# Nœud XAM-XAM LAB (ESP32 / XIAO ESP32-S3)

- Copier `include/xx_config.example.h` en `include/xx_config.h` (non versionné) et renseigner Wi-Fi, adresse du serveur, jeton (affiché une seule fois dans IoT Gateway) et certificat racine.
- Compiler : `pio run -d firmware/xamxam-node -e xiao_esp32s3` (PlatformIO).
- **État : compilé avec succès (PlatformIO, espressif32 6.9.0, cible xiao_esp32s3, configuration factice) le 17/11/2026 ; non testé sur matériel.**
- Sécurités locales indépendantes de la plateforme : durée maximale absolue, arrêt sur perte de liaison, démarrage relais ouvert, arrêt d'urgence prioritaire. Elles complètent — sans remplacer — l'arrêt d'urgence câblé et les protections électriques.
- La sortie série `raw_adc=<valeur>` est lisible dans IoT Lab → Lecture série (Web Serial).
