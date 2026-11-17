"use client";
import { useT } from "@/components/providers";
import { EcoBoard } from "@/components/EcoBoard";
import { Page } from "@/components/ui";

export default function Challenges() {
  const t = useT();
  return (
    <Page title={t("nav.challenges")} subtitle={t("eco.challenges.subtitle")}>
      <EcoBoard kind="challenge" capability="create_challenge" fields={[
        { k: "description", type: "textarea" }, { k: "rules", type: "textarea" }, { k: "criteria", type: "list" }, { k: "deadline", type: "date" }, { k: "prizes", type: "textarea" }, { k: "sponsor", type: "text" },
      ]} />
    </Page>
  );
}
