import type { DiaryClient } from "../supabase";
import { changeDiary, readAsset, readDiary, storeAsset } from "./local";
import {
  bucket, entryKey, photoWaiting, tracked,
  type Diary, type Entry, type LocalPhoto, type Photo, type Project, type Report, type Tracked,
} from "./model";

type Area = "database" | "storage";
export type SyncIssue = "offline" | "login" | "unavailable" | "storage-full" | "database-full" | "storage" | "unknown";

export class CloudError extends Error {
  constructor(readonly area: Area, readonly detail: unknown) {
    super("Cloud sync failed.");
  }
}

type ErrorDetails = { status?: number | string; statusCode?: number | string; code?: string; message?: string };
type CloudResult = { error: unknown; status?: number };

function details(error: unknown): ErrorDetails {
  if (!error || typeof error !== "object") return {};
  const { status, statusCode, code, message } = error as ErrorDetails;
  return { status, statusCode, code, message };
}

function checked(result: CloudResult, area: Area): void {
  if (!result.error) return;
  const info = details(result.error);
  throw new CloudError(area, { ...info, status: info.status ?? result.status });
}

export function classifyCloudIssue(error: unknown): SyncIssue {
  if (!navigator.onLine) return "offline";
  const info = details(error instanceof CloudError ? error.detail : error);
  const status = Number(info.status || info.statusCode);
  const message = ((info.code ?? "") + " " + (info.message ?? "")).toLowerCase();
  if (status === 401 || /jwt.*expired|invalid.*refresh|session.*not found/.test(message)) return "login";
  if (error instanceof CloudError && error.area === "storage") {
    if (/storagequota|quota.*exceeded|exceeded.*quota|storage.*full/.test(message)) return "storage-full";
    if (status === 413 || /bucket.*not found|invalid.*bucket|entitytoolarge/.test(message)) return "storage";
  }
  if (/53100|25006|disk.*full|read.only transaction|database.*quota/.test(message)) return "database-full";
  if ((status >= 500 && status < 600) || /paused|failed to fetch|fetch failed|networkerror|load failed/.test(message)) return "unavailable";
  return "unknown";
}

export const syncMessages: Record<SyncIssue, string> = {
  offline: "No internet. Your changes are saved on this phone.",
  login: "Sign-in expired. Your changes are saved on this phone. Sign in again to sync.",
  unavailable: "The cloud project is unavailable or paused. Your changes are saved on this phone.",
  "storage-full": "Cloud storage is full. Your changes are saved on this phone. Download your report now.",
  "database-full": "The cloud database is full or read-only. Your changes are saved on this phone. Download your report now.",
  storage: "Cloud storage rejected the file. Your changes are saved on this phone. Download your report now.",
  unknown: "Cloud sync failed. Your changes are saved on this phone. You can retry sync.",
};

export async function getAsset(client: DiaryClient, path: string): Promise<Blob> {
  const cached = await readAsset(path);
  if (cached) return cached;
  const signed = await client.storage.from(bucket).createSignedUrl(path, 120);
  checked(signed, "storage");
  if (!signed.data) throw new CloudError("storage", { message: "Could not sign the file." });
  const file = await fetch(signed.data.signedUrl);
  if (!file.ok) throw new CloudError("storage", { status: file.status });
  const blob = await file.blob();
  await storeAsset(path, blob).catch(() => {});
  return blob;
}

async function upload(client: DiaryClient, path: string, type: string) {
  const blob = await readAsset(path);
  if (!blob) throw new CloudError("storage", { message: "The local file is missing." });
  const result = await client.storage.from(bucket).upload(path, blob, {
    contentType: type, cacheControl: "0", upsert: false,
  });
  const error = details(result.error);
  const duplicate = Number(error.status || error.statusCode) === 409
    || /already exists|duplicate/i.test(error.message ?? "");
  if (result.error && !duplicate) checked(result, "storage");
}

async function allRows<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown; status: number }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await fetchPage(from, from + size - 1);
    checked(result, "database");
    if (!result.data) return rows;
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}

async function pull(client: DiaryClient, owner: string) {
  const [projects, entries, photos, reports] = await Promise.all([
    allRows<Project>((from, to) => client.from("projects").select("*").order("id").range(from, to)),
    allRows<Entry>((from, to) => client.from("entries").select("*").order("id").range(from, to)),
    allRows<Photo>((from, to) => client.from("photos").select("*").order("id").range(from, to)),
    allRows<Report>((from, to) => client.from("reports").select("*").order("id").range(from, to)),
  ]);

  return changeDiary(owner, (current) => {
    for (const project of projects) {
      if (!current.projects[project.id]?.pending) current.projects[project.id] = tracked(project, false);
    }
    if (!current.activeProjectId || !current.projects[current.activeProjectId]) {
      const latest = Object.values(current.projects).sort((a, b) => b.row.created_at.localeCompare(a.row.created_at))[0];
      current.activeProjectId = latest?.row.id ?? null;
    }
    for (const entry of entries) {
      const key = entryKey(entry.project_id, entry.report_date);
      if (!current.entries[key]?.pending) current.entries[key] = tracked(entry, false);
    }
    for (const photo of photos) {
      if (!current.photos[photo.id]?.pending) {
        current.photos[photo.id] = {
          ...tracked(photo, false), review: photo.ai_ok === true ? "clear" : photo.ai_ok === false ? "rejected" : "unavailable",
          deleted: false, uploaded: true, reason: current.photos[photo.id]?.reason,
        };
      }
    }
    for (const report of reports) {
      if (!current.reports[report.id]?.pending) {
        current.reports[report.id] = { ...tracked(report, false), uploaded: true, filename: current.reports[report.id]?.filename };
      }
    }
  });
}

