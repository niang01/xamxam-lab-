import { expect, test, type APIRequestContext } from "@playwright/test";
import mqtt from "mqtt";
import { MockBinding } from "@serialport/binding-mock";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Import ESM natif (non réécrit par le transpileur des tests).
const esm = new Function("u", "return import(u)") as (u: string) => Promise<Record<string, unknown>>;
const load = (f: string) => esm(pathToFileURL(path.join(process.cwd(), "services", f)).href);
type Gateway = { close: () => Promise<void> };
type Agent = { port: unknown; stop: () => Promise<void> };

test.describe.configure({ mode: "serial" });

const caps = { metrics: [{ metric: "soil", unit: "%" }], commands: [{ action: "pump_on", max_duration_s: 300, requires_duration: true }] };

async function setup(request: APIRequestContext, email: string) {
  await request.post("/api/auth/register", { data: { email, password: "motdepasse-e2e-1", display_name: "IoT", profile_kind: "engineer" } });
  const r = await request.post("/api/devices", { data: { name: `Nœud ${email}`, hardware: "esp32", protocol: "mqtt", environment: "virtual", capabilities: caps } });
  expect(r.status()).toBe(201);
  return (await r.json()) as { id: string; token: string };
}
async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, ms = 15000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error("délai dépassé"); await new Promise((r) => setTimeout(r, 300)); }
}
const status = async (request: APIRequestContext, deviceId: string, commandId: string) =>
  ((await (await request.get(`/api/devices/${deviceId}`)).json()).commands as { id: string; status: string }[]).find((c) => c.id === commandId)?.status;

test("MQTT : authentification par jeton, télémétrie, commande confirmée, accusé", async ({ request, baseURL }) => {
  const dev = await setup(request, `mqtt-${Date.now()}@e2e.local`);
  const { startGateway } = (await load("mqtt-gateway.mjs")) as { startGateway: (o: object) => Promise<Gateway> };
  const gw = await startGateway({ port: 18831, platformUrl: baseURL, pollMs: 500 });
  try {
    const bad = mqtt.connect("mqtt://127.0.0.1:18831", { clientId: dev.id, username: dev.id, password: "mauvais", reconnectPeriod: 0 });
    const badResult = await new Promise((res) => { bad.on("error", (e) => res(String(e.message))); bad.on("connect", () => res("connecté")); });
    expect(badResult).not.toBe("connecté");
    bad.end(true);

    const c = mqtt.connect("mqtt://127.0.0.1:18831", { clientId: dev.id, username: dev.id, password: dev.token, reconnectPeriod: 0 });
    await new Promise((res, rej) => { c.on("connect", res); c.on("error", rej); });
    const cmds: { id: string; action: string }[] = [];
    c.on("message", (_t, p) => cmds.push(JSON.parse(p.toString())));
    await c.subscribeAsync(`xx/${dev.id}/cmd`, { qos: 1 });
    await c.publishAsync(`xx/${dev.id}/telemetry`, JSON.stringify({ readings: [{ metric: "soil", value: 18.5, unit: "%" }] }));
    await waitFor(async () => ((await (await request.get(`/api/devices/${dev.id}/measurements?metric=soil`)).json()).items as { value: number }[]).some((m) => m.value === 18.5));

    const cmd = await (await request.post(`/api/devices/${dev.id}/commands`, { data: { action: "pump_on", duration_s: 60, confirm: true } })).json();
    const got = await waitFor(async () => cmds.find((x) => x.id === cmd.id));
    expect(got.action).toBe("pump_on");
    expect(await status(request, dev.id, cmd.id)).toBe("sent");
    await c.publishAsync(`xx/${dev.id}/ack`, JSON.stringify({ id: cmd.id, ok: true, state: { relay: "on" } }));
    await waitFor(async () => (await status(request, dev.id, cmd.id)) === "acknowledged");
    c.end(true);
  } finally { await gw.close(); }
});

test("agent local série : mesures, commande écrite sur le port, accusé (port série factice de serialport)", async ({ request, baseURL }) => {
  const { runAgent, parseLine } = (await load("local-agent.mjs")) as { runAgent: (o: object) => Promise<Agent>; parseLine: (l: string) => unknown };
  expect(parseLine("soil=12.5")).toEqual({ kind: "reading", metric: "soil", value: 12.5 });
  expect(parseLine("bonjour")).toBeNull();
  const dev = await setup(request, `agent-${Date.now()}@e2e.local`);
  MockBinding.createPort("/dev/XXTEST", { echo: false, record: true });
  const agent = await runAgent({ path: "/dev/XXTEST", platformUrl: baseURL!, token: dev.token, binding: MockBinding, pollMs: 500, flushMs: 300 });
  try {
    const mockPort = (agent.port as unknown as { port: { emitData: (d: string) => void; recording: Buffer } }).port;
    mockPort.emitData("soil=11.25\n");
    await waitFor(async () => ((await (await request.get(`/api/devices/${dev.id}/measurements?metric=soil`)).json()).items as { value: number }[]).some((m) => m.value === 11.25));
    const cmd = await (await request.post(`/api/devices/${dev.id}/commands`, { data: { action: "pump_on", duration_s: 30, confirm: true } })).json();
    await waitFor(async () => mockPort.recording.toString().includes(cmd.id));
    expect(mockPort.recording.toString()).toMatch(/^CMD \{.*"pump_on".*\}/m);
    mockPort.emitData(`ACK ${cmd.id} ok {"relay":"on"}\n`);
    await waitFor(async () => (await status(request, dev.id, cmd.id)) === "acknowledged");
  } finally { await agent.stop(); }
});
