import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { activeVideo, seekVideo, videoTimeAt } from "./media";
import { drawFrame, frameSize } from "./renderer";
import { MIX_RATE, type Assets, type Project, type Timeline } from "./types";

export interface ExportOptions {
  quality: Quality;
  fps: number;
  assets: Assets | null;
}

export type Quality = 720 | 1080 | 1440 | 2160;

export interface Exported {
  blob: Blob;
  /** "mp4" or "webm". */
  ext: string;
}

/** The frame in pixels for a quality (its short side), both sides even. */
export function pixelSize(project: Project, quality: Quality) {
  const { W, H } = frameSize(project.format);
  const k = quality / Math.min(W, H);
  const even = (n: number) => Math.round((n * k) / 2) * 2;
  return { width: even(W), height: even(H), k };
}

export const canEncodeMp4 = () => typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

type Accel = "no-preference" | "prefer-software";

/** The encoder stopped taking frames: some hardware encoders stall on big frames. */
class EncoderStall extends Error {}

async function pickVideoCodec(width: number, height: number, bitrate: number, FPS: number, accel: Accel): Promise<string | null> {
  // High profile at the level the frame needs, then simpler profiles.
  const codecs = width * height > 2_100_000 ? ["avc1.640033", "avc1.640034", "avc1.4d0033"] : ["avc1.640028", "avc1.4d0028", "avc1.42002a", "avc1.42001f"];
  for (const codec of codecs) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: FPS, hardwareAcceleration: accel });
      if (supported) return codec;
    } catch {
      // Not this one.
    }
  }
  return null;
}

async function pickAudioCodec(): Promise<{ codec: string; mux: "aac" | "opus" } | null> {
  if (typeof AudioEncoder === "undefined") return null;
  for (const [codec, mux] of [["mp4a.40.2", "aac"], ["opus", "opus"]] as const) {
    try {
      const { supported } = await AudioEncoder.isConfigSupported({ codec, sampleRate: MIX_RATE, numberOfChannels: 1, bitrate: 128_000 });
      if (supported) return { codec, mux };
    } catch {
      // Not this one.
    }
  }
  return null;
}

/**
 * The video as an MP4, drawn and encoded frame by frame — faster than real
 * time and never dropping a frame, all inside this browser. If the graphics
 * card's encoder stalls, it starts again on the software encoder.
 */
export async function exportMp4(project: Project, timeline: Timeline, options: ExportOptions, onProgress: (share: number) => void, signal?: AbortSignal): Promise<Exported> {
  try {
    return await encodeMp4(project, timeline, options, onProgress, "no-preference", signal);
  } catch (error) {
    if (!(error instanceof EncoderStall)) throw error;
    onProgress(0);
    return encodeMp4(project, timeline, options, onProgress, "prefer-software", signal);
  }
}

