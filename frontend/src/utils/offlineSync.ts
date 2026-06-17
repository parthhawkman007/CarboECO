import { getApiUrl, getWsUrl, getAuthHeaders } from "@/utils/api";
import { CarbonLog } from "@/types";

const DB_NAME = "CarboECO_Offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_logs";

export interface PendingLog {
  id?: number;
  date: string;
  category: string;
  subcategory: string;
  value: number;
  unit: string;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const queuePendingLog = async (log: Omit<PendingLog, "id">): Promise<number> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(log);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB failed to write log", err);
    return Date.now();
  }
};

export const getPendingLogs = async (): Promise<PendingLog[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as PendingLog[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB failed to read logs", err);
    return [];
  }
};

export const deletePendingLog = async (id: number): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB failed to delete log", err);
  }
};

export const syncOfflineLogs = async (): Promise<{ successCount: number; failedCount: number }> => {
  const pending = await getPendingLogs();
  if (pending.length === 0) return { successCount: 0, failedCount: 0 };

  let successCount = 0;
  let failedCount = 0;

  for (const log of pending) {
    const { id, ...payload } = log;
    try {
      const res = await fetch(`${getApiUrl()}/api/carbon/logs`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        if (id !== undefined) {
          await deletePendingLog(id);
        }
        successCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { successCount, failedCount };
};
