"use client";
/**
 * Drone Command Center : enregistrement des drones MAVLink, profil constructeur, télémétrie reçue du pont,
 * conditions de vol (PRÉVISION), missions validées, commandes confirmées et arrêt d'urgence.
 * Aucun contrôle n'agit sans le pont MAVLink connecté au drone (services/drone_bridge.py) : sans télémétrie récente,
 * l'interface l'indique et n'affiche aucune valeur inventée.
 */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Input, Page, Pill, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post, put } from "@/lib/client/api";
import type { DroneProfile, Verdict } from "@/lib/drone";
import type { MsgKey } from "@/lib/i18n/messages";

type State = { armed?: boolean | null; mode?: string | null; lat?: number | null; lon?: number | null; alt_rel_m?: number | null; groundspeed_ms?: number | null; battery_pct?: number | null; battery_v?: number | null; gps_fix?: number | null; satellites?: number | null; autopilot?: string | null; vehicle?: string | null; last_text?: string[] };
type DroneItem = { id: string; name: string; environment: "virtual" | "bench" | "real"; status: string; last_seen: string | null; state: State | null; state_at: string | null; has_profile: boolean };
type Command = { id: string; action: string; params: Record<string, unknown>; status: string; created_at: string; ack_payload: Record<string, unknown> | null };
type Mission = { id: string; name: string; waypoints: { lat: number; lon: number; alt_m: number }[]; check_result: { ok: boolean; errors: string[]; total_distance_m: number; flight_time_min: number | null; energy_needed_pct: number | null }; status: string; created_at: string };
type Detail = { device: DroneItem & { environment: DroneItem["environment"] }; profile: DroneProfile | null; state: { state: State; home_lat: number | null; home_lon: number | null; updated_at: string } | null; commands: Command[]; missions: Mission[]; now: string };
type Hour = { time: string; wind_10m_ms: number | null; wind_80m_ms: number | null; gust_10m_ms: number | null; wind_dir_deg: number | null; precip_mm: number | null; visibility_m: number | null; temperature_c: number | null; assessment: { verdict: Verdict; reasons: string[]; missing: string[] } | null };
type Conditions = { forecast: { source: string; model: string; fetched_at: string }; hours: Hour[]; warning: string; profile_complete: boolean };

const VERDICT_TONE: Record<Verdict, "ok" | "warn" | "danger" | "neutral"> = { favorable: "ok", prudence: "warn", defavorable: "danger", donnees_insuffisantes: "neutral" };
const STALE_S = 15;
const PROFILE_FIELDS: { k: keyof DroneProfile; unit: string }[] = [
  { k: "max_wind_ms", unit: "m/s" }, { k: "max_gust_ms", unit: "m/s" }, { k: "min_temp_c", unit: "°C" }, { k: "max_temp_c", unit: "°C" },
  { k: "max_alt_m", unit: "m" }, { k: "geofence_radius_m", unit: "m" }, { k: "cruise_speed_ms", unit: "m/s" }, { k: "endurance_min", unit: "min" },
  { k: "reserve_pct", unit: "%" }, { k: "min_visibility_m", unit: "m" },
];

function ageS(iso: string | null | undefined, now: string) { return iso ? Math.round((new Date(now).getTime() - new Date(iso).getTime()) / 1000) : null; }

