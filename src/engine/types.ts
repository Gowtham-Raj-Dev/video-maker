export type Mood = "normal" | "happy" | "sad" | "shocked" | "sleep" | "proud" | "deadpan" | "angry";
export type Arm = "down" | "hold" | "point" | "up" | "facepalm" | "clasp";
export type Format = "9:16" | "16:9" | "1:1";
export type SubtitleStyle = "pop" | "box" | "karaoke" | "clean" | "off";
export type SubtitlePosition = "top" | "middle" | "bottom";
export type MusicId = "none" | "funny" | "chill" | "smooth" | "suspense" | "custom";
/** "characters": cartoon people act the lines; "captions": no people, just big subtitles on a plain screen (or a scene). */
export type VideoMode = "characters" | "captions";
export type CameraStyle = "still" | "calm" | "dynamic";

/** Things the visitor brought that don't fit in a saved project: they last until the page is closed. */
export interface Assets {
  bgImage: CanvasImageSource | null;
  bgSize: [number, number];
  /** Mono, at MIX_RATE. */
  music: Float32Array | null;
}
export type LanguageId = "tamil" | "tanglish" | "english" | "telugu" | "hindi" | "hinglish";

/** One spoken line of the script. */
export interface Line {
  /** The name written in the script. */
  speaker: string;
  /** What the voice says. */
  text: string;
  /** What the subtitle shows (the text after "|"), the spoken text when not given. */
  caption: string;
  mood?: Mood;
  /** A background set from this line on ("[bg: park]" in the script). */
  bg?: string;
}

/** Who plays a name from the script. */
export interface CastMember {
  name: string;
  characterId: string;
  voice: string;
}

export interface Project {
  mode: VideoMode;
  /** The screen's colour when the background is "plain". */
  plainColor: string;
  script: string;
  cast: CastMember[];
  language: LanguageId;
  format: Format;
  background: string;
  subtitleStyle: SubtitleStyle;
  subtitlePosition: SubtitlePosition;
  subtitleSize: number;
  showNames: boolean;
  title: string;
  handle: string;
  music: MusicId;
  musicVolume: number;
  sfx: boolean;
  punch: boolean;
  /** "batch": few requests, cut back into lines; "line": one request a line. */
  voiceMode: "batch" | "line";
  /** The colour of the word being spoken. */
  highlight: string;
  upper: boolean;
  camera: CameraStyle;
  /** The people's size, 1 as designed. */
  charScale: number;
  /** Seconds of quiet between lines. */
  lineGap: number;
  progressBar: boolean;
  /** Words shown after the last line, empty for none. */
  endCard: string;
}

/** A line placed in time, with its mouth movement. */
export interface Span {
  line: Line;
  start: number;
  end: number;
  /** Mouth opening 0–1, ENVELOPE_RATE values a second from `start`. */
  envelope: Float32Array;
  /** Mouth width 0–1 (round to wide), on the same clock. */
  shape: Float32Array;
}

export interface Timeline {
  spans: Span[];
  duration: number;
  /** The mixed sound, mono at MIX_RATE; null for a silent preview. */
  audio: Float32Array | null;
  /** True when made without a voice (estimated lengths). */
  silent: boolean;
}

export const ENVELOPE_RATE = 60;
export const MIX_RATE = 48_000;
export const FPS = 30;
