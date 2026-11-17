/** Les 26 rubriques du menu principal (cahier des charges §26) + Automation Studio (§7). */
export type Group = "core" | "lab" | "connect" | "knowledge" | "ecosystem" | "me";
export interface Rubric { key: string; path: string; group: Group; icon: string }

export const RUBRICS: Rubric[] = [
  { key: "dashboard", path: "/", group: "core", icon: "◈" },
  { key: "ai", path: "/ai", group: "core", icon: "✦" },
  { key: "command", path: "/command-center", group: "core", icon: "⌘" },
  { key: "automation", path: "/automation", group: "core", icon: "⟳" },
  { key: "lab", path: "/lab", group: "lab", icon: "⬡" },
  { key: "electrical", path: "/lab/electrical", group: "lab", icon: "⚡" },
  { key: "electronics", path: "/lab/electronics", group: "lab", icon: "∿" },
  { key: "solar", path: "/lab/solar", group: "lab", icon: "☀" },
  { key: "iotlab", path: "/lab/iot", group: "lab", icon: "⌁" },
  { key: "mechanical", path: "/lab/mechanical", group: "lab", icon: "⚙" },
  { key: "refrigeration", path: "/lab/refrigeration", group: "lab", icon: "❄" },
  { key: "network", path: "/lab/network", group: "lab", icon: "⊞" },
  { key: "components", path: "/components", group: "lab", icon: "▦" },
  { key: "studio", path: "/studio", group: "lab", icon: "◭" },
  { key: "gateway", path: "/iot", group: "connect", icon: "⇄" },
  { key: "remote", path: "/remote", group: "connect", icon: "◎" },
  { key: "earth", path: "/earth", group: "connect", icon: "◐" },
  { key: "projects", path: "/projects", group: "knowledge", icon: "▤" },
  { key: "academy", path: "/academy", group: "knowledge", icon: "✎" },
  { key: "collab", path: "/collab", group: "knowledge", icon: "⇌" },
  { key: "startups", path: "/startups", group: "ecosystem", icon: "▲" },
  { key: "challenges", path: "/challenges", group: "ecosystem", icon: "★" },
  { key: "mentors", path: "/mentors", group: "ecosystem", icon: "☉" },
  { key: "careers", path: "/careers", group: "ecosystem", icon: "◆" },
  { key: "news", path: "/news", group: "ecosystem", icon: "▣" },
  { key: "portfolio", path: "/portfolio", group: "me", icon: "◉" },
  { key: "settings", path: "/settings", group: "me", icon: "⚙" },
];
