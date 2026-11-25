"use client";
/** Administration de la boutique : vérification des vendeurs et vue des commandes. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";

type D = { vendors: { user_id: string; business_name: string; email: string; phone: string | null; verified: boolean }[]; orders: { id: string; status: string; total_xof: number | null; created_at: string; buyer: string | null; seller: string | null }[]; listings: number };

export function ShopAdmin() {
  const { t } = useApp();
  const { data, reload } = useData<D>("/api/admin/shop");
  const [err, setErr] = useState<unknown>(null);
  return (
    <div className="space-y-4" data-testid="shop-admin">
      <ErrorBox error={err} />
      <Card title={t("shop.vendor")}>
        <p className="mb-2 text-xs text-[var(--fg-3)]">{data?.listings ?? 0} article(s) en rayon</p>
        <ul className="divide-y divide-[var(--line)] text-sm">{data?.vendors.map((v) => (
          <li key={v.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><strong>{v.business_name}</strong> <span className="text-xs text-[var(--fg-3)]">{v.email}{v.phone ? ` · ${v.phone}` : ""}</span></span>
            <span className="flex gap-2"><Pill tone={v.verified ? "ok" : "warn"}>{v.verified ? t("shop.verified") : t("shop.notVerified")}</Pill>
              <Btn kind="ghost" onClick={async () => { try { await post("/api/admin/shop", { vendor_id: v.user_id, verified: !v.verified }); reload(); } catch (e) { setErr(e); } }}>{v.verified ? t("adm.disable") : t("adm.enable")}</Btn></span></li>))}</ul>
      </Card>
      <Card title={t("shop.myOrders")}>
        <ul className="text-xs">{data?.orders.map((o) => <li key={o.id}>{new Date(o.created_at).toLocaleString()} — {o.buyer} → {o.seller} · {o.status} · {o.total_xof ?? "—"} FCFA</li>)}</ul>
      </Card>
    </div>
  );
}
