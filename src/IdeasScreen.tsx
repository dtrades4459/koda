import { type CSSProperties, useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Idea, Trade } from "./types";
import { MONO, BODY, DISPLAY } from "./shared";
import { IdeaCard } from "./components/IdeaCard";
import { IdeaComposer } from "./IdeaComposer";

interface IdeasScreenProps {
  myUid: string;
  recentTrades: Trade[];
  C: Record<string, string>;
  inp: CSSProperties;
  pillPrimary: (active: boolean) => CSSProperties;
  isDesktop: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
// Same placeholder-fallback pattern as src/lib/supabase.ts — without it,
// createClient throws "supabaseUrl is required" at module-eval time when
// env vars are missing, which crashes React mount before any UI can render.
const supabase = createClient(
  SUPABASE_URL || "http://localhost:54321",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
);

async function uploadChart(file: Blob, filename: string, userId: string): Promise<string> {
  // Storage RLS (003_storage_bucket.sql) requires foldername[1] = auth.uid().
  // Previous path `ideas/{userId}/{filename}` put "ideas" at position [1] and
  // was silently rejected. UID-first matches the existing trade-screenshots
  // convention and keeps each user's uploads under one folder.
  const path = `${userId}/ideas/${filename}`;
  const { error } = await supabase.storage.from("trade-screenshots").upload(path, file, {
    contentType: "image/jpeg", upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("trade-screenshots").getPublicUrl(path);
  return data.publicUrl;
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function IdeasScreen({ myUid, recentTrades, C, inp, pillPrimary, isDesktop }: IdeasScreenProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chartLightbox, setChartLightbox] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await getToken();
      if (alive) setAuthToken(t);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setAuthToken(session?.access_token ?? "");
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const resp = await fetch(`/api/ideas?action=list&page=${pageToLoad}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await resp.json() as { ideas?: Idea[]; hasMore?: boolean; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Failed to load");
      setIdeas(prev => append ? [...prev, ...(data.ideas ?? [])] : (data.ideas ?? []));
      setHasMore(!!data.hasMore);
      setPage(pageToLoad);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load(0, false);
    })();
    return () => { alive = false; };
  }, [load]);

  async function handleLike(id: string) {
    const before = ideas.find(i => i.id === id);
    if (!before) return;
    setIdeas(prev => prev.map(i => i.id === id ? {
      ...i,
      likedByMe: !i.likedByMe,
      likeCount: i.likeCount + (i.likedByMe ? -1 : 1),
    } : i));
    try {
      const token = await getToken();
      const resp = await fetch("/api/ideas?action=like", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ ideaId: id }),
      });
      const data = await resp.json() as { liked?: boolean; count?: number; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Like failed");
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, likedByMe: !!data.liked, likeCount: data.count ?? i.likeCount } : i));
    } catch {
      setIdeas(prev => prev.map(i => i.id === id ? before : i));
    }
  }

  function handlePosted(idea: Idea) {
    setIdeas(prev => [idea, ...prev]);
  }

  const containerStyle: CSSProperties = { width: "100%", paddingBottom: "120px" };

  return (
    <div data-testid="ideas-screen" style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginBottom: "4px" }}>Public · Chronological</div>
          <div style={{ fontFamily: DISPLAY, fontSize: "22px", fontWeight: 500, color: C.text, letterSpacing: "-0.02em" }}>Ideas</div>
        </div>
        <button onClick={() => load(0, false)} disabled={loading}
          style={{ background: "none", border: `1px solid ${C.border2 ?? C.border}`, borderRadius: "999px", width: "32px", height: "32px", color: C.muted, cursor: "pointer" }}>
          &#8635;
        </button>
      </div>

      {loading && ideas.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
          {[180, 160, 140].map((w, i) => (
            <div key={i} style={{ borderRadius: "14px", padding: "14px", border: `1px solid ${C.border2 ?? C.border}`, background: `color-mix(in srgb, ${C.text} 3%, transparent)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%",
                  background: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2 ?? C.border} 50%, ${C.panel} 100%)`,
                  backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ height: 11, width: "40%", borderRadius: "6px",
                    background: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2 ?? C.border} 50%, ${C.panel} 100%)`,
                    backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />
                  <div style={{ height: 9, width: "22%", borderRadius: "6px",
                    background: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2 ?? C.border} 50%, ${C.panel} 100%)`,
                    backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />
                </div>
              </div>
              <div style={{ height: 12, width: `${w}px`, maxWidth: "100%", borderRadius: "6px", marginBottom: "8px",
                background: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2 ?? C.border} 50%, ${C.panel} 100%)`,
                backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />
              <div style={{ height: 10, width: "70%", borderRadius: "6px",
                background: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2 ?? C.border} 50%, ${C.panel} 100%)`,
                backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "14px" }}>💡</div>
          <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 500, color: C.text, marginBottom: "8px" }}>Nothing posted yet today.</div>
          <div style={{ fontFamily: BODY, fontSize: "14px", color: C.text2, maxWidth: 280, margin: "0 auto", lineHeight: 1.55 }}>Drop a setup before the open or a breakdown after the close. Either earns the spot.</div>
        </div>
      ) : (
        <>
          {ideas.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              expanded={expandedId === idea.id}
              C={C}
              onLike={handleLike}
              onExpand={(id) => setExpandedId(prev => prev === id ? null : id)}
              onOpenChart={(url) => setChartLightbox(url)}
            />
          ))}
          {hasMore && (
            <button onClick={() => load(page + 1, true)} disabled={loading}
              style={{ display: "block", margin: "16px auto", padding: "10px 22px",
                background: "transparent", border: `1px solid ${C.border2 ?? C.border}`, borderRadius: "999px",
                fontFamily: MONO, fontSize: "11px", color: C.muted, cursor: "pointer" }}>
              {loading ? "…" : "Load more"}
            </button>
          )}
        </>
      )}

      {error && <div style={{ padding: "10px 14px", color: C.red ?? "#f87171", fontFamily: BODY, fontSize: "12px" }}>{error}</div>}

      <button
        data-testid="idea-fab-new"
        onClick={() => setComposerOpen(true)}
        style={{
          position: "fixed",
          bottom: isDesktop ? "28px" : "calc(96px + env(safe-area-inset-bottom))",
          // Aligns with the page-frame's clamp(16px, 4vw, 48px) horizontal padding
          // in Koda.tsx so the FAB sits at the content's right edge on desktop
          // instead of orphaned 32px off in the gutter on wide viewports.
          right: isDesktop ? "clamp(16px, 4vw, 48px)" : "16px",
          zIndex: 50,
          background: C.text, color: C.bg, border: "none", borderRadius: "999px",
          padding: "14px 20px", minHeight: "48px", cursor: "pointer",
          fontFamily: MONO, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" as const,
          boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
        }}>
        + New Idea
      </button>

      <IdeaComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={handlePosted}
        recentTrades={recentTrades}
        myUid={myUid}
        C={C}
        inp={inp}
        pillPrimary={pillPrimary}
        isDesktop={isDesktop}
        supabaseUploadChart={(file, filename) => uploadChart(file, filename, myUid)}
        authToken={authToken}
      />

      {chartLightbox && (
        <div onClick={() => setChartLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", cursor: "zoom-out" }}>
          <img src={chartLightbox} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "10px" }} />
        </div>
      )}
    </div>
  );
}
