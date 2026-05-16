import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { SectionKicker, StrategyPill, Toast, stratCode, MONO, BODY, DISPLAY } from "./shared";

export function TradingCircles({ myCircles, circlesView, setCirclesView, activeCircle, setActiveCircle, circleForm, setCircleForm, circleJoinCode, setCircleJoinCode, circleMsg, setCircleMsg, createCircle, joinCircle, publishToCircle, fetchCircleLeaderboard, profile, getMyCode, showToast, wins, losses, total, winRate, totalPnL, pnlPos, weekPnL, weekPnLPos, weekPnLStr, avgRR, streak, STRATEGY_NAMES, C, inp, sel, lbl, pillPrimary, pillGhost, following, followUser, unfollowUser, kickMember, leaveCircle, openProfile, isJoiningCircle, isCreatingCircle, totalPnlDollar, hasDollarData }: any) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbSort, setLbSort] = useState<"all" | "week">("all");
  const [loadingLB, setLoadingLB] = useState(false);
  const [circleTab, setCircleTab] = useState<"leaderboard" | "chat" | "members">("leaderboard");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const CIRCLE_EMOJIS = ["◆","▲","●","■","⬡","◈","△","○","□","✦"];
  const MEDALS = ["🥇","🥈","🥉"];

  // Returns the primary metric label + formatted value for a leaderboard entry
  function metricDisplay(entry: any, circle: any): { val: string; raw: number; label: string } {
    const m = circle?.metric || "dollar";
    if (m === "dollar") { const v = entry.totalPnLDollar || 0; return { val: `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(0)}`, raw: v, label: "$ P&L" }; }
    if (m === "r")       { const v = entry.totalPnL || 0; return { val: `${v >= 0 ? "+" : ""}${v.toFixed(1)}R`, raw: v, label: "R P&L" }; }
    if (m === "winrate") { const v = entry.winRate || 0; return { val: `${v.toFixed(0)}%`, raw: v, label: "WIN RATE" }; }
    if (m === "trades")  { const v = entry.total || 0; return { val: `${v}`, raw: v, label: "TRADES" }; }
    if (m === "avgr")    { const v = entry.avgRR || 0; return { val: `${v.toFixed(2)}R`, raw: v, label: "AVG R" }; }
    const v = entry.totalPnLDollar || 0; return { val: `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(0)}`, raw: v, label: "$ P&L" };
  }

  // Label for the circle's competition metric
  const METRIC_LABELS: Record<string, string> = { dollar: "$ DOLLAR P&L", r: "R-MULTIPLE", winrate: "WIN RATE", trades: "MOST TRADES", avgr: "AVG R" };

  async function loadChatMessages(circleCode: string) {
    setChatLoading(true);
    try {
      const { data } = await supabase
        .from("circle_messages")
        .select("*")
        .eq("circle_code", circleCode)
        .order("created_at", { ascending: true })
        .limit(100);
      setChatMessages(data || []);
    } catch {}
    setChatLoading(false);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  async function sendChatMessage(circleCode: string, myId: string) {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    setChatInput("");
    try {
      await supabase.from("circle_messages").insert({
        circle_code: circleCode,
        sender_id: myId,
        sender_name: profile.name || "Trader",
        sender_handle: profile.handle || "",
        text,
      });
    } catch { setChatInput(text); }
    setChatSending(false);
  }

  async function deleteChatMessage(id: string) {
    await supabase.from("circle_messages").delete().eq("id", id);
    setChatMessages(prev => prev.filter((m: any) => m.id !== id));
  }

  function fmtMsgTime(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff < 1) return "just now";
    if (diff < 60) return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  async function openCircle(circle: any) {
    setActiveCircle(circle);
    setCirclesView("detail");
    setExpandedMember(null);
    setCircleTab("leaderboard");
    setChatMessages([]);
    setChatInput("");
    setLoadingLB(true);
    const entries = await fetchCircleLeaderboard(circle);
    setLeaderboard(entries);
    setLoadingLB(false);
  }

  useEffect(() => {
    if (circlesView !== "detail" || !activeCircle) return;
    let alive = true;
    async function refresh() {
      try {
        const entries = await fetchCircleLeaderboard(activeCircle);
        if (alive) setLeaderboard(entries);
      } catch {}
    }
    const id = setInterval(refresh, 120_000);
    let unsub = () => {};
    try { unsub = subscribeToCircle(activeCircle.code, () => { refresh(); }); } catch {}
    const chatChannel = supabase
      .channel(`circle_chat_${activeCircle.code}`)
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public",
        table: "circle_messages",
        filter: `circle_code=eq.${activeCircle.code}`,
      }, (payload: any) => {
        setChatMessages(prev => prev.some((m: any) => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => {
      alive = false; clearInterval(id);
      try { unsub(); } catch {}
      supabase.removeChannel(chatChannel);
    };
  }, [circlesView, activeCircle, fetchCircleLeaderboard]);

  // ── Derived circle stats ──────────────────────────────────────────────
  const myRank = leaderboard.findIndex((e: any) => e.memberCode === getMyCode()) + 1;
  const leader = leaderboard[0];
  const circleAvgWR = leaderboard.length > 0
    ? Math.round(leaderboard.reduce((s: number, e: any) => s + (e.winRate || 0), 0) / leaderboard.length)
    : 0;
  const circleTotalTrades = leaderboard.reduce((s: number, e: any) => s + (e.total || 0), 0);

  function shareInviteLink(circle: any) {
    const url = `https://tradrjournal.xyz/?join=${circle.code}`;
    const msg = `Join my TRADR circle "${circle.name}" → ${url}`;
    if (navigator.share) {
      navigator.share({ title: "Join my TRADR circle", text: msg, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      showToast("Invite link copied");
    }
  }

  return (
    <div style={{ marginTop: "clamp(16px, 4vw, 28px)" }}>

      {/* ── BROWSE ── */}
      {circlesView === "browse" && (
        <>
          <section>
            <SectionKicker label="COMPETE. CONNECT. COMPARE." C={C} />
            <h1 style={{ fontFamily: DISPLAY, fontSize: "clamp(44px, 11vw, 68px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 0.95, color: C.text, marginTop: "20px", marginBottom: "28px" }}>
              Your <span style={{ fontStyle: "italic", fontWeight: 500, color: C.text2 }}>circles</span>.
            </h1>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={() => setCirclesView("create")} style={{ ...pillPrimary(true), width: "auto", padding: "12px 20px" }}>+ Create circle</button>
              <button onClick={() => setCirclesView("join")} style={{ ...pillGhost, padding: "12px 20px" }}>⤵ JOIN CIRCLE</button>
            </div>
          </section>

          {myCircles.length > 0 ? (
            <section style={{ marginTop: "clamp(40px, 6vw, 56px)" }}>
              <SectionKicker label={`MY CIRCLES · ${myCircles.length}`} C={C} />
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[...myCircles].sort((a: any, b: any) => {
                  if (a.code === "TRADRG-HB1U") return -1;
                  if (b.code === "TRADRG-HB1U") return 1;
                  return 0;
                }).map((circle: any) => (
                  <div key={circle.id} className="row-hvr" onClick={() => openCircle(circle)}
                    style={{ padding: "20px", background: C.panel, borderRadius: "14px", cursor: "pointer", border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                      {/* Symbol mark */}
                      <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "22px", color: C.text2, flexShrink: 0, border: `1px solid ${C.border2}` }}>
                        {circle.emoji || "◆"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginBottom: "4px" }}>
                          <span style={{ fontFamily: DISPLAY, fontSize: "20px", fontWeight: 500, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{circle.name}</span>
                          <span style={{ fontFamily: MONO, fontSize: "18px", color: C.muted, flexShrink: 0 }}>›</span>
                        </div>
                        {circle.description && <div style={{ fontFamily: BODY, fontSize: "13px", color: C.text2, lineHeight: 1.5, marginBottom: "10px" }}>{circle.description}</div>}
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "8px" }}>
                          <span>{circle.members?.length || 1} members</span>
                          {circle.strategy && <span>{stratCode(circle.strategy)}</span>}
                          <span style={{ color: circle.privacy === "public" ? C.green : C.muted }}>{circle.privacy === "public" ? "● PUBLIC" : "◐ PRIVATE"}</span>
                          {circle.isOwner && <span style={{ color: C.text2 }}>OWNER</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section style={{ marginTop: "clamp(40px, 6vw, 56px)", padding: "48px 24px", background: C.panel, borderRadius: "16px", textAlign: "center", border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: MONO, fontSize: "32px", color: C.border2, marginBottom: "16px", letterSpacing: "-0.02em" }}>◆</div>
              <div style={{ fontFamily: DISPLAY, fontSize: "22px", fontStyle: "italic", fontWeight: 500, color: C.text2, letterSpacing: "-0.01em", marginBottom: "8px" }}>No circles yet.</div>
              <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted, lineHeight: 1.6, marginBottom: "24px" }}>
                Compete with friends, share trades, and build your edge together.
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setCirclesView("create")} style={{ background: C.text, color: C.bg, border: "none", borderRadius: "999px", padding: "10px 22px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  + Create circle
                </button>
                <button onClick={() => setCirclesView("join")} style={{ background: "transparent", color: C.text, border: `1px solid ${C.border2}`, borderRadius: "999px", padding: "10px 22px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  ⤵ Join with code
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── CREATE ── */}
      {circlesView === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setCirclesView("browse")} style={{ ...pillGhost, padding: "8px 14px" }}>‹ BACK</button>
            <SectionKicker label="CREATE A CIRCLE" C={C} />
          </div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(32px, 7vw, 44px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: C.text, marginTop: "8px" }}>
            Start <span style={{ fontStyle: "italic", fontWeight: 500, color: C.text2 }}>something small</span>.
          </h2>
          {/* Symbol picker */}
          <div>
            <label style={lbl}>Symbol</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
              {CIRCLE_EMOJIS.map(em => {
                const active = (circleForm.emoji || "◆") === em;
                return (
                  <button key={em} onClick={() => setCircleForm((f: any) => ({ ...f, emoji: em }))}
                    style={{ width: "36px", height: "36px", borderRadius: "8px", fontSize: "16px", fontFamily: MONO, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: active ? C.text : "transparent", color: active ? C.bg : C.muted, border: `1px solid ${active ? C.text : C.border2}`, transition: "all 100ms", lineHeight: 1 }}>
                    {em}
                  </button>
                );
              })}
            </div>
          </div>
          <div><label style={lbl}>Circle name</label><input value={circleForm.name} onChange={e => setCircleForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. London ICT Traders" style={inp} /></div>
          <div><label style={lbl}>Description (optional)</label><textarea value={circleForm.description} onChange={e => setCircleForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="What's this circle about?" rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /></div>
          <div>
            <label style={lbl}>Strategy focus (optional)</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
              <button onClick={() => setCircleForm((f: any) => ({ ...f, strategy: "" }))}
                style={{ background: circleForm.strategy === "" ? C.text : "transparent", border: `1px solid ${circleForm.strategy === "" ? C.text : C.border2}`, borderRadius: "999px", padding: "7px 13px", cursor: "pointer", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.06em", color: circleForm.strategy === "" ? C.bg : C.muted, textTransform: "uppercase" }}>
                Any
              </button>
              {STRATEGY_NAMES.map((s: string) => (
                <StrategyPill key={s} name={s} selected={circleForm.strategy === s} onClick={() => setCircleForm((f: any) => ({ ...f, strategy: s }))} C={C} />
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Privacy</label>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              {[["public", "● Public"], ["private", "◐ Private"]].map(([val, label]) => (
                <button key={val} onClick={() => setCircleForm((f: any) => ({ ...f, privacy: val }))}
                  style={{ background: circleForm.privacy === val ? C.text : "transparent", border: `1px solid ${circleForm.privacy === val ? C.text : C.border2}`, borderRadius: "999px", padding: "10px 18px", cursor: "pointer", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", color: circleForm.privacy === val ? C.bg : C.text, textTransform: "uppercase" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted, marginTop: "10px", lineHeight: 1.55 }}>
              {circleForm.privacy === "public" ? "Anyone with the invite code can join." : "Invite only — you share the code."}
            </div>
          </div>
          {/* Competition metric */}
          <div>
            <label style={lbl}>Competition metric</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
              {([
                ["dollar", "$ Dollar P&L"],
                ["r",      "R-Multiple"],
                ["winrate","Win Rate"],
                ["trades", "Most Trades"],
                ["avgr",   "Avg R"],
              ] as const).map(([val, label]) => (
                <button key={val} onClick={() => setCircleForm((f: any) => ({ ...f, metric: val }))}
                  style={{ background: (circleForm.metric || "dollar") === val ? C.text : "transparent", border: `1px solid ${(circleForm.metric || "dollar") === val ? C.text : C.border2}`, borderRadius: "999px", padding: "7px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: (circleForm.metric || "dollar") === val ? C.bg : C.muted, textTransform: "uppercase", transition: "all 100ms" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted, marginTop: "8px", lineHeight: 1.55 }}>
              {{
                dollar:  "Leaderboard ranks by total dollar P&L.",
                r:       "Leaderboard ranks by total R gained/lost.",
                winrate: "Leaderboard ranks by win percentage.",
                trades:  "Leaderboard ranks by number of trades logged.",
                avgr:    "Leaderboard ranks by average R per trade.",
              }[circleForm.metric as string] || "Leaderboard ranks by total dollar P&L."}
            </div>
          </div>
          <button onClick={createCircle} disabled={isCreatingCircle || !circleForm.name.trim()} style={{ ...pillPrimary(!!circleForm.name.trim() && !isCreatingCircle), marginTop: "8px" }}>
            {isCreatingCircle ? "Creating…" : "Create circle →"}
          </button>
        </div>
      )}

      {/* ── JOIN ── */}
      {circlesView === "join" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setCirclesView("browse")} style={{ ...pillGhost, padding: "8px 14px" }}>‹ BACK</button>
            <SectionKicker label="JOIN A CIRCLE" C={C} />
          </div>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontFamily: MONO, fontSize: "28px", color: C.muted, marginBottom: "20px", letterSpacing: "-0.02em" }}>⤵</div>
            <div style={{ fontFamily: DISPLAY, fontSize: "clamp(28px, 6vw, 38px)", fontWeight: 500, letterSpacing: "-0.02em", color: C.text, marginBottom: "32px", fontStyle: "italic" }}>
              Enter the code.
            </div>
            <input value={circleJoinCode} onChange={e => setCircleJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinCircle()}
              placeholder="TRADR-ABCD-EFGH"
              style={{ ...inp, textAlign: "center", fontFamily: MONO, fontSize: "22px", letterSpacing: "0.14em", padding: "16px 0" }} />
            <button onClick={joinCircle} disabled={isJoiningCircle || !circleJoinCode.trim()} style={{ ...pillPrimary(!!circleJoinCode.trim() && !isJoiningCircle), marginTop: "20px" }}>
              {isJoiningCircle ? "Joining…" : "Join →"}
            </button>
            {circleMsg && <div style={{ fontFamily: BODY, fontSize: "13px", color: circleMsg.toLowerCase().includes("joined") ? C.green : C.red, marginTop: "14px" }}>{circleMsg}</div>}
          </div>
          <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted, lineHeight: 1.6, textAlign: "center", maxWidth: "32ch", margin: "0 auto" }}>
            Ask the circle owner for their invite link or code, then paste it above.
          </div>
        </div>
      )}

      {/* ── CIRCLE DETAIL ── */}
      {circlesView === "detail" && activeCircle && (
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(24px, 4vw, 36px)" }}>
          {/* Header bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
            <button onClick={() => { setCirclesView("browse"); setActiveCircle(null); setLeaderboard([]); }} style={{ ...pillGhost, padding: "8px 14px" }}>‹ BACK</button>
            {!activeCircle.isOwner && (
              <button onClick={() => { if (window.confirm(`Leave "${activeCircle.name}"? You can rejoin with the code.`)) leaveCircle(activeCircle.code); }}
                style={{ background: "transparent", color: C.muted, border: `0.5px solid ${C.border2}`, borderRadius: "999px", padding: "8px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Leave
              </button>
            )}
          </div>

          {/* Circle hero */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "16px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "28px", color: C.text, flexShrink: 0, border: `1px solid ${C.border2}` }}>
                {activeCircle.emoji || "◆"}
              </div>
              <div>
                <h1 style={{ fontFamily: DISPLAY, fontSize: "clamp(32px, 8vw, 48px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 0.95, color: C.text, marginBottom: "6px" }}>
                  {activeCircle.name}
                </h1>
                <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {activeCircle.code}
                </div>
              </div>
            </div>
            {activeCircle.description && (
              <div style={{ fontFamily: BODY, fontSize: "14px", color: C.text2, lineHeight: 1.6, maxWidth: "48ch", marginBottom: "16px" }}>{activeCircle.description}</div>
            )}
            {/* Aggregate stats bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0", background: C.panel, borderRadius: "12px", overflow: "hidden", border: `1px solid ${C.border}` }}>
              {[
                ["MEMBERS", activeCircle.members?.length || 1],
                ["ON BOARD", leaderboard.length || "—"],
                ["TRADES", circleTotalTrades || "—"],
                ["AVG WR", leaderboard.length > 0 ? `${circleAvgWR}%` : "—"],
              ].map(([k, v], i) => (
                <div key={k as string} style={{ padding: "14px 10px", textAlign: "center", borderLeft: i > 0 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: "20px", fontWeight: 500, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: MONO, fontSize: "8px", color: C.muted, letterSpacing: "0.12em", marginTop: "5px" }}>{k}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Weekly leader callout */}
          {leader && (
            <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.green, letterSpacing: "0.14em", marginBottom: "4px" }}>🏆 {METRIC_LABELS[activeCircle?.metric || "dollar"] || "$ DOLLAR P&L"}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 500, color: C.text, letterSpacing: "-0.01em" }}>{leader.name}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: DISPLAY, fontSize: "22px", fontWeight: 700, color: C.green, letterSpacing: "-0.02em" }}>{metricDisplay(leader, activeCircle).val}</div>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.08em" }}>{leader.winRate.toFixed(0)}% WR · {leader.total} trades</div>
              </div>
            </div>
          )}

          {/* Your rank callout (if on the board) */}
          {myRank > 0 && myRank > 1 && (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "12px 18px", display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ fontFamily: MONO, fontSize: "24px", fontWeight: 700, color: C.text2, letterSpacing: "-0.02em" }}>#{myRank}</span>
              <div>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.14em", marginBottom: "2px" }}>YOUR RANK</div>
                <div style={{ fontFamily: BODY, fontSize: "13px", color: C.text2 }}>Keep publishing to climb the board.</div>
              </div>
            </div>
          )}

          {/* Publish strip */}
          <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.14em" }}>YOUR STATS TO PUBLISH</div>
              <div style={{ fontFamily: MONO, fontSize: "9px", color: C.text2, letterSpacing: "0.1em", background: C.panel, border: `1px solid ${C.border2}`, borderRadius: "999px", padding: "3px 10px" }}>
                RANKED BY {METRIC_LABELS[activeCircle?.metric || "dollar"] || "$ P&L"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0", marginBottom: "14px" }}>
              {[["W/L", `${wins}/${losses}`], ["WR", `${winRate}%`], hasDollarData ? ["$ P&L", `${totalPnlDollar >= 0 ? "+" : ""}$${Math.abs(totalPnlDollar).toFixed(0)}`] : ["P&L", `${pnlPos ? "+" : ""}${totalPnL}R`], ["AVG R", avgRR === "—" ? "—" : `${avgRR}R`]].map(([k, v], i) => (
                <div key={k} style={{ padding: "4px 10px", borderLeft: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.1em", marginBottom: "6px" }}>{k}</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 500, color: C.text, letterSpacing: "-0.02em" }}>{v}</div>
                </div>
              ))}
            </div>
            <button onClick={() => publishToCircle(activeCircle.code)} style={{ ...pillPrimary(true), width: "100%", padding: "14px 20px" }}>PUBLISH MY STATS →</button>
          </section>

          {/* Tabs: Leaderboard / Chat / Members */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["leaderboard", "chat", "members"] as const).map(tab => (
                  <button key={tab}
                    onClick={() => { setCircleTab(tab); if (tab === "chat" && chatMessages.length === 0) loadChatMessages(activeCircle.code); }}
                    style={{ background: circleTab === tab ? C.text : "transparent", color: circleTab === tab ? C.bg : C.muted, border: `1px solid ${circleTab === tab ? C.text : C.border2}`, borderRadius: "999px", padding: "5px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {tab === "leaderboard" ? "Board" : tab === "chat" ? "Chat" : "Members"}
                  </button>
                ))}
              </div>
              {circleTab === "leaderboard" && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {(["all", "week"] as const).map(s => (
                    <button key={s} onClick={() => setLbSort(s)}
                      style={{ background: lbSort === s ? C.text2 + "22" : "transparent", border: `1px solid ${lbSort === s ? C.text2 : C.border2}`, borderRadius: "999px", padding: "4px 10px", cursor: "pointer", fontFamily: MONO, fontSize: "9px", color: lbSort === s ? C.text : C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {s === "all" ? "ALL TIME" : "THIS WEEK"}
                    </button>
                  ))}
                  <button onClick={async () => { setLoadingLB(true); const e = await fetchCircleLeaderboard(activeCircle); setLeaderboard(e); setLoadingLB(false); }}
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "11px" }}>↻</button>
                </div>
              )}
            </div>

            {/* ── LEADERBOARD ── */}
            {circleTab === "leaderboard" && (
              <div>
                {loadingLB ? (
                  <div style={{ padding: "28px 0", fontFamily: BODY, fontSize: "13px", color: C.muted, fontStyle: "italic" }}>Loading…</div>
                ) : leaderboard.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", background: C.panel, borderRadius: "12px" }}>
                    <div style={{ fontFamily: MONO, fontSize: "24px", color: C.border2, marginBottom: "12px" }}>—</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: "16px", fontStyle: "italic", color: C.text2, marginBottom: "6px" }}>No stats published yet.</div>
                    <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted }}>Be the first — hit "Publish My Stats" above.</div>
                  </div>
                ) : (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {leaderboard.map((entry: any, i: number) => {
                      const isMe = entry.memberCode === getMyCode();
                      const md = metricDisplay(entry, activeCircle);
                      const pPos = md.raw >= 0;
                      const isFirst = i === 0;
                      const pnlCol = isFirst && pPos ? C.green : pPos ? C.text : C.red;
                      const isExpanded = expandedMember === entry.memberCode;
                      const isFollowing = (following || []).includes(entry.memberCode);
                      const medal = MEDALS[i] || null;
                      return (
                        <div key={entry.memberCode} style={{ borderBottom: `1px solid ${C.border}`, background: isFirst ? `${C.green}08` : "transparent" }}>
                          <div
                            onClick={() => setExpandedMember(isExpanded ? null : entry.memberCode)}
                            style={{ padding: "16px 0", display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "14px", cursor: "pointer", paddingLeft: isExpanded ? "10px" : 0, paddingRight: isExpanded ? "10px" : 0 }}>
                            <span style={{ fontFamily: MONO, fontSize: "13px", color: isFirst ? C.green : C.muted, letterSpacing: "0.06em", minWidth: "28px" }}>
                              {medal || String(i + 1).padStart(2, "0")}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontFamily: DISPLAY, fontSize: "17px", fontWeight: 500, color: C.text, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                                {isMe && <span style={{ fontFamily: MONO, fontSize: "9px", color: C.green, letterSpacing: "0.12em", textTransform: "uppercase" }}>· YOU</span>}
                              </div>
                              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "3px", fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                <span>{entry.total} trades</span>
                                <span style={{ color: entry.winRate >= 50 ? C.green : entry.winRate > 0 ? C.red : C.muted }}>{entry.winRate.toFixed(0)}% WR</span>
                                {entry.topStrategy && <span>{stratCode(entry.topStrategy)}</span>}
                                {entry.streak?.count >= 2 && <span style={{ color: entry.streak.type === "Win" ? C.green : C.red }}>{entry.streak.count}{entry.streak.type === "Win" ? "W" : "L"}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                              <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 700, color: pnlCol, letterSpacing: "-0.01em", lineHeight: 1 }}>{md.val}</div>
                              <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.06em" }}>{md.label}</div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: "0 10px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                              <div>
                                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.14em", marginBottom: "4px" }}>
                                  {entry.alias && entry.alias !== entry.memberCode ? "ALIAS · USER CODE" : "USER CODE"}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <span style={{ fontFamily: MONO, fontSize: "13px", color: C.text, letterSpacing: "0.10em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {entry.alias && entry.alias !== entry.memberCode ? `${entry.alias} · ${entry.memberCode}` : entry.memberCode}
                                  </span>
                                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(entry.memberCode); showToast("Code copied"); }}
                                    style={{ ...pillGhost, padding: "6px 12px", fontSize: "9px" }}>COPY</button>
                                </div>
                              </div>
                              {!isMe && (
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button onClick={(e) => { e.stopPropagation(); isFollowing ? unfollowUser(entry.memberCode) : followUser(entry.memberCode); }}
                                    style={{ background: isFollowing ? "transparent" : C.text, color: isFollowing ? C.muted : C.bg, border: `1px solid ${isFollowing ? C.border2 : C.text}`, borderRadius: "999px", padding: "8px 18px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", flex: 1 }}>
                                    {isFollowing ? "✓ Following" : "+ Follow"}
                                  </button>
                                  {activeCircle?.isOwner && (
                                    <button onClick={async (e) => { e.stopPropagation(); await kickMember(activeCircle.code, entry.memberCode); setLeaderboard(prev => prev.filter(r => r.memberCode !== entry.memberCode)); setExpandedMember(null); }}
                                      style={{ background: "transparent", color: C.red, border: `1px solid ${C.red}44`, borderRadius: "999px", padding: "8px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                                      KICK
                                    </button>
                                  )}
                                </div>
                              )}
                              {entry.handle && openProfile && (
                                <button onClick={(e) => { e.stopPropagation(); openProfile(entry.handle); }}
                                  style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", padding: 0, textDecoration: "underline" }}>View Profile →</button>
                              )}
                              {entry.updatedAt && (
                                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                                  Last published · {new Date(entry.updatedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── CHAT ── */}
            {circleTab === "chat" && (() => {
              const myId = profile?.uid;
              return (
                <div>
                  <div style={{ borderTop: `1px solid ${C.border}`, minHeight: "260px", maxHeight: "420px", overflowY: "auto", paddingTop: "8px" }}>
                    {chatLoading
                      ? <div style={{ padding: "40px 0", textAlign: "center", fontFamily: BODY, fontSize: "13px", color: C.muted, fontStyle: "italic" }}>Loading…</div>
                      : chatMessages.length === 0
                        ? <div style={{ padding: "48px 0", textAlign: "center" }}>
                            <div style={{ fontFamily: MONO, fontSize: "22px", color: C.border2, marginBottom: "10px", letterSpacing: "0.14em" }}>· · ·</div>
                            <div style={{ fontFamily: DISPLAY, fontSize: "16px", fontStyle: "italic", color: C.text2, marginBottom: "6px" }}>No messages yet.</div>
                            <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted }}>Be the first to say something.</div>
                          </div>
                        : chatMessages.map((msg: any) => {
                            const isMe = msg.sender_id === myId;
                            return (
                              <div key={msg.id} style={{ padding: "10px 0", display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: "10px", alignItems: "flex-end" }}>
                                {!isMe && (
                                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: C.panel, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "10px", color: C.muted, flexShrink: 0, border: `1px solid ${C.border}` }}>
                                    {(msg.sender_name || "?")[0].toUpperCase()}
                                  </div>
                                )}
                                <div style={{ maxWidth: "75%" }}>
                                  {!isMe && <div onClick={() => openProfile && msg.sender_handle && openProfile(msg.sender_handle)} style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.08em", marginBottom: "4px", cursor: openProfile && msg.sender_handle ? "pointer" : "default" }}>{msg.sender_name}{msg.sender_handle ? ` @${msg.sender_handle}` : ""}</div>}
                                  <div style={{ background: isMe ? C.text : C.panel, color: isMe ? C.bg : C.text, borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontFamily: BODY, fontSize: "14px", lineHeight: 1.5, wordBreak: "break-word", border: isMe ? "none" : `1px solid ${C.border}` }}>{msg.text}</div>
                                  <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, marginTop: "4px", display: "flex", gap: "10px", justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "center" }}>
                                    <span>{fmtMsgTime(msg.created_at)}</span>
                                    {isMe && <button onClick={() => deleteChatMessage(msg.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "9px", padding: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Delete</button>}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                    }
                    <div ref={chatBottomRef} />
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", paddingTop: "14px", borderTop: `1px solid ${C.border}`, marginTop: "4px" }}>
                    <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(activeCircle.code, myId); } }}
                      placeholder="Message the circle…" rows={2}
                      style={{ ...inp, flex: 1, resize: "none", lineHeight: 1.5, fontFamily: BODY, fontSize: "14px" }} />
                    <button onClick={() => sendChatMessage(activeCircle.code, myId)}
                      disabled={!chatInput.trim() || chatSending}
                      style={{ ...pillPrimary(!!chatInput.trim() && !chatSending), width: "auto", padding: "10px 18px", opacity: chatSending ? 0.6 : 1, flexShrink: 0 }}>
                      {chatSending ? "…" : "Send"}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ── MEMBERS ── */}
            {circleTab === "members" && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                {(activeCircle.members || []).length === 0 ? (
                  <div style={{ padding: "28px 0", fontFamily: BODY, fontSize: "13px", color: C.muted, fontStyle: "italic" }}>No member data available.</div>
                ) : (activeCircle.members || []).map((m: any, idx: number) => {
                  const isMe = m.code === getMyCode();
                  const isFollowing = (following || []).includes(m.code);
                  const lbEntry = leaderboard.find((e: any) => e.memberCode === m.code);
                  return (
                    <div key={m.code || idx} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: C.panel, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontSize: "18px", flexShrink: 0, border: `1px solid ${C.border}` }}>
                        {m.avatar ? (m.avatar.length <= 8 && !m.avatar.startsWith("http") && !m.avatar.startsWith("data:") ? m.avatar : "👤") : "👤"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                          <span style={{ fontFamily: DISPLAY, fontSize: "16px", fontWeight: 500, color: C.text, letterSpacing: "-0.01em" }}>{m.name || "Trader"}</span>
                          {isMe && <span style={{ fontFamily: MONO, fontSize: "9px", color: C.green, letterSpacing: "0.12em" }}>· YOU</span>}
                          {m.code === activeCircle.createdBy || m.isOwner ? <span style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.1em" }}>OWNER</span> : null}
                        </div>
                        {m.alias && <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.06em", marginTop: "2px" }}>{m.alias}</div>}
                        {lbEntry && <div style={{ fontFamily: MONO, fontSize: "10px", color: lbEntry.totalPnL >= 0 ? C.green : C.red, letterSpacing: "0.06em", marginTop: "2px" }}>{lbEntry.totalPnL >= 0 ? "+" : ""}{lbEntry.totalPnL.toFixed(1)}R · {lbEntry.winRate.toFixed(0)}% WR</div>}
                      </div>
                      {!isMe && (
                        <button onClick={() => isFollowing ? unfollowUser(m.code) : followUser(m.code)}
                          style={{ background: isFollowing ? "transparent" : C.text, color: isFollowing ? C.muted : C.bg, border: `1px solid ${isFollowing ? C.border2 : C.text}`, borderRadius: "999px", padding: "6px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
                          {isFollowing ? "✓" : "+Follow"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Invite strip */}
          <section style={{ borderTop: `1px solid ${C.border}`, paddingTop: "22px" }}>
            <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", marginBottom: "12px" }}>INVITE TO CIRCLE</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ flex: 1, borderBottom: `1px solid ${C.border2}`, padding: "12px 0", fontFamily: MONO, fontSize: "16px", color: C.text, letterSpacing: "0.14em" }}>{activeCircle.code}</div>
              <button onClick={() => { navigator.clipboard?.writeText(activeCircle.code); showToast("Code copied"); }}
                style={{ ...pillGhost, padding: "8px 16px" }}>CODE</button>
              <button onClick={() => { navigator.clipboard?.writeText(`https://tradrjournal.xyz/?join=${activeCircle.code}`); showToast("Link copied"); }}
                style={{ ...pillGhost, padding: "8px 16px" }}>LINK</button>
              <button onClick={() => shareInviteLink(activeCircle)}
                style={{ ...pillPrimary(true), width: "auto", padding: "8px 16px" }}>SHARE</button>
            </div>
            <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>
              LINK copies a join URL · SHARE sends a ready-made invite.
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
