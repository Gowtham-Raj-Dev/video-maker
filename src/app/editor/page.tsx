import type { Metadata } from "next";
import { Editor } from "@/components/Editor";

export const metadata: Metadata = {
  title: { absolute: "Free AI Video Maker Online – Editor | CodeLove" },
  description:
    "Free online AI video maker: write a script, pick characters or text-only, add AI voices, subtitles and music, and export an MP4 for Shorts, Reels and YouTube. No watermark.",
  alternates: { canonical: "/editor/" },
  openGraph: {
    title: "Free AI Video Maker – Editor | CodeLove",
    description: "Write a script and get a talking cartoon or text video with AI voices, subtitles and music. Free, no watermark.",
    url: "/editor/",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function EditorPage() {
  return <Editor />;
}
