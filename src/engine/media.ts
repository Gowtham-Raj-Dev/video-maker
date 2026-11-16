import { MIX_RATE, type Assets, type Project } from "./types";

/**
 * The visitor's own files: a background video (and its sound) and their own music.
 * Everything stays in this browser.
 */

/** A video file ready to draw: muted (its sound is mixed with the voices instead), looping, inline. */
export function loadVideo(file: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    const done = () => {
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("error", fail);
      resolve(video);
    };
    const fail = () => {
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("error", fail);
      reject(new Error("That video couldn't be opened. Try an MP4 (H.264) or WebM file."));
    };
    video.addEventListener("loadeddata", done);
    video.addEventListener("error", fail);
    video.src = URL.createObjectURL(file);
  });
}

/** Where the background video should be at video time `t`: from the chosen start, looping. */
export function videoTimeAt(project: Project, video: HTMLVideoElement, t: number): number {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0.1) return 0;
  const start = Math.min(Math.max(0, project.videoStart ?? 0), duration - 0.1);
  return start + (t % (duration - start));
}

/** The background video in use, if this project shows one. */
export const activeVideo = (project: Project, assets: Assets | null) => (project.background === "video" && assets?.bgVideo ? assets.bgVideo : null);

/** Moves a video to `time` and waits until that frame can be drawn. */
export function seekVideo(video: HTMLVideoElement, time: number, timeoutMs = 2000): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.002 && video.readyState >= 2 && !video.seeking) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    video.addEventListener("seeked", finish);
    video.currentTime = time;
  });
}

/** The sound of an audio or video file, mono at the mix rate (at most `maxSeconds`); null when it has no sound we can read. */
export async function decodeMono(file: Blob, maxSeconds = 300): Promise<Float32Array | null> {
  try {
    // Decoding in a context at the mix's rate gives the sound already resampled.
    const decoded = await new OfflineAudioContext(1, 1, MIX_RATE).decodeAudioData(await file.arrayBuffer());
    const length = Math.min(decoded.length, MIX_RATE * maxSeconds);
    const mono = new Float32Array(length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += data[i] / decoded.numberOfChannels;
    }
    return mono;
  } catch {
    return null;
  }
}
