#!/usr/bin/env python3
"""
Pont MAVLink de XAM-XAM LAB : relie un autopilote MAVLink (ArduPilot, PX4) à la plateforme.

    XX_PLATFORM_URL=https://lab.mondomaine.sn XX_DEVICE_TOKEN=… \
    XX_MAVLINK_URL=udpin:0.0.0.0:14550 python3 services/drone_bridge.py

    XX_MAVLINK_URL : tcp:127.0.0.1:5760 (SITL), udpin:0.0.0.0:14550 (télémétrie radio/compagnon), /dev/ttyACM0,57600 (série)

Rôle : (1) envoyer la télémétrie (position, altitude, vitesse, batterie, mode, armement, GPS, messages de l'autopilote) ;
(2) récupérer les commandes CONFIRMÉES par une personne habilitée et les exécuter ; (3) accuser réception avec le
résultat réel lu sur l'autopilote (jamais « exécutée » sans confirmation de l'autopilote).

Sécurités locales (s'ajoutent à celles de l'autopilote — géorepérage, failsafes batterie/radio — qui restent maîtres) :
  - plafond d'altitude et rayon de géorepérage locaux (XX_MAX_ALT_M, XX_GEOFENCE_M) : commande refusée au-delà ;
  - perte de liaison avec la plateforme pendant XX_LINK_LOSS_S secondes, drone armé → retour au départ (RTL) ;
  - arrêt d'urgence (« estop ») = atterrissage immédiat (LAND) en vol, désarmement au sol ; la coupure moteurs en
    vol n'est jamais déclenchée à distance (risque de chute).
Dépendance : pymavlink (pip install pymavlink).
"""
import json, math, os, sys, threading, time, urllib.request, urllib.error
from pymavlink import mavutil

PLATFORM = os.environ.get("XX_PLATFORM_URL", "").rstrip("/")
TOKEN = os.environ.get("XX_DEVICE_TOKEN", "")
MAV_URL = os.environ.get("XX_MAVLINK_URL", "udpin:0.0.0.0:14550")
MAX_ALT = float(os.environ.get("XX_MAX_ALT_M", "0") or 0)
GEOFENCE = float(os.environ.get("XX_GEOFENCE_M", "0") or 0)
LINK_LOSS_S = float(os.environ.get("XX_LINK_LOSS_S", "20"))
POLL_S = float(os.environ.get("XX_POLL_S", "1"))
TELEMETRY_S = float(os.environ.get("XX_TELEMETRY_S", "2"))

def log(*a):
    print(time.strftime("%Y-%m-%dT%H:%M:%S"), "[drone-bridge]", *a, flush=True)

def api(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(PLATFORM + path, data=data, method="POST" if body is not None else "GET",
                                 headers={"authorization": f"Bearer {TOKEN}", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read() or b"{}")

def haversine(a, b):
    R, rad = 6371008.8, math.pi / 180
    dlat, dlon = (b[0] - a[0]) * rad, (b[1] - a[1]) * rad
    s = math.sin(dlat / 2) ** 2 + math.cos(a[0] * rad) * math.cos(b[0] * rad) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(s)))

