// Stores trip recordings locally in the browser's IndexedDB. Nothing here
// ever touches a server — this is the "not visible to anyone else" promise
// from the Safety Toolkit screen, made real.

const DB_NAME = "encompass-recordings";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This device doesn't support local recording storage."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves a finished recording. `meta` should include at least a human
 * readable label (e.g. the destination) and a role ("driver" or "rider").
 */
export async function saveRecording({ blob, mimeType, rideId, destination, role, kind }) {
  const db = await openDB();
  const record = {
    id: `${rideId || "trip"}-${Date.now()}`,
    blob,
    mimeType,
    destination: destination || "Trip recording",
    role,
    kind, // "audio" or "video"
    createdAt: new Date().toISOString(),
    sizeBytes: blob.size,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(record.id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listRecordings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecording(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
