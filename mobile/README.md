# XAM-XAM LAB — applications Android et iOS

Projets natifs générés avec **Capacitor 7** (`android/`, `ios/`). L'application charge la plateforme XAM-XAM LAB déployée (`XX_APP_URL`, en HTTPS) : mêmes comptes, mêmes projets, synchronisation immédiate entre ordinateur et téléphone, visioconférence (caméra et micro autorisés), lecture des notifications de la plateforme. Sans réseau, une page locale le signale.

## Android
Prérequis : Node 22, JDK 21, SDK Android (`ANDROID_HOME`) avec `platforms;android-35` et `build-tools;35.0.0`.
```bash
cd mobile
XX_APP_URL=https://lab.mondomaine.sn bash scripts/build-android.sh debug      # APK de test
# Production (clé de signature de l'exploitant, jamais versionnée) :
keytool -genkeypair -keystore xamxam.jks -alias xamxam -keyalg RSA -keysize 2048 -validity 10000
XX_APP_URL=https://lab.mondomaine.sn XX_KEYSTORE_PATH=$PWD/xamxam.jks XX_KEYSTORE_PASSWORD=… XX_KEY_ALIAS=xamxam XX_KEY_PASSWORD=… \
  bash scripts/build-android.sh release                                        # APK signé + AAB pour le Play Store
```
**Vérifié le 17/11/2026** : APK de débogage et APK/AAB de production signés compilés ; contenu contrôlé avec `aapt2` (paquet `sn.xamxam.lab`, SDK 35, permissions Internet, caméra, micro) et `apksigner`. **Non exécuté sur un appareil ni un émulateur** (pas de virtualisation disponible dans l'environnement de développement).

## iOS
Le projet `ios/App` (Swift Package Manager) se compile sur macOS avec Xcode 16 :
```bash
cd mobile && XX_APP_URL=https://lab.mondomaine.sn npx cap sync ios && npx cap open ios
```
Dans Xcode : choisir l'équipe de développement (compte Apple Developer, 99 USD/an), puis Product → Archive pour TestFlight / App Store. **Non compilé** : Xcode n'existe que sur macOS.

## Limites actuelles
- Notifications push natives : nécessitent Firebase (Android) et un certificat APNs (iOS) — non configurés ; les notifications restent consultables dans l'application.
- Bluetooth et USB natifs : non intégrés ; utiliser la liaison HTTPS/MQTT de l'appareil ou l'agent local.
