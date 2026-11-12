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
