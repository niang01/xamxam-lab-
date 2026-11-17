/** Client HTTP de l'interface : erreurs typées (clé de message traduisible). */
export class RequestError extends Error {
  constructor(public status: number, message: string, public key?: string, public details?: unknown) { super(message); }
}

export async function api<T = unknown>(path: string, init?: RequestInit & { body?: BodyInit | null }, jsonBody?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, {
      ...init,
      headers: { ...(jsonBody !== undefined ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
      body: jsonBody !== undefined ? JSON.stringify(jsonBody) : init?.body,
    });
  } catch {
    throw new RequestError(0, "Serveur injoignable", "err.network");
  }
  if (r.headers.get("X-XX-From-Cache") && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("xx-offline"));
  const ct = r.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await r.json() : await r.text();
  if (!r.ok) {
    const d = data as { error?: string; key?: string; details?: unknown };
    throw new RequestError(r.status, d?.error ?? `HTTP ${r.status}`, d?.key, d?.details);
  }
  return data as T;
}
export const post = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: "POST" }, body);
export const put = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: "PUT" }, body);
export const patch = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: "PATCH" }, body);
export const del = <T = unknown>(path: string) => api<T>(path, { method: "DELETE" });
