/**
 * Appels HTTP sortants (NASA POWER, Meteomatics, Anthropic, services de calcul).
 * Le fetch de Next.js ignore HTTPS_PROXY : avec un proxy configuré, on passe par un dispatcher undici
 * qui applique HTTPS_PROXY / HTTP_PROXY / NO_PROXY.
 */
import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";

let dispatcher: EnvHttpProxyAgent | undefined;
const proxied = () => ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"].some((k) => !!process.env[k]);

export const outboundFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!proxied()) return fetch(input, init);
  dispatcher ??= new EnvHttpProxyAgent();
  type UInput = Parameters<typeof undiciFetch>[0];
  type UInit = NonNullable<Parameters<typeof undiciFetch>[1]>;
  return undiciFetch(input as UInput, { ...(init as UInit), dispatcher }) as unknown as Response;
}) as typeof fetch;
