/**
 * Nœud XAM-XAM LAB — mesure analogique brute envoyée en HTTPS, commandes relais avec sécurités LOCALES :
 *  - durée maximale absolue XX_HARD_MAX_RUN_S, quelle que soit la commande reçue ;
 *  - arrêt du relais sur perte de liaison (XX_LINK_LOSS_STOP_S) ;
 *  - « estop » / « stop » : arrêt immédiat ;
 *  - accusé envoyé seulement après application réelle de la commande (état du relais relu).
 * La valeur envoyée est la lecture BRUTE de l'ADC (« raw ») : aucune conversion n'est inventée ; l'étalonnage
 * se fait sur la plateforme à partir de mesures de référence.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "xx_config.h"

static unsigned long relayOffAt = 0;      // millis() d'arrêt programmé (0 = arrêté)
static unsigned long lastServerOk = 0;
static unsigned long lastMeasure = 0;

static void relay(bool on) { digitalWrite(XX_RELAY_PIN, on ? HIGH : LOW); if (!on) relayOffAt = 0; }
static bool relayState() { return digitalRead(XX_RELAY_PIN) == HIGH; }

static bool request(const char* method, const String& path, const String& body, String& out) {
  if (strlen(XX_ROOT_CA) == 0) return false;               // jamais de TLS non vérifié
  WiFiClientSecure client; client.setCACert(XX_ROOT_CA);
  HTTPClient http;
  if (!http.begin(client, String(XX_SERVER) + path)) return false;
  http.addHeader("Authorization", String("Bearer ") + XX_DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");
  int code = strcmp(method, "GET") == 0 ? http.GET() : http.POST(body);
  out = http.getString(); http.end();
  if (code >= 200 && code < 300) { lastServerOk = millis(); return true; }
  return false;
}

static void ack(const char* id, bool ok) {
  JsonDocument d; d["id"] = id; d["ok"] = ok; d["state"]["relay"] = relayState() ? "on" : "off";
  String b, out; serializeJson(d, b); request("POST", "/api/device/ack", b, out);
}

static void pollCommands() {
  String out;
  if (!request("GET", "/api/device/commands", "", out)) return;
  JsonDocument d; if (deserializeJson(d, out)) return;
  for (JsonObject c : d["commands"].as<JsonArray>()) {
    const char* id = c["id"]; const char* action = c["action"];
    if (!strcmp(action, "estop") || !strcmp(action, "stop") || !strcmp(action, "off") || !strcmp(action, "pump_off")) { relay(false); ack(id, !relayState()); continue; }
    if (!strcmp(action, "pump_on") || !strcmp(action, "relay_on")) {
      long s = c["duration_s"] | 0;
      if (s <= 0) { ack(id, false); continue; }
      if (s > XX_HARD_MAX_RUN_S) s = XX_HARD_MAX_RUN_S;        // la limite matérielle locale prime
      relay(true); relayOffAt = millis() + (unsigned long)s * 1000UL;
      ack(id, relayState());
      continue;
    }
    ack(id, false);                                           // action inconnue : refusée
  }
}

static void measure() {
  JsonDocument d; JsonObject r = d["readings"].add<JsonObject>();
  r["metric"] = "raw_adc"; r["value"] = analogRead(XX_SENSOR_PIN); r["unit"] = "adc";
  JsonObject s = d["readings"].add<JsonObject>(); s["metric"] = "relay"; s["value"] = relayState() ? 1 : 0;
  d["firmware"] = "xx-node-0.1.0";
  String b, out; serializeJson(d, b); request("POST", "/api/device/ingest", b, out);
}

void setup() {
  pinMode(XX_RELAY_PIN, OUTPUT); relay(false);                // démarrage toujours relais ouvert
  Serial.begin(115200);
  WiFi.begin(XX_WIFI_SSID, XX_WIFI_PASSWORD);
  lastServerOk = millis();
}

void loop() {
  unsigned long now = millis();
  if (relayOffAt && (long)(now - relayOffAt) >= 0) relay(false);              // fin de durée
  if (relayState() && now - lastServerOk > XX_LINK_LOSS_STOP_S * 1000UL) relay(false); // perte de liaison
  if (WiFi.status() == WL_CONNECTED) {
    if (now - lastMeasure >= XX_PERIOD_S * 1000UL || lastMeasure == 0) { lastMeasure = now; measure(); }
    pollCommands();
  }
  Serial.printf("raw_adc=%d\n", analogRead(XX_SENSOR_PIN));                   // lisible par Web Serial
  delay(5000);
}
