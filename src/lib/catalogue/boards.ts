/**
 * Brochages détaillés des cartes de développement (données de brochage = faits techniques ; rendu graphique propre à
 * XAM-XAM LAB). Pour chaque broche : repère sérigraphié, GPIO, nature (entrée seule, entrée/sortie, alimentation,
 * masse, ne pas connecter), sortie PWM, fonctions (ADC, DAC, TOUCH, SPI, I2C, UART, LED).
 * Sources indiquées pour chaque carte ; les broches sont listées de haut en bas, connecteur USB en bas.
 */
export type FnType = "ADC" | "DAC" | "TOUCH" | "SPI" | "I2C" | "UART" | "LED" | "RESET" | "POWER" | "GND" | "NC" | "AREF";
export interface BoardPin { label: string; gpio: number | null; kind: "io" | "input" | "power" | "gnd" | "nc" | "control"; pwm?: boolean; fns: { type: FnType; name: string }[] }
export interface BoardPinout { key: string; name: string; manufacturer: string; mcu: string; logic: string; left: BoardPin[]; right: BoardPin[]; buttons: string[]; usb: string; sources: { label: string; url: string | null }[]; notes: string[] }

const io = (gpio: number, ...fns: [FnType, string][]): BoardPin => ({ label: String(gpio), gpio, kind: "io", pwm: true, fns: fns.map(([type, name]) => ({ type, name })) });
const inp = (gpio: number, ...fns: [FnType, string][]): BoardPin => ({ label: String(gpio), gpio, kind: "input", fns: fns.map(([type, name]) => ({ type, name })) });
const pw = (label: string): BoardPin => ({ label, gpio: null, kind: "power", fns: [{ type: "POWER", name: label }] });
const gnd = (): BoardPin => ({ label: "GND", gpio: null, kind: "gnd", fns: [{ type: "GND", name: "GND" }] });

