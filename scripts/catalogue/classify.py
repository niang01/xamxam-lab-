import json, re, sys, collections
sys.path.insert(0, ".")
d = json.load(open("kicad_sel.json"))
# bibliothèque KiCad -> (filière XAM-XAM, catégorie, sous-catégorie, code de symbole)
MAP = {
 "Transistor_BJT": ("electronique", "Semi-conducteurs", "Transistors bipolaires", None),
 "Transistor_FET": ("electronique", "Semi-conducteurs", "Transistors MOSFET", None),
 "Triac_Thyristor": ("puissance", "Semi-conducteurs de puissance", "Triacs et thyristors", None),
 "Diode": ("electronique", "Semi-conducteurs", "Diodes", "D"),
 "Diode_Bridge": ("puissance", "Semi-conducteurs de puissance", "Ponts redresseurs", None),
 "Regulator_Linear": ("electronique", "Alimentation", "Régulateurs linéaires", None),
 "Regulator_Switching": ("puissance", "Alimentation", "Régulateurs à découpage", None),
 "Amplifier_Operational": ("electronique", "Circuits intégrés analogiques", "Amplificateurs opérationnels", None),
 "Comparator": ("electronique", "Circuits intégrés analogiques", "Comparateurs", None),
 "Timer": ("electronique", "Circuits intégrés analogiques", "Temporisateurs", None),
 "Interface_UART": ("automatisme", "Communication industrielle", "Liaisons RS-232 / RS-485", None),
 "Interface_USB": ("iot", "Interfaces", "Convertisseurs USB-série", None),
 "Interface_CAN_LIN": ("automatisme", "Communication industrielle", "Bus CAN / LIN", None),
 "Interface_Expansion": ("iot", "Interfaces", "Extensions d'entrées-sorties", None),
 "Interface_CurrentLoop": ("instrumentation", "Instrumentation", "Boucles 4-20 mA", None),
 "Isolator": ("electronique", "Interfaces", "Optocoupleurs et isolateurs", None),
 "Relay": ("electrique", "Commande", "Relais électromécaniques", "K"),
 "Relay_SolidState": ("electrique", "Commande", "Relais statiques", None),
 "Driver_Motor": ("ia_robotique", "Commande de moteurs", "Pilotes de moteurs", None),
 "Driver_FET": ("puissance", "Commande de puissance", "Pilotes de MOSFET/IGBT", None),
 "Driver_LED": ("electronique", "Affichage et éclairage", "Pilotes de LED", None),
 "LED": ("electronique", "Affichage et éclairage", "LED adressables", "LED"),
 "Sensor_Temperature": ("iot", "Capteurs", "Température", None),
 "Sensor_Humidity": ("iot", "Capteurs", "Humidité", None),
 "Sensor_Pressure": ("iot", "Capteurs", "Pression", None),
 "Sensor_Motion": ("iot", "Capteurs", "Mouvement et inertie", None),
 "Sensor_Optical": ("iot", "Capteurs", "Lumière", None),
 "Sensor_Current": ("instrumentation", "Capteurs", "Courant", None),
 "Sensor_Energy": ("instrumentation", "Mesure d'énergie", "Mesure de puissance et d'énergie", None),
 "Sensor_Gas": ("environnement", "Capteurs", "Gaz", None),
 "Sensor_Distance": ("iot", "Capteurs", "Distance", None),
 "Sensor_Proximity": ("automatisme", "Capteurs", "Proximité et réflexion", None),
 "Sensor_Magnetic": ("iot", "Capteurs", "Champ magnétique", None),
 "Sensor_Touch": ("iot", "Capteurs", "Tactiles", None),
 "Sensor_Voltage": ("instrumentation", "Capteurs", "Tension", None),
 "MCU_Espressif": ("cartes", "Microcontrôleurs", "Espressif", "MCU"),
 "MCU_Microchip_ATmega": ("cartes", "Microcontrôleurs", "Microchip AVR (ATmega)", "MCU"),
 "MCU_Microchip_ATtiny": ("cartes", "Microcontrôleurs", "Microchip AVR (ATtiny)", "MCU"),
 "MCU_RaspberryPi": ("cartes", "Microcontrôleurs", "Raspberry Pi (RP2040/RP2350)", "MCU"),
 "MCU_ST_STM32F1": ("cartes", "Microcontrôleurs", "STMicroelectronics STM32", "MCU"),
 "MCU_ST_STM32F4": ("cartes", "Microcontrôleurs", "STMicroelectronics STM32", "MCU"),
 "MCU_Module": ("cartes", "Cartes de développement", "Cartes et modules", "MCU"),
 "MCU_Microchip_PIC16": ("cartes", "Microcontrôleurs", "Microchip PIC", "MCU"),
 "MCU_Microchip_PIC18": ("cartes", "Microcontrôleurs", "Microchip PIC", "MCU"),
 "MCU_Nordic": ("cartes", "Microcontrôleurs", "Nordic Semiconductor", "MCU"),
 "RF_Module": ("iot", "Communication sans fil", "Modules radio", "RF"),
 "RF_GPS": ("iot", "Communication sans fil", "Récepteurs GNSS", "RF"),
 "RF_GSM": ("telecom", "Communication sans fil", "Modules cellulaires", "RF"),
 "RF_Bluetooth": ("iot", "Communication sans fil", "Bluetooth", "RF"),
 "RF_WiFi": ("iot", "Communication sans fil", "Wi-Fi", "RF"),
 "RF_ZigBee": ("domotique", "Communication sans fil", "Zigbee", "RF"),
 "RF_NFC": ("iot", "Communication sans fil", "NFC", "RF"),
 "RF_RFID": ("iot", "Communication sans fil", "RFID", "RF"),
 "RF": ("iot", "Communication sans fil", "Émetteurs-récepteurs", "RF"),
 "Timer_RTC": ("iot", "Interfaces", "Horloges temps réel", None),
 "Memory_EEPROM": ("informatique", "Mémoires", "EEPROM", None),
 "Memory_Flash": ("informatique", "Mémoires", "Flash", None),
 "Analog_ADC": ("instrumentation", "Conversion", "Convertisseurs analogique-numérique", None),
 "Analog_DAC": ("instrumentation", "Conversion", "Convertisseurs numérique-analogique", None),
 "Battery_Management": ("solaire", "Stockage et batteries", "Gestion de batteries", None),
 "Power_Protection": ("electronique", "Protection", "Protection contre les surtensions", None),
 "Converter_ACDC": ("puissance", "Alimentation", "Modules AC/DC", None),
 "Converter_DCDC": ("puissance", "Alimentation", "Modules DC/DC isolés", None),
 "Display_Character": ("electronique", "Affichage et éclairage", "Afficheurs alphanumériques", None),
 "Motor": ("ia_robotique", "Moteurs", "Moteurs et ventilateurs", None),
 "Switch": ("electronique", "Commande", "Interrupteurs", "S"),
 "Transformer": ("electrique", "Transformateurs", "Transformateurs", "T"),
 "Valve": ("electronique", "Tubes électroniques", "Tubes à vide", None),
}
def family(lib, name):
    if lib in ("Converter_ACDC", "Transformer", "RF_GSM", "RF_GPS", "Sensor_Touch", "Sensor_Energy", "RF_Module", "Sensor_Proximity"):
        # variantes de tension, de bande ou de boîtier d'une même famille
        return re.sub(r"(\d+(\.\d+)?|[-_]x+|[A-Z]$)", "#", name.upper())
    return name
groups = collections.OrderedDict()
for x in d:
    if x["lib"] not in MAP: continue
    if x["lib"] == "Transformer" and ("Mini-Circuits" in x["footprint"] or "RF_" in x["footprint"]): continue  # baluns RF, hors programme
    k = (x["lib"], family(x["lib"], x["name"]))
    groups.setdefault(k, []).append(x)
refs = []
for (lib, fam), xs in groups.items():
    x = xs[0]
    disc, cat, sub, code = MAP[lib]
    refs.append({**x, "discipline": disc, "category": cat, "subcategory": sub, "code": code, "variants": [v["name"] for v in xs[1:]][:20]})
json.dump(refs, open("kicad_refs.json", "w"), ensure_ascii=False)
c = collections.Counter((r["discipline"]) for r in refs)
print(len(refs), dict(c))
