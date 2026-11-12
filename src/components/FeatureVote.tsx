"use client";

import { Check, Loader2, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { GOAL, hasRequested, requestFeature, watchCount, type Feature } from "@/lib/requests";

/** "When 100 people ask, we build it": a live count from Firestore and one "I want this" per browser. */
export function FeatureVote({ feature, compact = false }: { feature: Feature; compact?: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  useEffect(() => {
    setAsked(hasRequested(feature));
    return watchCount(feature, setCount, () => setCount(null));
  }, [feature]);

  const ask = async () => {
    setState("sending");
    try {
      await requestFeature(feature);
      setAsked(true);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const shown = count ?? 0;
  const left = Math.max(0, GOAL - shown);
  return (
    <div className={`vote${compact ? " vote-compact" : ""}`}>
      <div className="vote-row">
        <span className="vote-count">
          <b>{count === null ? "…" : shown}</b> / {GOAL} want this
        </span>
        <span className="vote-left">{left > 0 ? `${left} more and we build it` : "Goal reached — being built!"}</span>
      </div>
      <div className="vote-bar" role="progressbar" aria-valuemin={0} aria-valuemax={GOAL} aria-valuenow={shown} aria-label="People who want this">
        <i style={{ width: `${Math.min(100, (shown / GOAL) * 100)}%` }} />
      </div>
      {asked ? (
        <p className="vote-done"><Check size={15} /> You want this — thank you!</p>
      ) : (
        <button type="button" className={`btn ${compact ? "btn-sm" : "btn-primary"}`} disabled={state === "sending"} onClick={ask}>
          {state === "sending" ? <Loader2 size={15} className="animate-spin" /> : <ThumbsUp size={15} />} I want this
        </button>
      )}
      {state === "error" && <p className="note note-error" style={{ margin: 0 }}>Couldn&apos;t save right now. Check your connection and try again.</p>}
    </div>
  );
}
