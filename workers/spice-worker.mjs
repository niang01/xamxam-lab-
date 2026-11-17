/**
 * Processus isolé d'exécution de ngspice (eecircuit-engine). Lit { netlist } en JSON sur l'entrée standard,
 * écrit { ok, version, result, errors } sur la sortie standard. Isolé car le module WebAssembly modifie
 * l'objet global (globalThis.window), ce qui perturberait le serveur web ; le parent tue le processus au-delà du délai.
 */
import { Simulation } from "eecircuit-engine";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { input += c; });
process.stdin.on("end", async () => {
  try {
    const { netlist } = JSON.parse(input);
    const sim = new Simulation();
    await sim.start();
    const m = sim.getInitInfo().match(/ngspice-[\d.]+/);
    sim.setNetList(netlist);
    const r = await sim.runSim();
    process.stdout.write(JSON.stringify({ ok: true, version: m ? m[0] : "ngspice", result: r, errors: sim.getError() }));
    process.exit(0);
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, errors: [e instanceof Error ? e.message : String(e)] }));
    process.exit(0);
  }
});
