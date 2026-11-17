"""
Moteur de calcul scientifique de XAM-XAM LAB, exécuté en processus isolé.
Entrée : JSON sur stdin {"op": ..., "input": {...}} ; sortie : JSON sur stdout.
  - pv_hourly          : simulation photovoltaïque horaire (pvlib) à partir de données météo horaires fournies
  - thermo_cycle       : cycle frigorifique à compression de vapeur, fluide réel (CoolProp)
  - thermo_saturation  : courbe de saturation p–h d'un fluide (CoolProp)
  - versions           : versions des bibliothèques
Aucune valeur physique n'est supposée : tout paramètre de conception est fourni par l'appelant.
"""
import json
import math
import sys


def versions():
    out = {}
    try:
        import pvlib
        out["pvlib"] = pvlib.__version__
    except Exception as e:  # bibliothèque absente
        out["pvlib"] = None
        out["pvlib_error"] = str(e)
    try:
        import CoolProp
        out["CoolProp"] = CoolProp.__version__
    except Exception as e:
        out["CoolProp"] = None
        out["CoolProp_error"] = str(e)
    return out


def pv_hourly(i):
    import pandas as pd
    import pvlib

    times = pd.DatetimeIndex(pd.to_datetime(i["times"], utc=True))
    # Données horaires moyennes : position du soleil calculée au milieu de l'heure.
    mid = times + pd.Timedelta(minutes=30)
    w = pd.DataFrame({"ghi": i["ghi"], "dni": i["dni"], "dhi": i["dhi"], "temp_air": i["temp_air"], "wind_speed": i["wind_speed"]}, index=mid)
    w = w.apply(pd.to_numeric, errors="coerce")
    missing = int(w.isna().any(axis=1).sum())
    w = w.dropna()
    w[["ghi", "dni", "dhi"]] = w[["ghi", "dni", "dhi"]].clip(lower=0)
    loc = pvlib.location.Location(i["lat"], i["lon"])
    sp = loc.get_solarposition(w.index, temperature=w["temp_air"])
    dni_extra = pvlib.irradiance.get_extra_radiation(w.index)
    poa = pvlib.irradiance.get_total_irradiance(i["tilt"], i["azimuth"], sp["apparent_zenith"], sp["azimuth"], w["dni"], w["ghi"], w["dhi"],
                                                dni_extra=dni_extra, model="haydavies")
    params = pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS["sapm"][i["temp_model"]]
    tcell = pvlib.temperature.sapm_cell(poa["poa_global"], w["temp_air"], w["wind_speed"], **params)
    pdc0 = i["pdc0_kw"] * 1000.0
    pdc = pvlib.pvsystem.pvwatts_dc(poa["poa_global"], tcell, pdc0, i["gamma_pdc_pct"] / 100.0)
    pdc = pdc * (1 - i["losses_pct"] / 100.0)
    pac = pvlib.inverter.pvwatts(pdc, pdc0 / i["dc_ac_ratio"], eta_inv_nom=i["inverter_eff"])
    pac = pac.clip(lower=0).fillna(0)
    e_kwh = pac / 1000.0  # pas horaire : W moyens × 1 h = Wh
    poa_kwh = poa["poa_global"].fillna(0) / 1000.0
    by_month = pd.DataFrame({"e": e_kwh, "poa": poa_kwh, "ghi": w["ghi"] / 1000.0}).groupby(e_kwh.index.month).sum()
    annual = float(e_kwh.sum())
    poa_year = float(poa_kwh.sum())
    return {
        "hours": int(len(w)), "missing_hours": missing,
        "monthly": [{"month": int(m), "energy_kwh": round(float(r.e), 3), "poa_kwh_m2": round(float(r.poa), 3), "ghi_kwh_m2": round(float(r.ghi), 3)} for m, r in by_month.iterrows()],
        "annual_kwh": round(annual, 3),
        "specific_yield_kwh_kwp": round(annual / i["pdc0_kw"], 3),
        "poa_kwh_m2": round(poa_year, 3),
        "performance_ratio": round(annual / (i["pdc0_kw"] * poa_year), 4) if poa_year > 0 else None,
        "tcell_max_c": round(float(tcell.max()), 2),
        "models": {"transposition": "Hay-Davies", "temperature": f"SAPM ({i['temp_model']})", "dc": "PVWatts", "inverter": "PVWatts", "solar_position": "NREL SPA (pvlib)"},
    }


