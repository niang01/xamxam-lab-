"use client";
/** Enregistrement des programmes d'automate dans le compte (versions conservées) et rechargement. */
import { useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Field, Input, Select } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { api, post, put } from "@/lib/client/api";

export function ProgramStore({ kind, title, program, onLoad, onError }: { kind: "ladder" | "grafcet"; title: string; program: unknown; onLoad: (p: unknown) => void; onError: (e: unknown) => void }) {
  const t = useT();
  const { data, reload } = useData<{ items: { id: string; title: string; kind: string; version: number }[] }>("/api/plc");
  const [name, setName] = useState(title);
  const [id, setId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const mine = (data?.items ?? []).filter((x) => x.kind === kind);
  async function save() {
    onError(null); setMsg("");
    try {
      const body = { kind, title: name.trim() || title, program: { ...(program as object), title: name.trim() || title } };
      const r = id ? await put<{ id: string; version: number }>(`/api/plc/${id}`, body) : await post<{ id: string; version: number }>("/api/plc", body);
      if (!id) setId(r.id);
      setMsg(t("plc.saved", { v: r.version })); reload();
    } catch (e) { onError(e); }
  }
  async function open(pid: string) {
    if (!pid) return;
    try { const r = await api<{ id: string; title: string; program: unknown }>(`/api/plc/${pid}`); setId(r.id); setName(r.title); onLoad(r.program); }
    catch (e) { onError(e); }
  }
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <Field label={t("plc.programName")}><Input name={`${kind}-title`} value={name} onChange={(e) => setName(e.target.value.slice(0, 160))} /></Field>
      <Btn data-testid={`${kind}-save`} onClick={save}>{id ? t("plc.saveVersion") : t("c.save")}</Btn>
      {mine.length > 0 && <Field label={t("plc.myPrograms")}><Select data-testid={`${kind}-open`} value="" onChange={(e) => void open(e.target.value)} className="!w-auto max-w-full"><option value="">—</option>{mine.map((m) => <option key={m.id} value={m.id}>{m.title} (v{m.version})</option>)}</Select></Field>}
      {msg && <span className="text-sm text-[var(--ok)]" data-testid={`${kind}-saved`}>{msg}</span>}
    </div>
  );
}
