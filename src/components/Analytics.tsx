"use client";

import { useEffect } from "react";
import { startAnalytics } from "@/lib/firebase";

/** Starts Google Analytics (through Firebase) once the page is in the browser. */
export function Analytics() {
  useEffect(() => {
    void startAnalytics().catch(() => {});
  }, []);
  return null;
}
