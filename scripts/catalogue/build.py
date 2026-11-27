"""
Construction du catalogue de références réelles de XAM-XAM LAB (data/catalogue/references.json).

Sources (toutes réutilisables, conservées avec leurs liens) :
- Bibliothèques KiCad (https://gitlab.com/kicad/libraries/kicad-symbols, CC BY-SA 4.0) : nom exact, description,
  mots-clés, brochage, empreinte, lien de la fiche technique ;
- Wikimedia Commons : photographies sous licence libre (auteur, licence, page source) retenues après contrôle visuel
  (data/catalogue/photos.json) ;
- Bibliothèque 3D KiCad (STEP convertis en maillages, public/catalogue/3d).
Le fabricant n'est indiqué que lorsqu'il ressort du domaine officiel de la fiche technique ou du nom de la carte.
Usage : python3 scripts/catalogue/build.py <kicad_refs.json> <photos.json> <models3d.json>
"""
import json, re, sys, urllib.parse

MAKERS = {
 "ti.com": "Texas Instruments", "microchip.com": "Microchip Technology", "st.com": "STMicroelectronics", "vishay.com": "Vishay",
 "onsemi.com": "onsemi", "onsemi.cn": "onsemi", "espressif.com": "Espressif Systems", "maximintegrated.com": "Analog Devices (Maxim Integrated)",
 "infineon.com": "Infineon Technologies", "irf.com": "Infineon Technologies (International Rectifier)", "nxp.com": "NXP Semiconductors",
 "analog.com": "Analog Devices", "u-blox.com": "u-blox", "allegromicro.com": "Allegro MicroSystems", "tracopower.com": "Traco Power",
 "recom-power.com": "RECOM", "nexperia.com": "Nexperia", "broadcom.com": "Broadcom", "everlight.com": "Everlight", "everlighteurope.com": "Everlight",
 "ams.com": "ams OSRAM", "osram-os.com": "ams OSRAM", "hoperf.com": "HopeRF", "intersil.com": "Renesas (Intersil)", "littelfuse.com": "Littelfuse",
 "kodenshi.co.jp": "Kodenshi", "quectel.com": "Quectel", "simcom.ee": "SIMCom", "hlktech.com": "Hi-Link", "pulseeng.com": "Pulse Electronics",
 "haloelectronics.com": "HALO Electronics", "we-online.com": "Würth Elektronik", "unisonic.com.tw": "Unisonic Technologies", "aosmd.com": "Alpha & Omega Semiconductor",
 "diodes.com": "Diodes Incorporated", "advanced-monolithic.com": "Advanced Monolithic Systems", "olimex.com": "Olimex", "silabs.com": "Silicon Labs",
 "ftdichip.com": "FTDI", "omron.com": "Omron", "te.com": "TE Connectivity", "toshiba.semicon-storage.com": "Toshiba", "bosch-sensortec.com": "Bosch Sensortec",
 "resource.bosch.com": "Bosch Sensortec", "tdk.com": "TDK InvenSense", "invensense.com": "TDK InvenSense", "cypress.com": "Infineon (Cypress)", "sipeed.com": "Sipeed",
 "ai-thinker.com": "Ai-Thinker", "cdebyte.com": "Ebyte", "linxtechnologies.com": "Linx Technologies", "nordicsemi.com": "Nordic Semiconductor",
 "semtech.my.salesforce.com": "Semtech", "winbond.com": "Winbond", "meanwell.com": "MEAN WELL", "coilcraft.com": "Coilcraft", "bourns.com": "Bourns",
 "diotec.com": "Diotec", "torexsemi.com": "Torex", "xlsemi.net": "XLSEMI", "liteon.com": "Lite-On", "findernet.com": "Finder", "fujitsu.com": "Fujitsu",
 "clare.com": "IXYS (Clare)", "sharp-world.com": "Sharp", "sharpsde.com": "Sharp", "sensirion.com": "Sensirion", "sciosense.com": "ScioSense",
 "winsen-sensor.com": "Winsen", "sgxsensortech.com": "SGX Sensortech", "kingbright.com": "Kingbright", "rohm.com": "ROHM", "lem.com": "LEM",
 "heraeus.com": "Heraeus", "raspberrypi.com": "Raspberry Pi", "raspberrypi.org": "Raspberry Pi", "arduino.cc": "Arduino", "adafruit.com": "Adafruit",
 "rakwireless.com": "RAKwireless", "raytac.com": "Raytac", "iqrf.org": "IQRF", "mono-wireless.com": "Mono Wireless", "parallax.com": "Parallax",
 "8devices.com": "8devices", "flipper.net": "Flipper Devices", "coral.ai": "Google (Coral)", "leaflabs.com": "LeafLabs", "onion.io": "Onion",
 "sanyourelay.ca": "Sanyou", "normandled.com": "Normand", "led-color.com": "Shenzhen LED Color", "ystone.com.tw": "Y-Stone",
}
BOARD_MAKERS = [("Adafruit_", "Adafruit"), ("Arduino_", "Arduino"), ("RaspberryPi", "Raspberry Pi"), ("NUCLEO", "STMicroelectronics"), ("Sipeed", "Sipeed"),
                ("Olimex", "Olimex"), ("WeMos", "WEMOS"), ("Omega2", "Onion"), ("PocketBeagle", "BeagleBoard.org"), ("Google_Coral", "Google (Coral)"), ("Flipper", "Flipper Devices")]