function ProfileForm({ id, profile, onSaved }: { id: string; profile: DroneProfile | null; onSaved: () => void }) {
  const { t } = useApp();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(profile ?? {}).map(([k, x]) => [k, x == null ? "" : String(x)])));
  const [err, setErr] = useState<unknown>(null); const [ok, setOk] = useState(false);
  const num = (k: string) => (v[k] === undefined || v[k] === "" ? null : Number(v[k]));
  const bool = (k: string) => (v[k] === "true" ? true : v[k] === "false" ? false : null);
  async function save() {
    setErr(null); setOk(false);
    try {
      await put(`/api/drones/${id}`, { model: v.model ?? "", ...Object.fromEntries(PROFILE_FIELDS.map((f) => [f.k, num(f.k)])), rain_allowed: bool("rain_allowed"), night_allowed: bool("night_allowed") });
      setOk(true); onSaved();
    } catch (e) { setErr(e); }
  }
  return (
    <Card title={t("drone.profile")} testId="drone-profile">
      <p className="mb-3 text-xs text-[var(--fg-3)]">{t("drone.profileHint")}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("drone.model")}><Input name="model" value={v.model ?? ""} onChange={(e) => setV({ ...v, model: e.target.value })} /></Field>
        {PROFILE_FIELDS.map((f) => (
          <Field key={f.k} label={`${t(`drone.f.${f.k}` as MsgKey)} (${f.unit})`}><Input name={f.k} inputMode="decimal" value={v[f.k] ?? ""} onChange={(e) => setV({ ...v, [f.k]: e.target.value.replace(",", ".") })} /></Field>
        ))}
        {(["rain_allowed", "night_allowed"] as const).map((k) => (
          <Field key={k} label={t(`drone.f.${k}` as MsgKey)}>
            <Select name={k} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })}><option value="">—</option><option value="true">{t("c.yes")}</option><option value="false">{t("c.no")}</option></Select>
          </Field>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2"><Btn data-testid="save-profile" onClick={save}>{t("c.save")}</Btn>{ok && <Pill tone="ok">{t("c.saved")}</Pill>}</div>
      <ErrorBox error={err} />
    </Card>
  );
}

