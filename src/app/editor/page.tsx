import type { Metadata } from "next";
import { Editor } from "@/components/Editor";

export const metadata: Metadata = {
  title: "Editor — make a talking cartoon video",
  description: "Write the script, pick the cast, the scene and the captions, record the voices with your Gemini key and export an MP4.",
  alternates: { canonical: "/editor/" },
};

export default function EditorPage() {
  return <Editor />;
}