class Bridge:
    def __init__(self):
        self.m = mavutil.mavlink_connection(MAV_URL, source_system=255, source_component=190)
        self.state = {"armed": False, "mode": None, "lat": None, "lon": None, "alt_rel_m": None, "alt_msl_m": None,
                      "groundspeed_ms": None, "heading_deg": None, "battery_pct": None, "battery_v": None, "gps_fix": None,
                      "satellites": None, "home": None, "last_text": [], "autopilot": None, "vehicle": None}
        self.lock = threading.Lock()
        self.last_platform_ok = time.time()
        self.link_loss_triggered = False

    # ---------- autopilote ----------
    def connect(self):
        log("connexion à l'autopilote", MAV_URL)
        hb = self.m.wait_heartbeat(timeout=60)
        if not hb:
            raise SystemExit("aucun battement de cœur MAVLink reçu")
        self.state["autopilot"] = mavutil.mavlink.enums["MAV_AUTOPILOT"][hb.autopilot].name
        self.state["vehicle"] = mavutil.mavlink.enums["MAV_TYPE"][hb.type].name
        log("autopilote", self.state["autopilot"], "véhicule", self.state["vehicle"], "système", self.m.target_system)
        self.m.mav.request_data_stream_send(self.m.target_system, self.m.target_component, mavutil.mavlink.MAV_DATA_STREAM_ALL, 4, 1)
        self.m.mav.command_long_send(self.m.target_system, self.m.target_component, mavutil.mavlink.MAV_CMD_GET_HOME_POSITION, 0, 0, 0, 0, 0, 0, 0, 0)

    def pump(self, seconds=0.0):
        """Lit les messages entrants pendant `seconds` (0 = ce qui est disponible) et met l'état à jour."""
        end = time.time() + seconds
        while True:
            msg = self.m.recv_match(blocking=seconds > 0, timeout=0.2)
            if msg is not None:
                self.handle(msg)
            if time.time() >= end and msg is None:
                return

    def handle(self, msg):
        t = msg.get_type()
        with self.lock:
            s = self.state
            if t == "HEARTBEAT" and msg.get_srcSystem() == self.m.target_system and msg.type != mavutil.mavlink.MAV_TYPE_GCS:
                s["armed"] = bool(msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
                s["mode"] = self.m.flightmode
            elif t == "GLOBAL_POSITION_INT":
                s["lat"], s["lon"] = msg.lat / 1e7, msg.lon / 1e7
                s["alt_rel_m"], s["alt_msl_m"] = msg.relative_alt / 1000, msg.alt / 1000
                s["heading_deg"] = msg.hdg / 100 if msg.hdg != 65535 else None
            elif t == "VFR_HUD":
                s["groundspeed_ms"] = msg.groundspeed
            elif t == "SYS_STATUS":
                s["battery_pct"] = msg.battery_remaining if msg.battery_remaining >= 0 else None
                s["battery_v"] = msg.voltage_battery / 1000 if msg.voltage_battery not in (0, 65535) else None
            elif t == "GPS_RAW_INT":
                s["gps_fix"], s["satellites"] = msg.fix_type, msg.satellites_visible
            elif t == "HOME_POSITION":
                s["home"] = {"lat": msg.latitude / 1e7, "lon": msg.longitude / 1e7, "alt_msl_m": msg.altitude / 1000}
            elif t == "STATUSTEXT":
                s["last_text"] = (s["last_text"] + [msg.text])[-8:]

    def wait_for(self, predicate, timeout):
        end = time.time() + timeout
        while time.time() < end:
            self.pump(0.3)
            with self.lock:
                if predicate(self.state):
                    return True
        return False

    def command_long(self, cmd, *p):
        p = list(p) + [0] * (7 - len(p))
        self.m.mav.command_long_send(self.m.target_system, self.m.target_component, cmd, 0, *p)
        end = time.time() + 5
        while time.time() < end:
            ack = self.m.recv_match(type="COMMAND_ACK", blocking=True, timeout=0.5)
            if ack is None:
                continue
            if ack.command == cmd:
                return ack.result
            self.handle(ack)
        return None

    def set_mode(self, mode):
        if mode not in self.m.mode_mapping():
            return False
        self.m.set_mode(mode)
        return self.wait_for(lambda s: s["mode"] == mode, 8)

    # ---------- commandes ----------
    def execute(self, c):
        action, params = c["action"], c.get("params") or {}
        s = self.state
        if action in ("takeoff", "goto"):
            alt = float(params.get("alt_m", 0))
            if MAX_ALT and alt > MAX_ALT:
                return False, {"error": f"altitude {alt} m > plafond local {MAX_ALT} m"}
        if action == "goto" and GEOFENCE:
            home = s["home"] or ({"lat": s["lat"], "lon": s["lon"]} if s["lat"] is not None else None)
            if not home:
                return False, {"error": "position de départ inconnue"}
            d = haversine((home["lat"], home["lon"]), (params["lat"], params["lon"]))
            if d > GEOFENCE:
                return False, {"error": f"destination à {d:.0f} m > géorepérage local {GEOFENCE} m"}

        if action == "arm":
            if not self.set_mode("GUIDED"):
                return False, {"error": "passage en mode GUIDED refusé"}
            res = self.command_long(mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM, 1)
            ok = self.wait_for(lambda st: st["armed"], 12)
            return ok, {"mav_result": res, "armed": ok, "autopilot_messages": s["last_text"][-4:]}
        if action == "disarm":
            res = self.command_long(mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM, 0)
            ok = self.wait_for(lambda st: not st["armed"], 8)
            return ok, {"mav_result": res, "armed": not ok}
        if action == "takeoff":
            if not s["armed"]:
                return False, {"error": "drone non armé"}
            alt = float(params["alt_m"])
            res = self.command_long(mavutil.mavlink.MAV_CMD_NAV_TAKEOFF, 0, 0, 0, 0, 0, 0, alt)
            if res != mavutil.mavlink.MAV_RESULT_ACCEPTED:
                return False, {"mav_result": res, "autopilot_messages": s["last_text"][-4:]}
            ok = self.wait_for(lambda st: st["alt_rel_m"] is not None and st["alt_rel_m"] >= 0.9 * alt, 60)
            return ok, {"mav_result": res, "alt_rel_m": s["alt_rel_m"], "target_alt_m": alt}
        if action == "goto":
            if not s["armed"]:
                return False, {"error": "drone non armé"}
            self.m.mav.set_position_target_global_int_send(0, self.m.target_system, self.m.target_component,
                mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT, 0b0000111111111000,
                int(params["lat"] * 1e7), int(params["lon"] * 1e7), float(params["alt_m"]), 0, 0, 0, 0, 0, 0, 0, 0)
            target = (params["lat"], params["lon"])
            ok = self.wait_for(lambda st: st["lat"] is not None and haversine((st["lat"], st["lon"]), target) < 3, 120)
            return ok, {"lat": s["lat"], "lon": s["lon"], "alt_rel_m": s["alt_rel_m"], "reached": ok}
        if action == "mission_start":
            return self.run_mission(params)
        if action in ("hold", "rtl", "land"):
            mode = {"hold": "LOITER", "rtl": "RTL", "land": "LAND"}[action]
            ok = self.set_mode(mode)
            return ok, {"mode": s["mode"]}
        if action in ("estop", "stop"):
            if s["armed"] and (s["alt_rel_m"] or 0) > 0.5:
                ok = self.set_mode("LAND")
                return ok, {"mode": s["mode"], "note": "arrêt d'urgence en vol : atterrissage immédiat (pas de coupure moteurs)"}
            res = self.command_long(mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM, 0)
            ok = self.wait_for(lambda st: not st["armed"], 8)
            return ok, {"mav_result": res, "armed": not ok}
        return False, {"error": f"commande « {action} » inconnue du pont MAVLink"}

    def run_mission(self, params):
        wps = params.get("waypoints") or []
        if not wps:
            return False, {"error": "mission sans point de passage"}
        for w in wps:
            if MAX_ALT and w["alt_m"] > MAX_ALT:
                return False, {"error": f"point à {w['alt_m']} m > plafond local {MAX_ALT} m"}
        s = self.state
        if not s["armed"]:
            return False, {"error": "drone non armé"}
        items = [(mavutil.mavlink.MAV_CMD_NAV_TAKEOFF, 0, 0, wps[0]["alt_m"])]
        items += [(mavutil.mavlink.MAV_CMD_NAV_WAYPOINT, w["lat"], w["lon"], w["alt_m"]) for w in wps]
        items += [(mavutil.mavlink.MAV_CMD_NAV_RETURN_TO_LAUNCH, 0, 0, 0)]
        n = len(items) + 1  # item 0 = position de départ (ArduPilot)
        self.m.mav.mission_count_send(self.m.target_system, self.m.target_component, n, mavutil.mavlink.MAV_MISSION_TYPE_MISSION)
        end = time.time() + 20
        while time.time() < end:
            req = self.m.recv_match(type=["MISSION_REQUEST_INT", "MISSION_REQUEST", "MISSION_ACK"], blocking=True, timeout=1)
            if req is None:
                continue
            if req.get_type() == "MISSION_ACK":
                if req.type != mavutil.mavlink.MAV_MISSION_ACCEPTED:
                    return False, {"error": f"mission refusée par l'autopilote (code {req.type})"}
                break
            seq = req.seq
            if seq == 0:
                home = s["home"] or {"lat": s["lat"], "lon": s["lon"]}
                cmd, lat, lon, alt = mavutil.mavlink.MAV_CMD_NAV_WAYPOINT, home["lat"], home["lon"], 0
            else:
                cmd, lat, lon, alt = items[seq - 1]
            self.m.mav.mission_item_int_send(self.m.target_system, self.m.target_component, seq,
                mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT, cmd, 0, 1, 0, 0, 0, 0,
                int(lat * 1e7), int(lon * 1e7), alt, mavutil.mavlink.MAV_MISSION_TYPE_MISSION)
        else:
            return False, {"error": "transfert de mission sans réponse de l'autopilote"}
        if not self.set_mode("AUTO"):
            return False, {"error": "passage en mode AUTO refusé"}
        res = self.command_long(mavutil.mavlink.MAV_CMD_MISSION_START, 0, 0)
        return res == mavutil.mavlink.MAV_RESULT_ACCEPTED, {"mav_result": res, "items": n, "mode": s["mode"]}

    # ---------- plateforme ----------
    def telemetry_loop(self):
        while True:
            time.sleep(TELEMETRY_S)
            with self.lock:
                s = dict(self.state)
            readings = [{"metric": k, "value": float(v), "unit": u} for k, v, u in (
                ("drone_alt_rel", s["alt_rel_m"], "m"), ("drone_groundspeed", s["groundspeed_ms"], "m/s"),
                ("drone_battery", s["battery_pct"], "%"), ("drone_battery_v", s["battery_v"], "V"),
                ("drone_lat", s["lat"], "°"), ("drone_lon", s["lon"], "°")) if v is not None]
            try:
                api("/api/device/drone-state", {"state": s})
                if readings:
                    api("/api/device/ingest", {"readings": readings})
                self.last_platform_ok = time.time()
                self.link_loss_triggered = False
            except Exception as e:  # noqa: BLE001 — la boucle doit survivre à toute erreur réseau
                log("télémétrie non transmise :", e)
            if s["armed"] and time.time() - self.last_platform_ok > LINK_LOSS_S and not self.link_loss_triggered:
                log(f"liaison plateforme perdue depuis {LINK_LOSS_S:.0f} s, drone armé : RETOUR AU DÉPART (RTL)")
                self.m.set_mode("RTL")
                self.link_loss_triggered = True

    def run(self):
        self.connect()
        me = api("/api/device/whoami")
        log("appareil", me.get("name"), "environnement", me.get("environment"))
        threading.Thread(target=self.telemetry_loop, daemon=True).start()
        while True:
            self.pump(POLL_S)
            try:
                cmds = api("/api/device/commands").get("commands", [])
                self.last_platform_ok = time.time()
            except Exception as e:  # noqa: BLE001
                log("commandes non récupérées :", e)
                continue
            for c in cmds:
                log("commande", c["action"], json.dumps(c.get("params") or {}))
                try:
                    ok, payload = self.execute(c)
                except Exception as e:  # noqa: BLE001
                    ok, payload = False, {"error": str(e)}
                log("résultat", c["action"], "OK" if ok else "ÉCHEC", json.dumps(payload, default=str)[:300])
                try:
                    api("/api/device/ack", {"id": c["id"], "ok": bool(ok), "state": payload})
                except urllib.error.HTTPError as e:
                    log("accusé refusé :", e.code)

if __name__ == "__main__":
    if not PLATFORM or not TOKEN:
        sys.exit("XX_PLATFORM_URL et XX_DEVICE_TOKEN sont requis (jeton affiché à la création de l'appareil dans IoT Gateway)")
    Bridge().run()
