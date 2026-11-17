"use client";
import { useT } from "@/components/providers";
import { EcoBoard } from "@/components/EcoBoard";
import { Page } from "@/components/ui";

export default function Mentors() {
  const t = useT();
  return (
    <Page title={t("nav.mentors")} subtitle={t("eco.mentors.subtitle")}>
      <EcoBoard kind="mentor" capability="mentor" fields={[{ k: "expertise", type: "list" }, { k: "languages", type: "langs" }, { k: "bio", type: "textarea" }, { k: "slots", type: "slots" }]} />
    </Page>
  );
}
