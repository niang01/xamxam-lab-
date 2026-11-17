"use client";
import { useT } from "@/components/providers";
import { EcoBoard } from "@/components/EcoBoard";
import { Page } from "@/components/ui";

export default function News() {
  const t = useT();
  return (
    <Page title={t("nav.news")} subtitle={t("eco.news.subtitle")}>
      <h2 className="text-lg font-semibold">{t("eco.newsTitle")}</h2>
      <EcoBoard kind="post" capability="publish_news" fields={[{ k: "category", type: "select", options: ["tech", "ai", "digital", "renewables", "climate", "environment", "innovation", "training", "events", "calls", "funding"] }, { k: "body", type: "textarea" }, { k: "source_url", type: "url" }]} />
      <h2 className="text-lg font-semibold">{t("eco.marketplace")}</h2>
      <p className="text-xs text-[var(--fg-3)]">{t("eco.marketInfo")}</p>
      <EcoBoard kind="listing" capability="publish_news" fields={[{ k: "category", type: "select", options: ["equipment", "services", "training"] }, { k: "body", type: "textarea" }, { k: "price", type: "text" }, { k: "location", type: "text" }]} />
    </Page>
  );
}
