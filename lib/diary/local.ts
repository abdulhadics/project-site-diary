import { entryKey, newDiary, type Diary, type Project, type Tracked } from "./model";

const databaseName = "project-site-diary";
let connection: Promise<IDBDatabase> | undefined;

type AssetChanges = { put?: [string, Blob][]; remove?: string[] };
type LegacyDiary = Omit<Diary, "activeProjectId" | "projects"> & { project: Tracked<Project> | null };

function readSnapshot(stored: Diary | LegacyDiary | undefined): Diary {
  if (!stored) return newDiary();
  if ("projects" in stored) return stored;
  const project = stored.project;
  return {
    activeProjectId: project?.row.id ?? null,
    projects: project ? { [project.row.id]: project } : {},
    entries: Object.fromEntries(Object.values(stored.entries).map((entry) => [
      entryKey(entry.row.project_id, entry.row.report_date), entry,
    ])),
    photos: stored.photos,
    reports: stored.reports,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = (event) => {
      if (event.oldVersion > 0) return;
      request.result.createObjectStore("diaries");
      request.result.createObjectStore("assets");
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
  });
  return connection;
}

export async function readDiary(owner: string): Promise<Diary> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("diaries").objectStore("diaries").get(owner);
    request.onsuccess = () => resolve(readSnapshot(request.result));
    request.onerror = () => reject(request.error);
  });
}

export async function changeDiary(
  owner: string,
  mutate: (diary: Diary) => AssetChanges | void,
): Promise<Diary> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["diaries", "assets"], "readwrite");
    const records = tx.objectStore("diaries");
    const assets = tx.objectStore("assets");
    const request = records.get(owner);
    let diary: Diary;
    let failure: unknown;
    request.onsuccess = () => {
      diary = readSnapshot(request.result);
      try {
        const changes = mutate(diary);
        records.put(diary, owner);
        for (const [path, blob] of changes?.put ?? []) assets.put(blob, path);
        for (const path of changes?.remove ?? []) assets.delete(path);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(diary);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Local save was interrupted."));
  });
}

export async function readAsset(path: string): Promise<Blob | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("assets").objectStore("assets").get(path);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function storeAsset(path: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(blob, path);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}
