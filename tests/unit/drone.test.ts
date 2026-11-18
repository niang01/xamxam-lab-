import { describe, expect, it } from "vitest";
import { assessFlight, checkMission, distanceM, droneCommandBlockers, windAtAltitude, type DroneProfile, type WeatherHour } from "@/lib/drone";

const P: DroneProfile = {
  model: "Quadricoptère de banc", max_wind_ms: 10, max_gust_ms: 12, rain_allowed: false, min_temp_c: 0, max_temp_c: 40,
  max_alt_m: 120, geofence_radius_m: 500, cruise_speed_ms: 8, endurance_min: 25, reserve_pct: 25, min_visibility_m: 3000, night_allowed: false,
};
const H: WeatherHour = { time: "2026-11-18T12:00", wind_10m_ms: 4, wind_80m_ms: 6, wind_120m_ms: 7, wind_dir_deg: 350, gust_10m_ms: 7, precip_mm: 0, precip_prob_pct: 5, visibility_m: 24000, cloud_cover_pct: 10, temperature_c: 29, is_day: true, weather_code: 1 };
const HOME = { lat: 14.6928, lon: -17.4467 };

describe("Drones — conditions de vol", () => {
  it("vent à l'altitude : jamais le plus faible des niveaux couvrant le vol", () => {
    expect(windAtAltitude(H, 5)).toBe(4);
    expect(windAtAltitude(H, 50)).toBe(6);
    expect(windAtAltitude(H, 100)).toBe(7);
    expect(windAtAltitude({ ...H, wind_80m_ms: null, wind_120m_ms: null }, 100)).toBe(4);
  });
  it("favorable sous les limites ; nature = prédiction", () => {
    expect(assessFlight(P, H, 50)).toMatchObject({ verdict: "favorable", nature: "prediction", reasons: [] });
  });
  it("défavorable : vent, rafales, pluie, température, visibilité, nuit, orage", () => {
    expect(assessFlight(P, { ...H, wind_80m_ms: 11 }, 60).verdict).toBe("defavorable");
    expect(assessFlight(P, { ...H, gust_10m_ms: 13 }, 30).reasons[0]).toContain("rafales");
    expect(assessFlight(P, { ...H, precip_mm: 0.4 }, 30).verdict).toBe("defavorable");
    expect(assessFlight(P, { ...H, temperature_c: 43 }, 30).verdict).toBe("defavorable");
    expect(assessFlight(P, { ...H, visibility_m: 1500 }, 30).verdict).toBe("defavorable");
    expect(assessFlight(P, { ...H, is_day: false }, 30).verdict).toBe("defavorable");
    expect(assessFlight(P, { ...H, weather_code: 95 }, 30).verdict).toBe("defavorable");
  });
  it("prudence au-delà de 80 % d'une limite ou si la prévision manque", () => {
    expect(assessFlight(P, { ...H, wind_10m_ms: 8.5 }, 5).verdict).toBe("prudence");
    expect(assessFlight(P, { ...H, visibility_m: null }, 30)).toMatchObject({ verdict: "prudence", missing: ["prévision : visibilité"] });
  });
  it("jamais favorable si une limite constructeur manque", () => {
    const r = assessFlight({ ...P, max_wind_ms: null }, H, 30);
    expect(r.verdict).toBe("donnees_insuffisantes");
    expect(r.missing).toContain("profil : vent maximal");
  });
});

describe("Drones — mission et commandes", () => {
  it("distance de haversine (1° de latitude ≈ 111,2 km)", () => {
    expect(distanceM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111195, -1);
  });
  it("mission valide : distance, temps et énergie calculés", () => {
    const wp = [{ lat: 14.6950, lon: -17.4467, alt_m: 30 }, { lat: 14.6950, lon: -17.4440, alt_m: 30 }];
    const r = checkMission(P, HOME, wp);
    expect(r.ok).toBe(true);
    expect(r.total_distance_m).toBeGreaterThan(800);
    expect(r.flight_time_min).toBeGreaterThan(2);
  });
  it("mission refusée : plafond, géorepérage, autonomie, limites absentes", () => {
    expect(checkMission(P, HOME, [{ lat: 14.6950, lon: -17.4467, alt_m: 150 }]).errors[0]).toContain("plafond");
    expect(checkMission(P, HOME, [{ lat: 14.71, lon: -17.4467, alt_m: 30 }]).errors[0]).toContain("géorepérage");
    expect(checkMission({ ...P, geofence_radius_m: 20000, endurance_min: 3 }, HOME, [{ lat: 14.72, lon: -17.4467, alt_m: 30 }]).errors.join()).toContain("réserve");
    expect(checkMission({ ...P, max_alt_m: null }, HOME, [{ lat: 14.6950, lon: -17.4467, alt_m: 30 }]).ok).toBe(false);
  });
  it("commandes : paramètres stricts, plafond, géorepérage, départ connu", () => {
    expect(droneCommandBlockers(P, HOME, "takeoff", { alt_m: 20 })).toEqual([]);
    expect(droneCommandBlockers(P, HOME, "takeoff", { alt_m: 200 })[0]).toContain("plafond");
    expect(droneCommandBlockers(P, HOME, "takeoff", {})[0]).toContain("paramètres invalides");
    expect(droneCommandBlockers(P, HOME, "arm", { force: true })[0]).toContain("paramètres invalides");
    expect(droneCommandBlockers(P, HOME, "goto", { lat: 14.75, lon: -17.4467, alt_m: 30 })[0]).toContain("géorepérage");
    expect(droneCommandBlockers(P, null, "goto", { lat: 14.693, lon: -17.4467, alt_m: 30 })[0]).toContain("départ");
    expect(droneCommandBlockers(P, HOME, "rtl", {})).toEqual([]);
  });
});
