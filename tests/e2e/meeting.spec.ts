import { expect, test } from "@playwright/test";
import { signup } from "./helpers";

test("visioconférence WebRTC entre deux membres du projet (caméras factices de Chromium)", async ({ browser }) => {
  const stamp = Date.now();
  const ctxA = await browser.newContext(); const ctxB = await browser.newContext();
  const a = await ctxA.newPage(); const b = await ctxB.newPage();
  await signup(b, `invite-${stamp}@e2e.local`, "student");
  await signup(a, `hote-${stamp}@e2e.local`, "engineer");
  const pid = (await (await a.request.post("/api/projects", { data: { title: "Réunion de chantier" } })).json()).id as string;
  expect((await a.request.post(`/api/projects/${pid}/members`, { data: { email: `invite-${stamp}@e2e.local`, role: "editor" } })).status()).toBe(200);
  // Un non-membre ne peut pas rejoindre la salle.
  const ctxC = await browser.newContext(); const c = await ctxC.newPage();
  await signup(c, `intrus-${stamp}@e2e.local`, "student");
  expect((await c.request.post(`/api/rooms/${pid}/join`, { data: {} })).status()).toBe(404);

  for (const p of [a, b]) { await p.goto(`/collab?projet=${pid}`); await p.getByTestId("meet-join").click(); await expect(p.getByTestId("local-video")).toBeVisible(); }
  for (const p of [a, b]) {
    await expect.poll(async () => p.getByTestId("remote-video").first().evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(p.getByText("connected")).toBeVisible();
  }
  await b.getByTestId("meet-leave").click();
  await expect.poll(async () => a.getByTestId("remote-video").count(), { timeout: 40_000 }).toBe(0);
  await Promise.all([ctxA.close(), ctxB.close(), ctxC.close()]);
});
