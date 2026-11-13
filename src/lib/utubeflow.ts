/**
 * "Send to UTubeFlow": hands a finished video to UTubeFlow (utubeflow.codelove.in), our free YouTube
 * bulk uploader and scheduler, without downloading it first.
 *
 * Video Maker opens UTubeFlow's upload page in a named tab. That tab (window.opener = us) says hello;
 * we answer and send the video. Origins are checked on both sides.
 *   UTubeFlow tab → Video Maker: { type: "utubeflow:hello", kind }
 *   Video Maker → UTubeFlow tab: { type: "videomaker:linked" }
 *   Video Maker → UTubeFlow tab: { type: "videomaker:clips", kind, clips: [{ name, type, blob, title, description, index }] }
 *   UTubeFlow tab → Video Maker: { type: "utubeflow:received", count }
 * For local testing of both apps: NEXT_PUBLIC_UTUBEFLOW_URL=http://localhost:5173 (and VITE_VIDEOMAKER_URL there).
 */

export const UTUBEFLOW_URL = (process.env.NEXT_PUBLIC_UTUBEFLOW_URL || "https://utubeflow.codelove.in").replace(/\/$/, "");
const UTUBEFLOW_ORIGIN = new URL(UTUBEFLOW_URL).origin;

const isUTubeFlowOrigin = (origin: string) =>
  origin === UTUBEFLOW_ORIGIN || origin === "https://utubeflow.codelove.in" || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

/**
 * Inside UTubeFlow: its "Video Maker" page shows the editor in a frame (/editor/?embed=utubeflow).
 * Then a finished video goes straight to UTubeFlow's Ready to Post instead of opening a new tab.
 *   Video Maker → UTubeFlow page: { type: "videomaker:ready" }
 *   UTubeFlow page → Video Maker: { type: "utubeflow:init", theme }
 *   Video Maker → UTubeFlow page: { type: "videomaker:clips", kind, clips }
 *   UTubeFlow page → Video Maker: { type: "utubeflow:received", count }
 */
export const isEmbeddedInUTubeFlow = () =>
  typeof window !== "undefined" && window.parent !== window && new URLSearchParams(window.location.search).get("embed") === "utubeflow";

let parentOrigin: string | null = null;

/** Says hello to UTubeFlow and learns its origin from its answer. Call once on mount; returns a cleanup. */
export function linkToUTubeFlowParent(): () => void {
  const onMessage = (e: MessageEvent) => {
    if (e.source !== window.parent || !isUTubeFlowOrigin(e.origin)) return;
    if ((e.data as { type?: string })?.type === "utubeflow:init") parentOrigin = e.origin;
  };
  window.addEventListener("message", onMessage);
  // Nothing private in a hello; the parent answers only if it is UTubeFlow, and we check its origin.
  window.parent.postMessage({ type: "videomaker:ready" }, "*");
  return () => window.removeEventListener("message", onMessage);
}

/** Sends the video to the UTubeFlow page around us; resolves with how many videos it took. */
export function sendToUTubeFlowParent(video: SendVideo): Promise<number> {
  if (!parentOrigin) {
    // Hello lost (slow load): ask again and give it a moment.
    window.parent.postMessage({ type: "videomaker:ready" }, "*");
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const trySend = () => {
      if (!parentOrigin) {
        if (Date.now() - started > 8000) return reject(new Error("UTubeFlow didn't answer. Reload the page and try again."));
        return void window.setTimeout(trySend, 300);
      }
      const origin = parentOrigin;
      const timer = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("UTubeFlow didn't confirm. Try again."));
      }, 60_000);
      const onMessage = (e: MessageEvent) => {
        if (e.source !== window.parent || e.origin !== origin) return;
        const data = e.data as { type?: string; count?: unknown };
        if (data?.type !== "utubeflow:received") return;
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(Number(data.count) || 0);
      };
      window.addEventListener("message", onMessage);
      const clip = { name: video.fileName, type: video.blob.type || "video/mp4", blob: video.blob, title: video.title.slice(0, 100), description: video.description, index: 1 };
      window.parent.postMessage({ type: "videomaker:clips", kind: video.kind, clips: [clip] }, origin);
    };
    trySend();
  });
}
const TAB = "utubeflow";

export interface SendVideo {
  blob: Blob;
  fileName: string;
  title: string;
  description: string;
  /** Shorts go to UTubeFlow's Shorts list, the rest to long videos. */
  kind: "short" | "video";
}

/**
 * Opens UTubeFlow and sends the video once its tab says hello. Resolves with how many videos it took;
 * rejects if it never answers (closed, blocked, not signed in yet).
 */
export function sendToUTubeFlow(video: SendVideo, onLinked: () => void): Promise<number> {
  const tab = window.open(`${UTUBEFLOW_URL}/upload/${video.kind}?from=videomaker`, TAB);
  if (!tab) return Promise.reject(new Error("Your browser blocked the UTubeFlow tab. Allow pop-ups for this site and try again."));
  return new Promise((resolve, reject) => {
    let sent = false;
    const timer = window.setTimeout(() => {
      done();
      reject(new Error(sent ? "UTubeFlow didn't confirm. Check its tab: sign in with Google there, then send again." : "UTubeFlow didn't answer. Sign in on its tab, keep it open, then press Send again."));
    }, 120_000);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== UTUBEFLOW_ORIGIN || e.source !== tab) return;
      const data = e.data as { type?: string; count?: unknown };
      if (data?.type === "utubeflow:hello") {
        onLinked();
        tab.postMessage({ type: "videomaker:linked" }, UTUBEFLOW_ORIGIN);
        const clip = { name: video.fileName, type: video.blob.type || "video/mp4", blob: video.blob, title: video.title.slice(0, 100), description: video.description, index: 1 };
        tab.postMessage({ type: "videomaker:clips", kind: video.kind, clips: [clip] }, UTUBEFLOW_ORIGIN);
        sent = true;
      } else if (data?.type === "utubeflow:received") {
        done();
        resolve(Number(data.count) || 0);
      }
    };
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);
  });
}
