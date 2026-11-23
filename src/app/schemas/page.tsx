"use client";
import { useT } from "@/components/providers";
import { Page } from "@/components/ui";
import { DiagramEditor } from "@/components/DiagramEditor";

export default function Schemas() {
  const t = useT();
  return <Page title={t("nav.schemas")} subtitle={t("dia.subtitle")}><DiagramEditor /></Page>;
}
