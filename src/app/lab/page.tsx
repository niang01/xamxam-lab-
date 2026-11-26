"use client";
import Link from "next/link";
import { useT } from "@/components/providers";
import { Card, Page, Pill } from "@/components/ui";
import type { MsgKey } from "@/lib/i18n/messages";

const LABS: [string, string, MsgKey, MsgKey][] = [
  ["/lab/electrical", "nav.electrical", "lab.electrical.desc", "lab.engine.pure"],
  ["/lab/electronics", "nav.electronics", "lab.electronics.desc", "lab.engine.spice"],
  ["/lab/solar", "nav.solar", "lab.solar.desc", "lab.engine.solar"],
  ["/lab/iot", "nav.iotlab", "lab.iot.desc", "lab.engine.iot"],
  ["/lab/automatisme", "nav.automatisme", "lab.automatisme.desc", "lab.engine.plc"],
  ["/lab/mechanical", "nav.mechanical", "lab.mechanical.desc", "lab.engine.pure"],
  ["/lab/refrigeration", "nav.refrigeration", "lab.refrigeration.desc", "lab.engine.pure"],
  ["/lab/network", "nav.network", "lab.network.desc", "lab.engine.pure"],
  ["/components", "nav.components", "lab.components.desc", "lab.engine.library"],
  ["/studio", "nav.studio", "lab.studio.desc", "lab.engine.studio"],
];

export default function Lab() {
  const t = useT();
  return (
    <Page title={t("nav.lab")} subtitle={t("lab.subtitle")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LABS.map(([href, title, desc, eng]) => (
          <Link key={href} href={href} className="block"><Card className="h-full hover:border-[var(--cyan)]" title={t(title as MsgKey)}><p className="text-sm text-[var(--fg-2)]">{t(desc)}</p><div className="mt-3"><Pill tone="info">{t(eng)}</Pill></div></Card></Link>
        ))}
      </div>
    </Page>
  );
}
