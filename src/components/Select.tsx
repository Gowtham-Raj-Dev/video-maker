"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface Option<T extends string | number> {
  value: T;
  label: string;
  /** A second, quieter line. */
  hint?: string;
  icon?: ReactNode;
  group?: string;
}

interface Props<T extends string | number> {
  value: T | null;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  ariaLabel: string;
  /** Shown when nothing is chosen, and for menus that act instead of holding a value. */
  placeholder?: string;
  search?: boolean;
  leading?: ReactNode;
  small?: boolean;
}

/** A dropdown that looks the same in every browser: keyboard, search, icons and groups. */
export function Select<T extends string | number>({ value, onChange, options, ariaLabel, placeholder, search, leading, small }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const chosen = options.find((o) => o.value === value) ?? null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = (focus = true) => {
    setOpen(false);
    setQuery("");
    if (focus) buttonRef.current?.focus();
  };

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  // Under the button, or above it when there is more room there; never off the screen.
  useLayoutEffect(() => {
    if (!open) return;
    const fit = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const width = Math.min(Math.max(r.width, 230), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      if (below >= 240 || below >= above) setPlace({ left, width, top: r.bottom + 6, maxHeight: Math.min(380, below) });
      else setPlace({ left, width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(380, above) });
    };
    fit();
    const onScroll = (e: Event) => {
      if (popRef.current?.contains(e.target as Node)) return;
      fit();
    };
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (popRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open, place]);

  const pick = (o: Option<T>) => {
    onChange(o.value);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(shown.length - 1);
    } else if (e.key === "Enter" || (e.key === " " && !search)) {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  let lastGroup: string | undefined;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="sel-btn"
        style={small ? { minHeight: 34, fontSize: 13.5 } : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${ariaLabel}${chosen ? `: ${chosen.label}` : ""}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        {leading ?? chosen?.icon}
        <span className="sel-text">
          {chosen && !placeholder ? chosen.label : placeholder ?? "Choose…"}
          {chosen?.hint && !placeholder && <span className="sel-hint"> · {chosen.hint}</span>}
        </span>
        <ChevronDown size={16} aria-hidden="true" style={{ flex: "none", opacity: 0.6, transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      {open && place && createPortal(
        <div ref={popRef} className="sel-pop" style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }} onKeyDown={onKey}>
          {search && (
            <input
              autoFocus
              className="field sel-search"
              placeholder="Search…"
              aria-label={`Search ${ariaLabel}`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          )}
          <div ref={(el) => { listRef.current = el; if (el && !search) el.focus(); }} id={id} className="sel-list" role="listbox" aria-label={ariaLabel} tabIndex={-1}>
            {shown.length === 0 && <div className="hint" style={{ padding: 10 }}>Nothing matches.</div>}
            {shown.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <div key={String(o.value)}>
                  {header && <div className="sel-group">{header}</div>}
                  <div
                    className="sel-opt"
                    role="option"
                    aria-selected={o.value === value}
                    data-active={i === active}
                    onPointerMove={() => setActive(i)}
                    onClick={() => pick(o)}
                  >
                    {o.icon}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {o.label}
                      {o.hint && <small>{o.hint}</small>}
                    </span>
                    {o.value === value && <Check size={16} aria-hidden="true" style={{ flex: "none" }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