async function pushEntry(client: DiaryClient, owner: string, entry: Tracked<Entry>) {
  const result = await client.from("entries").upsert(entry.row);
  const date = entry.row.report_date;
  const key = entryKey(entry.row.project_id, date);
  if (result.error?.code === "23505") {
    const duplicate = await client.from("entries").select("*")
      .eq("project_id", entry.row.project_id).eq("report_date", date).single();
    checked(duplicate, "database");
    const remote = duplicate.data;
    if (remote) {
      return changeDiary(owner, (diary) => {
        if (diary.entries[key]?.revision !== entry.revision) return;
        diary.entries[key] = tracked(remote, false);
        for (const photo of Object.values(diary.photos)) {
          if (photo.row.entry_id !== entry.row.id) continue;
          photo.row.entry_id = remote.id;
          photo.revision = crypto.randomUUID();
        }
      });
    }
  }
  checked(result, "database");
  return changeDiary(owner, (diary) => {
    if (diary.entries[key]?.revision === entry.revision) diary.entries[key].pending = false;
  });
}

async function pushPhoto(client: DiaryClient, owner: string, photo: LocalPhoto) {
  const { id, storage_path: path } = photo.row;
  if (photo.deleted) {
    checked(await client.storage.from(bucket).remove([path]), "storage");
    checked(await client.from("photos").delete().eq("id", id), "database");
  } else {
    if (!photo.uploaded) {
      await upload(client, path, "image/jpeg");
      await changeDiary(owner, (diary) => {
        if (diary.photos[id]) diary.photos[id].uploaded = true;
      });
    }
    checked(await client.from("photos").upsert(photo.row), "database");
  }
  return changeDiary(owner, (diary) => {
    if (diary.photos[id]?.revision !== photo.revision) return;
    if (photo.deleted) {
      delete diary.photos[id];
      return { remove: [path] };
    }
    diary.photos[id].pending = false;
  });
}

export async function cloudBytes(client: DiaryClient): Promise<number> {
  const result = await client.rpc("diary_storage_bytes");
  checked(result, "database");
  return Number(result.data);
}

export async function syncDiary(
  client: DiaryClient, owner: string, refresh: boolean, onSaved: (diary: Diary) => void,
) {
  async function sync() {
    let diary = await readDiary(owner);
    for (const project of Object.values(diary.projects)) {
      if (!project.pending) continue;
      checked(await client.from("projects").upsert(project.row), "database");
      diary = await changeDiary(owner, (current) => {
        if (current.projects[project.row.id]?.revision === project.revision) current.projects[project.row.id].pending = false;
      });
      onSaved(diary);
    }
    for (const entry of Object.values(diary.entries)) {
      if (!entry.pending || diary.projects[entry.row.project_id]?.pending) continue;
      diary = await pushEntry(client, owner, entry);
      onSaved(diary);
    }
    const readyEntries = new Set(Object.values(diary.entries).filter((entry) => !entry.pending).map((entry) => entry.row.id));
    for (const photo of Object.values(diary.photos)) {
      if (!photoWaiting(photo) || (!photo.deleted && !readyEntries.has(photo.row.entry_id))) continue;
      diary = await pushPhoto(client, owner, photo);
      onSaved(diary);
    }
    for (const report of Object.values(diary.reports)) {
      const entry = diary.entries[entryKey(report.row.project_id, report.row.report_date)];
      if (!report.pending || !entry || entry.pending) continue;
      if (!report.uploaded) {
        await upload(client, report.row.pdf_path, "application/pdf");
        await changeDiary(owner, (current) => {
          if (current.reports[report.row.id]) current.reports[report.row.id].uploaded = true;
        });
      }
      checked(await client.from("reports").upsert(report.row, { ignoreDuplicates: true }), "database");
      diary = await changeDiary(owner, (current) => {
        if (current.reports[report.row.id]?.revision === report.revision) {
          current.reports[report.row.id].pending = false;
        }
      });
      onSaved(diary);
    }
    if (refresh) onSaved(await pull(client, owner));
  }
  if (navigator.locks) {
    await navigator.locks.request("site-diary-sync-" + owner, sync);
  } else {
    await sync();
  }
}
