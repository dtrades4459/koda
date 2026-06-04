import { useEffect, useMemo, useRef, useState } from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY } from "../shared";

// ═══════════════════════════════════════════════════════════════════════════
// Command palette + keyboard shortcuts (cat18)
//
// Exports:
//   • CommandPalette — ⌘K / Ctrl+K overlay (fuzzy filter, keyboard nav)
//   • useCommandPalette() — hook that returns { open, setOpen, ... } and binds ⌘K
//   • KeyboardShortcutsOverlay — ? overlay listing every shortcut
//   • useGlobalShortcut(key, handler) — bind a single shortcut
//
// Design tokens are from `theme.ts`. The palette is dark by default
// since it sits over any screen, but inherits accent colours from C.
// ═══════════════════════════════════════════════════════════════════════════

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  shortcut?: string;
  icon?: string; // emoji or unicode
  action: () => void;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}
const META = isMac() ? "⌘" : "Ctrl";

// ─── useCommandPalette hook ────────────────────────────────────────────────
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (cmdK) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);
  return { open, setOpen, toggle: () => setOpen(o => !o) };
}

// ─── useGlobalShortcut ─────────────────────────────────────────────────────
export function useGlobalShortcut(combo: string, handler: () => void) {
  useEffect(() => {
    const parts = combo.toLowerCase().split("+").map(s => s.trim());
    const wantMeta = parts.includes("cmd") || parts.includes("meta") || parts.includes("ctrl");
    const wantShift = parts.includes("shift");
    const wantAlt = parts.includes("alt") || parts.includes("option");
    const key = parts.filter(p => !["cmd", "ctrl", "meta", "shift", "alt", "option"].includes(p))[0] ?? "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key) return;
      if (wantMeta && !(e.metaKey || e.ctrlKey)) return;
      if (wantShift && !e.shiftKey) return;
      if (wantAlt && !e.altKey) return;
      // Don't fire shortcuts while typing
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, handler]);
}

// ─── CommandPalette ────────────────────────────────────────────────────────
function fuzzyScore(needle: string, hay: string): number {
  if (!needle) return 1;
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  if (h.includes(n)) return 1 - h.indexOf(n) / Math.max(20, h.length);
  let nIdx = 0;
  for (let i = 0; i < h.length && nIdx < n.length; i++) {
    if (h[i] === n[nIdx]) nIdx++;
  }
  return nIdx === n.length ? 0.4 : 0;
}

