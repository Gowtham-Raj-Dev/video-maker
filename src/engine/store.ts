import { defaultProject, parseScript, syncCast } from "./script";
import type { Project } from "./types";

/** What stays in this browser between visits: the project, the API keys, and recorded voices. Nothing leaves it. */

const PROJECT_KEY = "videomaker.project.v1";
const KEYS_KEY = "videomaker.keys.v1";

export function loadProject(): Project {
  try {
    const saved = JSON.parse(localStorage.getItem(PROJECT_KEY) ?? "null") as Partial<Project> | null;
    if (saved?.script) {
      const project = { ...defaultProject(), ...saved };
      return { ...project, cast: syncCast(parseScript(project.script).lines, project.cast ?? []) };
    }
  } catch {
    // A broken save: start fresh.
  }
  return defaultProject();
}

export function saveProject(project: Project) {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  } catch {
    // Storage is full or blocked: the project just isn't remembered.
  }
}

export function loadKeys(): string {
  try {
    return localStorage.getItem(KEYS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveKeys(keys: string) {
  try {
    if (keys.trim()) localStorage.setItem(KEYS_KEY, keys);
    else localStorage.removeItem(KEYS_KEY);
  } catch {
    // Not remembered.
  }
}

// ─── Recorded voices (IndexedDB): a line is recorded once, then reused ────────

export interface SavedVoice {
  rate: number;
  parts: Float32Array[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open("videomaker", 2);
    open.onupgradeneeded = () => {
      const names = open.result.objectStoreNames;
      if (!names.contains("voice")) open.result.createObjectStore("voice");
      if (!names.contains("media")) open.result.createObjectStore("media");
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  return dbPromise;
}

export async function voiceKey(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("\u0001"));
  if (!crypto.subtle) {
    // Not a secure page: a plain hash will do.
    let h = 5381;
    for (const b of data) h = ((h << 5) + h + b) | 0;
    return `h${h}-${data.length}`;
  }
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getVoice(key: string): Promise<SavedVoice | null> {
  try {
    const store = (await db()).transaction("voice").objectStore("voice");
    return await new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as SavedVoice | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function putVoice(key: string, voice: SavedVoice) {
  try {
    const tx = (await db()).transaction("voice", "readwrite");
    tx.objectStore("voice").put(voice, key);
  } catch {
    // Not saved: it will be recorded again next time.
  }
}

// ─── The visitor's own files (IndexedDB), so they are still there after a reload ──

export type MediaKind = "picture" | "music" | "video";
export interface SavedMedia {
  name: string;
  blob: Blob;
}

export async function putMedia(kind: MediaKind, media: SavedMedia | null) {
  try {
    const store = (await db()).transaction("media", "readwrite").objectStore("media");
    if (media) store.put(media, kind);
    else store.delete(kind);
  } catch {
    // Not kept: it is gone after a reload.
  }
}

export async function getMedia(kind: MediaKind): Promise<SavedMedia | null> {
  try {
    const store = (await db()).transaction("media").objectStore("media");
    return await new Promise((resolve) => {
      const req = store.get(kind);
      req.onsuccess = () => resolve((req.result as SavedMedia | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearVoices() {
  try {
    (await db()).transaction("voice", "readwrite").objectStore("voice").clear();
  } catch {
    // Nothing to clear.
  }
}
