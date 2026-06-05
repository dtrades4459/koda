// src/components/MentionAutocomplete.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · @mention autocomplete (cat04)
//
// Floating dropdown that detects `@xxx` at the end of a composer textarea,
// matches against a list of known handles, and inserts on click/Enter. Stays
// keyboard-friendly (↑ / ↓ / Enter / Esc).
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import type { Theme } from "../theme";
import { MONO, BODY } from "../shared";

export interface MentionCandidate {
  handle: string;
  name?: string;
}

interface Props {
  C: Theme;
  text: string;                              // current composer text
  candidates: MentionCandidate[];            // all possible mentions
  onPick: (next: string) => void;            // returns the next composer text after insertion
}

export function MentionAutocomplete({ C, text, candidates, onPick }: Props) {
  const [highlight, setHighlight] = useState(0);

  // Detect a trailing `@token` (where token can be letters/digits/_).
  const match = useMemo(() => {
    const m = text.match(/(^|\s)@([A-Za-z0-9_]*)$/);
    if (!m) return null;
    return { token: m[2], start: text.length - m[2].length - 1 };
  }, [text]);

  const filtered = useMemo(() => {
    if (!match) return [];
    const t = match.token.toLowerCase();
    return candidates
      .filter(c => c.handle.toLowerCase().startsWith(t))
      .slice(0, 6);
  }, [match, candidates]);

  useEffect(() => { setHighlight(0); }, [match?.token]);

  useEffect(() => {
    if (!match || filtered.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => (h + 1) % filtered.length); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setHighlight(h => (h - 1 + filtered.length) % filtered.length); }
      else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        pick(filtered[highlight].handle);
      }
      else if (e.key === "Escape") { /* parent's onBlur will clear */ }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [match, filtered, highlight]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!match || filtered.length === 0) return null;

  function pick(handle: string) {
    if (!match) return;
    const before = text.slice(0, match.start);
    const next   = `${before}@${handle} `;
    onPick(next);
  }

  return (
    <div style={{
      position: "absolute", bottom: "calc(100% + 6px)", left: 0,
      minWidth: 200, maxWidth: 320,
      background: C.panel, border: `1px solid ${C.border2}`,
      borderRadius: 12, padding: 4,
      boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
      zIndex: 9200,
      animation: "kSlideIn 0.18s ease-out",
    }}>
      {filtered.map((c, i) => (
        <button
          key={c.handle}
          onMouseDown={e => { e.preventDefault(); pick(c.handle); }}
          onMouseEnter={() => setHighlight(i)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "8px 10px", borderRadius: 8,
            background: i === highlight ? C.surface : "transparent",
            border: "none", cursor: "pointer", textAlign: "left",
            fontFamily: BODY, color: C.text,
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: "50%",
            background: C.surface, border: `1px solid ${C.border2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: C.text2, flexShrink: 0,
          }}>
            {c.handle.charAt(0).toUpperCase()}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>@{c.handle}</span>
          {c.name && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginLeft: "auto" }}>
              {c.name}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
