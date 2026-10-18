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

/* Cloud restore (see cloud.ts / /api/media): only used when the local blob is
 * missing — e.g. project opened from another browser or after cache eviction.
 * In-flight de-dup prevents parallel clips from fetching the same asset. */
const cloudFetches = new Map<string, Promise<Blob | null>>();

function restoreFromCloud(id: string): Promise<Blob | null> {
  let p = cloudFetches.get(id);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) return null;
        const blob = await res.blob();
        return blob && blob.size > 0 ? blob : null;
      } catch {
        return null;
      }
    })().finally(() => cloudFetches.delete(id));
    cloudFetches.set(id, p);
  }
  return p;
}

export async function getAssetUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  let blob = await getAssetBlob(id);
  if (!blob) {
    // Local cache miss — transparently restore from the cloud backup,
    // cache it locally, then serve as usual.
    blob = await restoreFromCloud(id);
    if (!blob) return null;
    await putAssetBlob(id, blob);
  }
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
