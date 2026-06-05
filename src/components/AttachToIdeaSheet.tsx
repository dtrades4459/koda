// src/components/AttachToIdeaSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Attach a trade to one of your existing Ideas (cat03)
//
// Bottom-sheet picker. Lists the caller's recent post-trade Ideas; tapping
// one POSTs { ideaId, tradeId } to /api/ideas?action=attach-trade and closes.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import type { Theme } from "../theme";
import type { Idea } from "../types";
import { MONO, BODY, DISPLAY } from "../shared";
import { supabase } from "../lib/supabase";

interface Props {
  C: Theme;
  tradeId: number;
  myUid: string;
  onClose: () => void;
  onAttached?: (ideaId: string) => void;
}

export function AttachToIdeaSheet({ C, tradeId, myUid, onClose, onAttached }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? "";
        const res = await fetch("/api/ideas?action=list&limit=20", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { ideas: Idea[] };
        if (cancelled) return;
        // Only the caller's own post-trade ideas can have linked_trade_id set.
        setIdeas((json.ideas ?? []).filter(i => i.authorUid === myUid && i.type === "post"));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [myUid]);

  async function attach(ideaId: string) {
    setBusy(ideaId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/ideas?action=attach-trade", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ ideaId, tradeId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onAttached?.(ideaId);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to attach");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9300,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 14, animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          borderRadius: 24, background: C.panel,
          border: `1px solid ${C.border2}`,
          padding: 24, maxHeight: "80dvh", overflowY: "auto",
          animation: "kSlideIn 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: C.muted, textTransform: "uppercase" }}>
          Attach to idea
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", color: C.text, marginTop: 8 }}>
          Pick one of your <span style={{ fontStyle: "italic", fontWeight: 500, color: C.live }}>ideas.</span>
        </div>
        <div style={{ fontSize: 12.5, color: C.text2, marginTop: 6, lineHeight: 1.5, fontFamily: BODY }}>
          Only post-trade ideas you authored are listed. Tap one to link this trade to it.
        </div>

        {loading && (
          <div style={{ padding: "32px 0", textAlign: "center", color: C.muted, fontSize: 13, fontFamily: BODY }}>
            Loading…
          </div>
        )}

        {err && !loading && (
          <div style={{
            padding: 14, borderRadius: 12, marginTop: 16,
            background: `color-mix(in oklch, ${C.red} 8%, transparent)`,
            border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
            color: C.text2, fontSize: 13, fontFamily: BODY,
          }}>
            {err}
          </div>
        )}

        {!loading && !err && ideas.length === 0 && (
          <div style={{
            marginTop: 18, padding: "22px 16px", borderRadius: 14,
            background: C.surface, border: `1px solid ${C.line}`,
            textAlign: "center", fontSize: 13, color: C.text2, fontFamily: BODY,
          }}>
            No post-trade ideas yet. Write one first from the Ideas tab.
          </div>
        )}

        {!loading && ideas.length > 0 && (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {ideas.map(i => (
              <button
                key={i.id}
                onClick={() => attach(i.id)}
                disabled={busy !== null}
                style={{
                  display: "block", textAlign: "left", width: "100%",
                  padding: 14, borderRadius: 14,
                  background: C.surface, border: `1px solid ${C.line}`,
                  cursor: busy ? "wait" : "pointer", opacity: busy && busy !== i.id ? 0.5 : 1,
                  transition: "border-color 0.12s, transform 0.12s",
                  fontFamily: BODY,
                }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.live; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.line; }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
                  {i.title || "(untitled idea)"}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", marginTop: 4 }}>
                  {i.instrument} · {i.direction.toUpperCase()} · {new Date(i.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {i.linkedTradeId !== null && (
                    <span style={{ marginLeft: 8, color: C.warn }}>· already linked to #{i.linkedTradeId}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 18, padding: "13px 22px", borderRadius: 999,
            background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: 14, fontWeight: 500, cursor: "pointer", width: "100%",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
