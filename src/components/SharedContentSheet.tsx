// src/components/SharedContentSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Shared content receiver (cat19)
//
// Mounted when ?screen=share-receive is in the URL. The PWA share_target
// intent (declared in manifest.webmanifest) POSTs into the service worker
// (src/sw.ts), which stashes any uploaded screenshot in the "share-staging"
// cache and 303s here with a ?share_id=… token.
//
// We read the stash, offer "Attach to a new trade" (jumps to the log view
// with the file pre-attached) or "Dismiss". Caches are cleaned up on exit.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import type { Theme } from "../theme";
import { BODY, DISPLAY, MONO, KodaMark } from "../shared";

interface ShareMeta {
  id:      string;
  title:   string;
  text:    string;
  url:     string;
  hasFile: boolean;
}

interface Props {
  C: Theme;
  onAttachToTrade: (file: File | null, text: string) => void;
  onClose: () => void;
}

export function SharedContentSheet({ C, onAttachToTrade, onClose }: Props) {
  const [meta, setMeta]   = useState<ShareMeta | null>(null);
  const [file, setFile]   = useState<File | null>(null);
  const [preview, setPrev] = useState<string | null>(null);
  const [err, setErr]     = useState(false);

  useEffect(() => {
    let mounted = true;
    let revoke: string | null = null;
    (async () => {
      try {
        const id = new URLSearchParams(window.location.search).get("share_id");
        if (!id) { setErr(true); return; }
        const cache = await caches.open("share-staging");
        const metaRes = await cache.match(`/__share/${id}.json`);
        if (!metaRes) { setErr(true); return; }
        const m = (await metaRes.json()) as ShareMeta;
        if (!mounted) return;
        setMeta(m);

        if (m.hasFile) {
          const blobRes = await cache.match(`/__share/${id}.blob`);
          if (blobRes) {
            const blob = await blobRes.blob();
            const f = new File([blob], "shared-screenshot.png", { type: blob.type || "image/png" });
            if (!mounted) return;
            setFile(f);
            revoke = URL.createObjectURL(f);
            setPrev(revoke);
          }
        }
      } catch {
        if (mounted) setErr(true);
      }
    })();
    return () => {
      mounted = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, []);

  async function cleanup() {
    try {
      if (!meta) return;
      const cache = await caches.open("share-staging");
      await cache.delete(`/__share/${meta.id}.json`);
      await cache.delete(`/__share/${meta.id}.blob`);
    } catch { /* noop */ }
    window.history.replaceState({}, "", window.location.pathname);
  }

  function attach() {
    onAttachToTrade(file, meta?.text ?? "");
    void cleanup();
  }
  function dismiss() {
    onClose();
    void cleanup();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9100,
        background: C.bg, color: C.text,
        display: "flex", flexDirection: "column",
        padding: "max(22px, env(safe-area-inset-top)) 22px 22px",
        boxSizing: "border-box", overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <KodaMark size={20} color={C.text} />
        <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, letterSpacing: "0.22em", color: C.text }}>
          Kōda
        </span>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: C.muted, textTransform: "uppercase", marginTop: 24 }}>
        Shared with Kōda
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 26, fontWeight: 600,
        letterSpacing: "-0.03em", color: C.text, marginTop: 6, lineHeight: 1.1,
      }}>
        {err ? "Couldn't read shared content" : "Attach to a trade?"}
      </div>

      {!err && (
        <div style={{ fontSize: 13.5, color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY }}>
          {file ? "We'll open the trade form with this screenshot pre-attached." : "We received some text — open the trade form to use it as notes."}
        </div>
      )}

      {preview && (
        <div style={{
          marginTop: 22, borderRadius: 16, overflow: "hidden",
          border: `1px solid ${C.border2}`, background: C.surface,
        }}>
          <img src={preview} alt="Shared screenshot" style={{
            display: "block", width: "100%", maxHeight: 360, objectFit: "contain", background: "#000",
          }} />
        </div>
      )}

      {meta?.text && (
        <div style={{
          marginTop: 18, padding: 14, borderRadius: 14,
          background: C.surface, border: `1px solid ${C.line}`,
          fontFamily: BODY, fontSize: 13, color: C.text2, lineHeight: 1.55,
        }}>
          {meta.text}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        {!err && (
          <button onClick={attach} style={{
            padding: "13px 22px", borderRadius: 999,
            background: C.live, color: "#0A0A0A", border: "none",
            fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
          }}>
            Attach to a new trade
          </button>
        )}
        <button onClick={dismiss} style={{
          padding: "13px 22px", borderRadius: 999,
          background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
          fontFamily: BODY, fontSize: 14, fontWeight: 500, cursor: "pointer", width: "100%",
        }}>
          {err ? "Back" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
