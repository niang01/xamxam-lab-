/**
 * Programmes d'exemple (Arduino / ESP32, C++) des projets de la banque. Ils n'utilisent que le cœur Arduino-ESP32
 * (aucune bibliothèque externe) et sont COMPILÉS par `npm run bank:compile` (PlatformIO, carte esp32dev) : voir
 * docs/RAPPORT_DE_TESTS.md. Les seuils, coefficients et broches sont des paramètres à adapter au matériel réel.
 */
export type CodeKey = "threshold_relay" | "telemetry_http" | "pulse_counter" | "ultrasonic_level" | "current_monitor" | "access_control" | "alarm_inputs" | "battery_monitor" | "robot_obstacle" | "vibration_rms" | "ntc_temperature";

const HEADER = (title: string) => `// ${title}\n// Programme d'exemple XAM-XAM LAB — à adapter (broches, seuils, coefficients) et à tester au banc avant usage réel.\n#include <Arduino.h>\n`;

const NET = `#include <WiFi.h>
#include <HTTPClient.h>
// Identifiants : à renseigner localement, ne jamais publier.
const char* WIFI_SSID = "VOTRE_RESEAU";
const char* WIFI_PASS = "VOTRE_MOT_DE_PASSE";
const char* INGEST_URL = "https://xamxam-lab.onrender.com/api/device/ingest";
const char* DEVICE_TOKEN = "JETON_DE_L_APPAREIL"; // affiché une seule fois dans IoT Gateway

bool sendReading(const char* metric, float value, const char* unit) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  String body = String("{\\"readings\\":[{\\"metric\\":\\"") + metric + "\\",\\"value\\":" + String(value, 3) + ",\\"unit\\":\\"" + unit + "\\"}]}";
  int code = http.POST(body);
  http.end();
  return code == 200;
}
`;

