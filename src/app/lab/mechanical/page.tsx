"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { CalcForm } from "@/components/CalcForm";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Page, Unavailable } from "@/components/ui";

export default function Mechanical() {
  const t = useT();
  const [pid, setPid] = useState("");
  return (
    <Page title={t("nav.mechanical")} subtitle={t("lab.mechanical.desc")} actions={<ProjectPicker value={pid} onChange={setPid} />}>
      <CalcForm projectId={pid} kind="torque" fields={[{ k: "powerW", type: "num" }, { k: "rpm", type: "num" }]} />
      <CalcForm projectId={pid} kind="gear_train" fields={[{ k: "stages", type: "rows", cols: [{ k: "z1", type: "int" }, { k: "z2", type: "int" }] }, { k: "rpmIn", type: "num" }, { k: "torqueIn", type: "num" }, { k: "stageEfficiency", type: "num" }]} initial={{ stages: [{}] }} />
      <CalcForm projectId={pid} kind="cylinder" fields={[{ k: "pressureBar", type: "num" }, { k: "boreMm", type: "num" }, { k: "efficiency", type: "num" }]} />
      <Unavailable title={t("mech.cad")} reason={t("mech.cadReason")} phase={4} />
      <Unavailable title={t("mech.fea")} reason={t("mech.feaReason")} phase={4} />
    </Page>
  );
}
