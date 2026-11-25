/** Formation à distance : droits (auteur, inscrit), fichiers de cours et remises, corrections. */
import { ApiFailure, type User } from "./api";
import { sqlOne } from "./db";
import { loadCourse, type CourseRow } from "./courses";

export const FILE_MAX = 8 * 1024 * 1024;
const MIME: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain", zip: "application/zip", ino: "text/plain", py: "text/plain",
};
export const ALLOWED_EXT = Object.keys(MIME);

/** Fichier contrôlé : extension autorisée, taille, signature cohérente (PDF, ZIP/Office, images). */
export async function readUpload(f: FormDataEntryValue | null): Promise<{ name: string; mime: string; bytes: Uint8Array } | null> {
  if (!(f instanceof File) || !f.size) return null;
  const ext = f.name.toLowerCase().split(".").pop() ?? "";
  if (!MIME[ext]) throw new ApiFailure(400, `Type de fichier non accepté (.${ext}). Acceptés : ${ALLOWED_EXT.join(", ")}`, "fad.err.type");
  if (f.size > FILE_MAX) throw new ApiFailure(413, "Fichier trop volumineux (8 Mo maximum)", "fad.err.size");
  const b = new Uint8Array(await f.arrayBuffer());
  const sig = (s: number[]) => s.every((x, i) => b[i] === x);
  const okSig = ext === "pdf" ? sig([0x25, 0x50, 0x44, 0x46]) : ["docx", "pptx", "xlsx", "zip"].includes(ext) ? sig([0x50, 0x4b]) : ext === "png" ? sig([0x89, 0x50]) : ["jpg", "jpeg"].includes(ext) ? sig([0xff, 0xd8]) : true;
  if (!okSig) throw new ApiFailure(400, "Le contenu du fichier ne correspond pas à son extension", "fad.err.type");
  return { name: f.name.replace(/[\\/]/g, "_").slice(0, 200), mime: MIME[ext], bytes: b };
}

export async function courseRole(courseId: string, u: User): Promise<{ course: CourseRow; author: boolean; enrolled: boolean }> {
  const course = await loadCourse(courseId, u);
  const author = course.author_id === u.id || u.is_admin;
  const enrolled = !!(await sqlOne("SELECT 1 FROM enrollments WHERE course_id=$1 AND user_id=$2", [courseId, u.id]));
  return { course, author, enrolled };
}
export async function mustAuthor(courseId: string, u: User) { const r = await courseRole(courseId, u); if (!r.author) throw new ApiFailure(403, "Réservé au formateur du cours", "err.forbidden"); return r; }
export async function mustAccess(courseId: string, u: User) { const r = await courseRole(courseId, u); if (!r.author && !r.enrolled) throw new ApiFailure(403, "Inscrivez-vous au cours pour accéder à ce contenu", "fad.err.enroll"); return r; }
