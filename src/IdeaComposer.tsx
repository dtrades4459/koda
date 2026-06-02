import { type CSSProperties, useState, useRef } from "react";
import type { Idea, IdeaCreateInput, Trade } from "./types";
import { MONO, BODY, DISPLAY, compressImage } from "./shared";

interface IdeaComposerProps {
  open: boolean;
  onClose: () => void;
  onPosted: (idea: Idea) => void;
  recentTrades: Trade[];
  myUid: string;
  C: Record<string, string>;
  inp: CSSProperties;
  pillPrimary: (active: boolean) => CSSProperties;
  isDesktop: boolean;
  supabaseUploadChart: (file: Blob, filename: string) => Promise<string>;
  authToken: string;
}

const TYPES = ["post", "pre"] as const;
const DIRECTIONS = ["long", "short", "neutral"] as const;

export function IdeaComposer({
  open, onClose, onPosted, recentTrades, myUid: _myUid, C, inp, pillPrimary, isDesktop,
  supabaseUploadChart, authToken,
}: IdeaComposerProps) {
  const [type, setType] = useState<"pre" | "post">("post");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [instrument, setInstrument] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [direction, setDirection] = useState<"long" | "short" | "neutral">("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [chartFile, setChartFile] = useState<File | null>(null);
  const [linkedTradeId, setLinkedTradeId] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const reset = () => {
    setType("post"); setTitle(""); setBodyText(""); setInstrument(""); setTimeframe("");
    setDirection("long"); setEntry(""); setStop(""); setTarget("");
    setChartFile(null); setLinkedTradeId(null); setError(null); setPosting(false);
  };

  const canPost = title.trim().length > 0
    && bodyText.trim().length > 0
    && instrument.trim().length > 0;

  async function handlePost() {
    if (!canPost || posting) return;
    setPosting(true);
    setError(null);
    try {
      let chartUrl: string | null = null;
      if (chartFile) {
        const dataUri = await compressImage(chartFile, 1600);
        const res = await fetch(dataUri);
        const blob = await res.blob();
        const filename = `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        chartUrl = await supabaseUploadChart(blob, filename);
      }

      const payload: IdeaCreateInput = {
        type, title: title.trim(), body: bodyText.trim(),
        instrument: instrument.trim().toUpperCase(),
        timeframe: timeframe.trim() || null,
        direction,
        entryPrice: entry.trim() || null,
        stopPrice: stop.trim() || null,
        targetPrice: target.trim() || null,
        chartUrl,
        linkedTradeId: type === "post" ? linkedTradeId : null,
      };

      const resp = await fetch("/api/ideas?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      const data = await resp.json() as { idea?: Idea; error?: string };
      if (!resp.ok || !data.idea) throw new Error(data.error ?? "Failed to post");
      onPosted(data.idea);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  const backdropStyle: CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    // Above the bottom-nav (z-index 30) AND the Feedback FAB (z-index 998).
    zIndex: 1000, display: "flex",
    alignItems: isDesktop ? "center" : "flex-end",
    justifyContent: "center",
  };

  const panelStyle: CSSProperties = {
    background: C.bg ?? "#0f0f14",
    border: `1px solid ${C.border2 ?? C.border}`,
    borderRadius: isDesktop ? "18px" : "18px 18px 0 0",
    width: "100%",
    maxWidth: isDesktop ? "560px" : "100%",
    maxHeight: isDesktop ? "90vh" : "92vh",
    overflowY: "auto",
    // Extra bottom padding on mobile so the Post button clears the bottom-nav
    // pill (which sits at the same position with a lower z-index but still
    // pulls the eye). Desktop keeps the original tight padding.
    padding: isDesktop
      ? "18px 18px calc(24px + env(safe-area-inset-bottom))"
      : "18px 18px calc(110px + env(safe-area-inset-bottom))",
    display: "flex", flexDirection: "column", gap: "12px",
  };

  const segBtn = (id: "pre" | "post"): CSSProperties => ({
    flex: 1, padding: "8px 12px",
    background: type === id ? C.text : "transparent",
    color: type === id ? C.bg : C.text,
    border: `1px solid ${C.border2 ?? C.border}`,
    borderRadius: "8px", cursor: "pointer",
    fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  });

  const labelStyle: CSSProperties = {
    fontFamily: MONO, fontSize: "9px", color: C.muted,
    letterSpacing: "0.16em", textTransform: "uppercase" as const,
    marginBottom: "4px",
  };

  return (
    <div data-testid="idea-composer" style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 600, color: C.text }}>New Idea</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.muted, fontSize: "20px", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={segBtn(t)}>
              {t === "pre" ? "Pre-trade" : "Post-trade"}
            </button>
          ))}
        </div>

        <div>
          <div style={labelStyle}>Title</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. NQ break above VWAP" maxLength={120} style={{ ...inp, margin: 0, width: "100%" }} />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 2 }}>
            <div style={labelStyle}>Instrument</div>
            <input value={instrument} onChange={e => setInstrument(e.target.value)} placeholder="NQ" maxLength={32} style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Direction</div>
            <select value={direction} onChange={e => setDirection(e.target.value as "long" | "short" | "neutral")} style={{ ...inp, margin: 0, width: "100%" }}>
              {DIRECTIONS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Timeframe</div>
            <input value={timeframe} onChange={e => setTimeframe(e.target.value)} placeholder="15m" maxLength={16} style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Entry</div>
            <input value={entry} onChange={e => setEntry(e.target.value)} placeholder="—" inputMode="decimal" style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Stop</div>
            <input value={stop} onChange={e => setStop(e.target.value)} placeholder="—" inputMode="decimal" style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Target</div>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="—" inputMode="decimal" style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Analysis</div>
          <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder="Write your analysis..."
            maxLength={4000} rows={6}
            style={{ ...inp, margin: 0, width: "100%", fontFamily: BODY, lineHeight: 1.5, resize: "vertical" }} />
        </div>

        <div>
          <div style={labelStyle}>Chart image (optional)</div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%", padding: "12px",
              background: "transparent",
              border: `1px dashed ${C.border2 ?? C.border}`,
              borderRadius: "10px",
              fontFamily: MONO, fontSize: "11px", color: C.muted, cursor: "pointer",
            }}>
            {chartFile ? `📎 ${chartFile.name}` : "📎 Attach chart"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={e => setChartFile(e.target.files?.[0] ?? null)} />
        </div>

        {type === "post" && recentTrades.length > 0 && (
          <div>
            <div style={labelStyle}>Link trade (optional)</div>
            <select
              value={linkedTradeId ?? ""}
              onChange={e => setLinkedTradeId(e.target.value ? Number(e.target.value) : null)}
              style={{ ...inp, margin: 0, width: "100%" }}
            >
              <option value="">— none —</option>
              {recentTrades.slice(0, 10).map(t => (
                <option key={t.id} value={t.id}>
                  {t.date} · {t.pair} · {t.direction?.toUpperCase() ?? ""} · {t.outcome}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div style={{ fontFamily: BODY, fontSize: "12px", color: C.red ?? "#f87171" }}>{error}</div>
        )}

        <button
          onClick={handlePost}
          disabled={!canPost || posting}
          style={{ ...pillPrimary(canPost && !posting), width: "100%", padding: "12px", opacity: !canPost || posting ? 0.55 : 1 }}>
          {posting ? "Posting…" : "Post Idea"}
        </button>
      </div>
    </div>
  );
}
