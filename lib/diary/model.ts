import type { Tables } from "../../types/database";

export type Project = Tables<"projects">;
export type Entry = Tables<"entries">;
export type Photo = Tables<"photos">;
export type Report = Tables<"reports">;

export type Tracked<Row> = { row: Row; revision: string; pending: boolean };
export type PhotoReview = "checking" | "clear" | "rejected" | "unavailable";
export type LocalPhoto = Tracked<Photo> & { review: PhotoReview; deleted: boolean; reason?: string; uploaded?: boolean };
export type LocalReport = Tracked<Report> & { filename?: string; uploaded?: boolean };

export type Diary = {
  project: Tracked<Project> | null;
  entries: Record<string, Tracked<Entry>>;
  photos: Record<string, LocalPhoto>;
  reports: Record<string, LocalReport>;
};

export const bucket = "site-diary";
export const descriptionLimit = 240;
export const noteLimit = 1000;
export const poorAccuracyMetres = 50;
export const pdfLimit = 15 * 1024 * 1024;

export function newDiary(): Diary {
  return { project: null, entries: {}, photos: {}, reports: {} };
}

export function tracked<Row>(row: Row, pending = true): Tracked<Row> {
  return { row, revision: crypto.randomUUID(), pending };
}

export function localDay(date = new Date()): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => String(value).padStart(index ? 2 : 4, "0"))
    .join("-");
}

export function reportDate(day: string): string {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "full" })
    .format(new Date(day + "T12:00:00"));
}

export function captureTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  }).format(new Date(timestamp)).replace(/\b(?:am|pm)\b/g, (period) => period.toUpperCase());
}

export function assetPath(project: Project, folder: "photos" | "reports", id: string): string {
  return [project.user_id, project.id, folder, id].join("/") + (folder === "photos" ? ".jpg" : ".pdf");
}

export function reportFilename(name: string, day: string): string {
  const safeName = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ").replace(/[. ]+$/, "");
  return (safeName || "Project") + "_" + day + ".pdf";
}

export function photosForDay(diary: Diary, day: string): LocalPhoto[] {
  return Object.values(diary.photos)
    .filter((photo) => !photo.deleted && photo.row.entry_id === diary.entries[day]?.row.id)
    .sort((a, b) => a.row.captured_at.localeCompare(b.row.captured_at) || a.row.id.localeCompare(b.row.id));
}

export function reportsForDay(diary: Diary, day: string): LocalReport[] {
  return Object.values(diary.reports)
    .filter((report) => report.row.report_date === day)
    .sort((a, b) => b.row.created_at.localeCompare(a.row.created_at) || b.row.id.localeCompare(a.row.id));
}

export function photoWaiting(photo: LocalPhoto): boolean {
  return photo.pending && (photo.deleted || photo.review !== "checking");
}

export function waiting(diary: Diary): number {
  return Number(diary.project?.pending ?? false)
    + Object.values(diary.entries).filter((entry) => entry.pending).length
    + Object.values(diary.photos).filter(photoWaiting).length
    + Object.values(diary.reports).filter((report) => report.pending).length;
}

export function mapUrl(photo: Pick<Photo, "lat" | "lng">): string {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(photo.lat + "," + photo.lng);
}
