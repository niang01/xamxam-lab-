/** Les 15 profils de XAM-XAM LAB et leurs droits par défaut (cahier des charges §21, dossier doc 03). */
export const PROFILES = [
  "pupil", "student", "teacher", "trainer", "technician", "engineer", "researcher", "entrepreneur",
  "startup", "mentor", "company", "recruiter", "sponsor", "investor", "administrator",
] as const;
export type Profile = (typeof PROFILES)[number];

/** Profils qu'une personne peut choisir elle-même à l'inscription (administrateur : attribué par configuration). */
export const SELF_SERVICE_PROFILES: Profile[] = PROFILES.filter((p) => p !== "administrator");

export type Capability =
  | "labs" | "simulate" | "devices" | "confirm_commands" | "create_courses" | "publish_startup" | "create_challenge"
  | "post_jobs" | "search_talents" | "mentor" | "publish_news";

const ALL: Capability[] = ["labs", "simulate", "devices", "confirm_commands", "create_courses", "publish_startup", "create_challenge", "post_jobs", "search_talents", "mentor", "publish_news"];

export const PROFILE_CAPABILITIES: Record<Profile, Capability[]> = {
  pupil: ["labs", "simulate"],
  student: ["labs", "simulate", "devices", "publish_news"],
  teacher: ["labs", "simulate", "devices", "confirm_commands", "create_courses", "publish_news"],
  trainer: ["labs", "simulate", "devices", "confirm_commands", "create_courses", "publish_news"],
  technician: ["labs", "simulate", "devices", "confirm_commands", "publish_news"],
  engineer: ["labs", "simulate", "devices", "confirm_commands", "publish_news", "mentor"],
  researcher: ["labs", "simulate", "devices", "confirm_commands", "create_courses", "publish_news"],
  entrepreneur: ["labs", "simulate", "devices", "publish_startup", "publish_news"],
  startup: ["labs", "simulate", "devices", "publish_startup", "post_jobs", "publish_news"],
  mentor: ["labs", "simulate", "mentor", "publish_news"],
  company: ["labs", "simulate", "devices", "confirm_commands", "post_jobs", "search_talents", "create_challenge", "publish_news"],
  recruiter: ["post_jobs", "search_talents", "publish_news"],
  sponsor: ["create_challenge", "publish_news"],
  investor: ["search_talents", "publish_news"],
  administrator: ALL,
};

export function can(profile: string, isAdmin: boolean, c: Capability): boolean {
  if (isAdmin) return true;
  return (PROFILE_CAPABILITIES[profile as Profile] ?? []).includes(c);
}

/** Habilitations nominatives (attribuées par un administrateur, avec justificatif). */
export const CLEARANCES = ["operation_reelle", "banc_essai", "telepilote_drone", "validateur_traduction_wo", "jury"] as const;
export type Clearance = (typeof CLEARANCES)[number];