async function encodeMp4(project: Project, timeline: Timeline, options: ExportOptions, onProgress: (share: number) => void, accel: Accel, signal?: AbortSignal): Promise<Exported> {
  const { quality, fps: FPS, assets } = options;
  const { width, height, k } = pixelSize(project, quality);
  const bitrate = Math.round(width * height * 30 * 0.11 * (FPS > 30 ? 1.4 : 1));
  const videoCodec = await pickVideoCodec(width, height, bitrate, FPS, accel);
  if (!videoCodec) throw new Error("This browser can't encode video at this size. Try a smaller quality, or Chrome / Edge.");
  const audioCodec = timeline.audio ? await pickAudioCodec() : null;

  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d", { alpha: false }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Couldn't start drawing the video.");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: FPS },
    ...(audioCodec ? { audio: { codec: audioCodec.mux, numberOfChannels: 1, sampleRate: MIX_RATE } } : {}),
    fastStart: "in-memory",
  });

  let failure: unknown = null;
  const video = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  });
  video.configure({ codec: videoCodec, width, height, bitrate, framerate: FPS, hardwareAcceleration: accel });
  const stalled = () => {
    try {
      video.close();
    } catch {
      // Already closed.
    }
    return new EncoderStall("The video encoder stopped responding.");
  };

  const frames = Math.ceil(timeline.duration * FPS);
  const bgVideo = activeVideo(project, assets);
  bgVideo?.pause();
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) {
      video.close();
      throw new DOMException("Stopped", "AbortError");
    }
    if (failure) throw failure;
    // The visitor's video is stepped to this exact frame before drawing.
    if (bgVideo) await seekVideo(bgVideo, videoTimeAt(project, bgVideo, i / FPS));
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawFrame(ctx, project, timeline, i / FPS, assets);
    const frame = new VideoFrame(canvas as CanvasImageSource, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    video.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    // Don't draw faster than the encoder can take.
    const since = performance.now();
    while (video.encodeQueueSize > 6) {
      await new Promise((r) => setTimeout(r, 4));
      if (performance.now() - since > 8000) throw stalled();
    }
    if (i % 5 === 0) {
      onProgress((i / frames) * 0.95);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const flushed = await Promise.race([video.flush().then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 30_000))]);
  if (!flushed) throw stalled();
  video.close();

  if (audioCodec && timeline.audio) {
    const audio = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => (failure = e),
    });
    audio.configure({ codec: audioCodec.codec, sampleRate: MIX_RATE, numberOfChannels: 1, bitrate: 128_000 });
    const step = MIX_RATE; // a second at a time
    for (let at = 0; at < timeline.audio.length; at += step) {
      const piece = timeline.audio.slice(at, at + step);
      const data = new AudioData({ format: "f32-planar", sampleRate: MIX_RATE, numberOfFrames: piece.length, numberOfChannels: 1, timestamp: Math.round((at / MIX_RATE) * 1e6), data: piece });
      audio.encode(data);
      data.close();
    }
    await audio.flush();
    audio.close();
  }
  if (failure) throw failure;
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4" };
}

/**
 * For browsers without WebCodecs: plays the video on a canvas and records it
 * as it plays (real time, WebM).
 */
export async function exportRecording(project: Project, timeline: Timeline, options: ExportOptions, onProgress: (share: number) => void, signal?: AbortSignal): Promise<Exported> {
  const { quality, fps: FPS, assets } = options;
  const { width, height, k } = pixelSize(project, quality);
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || typeof MediaRecorder === "undefined" || !canvas.captureStream) throw new Error("This browser can't record video. Please use Chrome, Edge or a recent Safari.");
  const stream = canvas.captureStream(FPS);
  const audioCtx = new AudioContext({ sampleRate: MIX_RATE });
  let source: AudioBufferSourceNode | null = null;
  if (timeline.audio) {
    const buffer = audioCtx.createBuffer(1, timeline.audio.length, MIX_RATE);
    buffer.getChannelData(0).set(timeline.audio);
    const dest = audioCtx.createMediaStreamDestination();
    source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(dest);
    for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
  }
  const mime = ["video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: Math.round(width * height * FPS * 0.12) });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawFrame(ctx, project, timeline, 0, assets);
  const bgVideo = activeVideo(project, assets);
  if (bgVideo) {
    await seekVideo(bgVideo, videoTimeAt(project, bgVideo, 0));
    void bgVideo.play().catch(() => {});
  }
  recorder.start(500);
  const began = audioCtx.currentTime;
  source?.start();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      const t = audioCtx.currentTime - began;
      if (signal?.aborted) return reject(new DOMException("Stopped", "AbortError"));
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawFrame(ctx, project, timeline, Math.min(t, timeline.duration), assets);
      onProgress(Math.min(1, t / timeline.duration));
      if (t >= timeline.duration) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  }).finally(() => {
    bgVideo?.pause();
    recorder.stop();
    void audioCtx.close();
  });
  await stopped;
  return { blob: new Blob(chunks, { type: mime.split(";")[0] || "video/webm" }), ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
}

/** The subtitles as an .srt file, for uploading with the video. */
export function toSrt(timeline: Timeline): string {
  const stamp = (s: number) => {
    const ms = Math.round(s * 1000);
    const p = (n: number, w = 2) => String(n).padStart(w, "0");
    return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  return timeline.spans.map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.line.caption}\n`).join("\n");
}
