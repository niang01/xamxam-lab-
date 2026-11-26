/**
 * Simulation d'une carte Arduino Uno (ATmega328P à 16 MHz) avec l'émulateur libre avr8js : le programme COMPILÉ
 * (fichier .hex) est exécuté instruction par instruction ; minuterie 0 (millis, delay), ports B, C, D, convertisseur
 * analogique-numérique et liaison série USART0 sont émulés. Les capteurs sont représentés par des tensions sur
 * A0–A5 et des niveaux logiques sur les broches d'entrée. C'est une simulation du microcontrôleur, pas des capteurs.
 */
import { AVRADC, AVRIOPort, AVRTimer, AVRUSART, CPU, adcConfig, avrInstruction, portBConfig, portCConfig, portDConfig, timer0Config, usart0Config } from "avr8js";

export const F_CPU = 16e6;

export function parseHex(hex: string): Uint16Array {
  const bytes = new Uint8Array(0x8000);
  let base = 0;
  for (const raw of hex.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(":")) continue;
    const n = parseInt(line.slice(1, 3), 16), addr = parseInt(line.slice(3, 7), 16), type = parseInt(line.slice(7, 9), 16);
    if (type === 0) for (let i = 0; i < n; i++) bytes[base + addr + i] = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
    else if (type === 2) base = parseInt(line.slice(9, 13), 16) << 4;
    else if (type === 1) break;
  }
  return new Uint16Array(bytes.buffer);
}

/** Broche Arduino → port et bit. */
export const PIN_MAP: Record<number, ["B" | "C" | "D", number]> = Object.fromEntries([
  ...Array.from({ length: 8 }, (_, i) => [i, ["D", i]]), ...Array.from({ length: 6 }, (_, i) => [8 + i, ["B", i]]), ...Array.from({ length: 6 }, (_, i) => [14 + i, ["C", i]]),
]) as Record<number, ["B" | "C" | "D", number]>;

export class UnoSim {
  readonly cpu: CPU;
  private ports: Record<"B" | "C" | "D", AVRIOPort>;
  private adc: AVRADC;
  private timer: AVRTimer;
  readonly usart: AVRUSART;
  serial = "";
  constructor(hex: string, onSerial?: (c: string) => void) {
    this.cpu = new CPU(parseHex(hex));
    this.timer = new AVRTimer(this.cpu, timer0Config);
    this.ports = { B: new AVRIOPort(this.cpu, portBConfig), C: new AVRIOPort(this.cpu, portCConfig), D: new AVRIOPort(this.cpu, portDConfig) };
    this.adc = new AVRADC(this.cpu, adcConfig);
    this.usart = new AVRUSART(this.cpu, usart0Config, F_CPU);
    this.usart.onByteTransmit = (b) => { const c = String.fromCharCode(b); this.serial += c; if (this.serial.length > 20000) this.serial = this.serial.slice(-10000); onSerial?.(c); };
    void this.timer;
  }
  /** Exécute le programme pendant `ms` millisecondes de temps simulé. */
  runMs(ms: number) {
    const end = this.cpu.cycles + (ms / 1000) * F_CPU;
    while (this.cpu.cycles < end) { avrInstruction(this.cpu); this.cpu.tick(); }
  }
  /** Niveau d'une broche (true = niveau haut) telle que pilotée par le programme. */
  pin(n: number): boolean { const [p, b] = PIN_MAP[n]; return this.ports[p].pinState(b) === 1; }
  /** Tension appliquée sur une entrée analogique A0–A5 (0–5 V). */
  setAnalog(ch: number, volts: number) { this.adc.channelValues[ch] = Math.max(0, Math.min(5, volts)); }
  /** Niveau imposé sur une entrée numérique (bouton, contact). */
  setInput(n: number, high: boolean) { const [p, b] = PIN_MAP[n]; this.ports[p].setPin(b, high); }
}
