"use client";
/** Sélecteur de projet de rattachement (tout objet créé dans un labo peut être lié à un projet). Mémorisé localement. */
import { useEffect } from "react";
import { useT } from "./providers";
import { Select } from "./ui";
import { useData } from "@/lib/client/hooks";

export function ProjectPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const { data } = useData<{ items: { id: string; title: string; role: string }[] }>("/api/projects");
  useEffect(() => {
    if (value) return;
    try { const v = localStorage.getItem("xx.project"); if (v) onChange(v); } catch { /* ignore */ }
  }, [value, onChange]);
  const items = (data?.items ?? []).filter((p) => p.role !== "viewer" && p.role !== "commenter");
  return (
    <Select aria-label={t("c.project")} data-testid="project-picker" value={value} onChange={(e) => { onChange(e.target.value); try { localStorage.setItem("xx.project", e.target.value); } catch { /* ignore */ } }} className="max-w-xs">
      <option value="">{t("c.noProject")}</option>
      {items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
    </Select>
  );
}
