/**
 * Programmes d'exemple pour la carte Arduino Uno, compilés et simulés dans le laboratoire IoT (aucune bibliothèque
 * externe). Les seuils sont des paramètres d'exemple à adapter à l'installation réelle.
 */
export interface Sketch { key: string; title: string; description: string; inputs: { pin: number; kind: "analog" | "digital"; label: string; idle?: boolean }[]; outputs: { pin: number; label: string }[]; source: string }

export const SKETCHES: Sketch[] = [
  { key: "clignotant", title: "LED clignotante (Blink)", description: "La LED de la broche 13 s'allume et s'éteint toutes les 500 ms.", inputs: [], outputs: [{ pin: 13, label: "LED D13" }],
    source: `// LED clignotante : broche 13, période 1 s
const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
  Serial.println("Demarrage");
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
` },
  { key: "seuil", title: "Commande par seuil avec hystérésis (capteur analogique → relais)", description: "Le relais (D7) s'enclenche quand la tension sur A0 dépasse le seuil haut et retombe sous le seuil bas ; la mesure est envoyée sur la liaison série.", inputs: [{ pin: 14, kind: "analog", label: "Capteur sur A0" }], outputs: [{ pin: 7, label: "Relais D7" }],
    source: `// Commande par seuil avec hysteresis : capteur analogique sur A0, relais sur D7
const int CAPTEUR = A0;
const int RELAIS = 7;
const int SEUIL_HAUT = 700;   // a regler apres etalonnage (0-1023)
const int SEUIL_BAS = 500;
bool actif = false;

void setup() {
  pinMode(RELAIS, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int mesure = analogRead(CAPTEUR);
  if (!actif && mesure > SEUIL_HAUT) actif = true;
  if (actif && mesure < SEUIL_BAS) actif = false;
  digitalWrite(RELAIS, actif ? HIGH : LOW);
  Serial.print("mesure=");
  Serial.print(mesure);
  Serial.print(" relais=");
  Serial.println(actif ? 1 : 0);
  delay(200);
}
` },
  { key: "alarme", title: "Alarme : contact d'ouverture et sirène", description: "Un contact (D2, entrée avec résistance de tirage) déclenche la sirène (D8) après une temporisation ; un bouton (D3) l'acquitte.", inputs: [{ pin: 2, kind: "digital", label: "Contact de porte D2 (ouvert = haut)", idle: false }, { pin: 3, kind: "digital", label: "Bouton d'acquittement D3 (appui = bas)", idle: true }], outputs: [{ pin: 8, label: "Sirène D8" }],
    source: `// Alarme : contact D2 (INPUT_PULLUP, ouvert = HIGH), acquittement D3, sirene D8
const int CONTACT = 2, ACQUIT = 3, SIRENE = 8;
const unsigned long TEMPO_MS = 1000;
unsigned long ouvertDepuis = 0;
bool alarme = false;

void setup() {
  pinMode(CONTACT, INPUT_PULLUP);
  pinMode(ACQUIT, INPUT_PULLUP);
  pinMode(SIRENE, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool ouvert = digitalRead(CONTACT) == HIGH;
  if (ouvert && ouvertDepuis == 0) ouvertDepuis = millis();
  if (!ouvert) ouvertDepuis = 0;
  if (ouvert && millis() - ouvertDepuis >= TEMPO_MS && !alarme) { alarme = true; Serial.println("ALARME"); }
  if (digitalRead(ACQUIT) == LOW && alarme) { alarme = false; Serial.println("acquittee"); }
  digitalWrite(SIRENE, alarme ? HIGH : LOW);
  delay(20);
}
` },
  { key: "niveau", title: "Niveau de réservoir et pompe (deux capteurs analogiques)", description: "La pompe (D6) démarre si le niveau (A0) est bas et s'arrête au niveau haut ; elle est interdite si la pression (A1) est trop basse (marche à sec).", inputs: [{ pin: 14, kind: "analog", label: "Niveau A0" }, { pin: 15, kind: "analog", label: "Pression A1" }], outputs: [{ pin: 6, label: "Pompe D6" }],
    source: `// Reservoir : niveau sur A0, pression d'aspiration sur A1, pompe sur D6
const int NIVEAU = A0, PRESSION = A1, POMPE = 6;
const int NIVEAU_BAS = 300, NIVEAU_HAUT = 800, PRESSION_MIN = 150;
bool marche = false;

void setup() { pinMode(POMPE, OUTPUT); Serial.begin(9600); }

void loop() {
  int n = analogRead(NIVEAU), p = analogRead(PRESSION);
  if (n < NIVEAU_BAS) marche = true;
  if (n > NIVEAU_HAUT) marche = false;
  bool securite = p >= PRESSION_MIN;
  digitalWrite(POMPE, (marche && securite) ? HIGH : LOW);
  Serial.print("niveau="); Serial.print(n); Serial.print(" pression="); Serial.print(p);
  Serial.print(" pompe="); Serial.println((marche && securite) ? 1 : 0);
  delay(250);
}
` },
];
