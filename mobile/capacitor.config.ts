import type { CapacitorConfig } from "@capacitor/cli";

/**
 * L'application mobile charge la plateforme XAM-XAM LAB déployée (XX_APP_URL, en HTTPS) : mêmes comptes, mêmes
 * données, synchronisation immédiate entre ordinateur et téléphone. Sans réseau, la page locale www/index.html
 * l'indique et propose de réessayer.
 */
const appUrl = process.env.XX_APP_URL?.replace(/\/$/, "");
if (appUrl && !/^https:\/\//.test(appUrl) && !/^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?$/.test(appUrl)) {
  throw new Error("XX_APP_URL doit être une adresse https:// (http autorisé seulement pour l'émulateur : 10.0.2.2)");
}

const config: CapacitorConfig = {
  appId: "sn.xamxam.lab",
  appName: "XAM-XAM LAB",
  webDir: "www",
  backgroundColor: "#080d1b",
  server: appUrl ? { url: appUrl, cleartext: appUrl.startsWith("http://"), errorPath: "index.html", allowNavigation: [new URL(appUrl).host] } : { androidScheme: "https" },
  android: { allowMixedContent: false },
};

export default config;
