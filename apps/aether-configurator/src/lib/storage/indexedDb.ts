/**
 * Local profile / settings store via IndexedDB (idb).
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface SavedProfile {
  id: string;
  name: string;
  craft: string;
  protocol: string;
  notes: string;
  /** Opaque preset payload — CLI dump, param dict, etc. */
  payload: string;
  createdAt: number;
  updatedAt: number;
}

interface AetherDb extends DBSchema {
  profiles: {
    key: string;
    value: SavedProfile;
    indexes: { "by-updated": number };
  };
  kv: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<AetherDb>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<AetherDb>("aether-configurator", 1, {
      upgrade(db) {
        const profiles = db.createObjectStore("profiles", { keyPath: "id" });
        profiles.createIndex("by-updated", "updatedAt");
        db.createObjectStore("kv", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function listProfiles(): Promise<SavedProfile[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("profiles", "by-updated");
  return all.reverse();
}

export async function saveProfile(
  profile: Omit<SavedProfile, "createdAt" | "updatedAt"> & {
    createdAt?: number;
  },
): Promise<SavedProfile> {
  const db = await getDb();
  const now = Date.now();
  const existing = await db.get("profiles", profile.id);
  const next: SavedProfile = {
    ...profile,
    createdAt: existing?.createdAt ?? profile.createdAt ?? now,
    updatedAt: now,
  };
  await db.put("profiles", next);
  return next;
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("profiles", id);
}

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const row = await db.get("kv", key);
  return (row?.value as T) ?? fallback;
}

export async function setKv(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("kv", { key, value });
}
