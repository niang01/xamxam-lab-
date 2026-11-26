"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { Page } from "@/components/ui";
import { LadderLab } from "@/components/plc/LadderLab";
import { GrafcetLab } from "@/components/plc/GrafcetLab";
import { ModbusTool } from "@/components/plc/ModbusTool";

type Tab = "ladder" | "grafcet" | "modbus";

export default function Automatisme() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("ladder");
  return (
    <Page title={t("nav.automatisme")} subtitle={t("lab.automatisme.desc")}>
      <div className="flex flex-wrap gap-2" role="tablist">
        {(["ladder", "grafcet", "modbus"] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} data-tab={k} onClick={() => setTab(k)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${tab === k ? "border-[var(--cyan)] text-[var(--fg)]" : "border-[var(--line)] text-[var(--fg-2)]"}`}>{t(`plc.tab.${k}` as "plc.tab.ladder")}</button>
        ))}
      </div>
      {tab === "ladder" && <LadderLab />}
      {tab === "grafcet" && <GrafcetLab />}
      {tab === "modbus" && <ModbusTool />}
    </Page>
  );
}
