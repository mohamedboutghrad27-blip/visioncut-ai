"use client";

/* IndexedDB persistence for uploaded/generated media blobs.
 * Project timelines reference assets by id; blobs survive page reloads. */

const DB_NAME = "visioncut-assets";
const STORE = "blobs";
const META_STORE = "meta";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      })
  );
}

export async function putAssetBlob(id: string, blob: Blob): Promise<void> {
  await tx(STORE, "readwrite", (s) => s.put(blob, id) as unknown as IDBRequest<undefined>);
}

export async function getAssetBlob(id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>(STORE, "readonly", (s) => s.get(id));
}

export async function deleteAssetBlob(id: string): Promise<void> {
  await tx(STORE, "readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

export async function listAssetIds(): Promise<string[]> {
  return tx<IDBValidKey[]>(STORE, "readonly", (s) => s.getAllKeys());
}

export async function clearAllAssets(): Promise<void> {
  await tx(STORE, "readwrite", (s) => s.clear() as unknown as IDBRequest<undefined>);
}

/** Store a Blob and return its asset id (caller also records Asset metadata in project). */
export async function storeBlob(blob: Blob): Promise<string> {
  const id = `as_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  await putAssetBlob(id, blob);
  return id;
}

/* In-memory object URL registry (avoid re-creating URLs for the same asset) */
const urlCache = new Map<string, string>();

export async function getAssetUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getAssetBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function dropAssetUrl(id: string) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}