export const BOARDS: BoardPinout[] = [
  {
    key: "upesy-esp32-wroom-devkit", name: "ESP32 Wroom DevKit (30 broches, USB-C)", manufacturer: "uPesy", mcu: "ESP32-WROOM-32 (Espressif ESP32-D0WD)", logic: "3,3 V",
    left: [
      { label: "EN", gpio: null, kind: "control", fns: [{ type: "RESET", name: "RESTART / EN" }] },
      inp(36, ["ADC", "ADC1_0"]), inp(39, ["ADC", "ADC1_3"]), inp(34, ["ADC", "ADC1_6"]), inp(35, ["ADC", "ADC1_7"]),
      io(32, ["TOUCH", "TOUCH_9"]), io(33, ["TOUCH", "TOUCH_8"]), io(25, ["DAC", "DAC_1"]), io(26, ["DAC", "DAC_2"]), io(27, ["TOUCH", "TOUCH_7"]),
      io(14, ["SPI", "HSPI_CLK"]), io(12, ["SPI", "HSPI_MISO"]), io(13, ["SPI", "HSPI_MOSI"]),
      { label: "VIN", gpio: null, kind: "power", fns: [{ type: "POWER", name: "VIN (entrée d'alimentation)" }] }, pw("5V"), gnd(),
    ],
    right: [
      io(23, ["SPI", "VSPI_MOSI"]), io(22, ["I2C", "I2C_SCL"]), { ...io(1, ["UART", "TX0"]), label: "TX0" }, { ...io(3, ["UART", "RX0"]), label: "RX0" }, io(21, ["I2C", "I2C_SDA"]),
      io(19, ["SPI", "VSPI_MISO"]), io(18, ["SPI", "VSPI_CLK"]), io(5, ["SPI", "VSPI_CS"]),
      { label: "NC", gpio: null, kind: "nc", fns: [{ type: "NC", name: "NE PAS CONNECTER" }] }, { label: "NC", gpio: null, kind: "nc", fns: [{ type: "NC", name: "NE PAS CONNECTER" }] },
      io(4, ["TOUCH", "TOUCH_0"]), io(0, ["TOUCH", "TOUCH_1"]), io(2, ["LED", "LED intégrée"]), io(15, ["SPI", "HSPI_CS"]), pw("3V3"), gnd(),
    ],
    buttons: ["EN (redémarrage)", "BOOT (mode programmation)"], usb: "USB-C",
    sources: [{ label: "Brochage uPesy ESP32 Wroom DevKit (visuel fourni par l'exploitant)", url: null }, { label: "Espressif — ESP32-WROOM-32 Datasheet", url: "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf" }],
    notes: ["GPIO 34, 35, 36 et 39 : entrées seulement, sans résistance de tirage interne.", "Niveaux logiques 3,3 V : une entrée ne tolère pas 5 V.", "GPIO 0, 2, 12 et 15 interviennent au démarrage (broches de configuration) : éviter d'y imposer un niveau au reset.", "GPIO 1 et 3 servent à la liaison série de programmation."],
  },
  {
    key: "arduino-uno-r3", name: "Arduino UNO R3", manufacturer: "Arduino", mcu: "Microchip ATmega328P", logic: "5 V",
    left: [
      { label: "IOREF", gpio: null, kind: "power", fns: [{ type: "POWER", name: "IOREF (tension logique)" }] },
      { label: "RESET", gpio: null, kind: "control", fns: [{ type: "RESET", name: "RESET (actif bas)" }] },
      pw("3V3"), pw("5V"), gnd(), gnd(), { label: "VIN", gpio: null, kind: "power", fns: [{ type: "POWER", name: "VIN (7-12 V conseillé)" }] },
      { label: "A0", gpio: 14, kind: "io", fns: [{ type: "ADC", name: "A0" }] }, { label: "A1", gpio: 15, kind: "io", fns: [{ type: "ADC", name: "A1" }] },
      { label: "A2", gpio: 16, kind: "io", fns: [{ type: "ADC", name: "A2" }] }, { label: "A3", gpio: 17, kind: "io", fns: [{ type: "ADC", name: "A3" }] },
      { label: "A4", gpio: 18, kind: "io", fns: [{ type: "ADC", name: "A4" }, { type: "I2C", name: "SDA" }] }, { label: "A5", gpio: 19, kind: "io", fns: [{ type: "ADC", name: "A5" }, { type: "I2C", name: "SCL" }] },
    ],
    right: [
      { label: "SCL", gpio: null, kind: "io", fns: [{ type: "I2C", name: "SCL (= A5)" }] }, { label: "SDA", gpio: null, kind: "io", fns: [{ type: "I2C", name: "SDA (= A4)" }] },
      { label: "AREF", gpio: null, kind: "power", fns: [{ type: "AREF", name: "Référence analogique" }] }, gnd(),
      { label: "D13", gpio: 13, kind: "io", fns: [{ type: "SPI", name: "SCK" }, { type: "LED", name: "LED « L »" }] },
      { label: "D12", gpio: 12, kind: "io", fns: [{ type: "SPI", name: "MISO" }] }, { label: "D11", gpio: 11, kind: "io", pwm: true, fns: [{ type: "SPI", name: "MOSI" }] },
      { label: "D10", gpio: 10, kind: "io", pwm: true, fns: [{ type: "SPI", name: "SS" }] }, { label: "D9", gpio: 9, kind: "io", pwm: true, fns: [] }, { label: "D8", gpio: 8, kind: "io", fns: [] },
      { label: "D7", gpio: 7, kind: "io", fns: [] }, { label: "D6", gpio: 6, kind: "io", pwm: true, fns: [] }, { label: "D5", gpio: 5, kind: "io", pwm: true, fns: [] },
      { label: "D4", gpio: 4, kind: "io", fns: [] }, { label: "D3", gpio: 3, kind: "io", pwm: true, fns: [] }, { label: "D2", gpio: 2, kind: "io", fns: [] },
      { label: "D1", gpio: 1, kind: "io", fns: [{ type: "UART", name: "TX" }] }, { label: "D0", gpio: 0, kind: "io", fns: [{ type: "UART", name: "RX" }] },
    ],
    buttons: ["RESET"], usb: "USB-B",
    sources: [{ label: "Bibliothèque KiCad MCU_Module : Arduino_UNO_R3 (noms des broches)", url: "https://gitlab.com/kicad/libraries/kicad-symbols" }, { label: "Arduino — UNO R3", url: "https://docs.arduino.cc/hardware/uno-rev3/" }],
    notes: ["Sorties PWM (~) : D3, D5, D6, D9, D10, D11.", "Convertisseur analogique 10 bits (0-1023) sur A0-A5.", "Courant par broche limité : consulter la fiche du ATmega328P avant de piloter une charge."],
  },
  {
    key: "raspberrypi-pico", name: "Raspberry Pi Pico", manufacturer: "Raspberry Pi", mcu: "RP2040", logic: "3,3 V",
    left: [0, 1, -1, 2, 3, 4, 5, -1, 6, 7, 8, 9, -1, 10, 11, 12, 13, -1, 14, 15].map((g) => g < 0 ? gnd() : io(g)).map((p) => (p.gpio != null ? { ...p, label: `GP${p.gpio}` } : p)),
    right: [
      pw("VBUS"), pw("VSYS"), gnd(), { label: "3V3_EN", gpio: null, kind: "control", fns: [{ type: "POWER", name: "Activation du régulateur 3,3 V" }] }, pw("3V3(OUT)"),
      { label: "ADC_VREF", gpio: null, kind: "power", fns: [{ type: "AREF", name: "Référence ADC" }] },
      { ...io(28, ["ADC", "ADC2"]), label: "GP28" }, { label: "AGND", gpio: null, kind: "gnd", fns: [{ type: "GND", name: "Masse analogique" }] },
      { ...io(27, ["ADC", "ADC1"]), label: "GP27" }, { ...io(26, ["ADC", "ADC0"]), label: "GP26" },
      { label: "RUN", gpio: null, kind: "control", fns: [{ type: "RESET", name: "RUN (reset actif bas)" }] },
      { ...io(22), label: "GP22" }, gnd(), { ...io(21), label: "GP21" }, { ...io(20), label: "GP20" }, { ...io(19), label: "GP19" }, { ...io(18), label: "GP18" }, gnd(), { ...io(17), label: "GP17" }, { ...io(16), label: "GP16" },
    ],
    buttons: ["BOOTSEL"], usb: "micro-USB",
    sources: [{ label: "Bibliothèque KiCad MCU_Module : RaspberryPi_Pico (broches 1 à 40)", url: "https://gitlab.com/kicad/libraries/kicad-symbols" }, { label: "Raspberry Pi — Pico Datasheet", url: "https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf" }],
    notes: ["Toutes les broches GPIO peuvent produire un signal PWM.", "ADC 12 bits sur GP26, GP27, GP28.", "Niveaux logiques 3,3 V."],
  },
];

export const FN_COLORS: Record<FnType, string> = {
  ADC: "#f97316", DAC: "#8b5cf6", TOUCH: "#ec4899", SPI: "#84cc16", I2C: "#0ea5e9", UART: "#10b981", LED: "#2563eb", RESET: "#475569", POWER: "#dc2626", GND: "#111827", NC: "#6b7280", AREF: "#a16207",
};