def maker(r):
    for p, m in BOARD_MAKERS:
        if r["name"].startswith(p): return m, "nom de la carte"
    host = urllib.parse.urlparse(r["datasheet"]).netloc.lower()
    for dom, m in MAKERS.items():
        if host == dom or host.endswith("." + dom): return m, "domaine officiel de la fiche technique"
    return None, None

def code_for(r):
    """Code de symbole conventionnel déduit de la bibliothèque et de la description officielle (jamais supposé)."""
    lib, d = r["lib"], (r["description"] + " " + r["keywords"]).lower()
    if lib == "Transistor_BJT": return "NPN" if "npn" in d else "PNP" if "pnp" in d else None
    if lib == "Transistor_FET": return "NMOS" if ("n-channel" in d or "n-mosfet" in d or "nmos" in d) else "PMOS" if ("p-channel" in d or "pmos" in d) else None
    if lib in ("Amplifier_Operational", "Comparator"): return "OPAMP"
    if lib == "Triac_Thyristor": return "TRIAC" if "triac" in d else "SCR" if ("thyristor" in d or "scr" in d) else None
    if lib == "Diode": return "DZ" if "zener" in d else "D"
    if lib == "Diode_Bridge": return "BRIDGE"
    if lib == "Motor": return "FAN" if "fan" in d else "SERVO" if "servo" in d else "MS" if "stepper" in d else "MOTOR"
    return r["code"]

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def main(kicad_path, photos_path, models_path):
    refs = json.load(open(kicad_path))
    photos = json.load(open(photos_path)) if photos_path else {}
    models = json.load(open(models_path)) if models_path else {}
    out = []
    for r in refs:
        m, how = maker(r)
        key = "kicad-" + slug(r["lib"] + "-" + r["name"])
        model3d = models.get(r["footprint"].split(":")[-1]) if r["footprint"] else None
        out.append({
            "key": key, "model": r["name"].replace("_", " "), "manufacturer": m, "manufacturer_source": how,
            "discipline": r["discipline"], "category": r["category"], "subcategory": r["subcategory"], "code": code_for(r),
            "description_en": r["description"], "keywords": r["keywords"], "datasheet": r["datasheet"], "footprint": r["footprint"] or None,
            "pins": [{"n": p["number"], "name": p["name"].replace("~{", "/").replace("}", ""), "type": p["type"]} for p in r["pins"]][:120],
            "variants": [v.replace("_", " ") for v in r["variants"]],
            "photos": photos.get(key, []), "model3d": model3d,
            "sources": [{"label": f"Bibliothèque KiCad {r['lib']} — symbole {r['name']}", "url": "https://gitlab.com/kicad/libraries/kicad-symbols", "license": "CC BY-SA 4.0"}],
        })
    # Cartes dont le brochage interactif est dessiné (src/lib/catalogue/boards.ts).
    BOARD_OF = {"kicad-mcu-module-arduino-uno-r3": "arduino-uno-r3", "kicad-mcu-module-raspberrypi-pico": "raspberrypi-pico"}
    for x in out:
        if x["key"] in BOARD_OF: x["board"] = BOARD_OF[x["key"]]
    # Références complémentaires documentées à la main (cartes hors bibliothèque KiCad).
    import os
    extra_p = os.path.join(os.path.dirname(__file__), "..", "..", "data", "catalogue", "extra.json")
    if os.path.exists(extra_p):
        for e in json.load(open(extra_p)):
            e["photos"] = photos.get(e["key"], e.get("photos", []))
            out.append(e)
    # Un même composant rangé dans deux bibliothèques KiCad (ex. capteur humidité + pression) : une seule fiche.
    seen, uniq = {}, []
    for x in out:
        k = (x["manufacturer"], x["model"].lower())
        if k in seen:
            prev = seen[k]
            prev["sources"] += [s for s in x["sources"] if s not in prev["sources"]]
            prev["keywords"] = ", ".join(dict.fromkeys(filter(None, [prev["keywords"], x["keywords"], x["subcategory"]])))
            continue
        seen[k] = x; uniq.append(x)
    # Clés stables et uniques (« DS1307+ » et « DS1307 » donneraient la même clé : le « + » est conservé en « plus »).
    used = set()
    for x in uniq:
        if x["key"] in used:
            x["key"] = x["key"] + "-" + slug(x["model"].replace("+", " plus "))
        used.add(x["key"])
    return uniq

if __name__ == "__main__":
    a = sys.argv[1:] + [None] * 3
    out = main(a[0], a[1], a[2])
    json.dump(out, open("data/catalogue/references.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print(len(out), "références ;", sum(1 for x in out if x["manufacturer"]), "avec fabricant ;", sum(1 for x in out if x["photos"]), "avec photo")
