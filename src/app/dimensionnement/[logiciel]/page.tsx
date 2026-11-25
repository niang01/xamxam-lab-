"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { ErrorBox, Page } from "@/components/ui";
import { StudyWorkbench, type SoftwareDef } from "@/components/StudyWorkbench";
import { useData } from "@/lib/client/hooks";
import { api } from "@/lib/client/api";
import type { Input } from "@/lib/studies/types";

type L = { software: SoftwareDef[]; tables: { id: string; standard: string; table_ref: string; description: string }[] };

export default function SoftwarePage({ params }: { params: Promise<{ logiciel: string }> }) {
  const { logiciel } = use(params);
  const { t } = useApp();
  const { data } = useData<L>("/api/studies");
  const [loaded, setLoaded] = useState<{ id: string; inputs: Input; table_id: string | null } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("etude");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- identifiant lu dans l'URL après le montage
    if (!id) { setReady(true); return; }
    api<{ study: { id: string; inputs: Input; table_id: string | null } }>(`/api/studies/${id}`).then((r) => { setLoaded(r.study); setReady(true); }).catch((e) => { setErr(e); setReady(true); });
  }, []);
  const sw = data?.software.find((s) => s.key === logiciel);
  return (
    <Page title={sw?.title ?? t("nav.sizing")} actions={<Link className="text-sm underline" href="/dimensionnement">← {t("nav.sizing")}</Link>}>
      <ErrorBox error={err} />
      {!data || !ready ? <p className="text-sm">{t("c.loading")}</p> : !sw ? <p className="text-sm">{t("err.notFound")}</p>
        : <StudyWorkbench key={loaded?.id ?? "new"} sw={sw} tables={data.tables} studyId={loaded?.id ?? null} initial={loaded?.inputs} initialTable={loaded?.table_id ?? null} />}
    </Page>
  );
}
