"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { CalcForm } from "@/components/CalcForm";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Page, Unavailable } from "@/components/ui";

export default function Network() {
  const t = useT();
  const [pid, setPid] = useState("");
  return (
    <Page title={t("nav.network")} subtitle={t("lab.network.desc")} actions={<ProjectPicker value={pid} onChange={setPid} />}>
      <CalcForm projectId={pid} kind="subnet" fields={[{ k: "cidr", type: "text", hint: "192.168.1.0/24" }]} />
      <CalcForm projectId={pid} kind="vlsm" fields={[{ k: "block", type: "text", hint: "10.0.0.0/24" }, { k: "needs", type: "rows", cols: [{ k: "name", type: "text" }, { k: "hosts", type: "int" }] }]} initial={{ needs: [{}] }} />
      <Unavailable title={t("net.emu")} reason={t("net.emuReason")} phase={4} />
    </Page>
  );
}
