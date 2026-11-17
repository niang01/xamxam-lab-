/** Déclaration minimale : le paquet fournit ses types mais pas dans son champ « exports ». */
declare module "@serialport/binding-mock" {
  export const MockBinding: { createPort(path: string, opt?: { echo?: boolean; record?: boolean }): void; reset(): void };
}