def _state(fluid, **kw):
    from CoolProp.CoolProp import PropsSI
    (k1, v1), (k2, v2) = list(kw.items())
    get = lambda out: PropsSI(out, k1, v1, k2, v2, fluid)
    return {"T_C": get("T") - 273.15, "P_kPa": get("P") / 1000, "h_kJkg": get("H") / 1000, "s_kJkgK": get("S") / 1000}


def thermo_cycle(i):
    from CoolProp.CoolProp import PropsSI
    f = i["fluid"]
    te, tc = i["t_evap_c"] + 273.15, i["t_cond_c"] + 273.15
    if tc <= te:
        raise ValueError("La température de condensation doit être supérieure à celle d'évaporation")
    pe = PropsSI("P", "T", te, "Q", 1, f)
    pc = PropsSI("P", "T", tc, "Q", 0, f)
    t1 = te + i["superheat_k"]
    h1 = PropsSI("H", "P", pe, "T", t1, f) if i["superheat_k"] > 0 else PropsSI("H", "P", pe, "Q", 1, f)
    s1 = PropsSI("S", "P", pe, "H", h1, f)
    h2s = PropsSI("H", "P", pc, "S", s1, f)
    h2 = h1 + (h2s - h1) / i["isentropic_eff"]
    t3 = tc - i["subcool_k"]
    h3 = PropsSI("H", "P", pc, "T", t3, f) if i["subcool_k"] > 0 else PropsSI("H", "P", pc, "Q", 0, f)
    h4 = h3
    q_evap, w_comp, q_cond = h1 - h4, h2 - h1, h2 - h3
    cop = q_evap / w_comp
    carnot = te / (tc - te)
    st = [
        {"point": 1, "name": "sortie évaporateur", **_state(f, P=pe, H=h1)},
        {"point": 2, "name": "refoulement compresseur", **_state(f, P=pc, H=h2)},
        {"point": 3, "name": "sortie condenseur", **_state(f, P=pc, H=h3)},
        {"point": 4, "name": "entrée évaporateur", **_state(f, P=pe, H=h4)},
    ]
    out = {"states": st, "q_evap_kJkg": q_evap / 1000, "w_comp_kJkg": w_comp / 1000, "q_cond_kJkg": q_cond / 1000, "cop": cop, "cop_carnot": carnot,
           "pressure_ratio": pc / pe}
    if i.get("cooling_kw") is not None:
        m = i["cooling_kw"] * 1000 / q_evap
        out.update({"mass_flow_kgs": m, "compressor_kw": m * w_comp / 1000, "condenser_kw": m * q_cond / 1000})
    return out


def thermo_saturation(i):
    from CoolProp.CoolProp import PropsSI
    f = i["fluid"]
    tmin = PropsSI("Tmin", f) + 1
    tcrit = PropsSI("Tcrit", f)
    n = 40
    pts = []
    for k in range(n):
        t = tmin + (tcrit - 0.5 - tmin) * k / (n - 1)
        pts.append({"T_C": t - 273.15, "P_kPa": PropsSI("P", "T", t, "Q", 0, f) / 1000, "h_liq": PropsSI("H", "T", t, "Q", 0, f) / 1000, "h_vap": PropsSI("H", "T", t, "Q", 1, f) / 1000})
    return {"fluid": f, "T_crit_C": tcrit - 273.15, "P_crit_kPa": PropsSI("Pcrit", f) / 1000, "points": pts}


def main():
    req = json.loads(sys.stdin.read())
    op = req.get("op")
    try:
        if op == "versions":
            res = versions()
        elif op == "pv_hourly":
            res = pv_hourly(req["input"])
        elif op == "thermo_cycle":
            res = thermo_cycle(req["input"])
        elif op == "thermo_saturation":
            res = thermo_saturation(req["input"])
        else:
            raise ValueError(f"opération inconnue : {op}")
        sys.stdout.write(json.dumps({"ok": True, "result": res, "versions": versions()}, default=lambda o: None if (isinstance(o, float) and math.isnan(o)) else float(o)))
    except Exception as e:
        sys.stdout.write(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}))


if __name__ == "__main__":
    main()