export const CODES: Record<CodeKey, { title: string; network: boolean; source: string }> = {
  threshold_relay: { title: "Commande par seuil avec hystérésis et durée maximale", network: false, source: `${HEADER("Commande par seuil avec hystérésis et durée maximale")}
const int SENSOR_PIN = 34;        // entrée analogique du capteur
const int RELAY_PIN = 26;         // commande du module relais
const int ON_BELOW = 1800;        // seuil bas (valeur brute 0-4095) : à fixer par l'utilisateur après étalonnage
const int OFF_ABOVE = 2400;       // seuil haut (hystérésis)
const unsigned long MAX_ON_MS = 30UL * 60UL * 1000UL; // sécurité : durée maximale de marche
bool on = false; unsigned long since = 0;

void setup() { Serial.begin(115200); pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, LOW); }

void loop() {
  int raw = analogRead(SENSOR_PIN);
  if (!on && raw < ON_BELOW) { on = true; since = millis(); }
  if (on && (raw > OFF_ABOVE || millis() - since > MAX_ON_MS)) on = false;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  Serial.printf("mesure=%d relais=%s\\n", raw, on ? "marche" : "arret");
  delay(1000);
}
` },
  telemetry_http: { title: "Télémétrie vers XAM-XAM LAB (HTTPS)", network: true, source: `${HEADER("Télémétrie vers XAM-XAM LAB (HTTPS)")}${NET}
const int SENSOR_PIN = 34;
const float SCALE = 3.3f / 4095.0f;      // conversion brute → tension (V) ; adapter selon le capteur
const unsigned long PERIOD_MS = 60000;   // une mesure par minute
unsigned long last = 0;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(250);
}

void loop() {
  if (millis() - last >= PERIOD_MS) {
    last = millis();
    float v = analogRead(SENSOR_PIN) * SCALE;
    bool ok = sendReading("tension_capteur", v, "V");
    Serial.printf("v=%.3f envoi=%s\\n", v, ok ? "ok" : "echec");
    if (WiFi.status() != WL_CONNECTED) WiFi.reconnect();
  }
}
` },
  pulse_counter: { title: "Comptage d'impulsions (débitmètre, pluviomètre, compteur)", network: false, source: `${HEADER("Comptage d'impulsions")}
const int PULSE_PIN = 27;
const float UNIT_PER_PULSE = 0.0f; // litres (ou mm de pluie) par impulsion : valeur du fabricant ou étalonnage — 0 tant que non renseigné
volatile unsigned long pulses = 0;
void IRAM_ATTR onPulse() { pulses++; }

void setup() { Serial.begin(115200); pinMode(PULSE_PIN, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(PULSE_PIN), onPulse, FALLING); }

void loop() {
  static unsigned long lastCount = 0;
  noInterrupts(); unsigned long n = pulses; interrupts();
  unsigned long perSecond = n - lastCount; lastCount = n;
  if (UNIT_PER_PULSE > 0) Serial.printf("impulsions=%lu total=%.3f debit=%.3f/s\\n", n, n * UNIT_PER_PULSE, perSecond * UNIT_PER_PULSE);
  else Serial.printf("impulsions=%lu (coefficient non renseigne)\\n", n);
  delay(1000);
}
` },
  ultrasonic_level: { title: "Niveau de réservoir par ultrasons", network: false, source: `${HEADER("Niveau de réservoir par ultrasons")}
const int TRIG_PIN = 5, ECHO_PIN = 18;
const float EMPTY_CM = 200.0f;  // distance capteur → fond (réservoir vide), mesurée sur site
const float FULL_CM = 20.0f;    // distance capteur → surface (réservoir plein)

float distanceCm() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (us == 0) return -1;           // pas d'écho : mesure invalide
  return us * 0.0343f / 2.0f;      // vitesse du son ≈ 343 m/s à 20 °C
}

void setup() { Serial.begin(115200); pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT); }

void loop() {
  float d = distanceCm();
  if (d < 0) Serial.println("mesure invalide");
  else { float pct = constrain((EMPTY_CM - d) / (EMPTY_CM - FULL_CM) * 100.0f, 0.0f, 100.0f); Serial.printf("distance=%.1f cm niveau=%.0f %%\\n", d, pct); }
  delay(2000);
}
` },
  current_monitor: { title: "Mesure de courant alternatif (valeur efficace)", network: false, source: `${HEADER("Mesure de courant alternatif (valeur efficace)")}
const int CT_PIN = 35;
const float AMPS_PER_VOLT = 0.0f; // sensibilité du capteur (fiche technique) — 0 tant que non renseignée
const int SAMPLES = 2000;

void setup() { Serial.begin(115200); analogReadResolution(12); }

void loop() {
  double sum = 0, mean = 0; static int buf[SAMPLES];
  for (int i = 0; i < SAMPLES; i++) { buf[i] = analogRead(CT_PIN); mean += buf[i]; delayMicroseconds(200); }
  mean /= SAMPLES;
  for (int i = 0; i < SAMPLES; i++) { double v = (buf[i] - mean) * 3.3 / 4095.0; sum += v * v; }
  double vrms = sqrt(sum / SAMPLES);
  if (AMPS_PER_VOLT > 0) Serial.printf("Irms=%.3f A\\n", vrms * AMPS_PER_VOLT); else Serial.printf("Vrms capteur=%.4f V (sensibilite non renseignee)\\n", vrms);
  delay(1000);
}
` },
  access_control: { title: "Contrôle d'accès : commande de gâche avec temporisation et journal", network: false, source: `${HEADER("Contrôle d'accès")}
const int BUTTON_PIN = 4;   // bouton intérieur ou sortie d'un lecteur de badge (contact sec)
const int DOOR_PIN = 15;    // contact d'ouverture de porte (fermé = porte fermée)
const int LOCK_PIN = 26;    // relais de gâche
const unsigned long OPEN_MS = 5000;
unsigned long openedAt = 0; bool unlocked = false;

void setup() { Serial.begin(115200); pinMode(BUTTON_PIN, INPUT_PULLUP); pinMode(DOOR_PIN, INPUT_PULLUP); pinMode(LOCK_PIN, OUTPUT); }

void loop() {
  if (digitalRead(BUTTON_PIN) == LOW && !unlocked) { unlocked = true; openedAt = millis(); Serial.printf("[%lu] acces accorde\\n", millis()); }
  if (unlocked && millis() - openedAt > OPEN_MS) { unlocked = false; Serial.printf("[%lu] reverrouillage\\n", millis()); }
  digitalWrite(LOCK_PIN, unlocked ? HIGH : LOW);
  static bool wasOpen = false; bool open = digitalRead(DOOR_PIN) == HIGH;
  if (open && !wasOpen) Serial.printf("[%lu] porte ouverte%s\\n", millis(), unlocked ? "" : " SANS AUTORISATION");
  wasOpen = open;
  delay(50);
}
` },
  alarm_inputs: { title: "Alarme : détecteurs, temporisation de sortie et sirène", network: false, source: `${HEADER("Alarme : détecteurs et sirène")}
const int DETECTORS[] = {32, 33};   // détecteurs (mouvement, fumée, ouverture) : contact actif à l'état HAUT
const int ARM_PIN = 4;              // interrupteur armé / désarmé
const int SIREN_PIN = 25;
const unsigned long EXIT_DELAY_MS = 30000;
unsigned long armedAt = 0; bool armed = false, alarmOn = false;

void setup() { Serial.begin(115200); for (int p : DETECTORS) pinMode(p, INPUT); pinMode(ARM_PIN, INPUT_PULLUP); pinMode(SIREN_PIN, OUTPUT); }

void loop() {
  bool wantArmed = digitalRead(ARM_PIN) == LOW;
  if (wantArmed && !armed) { armed = true; armedAt = millis(); }
  if (!wantArmed) { armed = false; alarmOn = false; }
  if (armed && millis() - armedAt > EXIT_DELAY_MS) for (int p : DETECTORS) if (digitalRead(p) == HIGH && !alarmOn) { alarmOn = true; Serial.printf("ALARME detecteur broche %d\\n", p); }
  digitalWrite(SIREN_PIN, alarmOn ? HIGH : LOW);
  delay(100);
}
` },
  battery_monitor: { title: "Surveillance de batterie (tension par pont diviseur)", network: false, source: `${HEADER("Surveillance de batterie")}
const int VBAT_PIN = 36;
const float R1 = 0.0f, R2 = 0.0f;   // résistances du pont diviseur (Ω) : à renseigner (0 = non renseigné)
const float V_LOW = 0.0f;           // seuil d'alerte (V) fixé par l'utilisateur selon la technologie de batterie

void setup() { Serial.begin(115200); analogReadResolution(12); }

void loop() {
  long acc = 0; for (int i = 0; i < 64; i++) acc += analogRead(VBAT_PIN);
  float vpin = (acc / 64.0f) * 3.3f / 4095.0f;
  if (R1 <= 0 || R2 <= 0) { Serial.printf("Vbroche=%.3f V (pont diviseur non renseigne)\\n", vpin); }
  else {
    float vbat = vpin * (R1 + R2) / R2;
    Serial.printf("Vbat=%.2f V%s\\n", vbat, (V_LOW > 0 && vbat < V_LOW) ? " ALERTE tension basse" : "");
  }
  delay(5000);
}
` },
  robot_obstacle: { title: "Robot mobile : évitement d'obstacles", network: false, source: `${HEADER("Robot mobile : évitement d'obstacles")}
const int TRIG_PIN = 5, ECHO_PIN = 18;
const int IN1 = 16, IN2 = 17, IN3 = 21, IN4 = 22; // pont en H
const int SPEED_PIN_A = 19, SPEED_PIN_B = 23;     // entrées de vitesse (MLI)
const float STOP_CM = 25.0f;

float distanceCm() { digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2); digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN, LOW); unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000UL); return us ? us * 0.0343f / 2 : 999; }
void drive(int a1, int a2, int b1, int b2, int speed) { digitalWrite(IN1, a1); digitalWrite(IN2, a2); digitalWrite(IN3, b1); digitalWrite(IN4, b2); analogWrite(SPEED_PIN_A, speed); analogWrite(SPEED_PIN_B, speed); }

void setup() { Serial.begin(115200); pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT); for (int p : {IN1, IN2, IN3, IN4}) pinMode(p, OUTPUT); }

void loop() {
  float d = distanceCm();
  if (d < STOP_CM) { drive(LOW, LOW, LOW, LOW, 0); delay(200); drive(HIGH, LOW, LOW, HIGH, 150); delay(400); }
  else drive(HIGH, LOW, HIGH, LOW, 180);
  delay(50);
}
` },
  vibration_rms: { title: "Maintenance conditionnelle : niveau vibratoire (valeur efficace)", network: false, source: `${HEADER("Maintenance conditionnelle : niveau vibratoire")}
const int ACC_PIN = 34;           // sortie analogique d'un accéléromètre
const float G_PER_VOLT = 0.0f;    // sensibilité (fiche technique) — 0 tant que non renseignée
const float ALERT_G = 0.0f;       // seuil d'alerte fixé d'après les mesures de référence de la machine
const int N = 1024;

void setup() { Serial.begin(115200); }

void loop() {
  static float s[N]; double mean = 0, sq = 0;
  for (int i = 0; i < N; i++) { s[i] = analogRead(ACC_PIN) * 3.3f / 4095.0f; mean += s[i]; delayMicroseconds(250); }
  mean /= N; for (int i = 0; i < N; i++) sq += (s[i] - mean) * (s[i] - mean);
  double vrms = sqrt(sq / N);
  if (G_PER_VOLT > 0) { double g = vrms * G_PER_VOLT; Serial.printf("vibration=%.4f g%s\\n", g, (ALERT_G > 0 && g > ALERT_G) ? " ALERTE" : ""); }
  else Serial.printf("Vrms=%.4f V (sensibilite non renseignee)\\n", vrms);
  delay(2000);
}
` },
  ntc_temperature: { title: "Température par thermistance CTN (équation β)", network: false, source: `${HEADER("Température par thermistance CTN")}
const int NTC_PIN = 34;
const float R_FIXED = 0.0f;   // résistance fixe du pont (Ω)
const float R0 = 0.0f;        // résistance de la CTN à T0 (Ω), fiche technique
const float BETA = 0.0f;      // coefficient β (K), fiche technique
const float T0 = 298.15f;     // 25 °C en kelvins

void setup() { Serial.begin(115200); analogReadResolution(12); }

void loop() {
  float raw = analogRead(NTC_PIN);
  if (R_FIXED <= 0 || R0 <= 0 || BETA <= 0 || raw <= 0 || raw >= 4095) { Serial.println("parametres CTN non renseignes ou mesure hors plage"); delay(2000); return; }
  float r = R_FIXED * raw / (4095.0f - raw);            // CTN côté masse
  float t = 1.0f / (1.0f / T0 + log(r / R0) / BETA) - 273.15f;
  Serial.printf("R=%.0f ohm T=%.2f C\\n", r, t);
  delay(2000);
}
` },
};
