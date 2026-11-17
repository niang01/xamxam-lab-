"use client";
import { useT } from "@/components/providers";
import { EcoBoard } from "@/components/EcoBoard";
import { Page } from "@/components/ui";

export default function Startups() {
  const t = useT();
  return (
    <Page title={t("nav.startups")} subtitle={t("eco.startups.subtitle")}>
      <EcoBoard kind="startup" capability="publish_startup" fields={[
        { k: "country", type: "text" }, { k: "sector", type: "text" }, { k: "stage", type: "select", options: ["idea", "prototype", "pilot", "market", "growth"] },
        { k: "pitch", type: "textarea" }, { k: "problem", type: "textarea" }, { k: "solution", type: "textarea" }, { k: "team", type: "textarea" },
        { k: "needs", type: "textarea" }, { k: "partners_sought", type: "textarea" }, { k: "funding_need", type: "text" }, { k: "website", type: "url" },
      ]} />
    </Page>
  );
}
