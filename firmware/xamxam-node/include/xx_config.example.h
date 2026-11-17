// Copier en xx_config.h (non versionné) et renseigner. Aucune valeur sensible dans le dépôt.
#pragma once
#define XX_WIFI_SSID      "..."
#define XX_WIFI_PASSWORD  "..."
#define XX_SERVER         "https://votre-domaine"   // adresse de la plateforme XAM-XAM LAB
#define XX_DEVICE_TOKEN   "..."                      // jeton affiché une seule fois à l'enregistrement
// Certificat racine de l'autorité du serveur (PEM). Laisser vide = connexion refusée (pas de TLS non vérifié).
#define XX_ROOT_CA        ""
#define XX_SENSOR_PIN     A0     // entrée analogique du capteur
#define XX_RELAY_PIN      D2     // sortie du relais de commande (actif à l'état haut)
// SÉCURITÉ MATÉRIELLE LOCALE (indépendante de la plateforme) : durée maximale absolue de marche du relais.
#define XX_HARD_MAX_RUN_S 900
// Arrêt si aucune communication réussie avec le serveur pendant ce délai.
#define XX_LINK_LOSS_STOP_S 120
#define XX_PERIOD_S       60     // période de mesure
