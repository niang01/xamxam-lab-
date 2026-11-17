"use client";
import Link from "next/link";
import { useT } from "@/components/providers";
import { Btn, Card, Page } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";

type N = { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export default function Notifications() {
  const t = useT();
  const { data, reload } = useData<{ items: N[] }>("/api/notifications");
  return (
    <Page title={t("notif.title")} actions={<Btn kind="ghost" onClick={async () => { await post("/api/notifications", {}); reload(); }}>{t("notif.readAll")}</Btn>}>
      <Card>
        {!data?.items.length ? <p className="text-sm text-[var(--fg-2)]">{t("c.none")}</p> : (
          <ul className="divide-y divide-[var(--line)]">
            {data.items.map((n) => (
              <li key={n.id} className={`py-2 text-sm ${n.read_at ? "opacity-60" : ""}`}>
                <div className="flex justify-between gap-2"><strong>{n.title}</strong><span className="text-xs text-[var(--fg-3)]">{new Date(n.created_at).toLocaleString()}</span></div>
                {n.body && <p className="text-[var(--fg-2)]">{n.body}</p>}
                {n.link && <Link className="text-xs text-[var(--cyan)] underline" href={n.link}>{t("c.open")}</Link>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
