import { newDiary, type Diary } from "./model";

const databaseName = "project-site-diary";
let connection: Promise<IDBDatabase> | undefined;

type AssetChanges = { put?: [string, Blob][]; remove?: string[] };

function openDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
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
    request.onsuccess = () => resolve((request.result as Diary | undefined) ?? newDiary());
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
      diary = (request.result as Diary | undefined) ?? newDiary();
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
