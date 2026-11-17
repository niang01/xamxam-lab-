#!/usr/bin/env bash
# Compile l'application Android de XAM-XAM LAB pour un serveur donné.
#   XX_APP_URL=https://lab.mondomaine.sn bash scripts/build-android.sh debug     → APK de test (signature de débogage)
#   XX_APP_URL=… XX_KEYSTORE_PATH=… XX_KEYSTORE_PASSWORD=… XX_KEY_ALIAS=… XX_KEY_PASSWORD=… bash scripts/build-android.sh release
# Prérequis : Node 22, JDK 21, SDK Android (ANDROID_HOME) avec platforms;android-35 et build-tools;35.0.0.
set -euo pipefail
MODE="${1:-debug}"
: "${XX_APP_URL:?XX_APP_URL requis (adresse https de la plateforme XAM-XAM LAB)}"
: "${ANDROID_HOME:?ANDROID_HOME requis (dossier du SDK Android)}"
cd "$(dirname "$0")/.."
npm ci
npx cap sync android
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
if [ "$MODE" = "release" ]; then
  : "${XX_KEYSTORE_PATH:?clé de signature requise pour une version de production}"
  ./gradlew --no-daemon assembleRelease bundleRelease
  echo "APK : android/app/build/outputs/apk/release/app-release.apk · AAB (Play Store) : android/app/build/outputs/bundle/release/app-release.aab"
else
  ./gradlew --no-daemon assembleDebug
  echo "APK : android/app/build/outputs/apk/debug/app-debug.apk"
fi