function ConditionsPanel({ id, home }: { id: string; home: { lat: number; lon: number } | null }) {
  const { t } = useApp();
  const [lat, setLat] = useState(home ? String(home.lat) : ""); const [lon, setLon] = useState(home ? String(home.lon) : ""); const [alt, setAlt] = useState("30");
  const [q, setQ] = useState<string | null>(null);
  const { data, error, loading } = useData<Conditions>(q);
  return (
    <Card title={t("drone.conditions")} testId="drone-conditions">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Latitude"><Input name="cond-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} /></Field>
        <Field label="Longitude"><Input name="cond-lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} /></Field>
        <Field label={t("drone.altitude")}><Input name="cond-alt" inputMode="numeric" value={alt} onChange={(e) => setAlt(e.target.value)} /></Field>
        <div className="flex items-end"><Btn data-testid="load-conditions" disabled={!lat || !lon} onClick={() => setQ(`/api/drones/${id}/conditions?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&alt=${encodeURIComponent(alt)}`)}>{t("drone.loadConditions")}</Btn></div>
      </div>
      {loading && q && <p className="mt-2 text-sm text-[var(--fg-3)]">{t("c.loading")}</p>}
      <ErrorBox error={error} />
      {data && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-[var(--warn)]">{data.warning}</p>
          <p className="text-xs text-[var(--fg-3)]">{data.forecast.source} · {data.forecast.model} · {new Date(data.forecast.fetched_at).toLocaleString()}</p>
          {!data.profile_complete && <p className="text-sm text-[var(--warn)]">{t("drone.noProfile")}</p>}
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[var(--fg-3)]"><th className="p-1">UTC</th><th>{t("drone.wind10")}</th><th>{t("drone.wind80")}</th><th>{t("drone.gust")}</th><th>{t("drone.precip")}</th><th>{t("drone.visibility")}</th><th>T °C</th><th>{t("drone.verdict")}</th></tr></thead>
              <tbody>{data.hours.slice(0, 48).map((h) => (
                <tr key={h.time} className="border-t border-[var(--line)] align-top">
                  <td className="p-1 font-mono">{h.time.slice(5, 16).replace("T", " ")}</td><td>{h.wind_10m_ms ?? "—"}</td><td>{h.wind_80m_ms ?? "—"}</td><td>{h.gust_10m_ms ?? "—"}</td><td>{h.precip_mm ?? "—"}</td><td>{h.visibility_m ?? "—"}</td><td>{h.temperature_c ?? "—"}</td>
                  <td>{h.assessment ? <span title={[...h.assessment.reasons, ...h.assessment.missing].join(" · ")}><Pill tone={VERDICT_TONE[h.assessment.verdict]}>{t(`drone.v.${h.assessment.verdict}` as MsgKey)}</Pill></span> : "—"}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function DroneDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useApp();
  const { data, reload, error } = useData<Detail>(`/api/drones/${id}`);
  const [alt, setAlt] = useState("10"); const [confirm, setConfirm] = useState(false); const [reason, setReason] = useState("");
  const [mName, setMName] = useState(""); const [wps, setWps] = useState("");
  const [err, setErr] = useState<unknown>(null); const [info, setInfo] = useState("");
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="text-sm text-[var(--fg-3)]">{t("c.loading")}</p>;
  const s = data.state?.state ?? null;
  const age = ageS(data.state?.updated_at, data.now);
  const live = age != null && age <= STALE_S;
  const home = data.state?.home_lat != null && data.state.home_lon != null ? { lat: data.state.home_lat, lon: data.state.home_lon } : null;
  const send = async (action: string, params: Record<string, unknown> = {}) => {
    setErr(null); setInfo("");
    try { const r = await post<{ id: string; status: string }>(`/api/drones/${id}/commands`, { action, params, reason: reason || null, confirm }); setInfo(`${action} : ${t(`drone.cmd.${r.status}` as MsgKey)}`); reload(); }
    catch (e) { setErr(e); }
  };
  const estop = async () => { setErr(null); try { await post(`/api/devices/${id}/estop`, {}); setInfo(t("drone.estopSent")); reload(); } catch (e) { setErr(e); } };
  const createMission = async () => {
    setErr(null); setInfo("");
    try {
      const waypoints = wps.split("\n").map((l) => l.split(/[;,\s]+/).filter(Boolean).map(Number)).filter((p) => p.length === 3 && p.every(Number.isFinite)).map(([lat, lon, alt_m]) => ({ lat, lon, alt_m }));
      const r = await post<{ check: { ok: boolean; errors: string[] } }>(`/api/drones/${id}/missions`, { name: mName, waypoints, home: null });
      setInfo(r.check.ok ? t("drone.missionValid") : `${t("drone.missionInvalid")} : ${r.check.errors.join(" ; ")}`); reload();
    } catch (e) { setErr(e); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Btn kind="ghost" onClick={onBack}>← {t("drone.back")}</Btn>
        <h2 className="text-lg font-semibold">{data.device.name}</h2>
        <Pill tone={data.device.environment === "real" ? "danger" : data.device.environment === "bench" ? "warn" : "info"}>{t(`drone.env.${data.device.environment}` as MsgKey)}</Pill>
        <Btn kind="danger" data-testid="estop" className="ml-auto" onClick={estop}>{t("drone.estop")}</Btn>
      </div>
      <Card title={t("drone.telemetry")} testId="drone-telemetry">
        {!s ? <p className="text-sm text-[var(--warn)]">{t("drone.noTelemetry")}</p> : (
          <>
            <p className={`mb-2 text-xs ${live ? "text-[var(--ok)]" : "text-[var(--warn)]"}`}>{live ? t("drone.live", { s: age ?? 0 }) : t("drone.stale", { s: age ?? 0 })}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <dt className="text-[var(--fg-3)]">{t("drone.armed")}</dt><dd>{s.armed ? t("c.yes") : t("c.no")}</dd>
              <dt className="text-[var(--fg-3)]">Mode</dt><dd className="font-mono">{s.mode ?? "—"}</dd>
              <dt className="text-[var(--fg-3)]">{t("drone.altitude")}</dt><dd className="font-mono">{s.alt_rel_m != null ? `${s.alt_rel_m.toFixed(1)} m` : "—"}</dd>
              <dt className="text-[var(--fg-3)]">{t("drone.speed")}</dt><dd className="font-mono">{s.groundspeed_ms != null ? `${s.groundspeed_ms.toFixed(1)} m/s` : "—"}</dd>
              <dt className="text-[var(--fg-3)]">{t("drone.battery")}</dt><dd className="font-mono">{s.battery_pct != null ? `${s.battery_pct} %` : "—"}{s.battery_v != null ? ` · ${s.battery_v.toFixed(2)} V` : ""}</dd>
              <dt className="text-[var(--fg-3)]">GPS</dt><dd className="font-mono">{s.gps_fix != null ? `fix ${s.gps_fix} · ${s.satellites ?? "?"} sat.` : "—"}</dd>
              <dt className="text-[var(--fg-3)]">Position</dt><dd className="col-span-1 font-mono sm:col-span-3">{s.lat != null && s.lon != null ? `${s.lat.toFixed(6)}, ${s.lon.toFixed(6)}` : "—"}</dd>
              <dt className="text-[var(--fg-3)]">{t("drone.autopilot")}</dt><dd className="col-span-1 sm:col-span-3">{[s.autopilot, s.vehicle].filter(Boolean).join(" · ") || "—"}</dd>
            </dl>
            {!!s.last_text?.length && <ul className="mt-2 text-xs text-[var(--fg-3)]">{s.last_text.map((x, i) => <li key={i} className="font-mono">{x}</li>)}</ul>}
          </>
        )}
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("drone.bridgeHint")}</p>
      </Card>

      <Card title={t("drone.commands")} testId="drone-commands">
        {data.device.environment === "real" && <p className="mb-2 text-xs text-[var(--warn)]">{t("drone.realRules")}</p>}
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label={t("drone.reason")}><Input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label={t("drone.takeoffAlt")}><Input name="takeoff-alt" inputMode="numeric" value={alt} onChange={(e) => setAlt(e.target.value)} /></Field>
          <label className="flex items-end gap-2 text-sm"><input type="checkbox" name="confirm" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />{t("drone.confirmNow")}</label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn data-testid="cmd-arm" onClick={() => send("arm")}>{t("drone.a.arm")}</Btn>
          <Btn data-testid="cmd-takeoff" onClick={() => send("takeoff", { alt_m: Number(alt) })}>{t("drone.a.takeoff")}</Btn>
          <Btn kind="ghost" data-testid="cmd-hold" onClick={() => send("hold")}>{t("drone.a.hold")}</Btn>
          <Btn kind="ghost" data-testid="cmd-rtl" onClick={() => send("rtl")}>{t("drone.a.rtl")}</Btn>
          <Btn kind="ghost" data-testid="cmd-land" onClick={() => send("land")}>{t("drone.a.land")}</Btn>
          <Btn kind="ghost" data-testid="cmd-disarm" onClick={() => send("disarm")}>{t("drone.a.disarm")}</Btn>
        </div>
        {info && <p role="status" className="mt-2 text-sm text-[var(--ok)]">{info}</p>}
        <ErrorBox error={err} />
        <h3 className="mt-4 text-sm font-semibold">{t("drone.history")}</h3>
        <ul className="mt-1 space-y-1 text-xs">{data.commands.map((c) => (
          <li key={c.id} className="flex flex-wrap gap-2"><span className="font-mono">{new Date(c.created_at).toLocaleTimeString()}</span><strong>{c.action}</strong><Pill tone={c.status === "acknowledged" ? "ok" : c.status === "failed" || c.status === "expired" ? "danger" : "neutral"}>{c.status}</Pill>{c.ack_payload && <span className="truncate text-[var(--fg-3)]">{JSON.stringify(c.ack_payload).slice(0, 140)}</span>}</li>))}</ul>
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("drone.confirmHint")}</p>
      </Card>

      <ProfileForm id={id} profile={data.profile} onSaved={reload} />
      <ConditionsPanel id={id} home={home} />

      <Card title={t("drone.missions")} testId="drone-missions">
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <Field label={t("drone.missionName")}><Input name="mission-name" value={mName} onChange={(e) => setMName(e.target.value)} /></Field>
          <Field label={t("drone.waypoints")} hint={t("drone.waypointsHint")}><Textarea name="waypoints" rows={4} value={wps} onChange={(e) => setWps(e.target.value)} placeholder="14.6950, -17.4467, 30" /></Field>
        </div>
        <Btn className="mt-2" data-testid="create-mission" disabled={mName.trim().length < 2 || !wps.trim()} onClick={createMission}>{t("drone.checkMission")}</Btn>
        <ul className="mt-3 space-y-2 text-sm">{data.missions.map((m) => (
          <li key={m.id} className="rounded-lg bg-[var(--bg-2)] p-2">
            <div className="flex flex-wrap items-center gap-2"><strong>{m.name}</strong><Pill tone={m.status === "simulated" || m.status === "flown" ? "ok" : m.check_result.ok ? "info" : "warn"}>{t(`drone.ms.${m.status}` as MsgKey)}</Pill>
              <span className="text-xs text-[var(--fg-3)]">{m.waypoints.length} pts · {m.check_result.total_distance_m} m{m.check_result.flight_time_min != null ? ` · ${m.check_result.flight_time_min} min · ${m.check_result.energy_needed_pct} %` : ""}</span>
              {m.check_result.ok && <Btn kind="ghost" className="ml-auto" data-testid="mission-start" onClick={() => send("mission_start", { mission_id: m.id })}>{t("drone.a.mission_start")}</Btn>}</div>
            {!m.check_result.ok && <p className="text-xs text-[var(--warn)]">{m.check_result.errors.join(" ; ")}</p>}
          </li>))}</ul>
      </Card>
    </div>
  );
}

export default function Drones() {
  const { t } = useApp();
  const { data, reload } = useData<{ items: DroneItem[]; now: string }>("/api/drones");
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState(""); const [env, setEnv] = useState<"virtual" | "bench" | "real">("virtual");
  const [token, setToken] = useState<string | null>(null); const [err, setErr] = useState<unknown>(null);
  if (sel) return <Page title={t("nav.drones")} subtitle={t("drone.subtitle")}><DroneDetail id={sel} onBack={() => { setSel(null); reload(); }} /></Page>;
  return (
    <Page title={t("nav.drones")} subtitle={t("drone.subtitle")}>
      <Card title={t("drone.register")} testId="drone-register">
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label={t("drone.name")}><Input name="drone-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t("drone.environment")}><Select name="drone-env" value={env} onChange={(e) => setEnv(e.target.value as typeof env)}>{(["virtual", "bench", "real"] as const).map((x) => <option key={x} value={x}>{t(`drone.env.${x}` as MsgKey)}</option>)}</Select></Field>
          <div className="flex items-end"><Btn data-testid="register-drone" disabled={name.trim().length < 2} onClick={async () => { setErr(null); try { const r = await post<{ id: string; token: string }>("/api/drones", { name, environment: env }); setToken(r.token); setName(""); reload(); } catch (e) { setErr(e); } }}>{t("drone.registerBtn")}</Btn></div>
        </div>
        {token && <div data-testid="drone-token" className="mt-3 rounded-lg border border-[var(--warn)] p-3 text-sm"><p>{t("drone.tokenOnce")}</p><code className="select-all break-all font-mono">{token}</code><p className="mt-2 text-xs text-[var(--fg-3)]">{t("drone.bridgeCmd")}</p></div>}
        <ErrorBox error={err} />
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data && !data.items.length && <p className="text-sm text-[var(--fg-3)]">{t("drone.none")}</p>}
        {data?.items.map((d) => {
          const age = ageS(d.state_at, data.now);
          return (
            <button key={d.id} data-testid="drone-card" onClick={() => setSel(d.id)} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-left hover:border-[var(--cyan)]">
              <div className="flex flex-wrap items-center gap-2"><strong>{d.name}</strong><Pill tone={d.environment === "real" ? "danger" : d.environment === "bench" ? "warn" : "info"}>{t(`drone.env.${d.environment}` as MsgKey)}</Pill></div>
              <p className="mt-1 text-xs text-[var(--fg-3)]">{age != null && age <= STALE_S ? t("drone.live", { s: age }) : d.state_at ? t("drone.stale", { s: age ?? 0 }) : t("drone.noTelemetryShort")}{d.has_profile ? "" : ` · ${t("drone.profileMissing")}`}</p>
              {d.state && <p className="mt-1 font-mono text-xs">{d.state.mode ?? "—"} · {d.state.armed ? t("drone.armed") : t("drone.disarmed")} · {d.state.alt_rel_m != null ? `${d.state.alt_rel_m.toFixed(1)} m` : "—"} · {d.state.battery_pct != null ? `${d.state.battery_pct} %` : "—"}</p>}
            </button>
          );
        })}
      </div>
    </Page>
  );
}
