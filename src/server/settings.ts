import { sql, sqlOne } from "./db";
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await sqlOne<{ value: T }>("SELECT value FROM settings WHERE key=$1", [key]);
  return r ? r.value : fallback;
}
export async function setSetting(key: string, value: unknown, by: string | null) {
  await sql(`INSERT INTO settings(key, value, updated_by) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_by=EXCLUDED.updated_by, updated_at=now()`, [key, JSON.stringify(value), by]);
}
export async function notify(userId: string, kind: string, title: string, body: string | null, link: string | null) {
  await sql("INSERT INTO notifications(user_id, kind, title, body, link) VALUES ($1,$2,$3,$4,$5)", [userId, kind, title, body, link]);
}
