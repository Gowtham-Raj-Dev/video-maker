import { doc, increment, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * "I want this" for features that aren't built yet: when GOAL people ask, it
 * gets built. stats/{feature} holds the public count. Each browser has a
 * random id, and its request is requests/{feature}_{id}: the rules allow
 * creating that once and never again, so one browser counts once.
 */

export type Feature = "own-character";
export const GOAL = 100;

const ID_KEY = "videomaker.browser-id";
const MINE = (feature: Feature) => `videomaker.requested.${feature}`;

function browserId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

/** Calls back with the current count, live; returns the unsubscribe. */
export function watchCount(feature: Feature, onCount: (count: number) => void, onError?: () => void): () => void {
  return onSnapshot(
    doc(db(), "stats", feature),
    (snap) => onCount(Number(snap.data()?.count ?? 0)),
    () => onError?.(),
  );
}

/** Whether this browser has already asked. */
export function hasRequested(feature: Feature): boolean {
  try {
    return localStorage.getItem(MINE(feature)) === "1";
  } catch {
    return false;
  }
}

/** Adds this browser's one request and bumps the count, together. A second try from the same browser counts nothing. */
export async function requestFeature(feature: Feature): Promise<void> {
  const batch = writeBatch(db());
  batch.set(doc(db(), "requests", `${feature}_${browserId()}`), {
    feature,
    lang: (navigator.language || "").slice(0, 20),
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db(), "stats", feature), { count: increment(1) }, { merge: true });
  try {
    await batch.commit();
  } catch (error) {
    // Already asked from this browser (the rules refuse a second request): just remember it.
    if ((error as { code?: string }).code !== "permission-denied") throw error;
  }
  try {
    localStorage.setItem(MINE(feature), "1");
  } catch {
    // Not remembered here; the rules still stop a second count.
  }
}
