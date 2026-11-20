"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Loads the AdSense tag after hydration (rendered straight into <head> it injects extra <script>
 * elements before React hydrates, which shows up as a hydration mismatch). Skipped on the editor,
 * so Auto ads can't place anything over the canvas or the timeline.
 */
export default function AdSenseScript({ client }: { client: string }) {
  const path = usePathname() || "/";
  useEffect(() => {
    if (path.startsWith("/editor")) return;
    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, [client, path]);
  return null;
}
