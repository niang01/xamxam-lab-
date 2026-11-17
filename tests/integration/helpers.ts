/** Appel direct des routes (Request réel, cookie de session), base PGlite en mémoire propre à chaque fichier de test. */
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface Session { cookie: string }

export async function call(h: Handler, method: string, url: string, opts: { body?: unknown; session?: Session | null; params?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const req = new Request(`http://localhost${url}`, {
    method, headers: { "content-type": "application/json", ...(opts.session ? { cookie: opts.session.cookie } : {}), ...(opts.headers ?? {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await h(req, { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json: json as Record<string, unknown> & { [k: string]: unknown }, headers: res.headers };
}

export async function register(h: Handler, email: string, profile = "engineer"): Promise<Session> {
  const r = await call(h, "POST", "/api/auth/register", { body: { email, password: "motdepasse-123", display_name: email.split("@")[0], profile_kind: profile, locale: "fr" } });
  if (r.status !== 201) throw new Error(`inscription : ${JSON.stringify(r.json)}`);
  const c = r.headers.get("set-cookie") ?? "";
  return { cookie: c.split(";")[0] };
}