export function CommandPalette({
  C, open, onClose, commands, placeholder = "Search commands…",
}: {
  C: Theme;
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands
      .map(c => ({ c, score: Math.max(fuzzyScore(query, c.label), fuzzyScore(query, c.hint ?? "")) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.c);
  }, [query, commands]);

  const grouped = useMemo(() => {
    const groups: Record<string, PaletteCommand[]> = {};
    filtered.forEach(c => {
      const g = c.group ?? "Commands";
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    return groups;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[activeIdx];
        if (cmd) {
          cmd.action();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIdx, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(10,10,11,0.72)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "calc(80px + env(safe-area-inset-top)) 16px 16px",
        animation: "kFadeIn 0.18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 620, borderRadius: 20,
          background: C.panel, border: `1px solid ${C.border2}`,
          overflow: "hidden",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
          animation: "kRise 0.22s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px", borderBottom: `1px solid ${C.line}`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke={C.muted} strokeWidth="1.6" />
            <path d="M16 16l4.5 4.5" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder={placeholder}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: BODY, fontSize: 16, color: C.text, padding: 0,
            }}
          />
          <kbd style={{
            fontFamily: MONO, fontSize: 10, padding: "3px 7px", borderRadius: 6,
            background: C.surfaceHi, color: C.muted, border: `1px solid ${C.line2}`,
            letterSpacing: "0.06em",
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{ maxHeight: "60vh", overflowY: "auto", padding: 6 }}
        >
          {filtered.length === 0 ? (
            <div style={{
              padding: "40px 20px", textAlign: "center",
              fontFamily: BODY, fontSize: 13, color: C.muted,
            }}>
              No commands match "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div style={{
                  fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em",
                  color: C.muted, textTransform: "uppercase",
                  padding: "12px 14px 6px",
                }}>
                  {group}
                </div>
                {items.map(cmd => {
                  const isActive = filtered[activeIdx]?.id === cmd.id;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => { cmd.action(); onClose(); }}
                      onMouseEnter={() => setActiveIdx(filtered.indexOf(cmd))}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        width: "100%", padding: "10px 14px", borderRadius: 10,
                        background: isActive ? C.accentSoft : "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                      }}
                    >
                      {cmd.icon && (
                        <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>
                          {cmd.icon}
                        </span>
                      )}
                      <span style={{
                        flex: 1, fontFamily: BODY, fontSize: 14, color: C.text,
                      }}>
                        {cmd.label}
                      </span>
                      {cmd.hint && (
                        <span style={{
                          fontFamily: BODY, fontSize: 12, color: C.text2,
                        }}>
                          {cmd.hint}
                        </span>
                      )}
                      {cmd.shortcut && (
                        <kbd style={{
                          fontFamily: MONO, fontSize: 10, padding: "3px 7px",
                          borderRadius: 6, background: C.surfaceHi, color: C.muted,
                          border: `1px solid ${C.line2}`, letterSpacing: "0.06em",
                        }}>
                          {cmd.shortcut.replace(/cmd|meta/gi, META)}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", borderTop: `1px solid ${C.line}`,
          background: C.surfaceHi,
        }}>
          <div style={{
            display: "flex", gap: 14, fontFamily: MONO, fontSize: 9,
            color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
          <span style={{
            fontFamily: MONO, fontSize: 9, color: C.muted, letterSpacing: "0.06em",
          }}>
            {META}+K
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── KeyboardShortcutsOverlay ─────────────────────────────────────────────
export interface ShortcutGroup {
  group: string;
  items: { combo: string; label: string }[];
}

export function KeyboardShortcutsOverlay({
  C, open, onClose, groups,
}: {
  C: Theme; open: boolean; onClose: () => void; groups: ShortcutGroup[];
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(10,10,11,0.72)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, animation: "kFadeIn 0.18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 720, maxHeight: "85vh",
          borderRadius: 20, background: C.panel, border: `1px solid ${C.border2}`,
          overflow: "hidden", display: "flex", flexDirection: "column",
          animation: "kRise 0.22s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${C.line}`,
        }}>
          <div>
            <div style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
              color: C.muted, textTransform: "uppercase",
            }}>
              Keyboard
            </div>
            <div style={{
              fontFamily: DISPLAY, fontSize: 22, fontWeight: 600,
              letterSpacing: "-0.02em", color: C.text, marginTop: 4,
            }}>
              Shortcuts
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: C.surface, border: `1px solid ${C.border2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6l-12 12" stroke={C.text} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div style={{
          flex: 1, overflowY: "auto", padding: "8px 12px",
          display: "grid", gridTemplateColumns: "1fr", gap: 12,
        }}>
          {groups.map(g => (
            <div key={g.group} style={{ padding: 12 }}>
              <div style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em",
                color: C.muted, textTransform: "uppercase", marginBottom: 8,
              }}>
                {g.group}
              </div>
              {g.items.map(item => (
                <div
                  key={item.combo}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 8px", borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  <span style={{ fontFamily: BODY, fontSize: 13, color: C.text }}>
                    {item.label}
                  </span>
                  <span style={{ display: "flex", gap: 4 }}>
                    {item.combo.replace(/cmd|meta/gi, META).split("+").map((k, i) => (
                      <kbd
                        key={i}
                        style={{
                          fontFamily: MONO, fontSize: 10,
                          padding: "3px 8px", borderRadius: 6,
                          background: C.surfaceHi, color: C.text,
                          border: `1px solid ${C.line2}`,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { META as KbdMetaSymbol };
