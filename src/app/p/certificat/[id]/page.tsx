"use client";
import { use } from "react";
import { useT } from "@/components/providers";
import { Card, ErrorBox, Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";

type Cert = { id: string; course: string; holder: string; score: number; issued_at: string; digest: string; valid: boolean };

/** Page publique de vérification d'un certificat (aucune connexion requise). */
export default function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data, error } = useData<Cert>(`/api/public/certificates/${id}`);
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {error && <ErrorBox error={error} />}
      {data && (
        <Card title={t("acad.certificate")} testId="certificate">
          <p className="text-2xl font-semibold">{data.holder}</p>
          <p className="mt-1 text-[var(--fg-2)]">{data.course}</p>
          <p className="mt-2 text-sm">{t("acad.score", { s: data.score })} · {new Date(data.issued_at).toLocaleDateString()}</p>
          <p className="mt-3"><Pill tone={data.valid ? "ok" : "danger"}>{data.valid ? t("acad.certValid") : t("acad.certInvalid")}</Pill></p>
          <p className="mt-2 break-all font-mono text-[10px] text-[var(--fg-3)]">SHA-256 {data.digest}</p>
        </Card>
      )}
    </div>
  );
}
