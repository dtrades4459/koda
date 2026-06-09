import { useState, useEffect, useRef, Fragment } from "react";
import { supabase } from "./lib/supabase";
import { StrategyPill, stratCode, KodaMark, MONO, BODY, DISPLAY, EmptyCirclesState, CornerGlow, SubNavDropdown } from "./shared";
import { KODA_GLOBAL_CODE } from "./hooks/useCircles";
import { readCircleMembers } from "./data/circles";
import { markChatRead } from "./data/chatReads";
import { useUnreadCircles } from "./hooks/useUnreadCircles";
import { createChallenge, fetchActiveChallenge, fetchTrophies } from "./data/circlesChallenges";
import { fetchSharedTrades, reactToSharedTrade, rowToSharedTrade } from "./data/circlesSharedTrades";
import { SharedTradeCard } from "./components/SharedTradeCard";
import type { Circle, CircleChallenge, ChallengeResult, FeedItem, CircleMessage, CircleMember, Profile } from "./types";
import type { Theme } from "./theme";

interface LeaderboardEntry {
  memberCode: string;
  name: string;
  handle?: string;
  alias?: string;
  total: number;
  winRate: number;
  totalPnL: number;
  totalPnLDollar?: number;
  pnlPercent?: number | null;
  topStrategy?: string | null;
  streak?: { count: number; type: string } | null;
  avgRR?: number;
  disciplineScore?: number | null;
  disciplineGrade?: string | null;
  updatedAt?: string | null;
}

interface CircleFormShape {
  name: string;
  description: string;
  strategy: string;
  privacy: string;
  emoji: string;
  metric: string;
}

export interface TradingCirclesProps {
  myCircles: Circle[];
  circlesView: string;
  setCirclesView: React.Dispatch<React.SetStateAction<string>>;
  activeCircle: Circle | null | any;
  setActiveCircle: React.Dispatch<React.SetStateAction<Circle | null | any>>;
  circleForm: CircleFormShape;
  setCircleForm: React.Dispatch<React.SetStateAction<CircleFormShape>>;
  circleJoinCode: string;
  setCircleJoinCode: React.Dispatch<React.SetStateAction<string>>;
  circleMsg: string;
  setCircleMsg: React.Dispatch<React.SetStateAction<string>>;
  createCircle: () => void | Promise<void>;
  joinCircle: () => void | Promise<void>;
  publishToCircle: (code: string) => void | Promise<void>;
  fetchCircleLeaderboard: (circle: Circle, sort?: "all" | "week") => Promise<LeaderboardEntry[]>;
  profile: Profile;
  getMyCode: () => string;
  showToast: (message: string) => void;
  wins: number;
  losses: number;
  total: number;
  winRate: string | number;
  totalPnL: number | string;
  pnlPos: boolean;
  weekPnL: number;
  weekPnLPos: boolean;
  weekPnLStr: string | number;
  avgRR: string | number;
  streak: { count: number; type: string | null } | null;
  STRATEGY_NAMES: string[];
  C: Theme;
  inp: React.CSSProperties;
  sel: React.CSSProperties;
  lbl: React.CSSProperties;
  pillPrimary: (active: boolean) => React.CSSProperties;
  pillGhost: React.CSSProperties;
  following: string[];
  followUser: (code: string) => void | Promise<void>;
  unfollowUser: (code: string) => void | Promise<void>;
  kickMember: (circleCode: string, memberCode: string) => Promise<void> | void;
  leaveCircle: (circleCode: string) => Promise<void> | void;
  openProfile?: (handle: string) => void;
  isJoiningCircle: boolean;
  isCreatingCircle: boolean;
  totalPnlDollar: number;
  hasDollarData: boolean;
  isPro: boolean;
  isDesktop: boolean;
}

// Raw DB row shape returned by the circle_messages Supabase query.
interface ChatMsg {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_handle: string;
  text: string;
  created_at: string;
}

export function TradingCircles({
  myCircles, circlesView, setCirclesView, activeCircle, setActiveCircle,
  circleForm, setCircleForm, circleJoinCode, setCircleJoinCode,
  circleMsg, createCircle, joinCircle, publishToCircle,
  fetchCircleLeaderboard, profile, getMyCode, showToast,
  wins, losses, winRate, totalPnL, pnlPos,
  avgRR,
  STRATEGY_NAMES, C, inp, sel, lbl, pillPrimary, pillGhost,
  following, followUser, unfollowUser, kickMember, leaveCircle,
  openProfile, isJoiningCircle, isCreatingCircle,
  totalPnlDollar, hasDollarData, isPro, isDesktop,
}: TradingCirclesProps) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbSort, setLbSort] = useState<"all" | "week">("all");
  const [loadingLB, setLoadingLB] = useState(false);
  const [lbError, setLbError] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [circleTab, setCircleTab] = useState<"feed" | "leaderboard" | "chat" | "members" | "trophies">("chat");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const circleTabRef = useRef(circleTab);
  useEffect(() => { circleTabRef.current = circleTab; }, [circleTab]);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const firstUnreadCapturedFor = useRef<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<CircleChallenge | null>(null);
  const [trophies, setTrophies] = useState<ChallengeResult[]>([]);
  const [trophiesLoading, setTrophiesLoading] = useState(false);
  const [showChallengeSheet, setShowChallengeSheet] = useState(false);
  const [challengeForm, setChallengeForm] = useState({
    title: "",
    metric: "r" as CircleChallenge["metric"],
    duration: "7" as "3" | "7" | "14" | "30",
  });
  const [challengeCreating, setChallengeCreating] = useState(false);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const feedBottomRef = useRef<HTMLDivElement>(null);
  const [showLeaveSheet, setShowLeaveSheet] = useState(false);
  const { perCircle: unread, refresh: refreshUnread } = useUnreadCircles(
    myCircles?.map((c) => c.code) ?? []
  );

  const TROPHY_GOLD = "#A88C50";

  function Skeleton({ height = 14, width = "100%", radius = 6, mb = 0 }: { height?: number; width?: number | string; radius?: number; mb?: number }) {
    return (
      <div style={{ height, width, borderRadius: radius, marginBottom: mb,
        background: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2} 50%, ${C.panel} 100%)`,
        backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />
    );
  }
  function SkeletonRow({ avatar = true, lines = 2 }: { avatar?: boolean; lines?: number }) {
    return (
      <div style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
        {avatar && <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.panel, flexShrink: 0,
          backgroundImage: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2} 50%, ${C.panel} 100%)`,
          backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton height={12} width="55%" />
          {lines > 1 && <Skeleton height={10} width="35%" />}
        </div>
      </div>
    );
  }
  const [composeText, setComposeText] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  const CIRCLE_EMOJIS = ["◆","▲","●","■","⬡","◈","△","○","□","✦"];
  const MEDALS = ["🥇","🥈","🥉"];

  // Returns the primary metric label + formatted value for a leaderboard entry
  function metricDisplay(entry: any, circle: any): { val: string; raw: number; label: string } {
    const m = circle?.metric || "dollar";
    // Negative-value sign: previously losses showed as "$165" (no minus) — only color
    // marked them as red, ambiguous with positive in red error states. Use explicit "-".
    if (m === "dollar") { const v = entry.totalPnLDollar || 0; const pct = entry.pnlPercent; const sign = v >= 0 ? "+" : "-"; const pctSign = (p: number) => p >= 0 ? "+" : "-"; const val = pct !== null && pct !== undefined ? `${sign}$${Math.abs(v).toFixed(0)} (${pctSign(pct)}${Math.abs(pct).toFixed(1)}%)` : `${sign}$${Math.abs(v).toFixed(0)}`; return { val, raw: v, label: "$ P&L" }; }
    if (m === "r")       { const v = entry.totalPnL || 0; return { val: `${v >= 0 ? "+" : ""}${v.toFixed(1)}R`, raw: v, label: "R P&L" }; }
    if (m === "winrate") { const v = Number(entry.winRate) || 0; return { val: `${v.toFixed(0)}%`, raw: v, label: "WIN RATE" }; }
    if (m === "trades")  { const v = entry.total || 0; return { val: `${v}`, raw: v, label: "TRADES" }; }
    if (m === "avgr")    { const v = entry.avgRR || 0; return { val: `${v.toFixed(2)}R`, raw: v, label: "AVG R" }; }
    if (m === "discipline") {
      const s = entry.disciplineScore;
      if (s === null || s === undefined) return { val: "—", raw: -1, label: "DISCIPLINE" };
      const g = entry.disciplineGrade ? ` ${entry.disciplineGrade}` : "";
      return { val: `${s.toFixed(0)}${g}`, raw: s, label: "DISCIPLINE" };
    }
    const v = entry.totalPnLDollar || 0; return { val: `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(0)}`, raw: v, label: "$ P&L" };
  }

  function formatCountdown(endsAt: string): string {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return "ended";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}d ${h}h left`;
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }

  // Handles are stored with a leading "@" (set by OnboardingFlow + Koda.tsx).
  // Rendering code historically prepended another "@" → "@@handle" in UI.
  // Combined with avatar-first-char fallback (also "@") it visually became "@@@handle".
  // This helper strips any leading "@"s so the renderer can prepend exactly one.
  function stripHandlePrefix(h: string | null | undefined): string {
    return (h ?? "").replace(/^@+/, "");
  }

  function formatTrophyValue(r: ChallengeResult): string {
    const metric = r.challenge?.metric ?? "dollar";
    const v = r.winningValue;
    if (metric === "dollar")     return `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(0)}`;
    if (metric === "winrate")    return `${v.toFixed(1)}%`;
    if (metric === "trades")     return `${Math.round(v)} trades`;
    if (metric === "discipline") return `${v.toFixed(0)} /100`;
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
  }

  function rowToCircleMessage(row: Record<string, unknown>): CircleMessage {
    return {
      id: row.id as string,
      circleCode: row.circle_code as string,
      senderId: (row.sender_id as string | null) ?? null,
      senderName: row.sender_name as string,
      senderHandle: row.sender_handle as string,
      senderAvatar: (row.sender_avatar as string | null) ?? null,
      text: row.text as string,
      createdAt: row.created_at as string,
    };
  }

  function rowToChallenge(row: Record<string, unknown>): CircleChallenge {
    return {
      id: row.id as string,
      circleCode: row.circle_code as string,
      title: row.title as string,
      metric: row.metric as CircleChallenge["metric"],
      startedAt: row.started_at as string,
      endsAt: row.ends_at as string,
      createdBy: row.created_by as string,
      status: row.status as "active" | "completed",
    };
  }

  async function loadFeed(circle: { code: string }) {
    setFeedLoading(true);
    let alive = true;
    try {
      const [rawMessages, sharedTrades, rawChallenges] = await Promise.all([
        supabase
          .from("circle_messages")
          .select("*")
          .eq("circle_code", circle.code)
          .order("created_at", { ascending: false })
          .limit(50)
          .then(r => r.data ?? []),
        fetchSharedTrades(circle.code, 50),
        supabase
          .from("circle_challenges")
          .select("*")
          .eq("circle_code", circle.code)
          .order("started_at", { ascending: false })
          .limit(20)
          .then(r => r.data ?? []),
      ]);

      if (!alive) return;

      const items: FeedItem[] = [];

      for (const m of rawMessages) {
        const msg = rowToCircleMessage(m as Record<string, unknown>);
        const isJoin = msg.text.includes("joined the circle");
        if (isJoin) {
          items.push({ type: "member_joined", ts: msg.createdAt, data: { id: msg.id, text: msg.text } });
        } else {
          items.push({ type: "message", ts: msg.createdAt, data: msg });
        }
      }

      for (const t of sharedTrades) {
        items.push({ type: "trade", ts: t.sharedAt, data: t });
      }

      for (const c of rawChallenges) {
        const ch = rowToChallenge(c as Record<string, unknown>);
        items.push({ type: "challenge_started", ts: ch.startedAt, data: ch });
      }

      items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setFeedItems(items);
    } catch {
      // network error — feed stays empty, loading clears
    } finally {
      if (alive) setFeedLoading(false);
    }

    return () => { alive = false; };
  }

  async function sendFeedMessage() {
    const text = composeText.trim();
    if (!text || composeSending || !activeCircle || !profile?.uid) return;
    setComposeSending(true);
    setComposeText("");
    try {
      const { error } = await supabase.from("circle_messages").insert({
        circle_code: activeCircle.code,
        sender_id: profile.uid,
        sender_name: profile.name || "Trader",
        sender_handle: profile.handle || "",
        text,
      });
      if (error) throw error;
      loadFeed(activeCircle);
    } catch (e) {
      // Restore the typed text so it isn't lost AND tell the user the send failed.
      setComposeText(text);
      showToast("Couldn't send — check your connection");
      console.error("[KODA][circles.chat.send]", e);
    }
    setComposeSending(false);
  }

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

  async function sendChatMessage(circleCode: string, myId: string | undefined) {
    const text = chatInput.trim();
    if (!text || chatSending || !myId) {
      if (!myId) showToast("Sign in required to send messages");
      return;
    }
    setChatSending(true);
    setChatInput("");
    try {
      const { error } = await supabase.from("circle_messages").insert({
        circle_code: circleCode,
        sender_id: myId,
        sender_name: profile.name || "Trader",
        sender_handle: profile.handle || "",
        text,
      });
      if (error) throw error;
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (token) {
          fetch("/api/push?action=notify-circle", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ circleCode, senderName: profile.name || "Trader", messagePreview: text }),
          }).catch(() => {});
        }
      });
      try {
        await loadChatMessages(circleCode);
      } catch {
        // Reload failure is non-fatal
      }
    } catch (e: unknown) {
      setChatInput(text);
      const errMsg = (e instanceof Error ? e.message : (e as any)?.message) ?? "";
      const errCode = (e as any)?.code ?? "";
      const errHint = (e as any)?.hint ?? "";
      console.error("chat send error", e);
      const isPolicy = errMsg.includes("policy") || errMsg.includes("denied") || errCode === "42501";
      const msg = isPolicy
        ? "Permission denied — try refreshing the page"
        : errMsg
          ? `Send failed: ${errMsg}${errCode ? ` (${errCode})` : ""}`
          : "Message failed to send — try again";
      showToast(msg);
      void errHint;
    }
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
    setCircleTab("feed");
    setChatMessages([]);
    setChatInput("");
    setFeedItems([]);
    setActiveChallenge(null);
    setTrophies([]);
    setLoadingLB(true);
    setLbError(false);
    let challenge: CircleChallenge | null = null;
    try {
      const [entries, challengeResult] = await Promise.all([
        fetchCircleLeaderboard(circle, lbSort),
        fetchActiveChallenge(circle.code),
      ]);
      setLeaderboard(entries);
      challenge = challengeResult;
      setActiveChallenge(challenge);
    } catch {
      setLbError(true);
      setLeaderboard([]);
    }
    setLoadingLB(false);
    loadFeed(circle);
    // Client-side fallback: trigger cron if challenge already expired
    if (challenge && new Date(challenge.endsAt) < new Date()) {
      fetch("/api/cron?job=complete-challenges", { method: "POST" }).catch(() => {});
      setTimeout(() => fetchActiveChallenge(circle.code).then(c => setActiveChallenge(c)).catch(() => {}), 2000);
    }
  }

  async function createChallengeFromForm() {
    if (!activeCircle || !challengeForm.title.trim() || challengeCreating) return;
    setChallengeCreating(true);
    try {
      const days = parseInt(challengeForm.duration);
      const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const result = await createChallenge(
        activeCircle.code,
        challengeForm.title.trim(),
        challengeForm.metric,
        endsAt,
        getMyCode()
      );
      if (result) {
        setActiveChallenge(result);
        setShowChallengeSheet(false);
        setChallengeForm({ title: "", metric: "r", duration: "7" });
        showToast("Challenge started!");
      } else {
        showToast("Failed to start challenge");
      }
    } finally {
      setChallengeCreating(false);
    }
  }

  useEffect(() => {
    if (circlesView !== "detail" || !activeCircle) return;
    let alive = true;
    async function refresh() {
      try {
        const entries = await fetchCircleLeaderboard(activeCircle, lbSort);
        if (alive) setLeaderboard(entries);
      } catch {}
    }
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 120_000);
    let unsub = () => {};
    // subscribeToCircle removed — real-time updates via setInterval + Supabase channels below
    const chatChannel = supabase
      .channel(`circle_chat_${activeCircle.code}`)
      .on("postgres_changes" as any, {
        event: "INSERT", schema: "public",
        table: "circle_messages",
        filter: `circle_code=eq.${activeCircle.code}`,
      }, (payload: any) => {
        setChatMessages(prev => prev.some((m: any) => m.id === payload.new.id) ? prev : [...prev, payload.new]);
        if (document.visibilityState === "visible" && circleTabRef.current === "chat") {
          void markChatRead(activeCircle.code);
          void refreshUnread();
        }
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        // Also prepend to feed
        const msg = rowToCircleMessage(payload.new as Record<string, unknown>);
        const isJoin = msg.text.includes("joined the circle");
        const newFeedItem: FeedItem = isJoin
          ? { type: "member_joined", ts: msg.createdAt, data: { id: msg.id, text: msg.text } }
          : { type: "message", ts: msg.createdAt, data: msg };
        setFeedItems(prev => [newFeedItem, ...prev]);
      })
      .subscribe();
    const sharedTradesChannel = supabase
      .channel(`circle_trades_${activeCircle.code}`)
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "circle_shared_trades",
        filter: `circle_code=eq.${activeCircle.code}`,
      }, (payload: unknown) => {
        const row = (payload as { new: Record<string, unknown> }).new;
        const newItem: FeedItem = {
          type: "trade",
          ts: row.shared_at as string,
          data: rowToSharedTrade(row),
        };
        setFeedItems(prev => [newItem, ...prev]);
      })
      .subscribe();
    const challengesChannel = supabase
      .channel(`circle_challenges_${activeCircle.code}`)
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "circle_challenges",
        filter: `circle_code=eq.${activeCircle.code}`,
      }, (payload: unknown) => {
        const ch = rowToChallenge((payload as { new: Record<string, unknown> }).new);
        setActiveChallenge(ch);
        const newItem: FeedItem = { type: "challenge_started", ts: ch.startedAt, data: ch };
        setFeedItems(prev => [newItem, ...prev]);
      })
      .subscribe();
    return () => {
      alive = false; clearInterval(id);
      try { unsub(); } catch {}
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(sharedTradesChannel);
      supabase.removeChannel(challengesChannel);
    };
  }, [circlesView, activeCircle, fetchCircleLeaderboard, lbSort]);

  // Poll chat every 8s when the chat tab is active — fallback while realtime warms up
  useEffect(() => {
    if (circleTab !== "chat" || !activeCircle) return;
    void markChatRead(activeCircle.code);
    void refreshUnread();
    const id = setInterval(() => loadChatMessages(activeCircle.code), 8_000);
    return () => clearInterval(id);
  }, [circleTab, activeCircle]);

  // Capture the first unread message ID once per chat-session so the NEW divider stays put
  useEffect(() => {
    if (circleTab !== "chat" || !activeCircle?.code) {
      firstUnreadCapturedFor.current = null;
      setFirstUnreadId(null);
      return;
    }
    if (firstUnreadCapturedFor.current === activeCircle.code) return;
    if (chatMessages.length === 0) return; // wait until messages load
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("chat_reads")
        .select("last_read_at")
        .eq("circle_code", activeCircle.code)
        .maybeSingle();
      if (!alive) return;
      const since = data?.last_read_at ?? null;
      if (!since) { setFirstUnreadId(null); firstUnreadCapturedFor.current = activeCircle.code; return; }
      const firstUnread = chatMessages.find(
        (m) => new Date(m.created_at).getTime() > new Date(since).getTime()
      );
      setFirstUnreadId(firstUnread?.id ?? null);
      firstUnreadCapturedFor.current = activeCircle.code;
    })();
    return () => { alive = false; };
  }, [circleTab, activeCircle?.code, chatMessages.length]);

  useEffect(() => {
    if (circleTab !== "trophies" || !activeCircle) return;
    let alive = true;
    setTrophiesLoading(true);
    fetchTrophies(activeCircle.code).then(results => {
      if (alive) { setTrophies(results); setTrophiesLoading(false); }
    }).catch(() => { if (alive) setTrophiesLoading(false); });
    return () => { alive = false; };
  }, [circleTab, activeCircle]);

  // ── Derived circle stats ──────────────────────────────────────────────
  // Numeric guards: Supabase can return PG numeric/decimal columns as strings,
  // which makes (s + e.winRate) string-concatenate → divide → NaN.
  // Numeric guards: Supabase can return PG numeric/decimal columns as strings,
  // which makes (s + e.winRate) string-concatenate → divide → NaN.
  const circleAvgWR = leaderboard.length > 0
    ? Math.round((leaderboard as LeaderboardEntry[]).reduce((s, e) => s + (Number(e.winRate) || 0), 0) / leaderboard.length)
    : 0;
  const circleTotalTrades = (leaderboard as LeaderboardEntry[]).reduce((s, e) => s + (Number(e.total) || 0), 0);

  function shareInviteLink(circle: any) {
    const url = `https://kodatrade.co.uk/?join=${circle.code}`;
    const msg = `Join my Kōda circle "${circle.name}" → ${url}`;
    if (navigator.share) {
      navigator.share({ title: "Join my Kōda circle", text: msg, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      showToast("Invite link copied");
    }
  }

  const sortedCircles = [...myCircles].sort((a, b) =>
    a.code === KODA_GLOBAL_CODE ? -1 : b.code === KODA_GLOBAL_CODE ? 1 : 0
  );

  return (
    <div style={{ position: "relative" }}>
      {/* ambient orb */}
      <div style={{ position: "absolute", top: 120, left: -100, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${(C as any).orb2 ?? C.accent} 0%, transparent 65%)`, filter: "blur(60px)", opacity: 0.4, pointerEvents: "none", zIndex: 0 }} />

      {/* ── BROWSE ── */}
      {circlesView === "browse" && (
        <>
          {/* Title */}
          <div style={{ padding: "12px 6px 14px", position: "relative", zIndex: 2 }}>
            <div style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>Trading circles</div>
            <div style={{ fontFamily: DISPLAY, fontSize: "26px", fontWeight: 500, letterSpacing: "-0.02em", marginTop: "4px", color: C.text }}>
              Compete with <span style={{ fontWeight: 600 }}>your circle</span>
            </div>
          </div>

          {/* Pill tabs */}
          <div style={{ display: "flex", gap: "6px", padding: "0 6px 12px", position: "relative", zIndex: 2, flexWrap: "wrap" }}>
            <div style={{ padding: "6px 14px", borderRadius: "999px", background: C.text, color: C.bg, border: `1px solid ${C.text}`, fontFamily: BODY, fontSize: "11px", fontWeight: 500, flexShrink: 0 }}>Joined</div>
            <div style={{ flex: 1 }} />
            <button onClick={() => setCirclesView("create")} style={{ padding: "6px 14px", borderRadius: "999px", background: "transparent", color: C.text2, border: `1px solid ${C.border2}`, fontFamily: BODY, fontSize: "11px", fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>+ New</button>
          </div>

          {sortedCircles.length > 0 ? (
            <>
            {/* Featured / first circle — glass card */}
            {sortedCircles.slice(0, 1).map(circle => (
              <div key={circle.id} data-testid="circle-card" onClick={() => openCircle(circle)} style={{ position: "relative", zIndex: 2, cursor: "pointer", borderRadius: "22px", padding: "22px", overflow: "hidden", isolation: "isolate", background: (C as any).surfaceGlass ?? C.panel, backdropFilter: "blur(20px) saturate(140%)", WebkitBackdropFilter: "blur(20px) saturate(140%)", border: `1px solid ${C.border2}` }}>
                {/* corner glow */}
                <div style={{ position: "absolute", top: -60, left: -60, width: 200, height: 200, borderRadius: "50%", background: `conic-gradient(from 200deg at 50% 50%, ${(C as any).orb3 ?? C.green}, ${C.accent}, ${(C as any).orb2 ?? C.accent}, ${(C as any).orb3 ?? C.green})`, filter: "blur(40px)", opacity: 0.4, pointerEvents: "none", zIndex: 0 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent }}>● LIVE · YOUR CIRCLE</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: "22px", fontWeight: 600, color: C.text, marginTop: "8px", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
                      {circle.name}
                      {unread[circle.code] > 0 && (
                        <span
                          aria-label={`${unread[circle.code]} unread`}
                          style={{
                            minWidth: 16,
                            height: 16,
                            borderRadius: 999,
                            background: C.accent,
                            color: C.bg,
                            fontFamily: MONO,
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "0 5px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {unread[circle.code] > 99 ? "99+" : unread[circle.code]}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: C.text2, marginTop: "4px", fontFamily: MONO }}>{circle.code} · {circle.members?.length || 1} members</div>
                  </div>
                </div>
                {/* Avatar stack */}
                <div style={{ display: "flex", marginTop: "18px", alignItems: "center", position: "relative", zIndex: 1 }}>
                  {(circle.members || []).slice(0, 5).map((m: CircleMember, i: number) => (
                    <div key={m.code || i} style={{ width: 34, height: 34, borderRadius: "999px", background: `linear-gradient(135deg, oklch(0.7 0.16 ${200 + i * 30}), oklch(0.5 0.18 ${280 + i * 20}))`, border: `2px solid ${C.bg}`, marginLeft: i === 0 ? 0 : -10, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: DISPLAY, fontWeight: 600, fontSize: "10px" }}>{(m.name || "?").slice(0, 2).toUpperCase()}</div>
                  ))}
                  {(circle.members?.length || 0) > 5 && (
                    <div style={{ marginLeft: -10, height: 34, padding: "0 12px", borderRadius: "999px", background: C.panel2, border: `1px solid ${C.border2}`, display: "flex", alignItems: "center", color: C.text2, fontSize: "11px", fontFamily: MONO }}>+{(circle.members?.length || 0) - 5}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Other circles list */}
            {sortedCircles.length > 1 && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", position: "relative", zIndex: 2 }}>
              {sortedCircles.slice(1).map((circle, i) => (
                <div key={circle.id} data-testid="circle-card" className="row-hvr" onClick={() => openCircle(circle)}
                  style={{ background: (C as any).surfaceGlass ?? C.panel, backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", border: `1px solid ${C.border2}`, borderRadius: 20, overflow: "hidden", position: "relative", padding: "18px 20px", cursor: "pointer", animation: `kRise 0.42s ease-out ${i * 0.06}s backwards` }}>
                  <CornerGlow C={C} />
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "14px", background: (C as any).accentSoft ?? C.panel, border: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <KodaMark size={16} color={C.accent} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ fontFamily: DISPLAY, fontSize: "14px", fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{circle.name}</div>
                        {unread[circle.code] > 0 && (
                          <span
                            aria-label={`${unread[circle.code]} unread`}
                            style={{
                              minWidth: 16,
                              height: 16,
                              borderRadius: 999,
                              background: C.accent,
                              color: C.bg,
                              fontFamily: MONO,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "0 5px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {unread[circle.code] > 99 ? "99+" : unread[circle.code]}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: C.text2, marginTop: "2px", fontFamily: MONO }}>{circle.code} · {circle.members?.length || 1} members</div>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: "12px", fontWeight: 600, color: C.text2 }}>
                      {circle.isOwner ? "OWNER" : "›"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Join circle button */}
            <div style={{ marginTop: "12px", display: "flex", gap: "8px", position: "relative", zIndex: 2 }}>
              <button onClick={() => setCirclesView("join")} style={{ flex: 1, background: "transparent", color: C.text, border: `1px solid ${C.border2}`, borderRadius: "999px", padding: "12px 18px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                ⤵ Join with code
              </button>
            </div>
            </>
          ) : (
            <EmptyCirclesState C={C} onDiscover={() => setCirclesView("create")} onJoin={() => setCirclesView("join")} />
          )}
        </>
      )}

      {/* ── CREATE ── */}
      {circlesView === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setCirclesView("browse")} style={{ width: 36, height: 36, borderRadius: "999px", background: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10l6 6" stroke={C.text} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>Create a circle</div>
          </div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: "26px", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, color: C.text, marginTop: "4px" }}>
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
                // "trades" intentionally hidden — rewards overtrading, which the
                // tilt/cooldown system explicitly works against. Existing circles
                // with metric="trades" still render via metricDisplay's branch.
                ["dollar",     "$ Dollar P&L"],
                ["r",          "R-Multiple"],
                ["winrate",    "Win Rate"],
                ["avgr",       "Avg R"],
                ["discipline", "Discipline"],
              ] as const).map(([val, label]) => (
                <button key={val} onClick={() => setCircleForm((f: any) => ({ ...f, metric: val }))}
                  style={{ background: (circleForm.metric || "dollar") === val ? C.text : "transparent", border: `1px solid ${(circleForm.metric || "dollar") === val ? C.text : C.border2}`, borderRadius: "999px", padding: "7px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: (circleForm.metric || "dollar") === val ? C.bg : C.muted, textTransform: "uppercase", transition: "all 100ms" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted, marginTop: "8px", lineHeight: 1.55 }}>
              {{
                dollar:     "Leaderboard ranks by total dollar P&L.",
                r:          "Leaderboard ranks by total R gained/lost.",
                winrate:    "Leaderboard ranks by win percentage.",
                avgr:       "Leaderboard ranks by average R per trade.",
                discipline: "Leaderboard ranks by 7-day discipline score — rules followed, risk limits, awareness.",
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
            <button onClick={() => setCirclesView("browse")} style={{ width: 36, height: 36, borderRadius: "999px", background: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10l6 6" stroke={C.text} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>Join a circle</div>
          </div>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontFamily: MONO, fontSize: "28px", color: C.muted, marginBottom: "20px", letterSpacing: "-0.02em" }}>⤵</div>
            <div style={{ fontFamily: DISPLAY, fontSize: "clamp(28px, 6vw, 38px)", fontWeight: 500, letterSpacing: "-0.02em", color: C.text, marginBottom: "32px", fontStyle: "italic" }}>
              Enter the code.
            </div>
            <input value={circleJoinCode} onChange={e => setCircleJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && joinCircle()}
              placeholder="KODA-ABCD-EFGH"
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
            {!activeCircle.isOwner && activeCircle.code !== KODA_GLOBAL_CODE && (
              <button onClick={() => setShowLeaveSheet(true)}
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
                <div key={k as string} style={{ padding: "16px 8px", textAlign: "center", borderLeft: i > 0 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: "20px", fontWeight: 500, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.1em", marginTop: "8px" }}>{k}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Publish strip */}
          <section>
            <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", marginBottom: "10px" }}>YOUR STATS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontFamily: MONO, fontSize: "12px", color: C.text2, marginBottom: "14px", letterSpacing: "0.04em" }}>
              <span><span style={{ color: C.muted }}>W/L</span> {wins}/{losses}</span>
              <span style={{ color: C.border2 }}>·</span>
              <span><span style={{ color: C.muted }}>WR</span> {winRate}%</span>
              <span style={{ color: C.border2 }}>·</span>
              {hasDollarData ? (
                <span><span style={{ color: C.muted }}>$P&L</span> <span style={{ color: totalPnlDollar >= 0 ? C.green : C.red }}>{totalPnlDollar >= 0 ? "+" : ""}${Math.abs(totalPnlDollar).toFixed(0)}</span></span>
              ) : (
                <span><span style={{ color: C.muted }}>P&L</span> <span style={{ color: pnlPos ? C.green : C.red }}>{pnlPos ? "+" : ""}{totalPnL}R</span></span>
              )}
              <span style={{ color: C.border2 }}>·</span>
              <span><span style={{ color: C.muted }}>AVG</span> {avgRR === "—" ? "—" : `${avgRR}R`}</span>
            </div>
            <button onClick={() => publishToCircle(activeCircle.code)} style={{ ...pillPrimary(true), width: "100%", padding: "14px 20px" }}>PUBLISH MY STATS →</button>
          </section>

          {/* Active challenge pill */}
          {activeChallenge && (
            <div style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 12px",
              border: `1px solid ${C.border2}`,
              borderRadius: 999,
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: C.text2,
            }}>
              <span style={{ color: C.muted }}>Challenge</span>
              <span style={{ color: C.text, letterSpacing: "0.04em", textTransform: "none" as const }}>{activeChallenge.title}</span>
              <span style={{ color: C.border2 }}>·</span>
              <span style={{ fontWeight: 700 }}>{formatCountdown(activeChallenge.endsAt)}</span>
            </div>
          )}

          {/* Tabs: Feed / Leaderboard / Chat / Members / Trophies */}
          <section>
            <div style={{ marginBottom: "20px" }}>
              {(() => {
                const CIRCLE_TAB_SECTIONS = [
                  { id: "feed", label: "Feed" },
                  { id: "leaderboard", label: "Board" },
                  { id: "chat", label: "Chat" },
                  { id: "members", label: "Members" },
                  { id: "trophies", label: "Trophies" },
                ];
                const handleTabChange = (t: typeof circleTab) => {
                  setCircleTab(t);
                  if (t === "chat") loadChatMessages(activeCircle.code);
                  if (t === "members" && activeCircle) {
                    setMembersLoading(true);
                    readCircleMembers(activeCircle.code, activeCircle.members || [])
                      .then(fresh => { setActiveCircle((c: unknown) => c ? { ...(c as object), members: fresh } : c); })
                      .catch((err) => { console.error("Failed to refresh members:", err); })
                      .finally(() => setMembersLoading(false));
                  }
                };
                return isDesktop ? (
                  /* Desktop: underline tab bar */
                  <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, overflowX: "auto", gap: 0, marginBottom: circleTab === "leaderboard" ? "10px" : 0 }}>
                    {(["feed", "leaderboard", "chat", "members", "trophies"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => handleTabChange(t)}
                        style={{
                          background: "none",
                          border: "none",
                          borderBottom: `2px solid ${circleTab === t ? C.text : "transparent"}`,
                          marginBottom: -1,
                          padding: "9px 12px",
                          cursor: "pointer",
                          fontFamily: MONO,
                          fontSize: "10px",
                          fontWeight: 600,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: circleTab === t ? C.text : C.muted,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {t === "leaderboard" ? "Board" : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Mobile: dropdown */
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", paddingBottom: "10px", borderBottom: `1px solid ${C.border}` }}>
                    <SubNavDropdown sections={CIRCLE_TAB_SECTIONS} value={circleTab} onChange={(s: string) => handleTabChange(s as typeof circleTab)} C={C} />
                  </div>
                );
              })()}
              {/* Leaderboard sort controls */}
              {circleTab === "leaderboard" && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", paddingTop: "10px" }}>
                  {(["all", "week"] as const).map(s => (
                    <button key={s} onClick={() => {
                      setLbSort(s);
                      if (activeCircle) {
                        setLoadingLB(true);
                        fetchCircleLeaderboard(activeCircle, s)
                          .then(e => { setLeaderboard(e); setLoadingLB(false); })
                          .catch(() => setLoadingLB(false));
                      }
                    }}
                      style={{ background: lbSort === s ? C.text2 + "22" : "transparent", border: `1px solid ${lbSort === s ? C.text2 : C.border2}`, borderRadius: "999px", padding: "4px 10px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", color: lbSort === s ? C.text : C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {s === "all" ? "ALL TIME" : "THIS WEEK"}
                    </button>
                  ))}
                  <button
                    disabled={loadingLB}
                    onClick={async () => {
                      if (loadingLB) return;
                      setLoadingLB(true);
                      try {
                        const e = await fetchCircleLeaderboard(activeCircle, lbSort);
                        setLeaderboard(e);
                      } finally {
                        setLoadingLB(false);
                      }
                    }}
                    style={{ background: "none", border: "none", color: loadingLB ? C.dim : C.muted, cursor: loadingLB ? "default" : "pointer", fontFamily: MONO, fontSize: "11px", opacity: loadingLB ? 0.5 : 1 }}
                  >↻</button>
                </div>
              )}
            </div>

            {/* ── FEED TAB ── */}
            {circleTab === "feed" && (
              <div style={{ paddingBottom: 90, display: "flex", flexDirection: "column", gap: 8 }}>
                {feedLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.panel, backgroundImage: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2} 50%, ${C.panel} 100%)`, backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />
                          <Skeleton height={10} width="40%" />
                        </div>
                        <Skeleton height={14} width="70%" mb={8} />
                        <Skeleton height={10} width="55%" />
                      </div>
                    ))}
                  </div>
                )}

                {feedItems.map(item => {
                  if (item.type === "trade") {
                    return (
                      <SharedTradeCard
                        key={`trade-${item.data.id}`}
                        trade={item.data}
                        myCode={getMyCode()}
                        C={C}
                        onReact={async (id, emoji) => {
                          await reactToSharedTrade(id, emoji, {
                            authorCode: item.data.authorCode,
                            currentUid: profile?.uid ?? undefined,
                            contextLabel: item.data.strategy ?? item.data.pair ?? undefined,
                          });
                          setFeedItems(prev => prev.map(fi => {
                            if (fi.type !== "trade" || fi.data.id !== id) return fi;
                            const reactions = { ...(fi.data.reactions ?? {}) };
                            const existing = reactions[emoji] ?? [];
                            const myCode = getMyCode();
                            reactions[emoji] = existing.includes(myCode)
                              ? existing.filter(c => c !== myCode)
                              : [...existing, myCode];
                            return { ...fi, data: { ...fi.data, reactions } };
                          }));
                        }}
                      />
                    );
                  }
                  if (item.type === "message") {
                    return (
                      <div key={`msg-${item.data.id}`} style={{ display: "flex", gap: 9, padding: "5px 0" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.panel, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: C.text2, flexShrink: 0, marginTop: 2 }}>
                          {(stripHandlePrefix(item.data.senderHandle) || item.data.senderName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 2 }}>
                            <span style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: C.text }}>@{stripHandlePrefix(item.data.senderHandle) || item.data.senderName}</span>
                            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{fmtMsgTime(item.data.createdAt)}</span>
                          </div>
                          <div style={{ fontFamily: BODY, fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{item.data.text}</div>
                        </div>
                      </div>
                    );
                  }
                  if (item.type === "challenge_started") {
                    return (
                      <div key={`ch-${item.data.id}`} style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.04em", textAlign: "center", padding: "4px 0" }}>
                        challenge started · {item.data.title}
                      </div>
                    );
                  }
                  if (item.type === "member_joined") {
                    return (
                      <div key={`join-${item.data.id}`} style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.04em", textAlign: "center", padding: "4px 0" }}>
                        {item.data.text}
                      </div>
                    );
                  }
                  return null;
                })}

                {!feedLoading && feedItems.length === 0 && (
                  <div style={{ fontFamily: BODY, fontSize: 13, color: C.muted, textAlign: "center", padding: "32px 0" }}>No activity yet. Say something!</div>
                )}
                <div ref={feedBottomRef} />
              </div>
            )}

            {/* ── LEADERBOARD ── */}
            {circleTab === "leaderboard" && (
              <div>
                {lbError && (
                  <div style={{ padding: "20px", textAlign: "center", fontFamily: BODY, fontSize: "13px", color: C.muted }}>
                    Couldn't load leaderboard. <button onClick={async () => { if (!activeCircle) return; setLoadingLB(true); setLbError(false); try { const [e, ch] = await Promise.all([fetchCircleLeaderboard(activeCircle, lbSort), fetchActiveChallenge(activeCircle.code)]); setLeaderboard(e); setActiveChallenge(ch); } catch { setLbError(true); } setLoadingLB(false); }} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontFamily: MONO, fontSize: "11px", textDecoration: "underline" }}>Try again</button>
                  </div>
                )}
                {loadingLB ? (
                  <div>
                    {[0,1,2,3,4].map(i => <SkeletonRow key={i} />)}
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center", background: C.panel, borderRadius: "12px" }}>
                    <div style={{ fontFamily: MONO, fontSize: "24px", color: C.border2, marginBottom: "12px" }}>—</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: "16px", fontStyle: "italic", color: C.text2, marginBottom: "6px" }}>No stats published yet.</div>
                    <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted }}>Be the first — hit "Publish My Stats" above.</div>
                  </div>
                ) : (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {(() => {
                      const myCode = getMyCode();
                      const renderRow = (entry: typeof leaderboard[number], i: number) => {
                        const isMe = entry.memberCode === myCode;
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
                                  {isMe && <span style={{ fontFamily: MONO, fontSize: "10px", color: C.green, letterSpacing: "0.12em", textTransform: "uppercase" }}>· YOU</span>}
                                </div>
                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "3px", fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                  <span>{entry.total} trades</span>
                                  <span style={{ color: Number(entry.winRate ?? 0) >= 50 ? C.green : Number(entry.winRate ?? 0) > 0 ? C.red : C.muted }}>{Number(entry.winRate ?? 0).toFixed(0)}% WR</span>
                                  {entry.topStrategy && <span>{stratCode(entry.topStrategy)}</span>}
                                  {entry.streak?.count >= 2 && <span style={{ color: entry.streak.type === "Win" ? C.green : C.red }}>{entry.streak.count}{entry.streak.type === "Win" ? "W" : "L"}</span>}
                                </div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                                <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 700, color: pnlCol, letterSpacing: "-0.01em", lineHeight: 1 }}>{md.val}</div>
                                <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.06em" }}>{md.label}</div>
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={{ padding: "0 10px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                  <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.14em", marginBottom: "4px" }}>
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
                                    <button onClick={(e) => { e.stopPropagation(); if (isFollowing) { unfollowUser(entry.memberCode); } else { followUser(entry.memberCode); } }}
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
                                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", padding: 0, textDecoration: "underline" }}>View Profile →</button>
                                )}
                                {entry.updatedAt && (
                                  <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                                    Last published · {new Date(entry.updatedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      };
                      return (
                        <>
                          {leaderboard.map((entry, i) => renderRow(entry, i))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ── CHAT ── */}
            {circleTab === "chat" && (() => {
              const myId = profile?.uid;
              return (
                <div>
                  <div style={{ borderTop: `1px solid ${C.border}`, minHeight: "280px", maxHeight: "min(48dvh, 480px)", overflowY: "auto", paddingTop: "8px" }}>
                    {chatLoading
                      ? <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 14 }}>
                          {[{ side: "left", w: "70%" }, { side: "right", w: "55%" }, { side: "left", w: "60%" }, { side: "right", w: "45%" }].map((row, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: row.side === "right" ? "flex-end" : "flex-start", gap: 8 }}>
                              {row.side === "left" && <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.panel, backgroundImage: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2} 50%, ${C.panel} 100%)`, backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite", flexShrink: 0 }} />}
                              <div style={{ background: C.panel, height: 32, width: row.w, borderRadius: "16px", backgroundImage: `linear-gradient(90deg, ${C.panel} 0%, ${C.border2} 50%, ${C.panel} 100%)`, backgroundSize: "200% 100%", animation: "kShimmer 1.4s ease-in-out infinite" }} />
                            </div>
                          ))}
                        </div>
                      : chatMessages.length === 0
                        ? <div style={{ padding: "48px 0", textAlign: "center" }}>
                            <div style={{ fontFamily: MONO, fontSize: "22px", color: C.border2, marginBottom: "10px", letterSpacing: "0.14em" }}>· · ·</div>
                            <div style={{ fontFamily: DISPLAY, fontSize: "16px", fontStyle: "italic", color: C.text2, marginBottom: "6px" }}>No messages yet.</div>
                            <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted }}>Be the first to say something.</div>
                          </div>
                        : (chatMessages as ChatMsg[]).map((msg, i) => {
                            const isMe = msg.sender_id === myId;
                            return (
                              <Fragment key={msg.id}>
                                {msg.id === firstUnreadId && i > 0 && (
                                  <div style={{
                                    display: "flex", alignItems: "center", gap: 8,
                                    margin: "6px 0", fontFamily: MONO, fontSize: 9,
                                    letterSpacing: "0.14em", color: C.accent,
                                  }}>
                                    <div style={{ flex: 1, height: 1, background: C.accent, opacity: 0.4 }} />
                                    NEW
                                    <div style={{ flex: 1, height: 1, background: C.accent, opacity: 0.4 }} />
                                  </div>
                                )}
                                <div style={{ padding: "10px 0", display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: "10px", alignItems: "flex-end" }}>
                                  {!isMe && (
                                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: C.panel, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "10px", color: C.muted, flexShrink: 0, border: `1px solid ${C.border}` }}>
                                      {(msg.sender_name || "?")[0].toUpperCase()}
                                    </div>
                                  )}
                                  <div style={{ maxWidth: "75%" }}>
                                    {!isMe && <div onClick={() => openProfile && msg.sender_handle && openProfile(msg.sender_handle)} style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.08em", marginBottom: "4px", cursor: openProfile && msg.sender_handle ? "pointer" : "default" }}>{msg.sender_name}{msg.sender_handle ? ` @${stripHandlePrefix(msg.sender_handle)}` : ""}</div>}
                                    <div style={{ background: isMe ? C.text : C.panel, color: isMe ? C.bg : C.text, borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontFamily: BODY, fontSize: "14px", lineHeight: 1.5, wordBreak: "break-word", border: isMe ? "none" : `1px solid ${C.border}` }}>{msg.text}</div>
                                    <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, marginTop: "4px", display: "flex", gap: "10px", justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "center" }}>
                                      <span>{fmtMsgTime(msg.created_at)}</span>
                                      {isMe && <button onClick={() => deleteChatMessage(msg.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "10px", padding: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Delete</button>}
                                    </div>
                                  </div>
                                </div>
                              </Fragment>
                            );
                          })
                    }
                    <div ref={chatBottomRef} />
                  </div>
                  {/* Fixed compose bar — same positioning pattern as the feed compose bar
                      so the bottom nav (~80px tall + safe area) doesn't cover the input. */}
                  <div style={{ position: "fixed" as const, bottom: "calc(80px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 500, padding: "10px 16px 14px", background: `linear-gradient(to top, ${C.bg} 80%, transparent)`, display: "flex", gap: "10px", alignItems: "flex-end", zIndex: 40 }}>
                    <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(activeCircle.code, myId); } }}
                      placeholder="Message the circle…" rows={2}
                      style={{ ...inp, flex: 1, resize: "none", lineHeight: 1.5, fontFamily: BODY, fontSize: "14px" }} />
                    <button onClick={() => sendChatMessage(activeCircle.code, myId)}
                      disabled={!chatInput.trim() || chatSending || !myId}
                      style={{ ...pillPrimary(!!chatInput.trim() && !chatSending), width: "auto", padding: "10px 18px", opacity: chatSending ? 0.6 : 1, flexShrink: 0 }}>
                      {chatSending ? "…" : "Send"}
                    </button>
                  </div>
                  {/* Spacer so the last message isn't covered by the fixed compose bar. */}
                  <div style={{ height: "calc(110px + env(safe-area-inset-bottom))" }} aria-hidden />
                </div>
              );
            })()}

            {/* ── MEMBERS ── */}
            {circleTab === "members" && (() => {
              const members = activeCircle?.members || [];
              return (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {membersLoading && members.length === 0 && (
                    <div>
                      {[0,1,2].map(i => <SkeletonRow key={i} />)}
                    </div>
                  )}
                  {membersLoading && members.length > 0 && (
                    <div style={{ padding: "8px 0 0", fontFamily: MONO, fontSize: "10px", color: C.muted }}>Refreshing…</div>
                  )}
                  {members.length === 0 && !membersLoading ? (
                    <div style={{ padding: "28px 0", fontFamily: BODY, fontSize: "13px", color: C.muted, fontStyle: "italic" }}>
                      No members found. Members appear here after they open the app.
                    </div>
                  ) : (members as (CircleMember & { alias?: string; isOwner?: boolean; handle?: string })[]).map((m, idx) => {
                    const isMe = m.code === getMyCode();
                    const isFollowing = (following || []).includes(m.code);
                    const lbEntry = (leaderboard as { memberCode: string; totalPnL: number; winRate: number }[]).find(e => e.memberCode === m.code);
                    const canViewProfile = !!openProfile && !!m.handle;
                    const onProfileClick = canViewProfile ? () => openProfile!(m.handle!) : undefined;
                    return (
                      <div key={m.code || idx} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div onClick={onProfileClick} style={{ width: "40px", height: "40px", borderRadius: "50%", background: C.panel, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontSize: "18px", flexShrink: 0, border: `1px solid ${C.border}`, cursor: canViewProfile ? "pointer" : "default" }}>
                          {m.avatar?.startsWith("http")
                            ? <img src={m.avatar} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                            : <span style={{ fontFamily: DISPLAY, fontSize: "14px", fontWeight: 600 }}>{(m.name || "?").slice(0, 2).toUpperCase()}</span>
                          }
                        </div>
                        <div onClick={onProfileClick} style={{ flex: 1, minWidth: 0, cursor: canViewProfile ? "pointer" : "default" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                            <span style={{ fontFamily: DISPLAY, fontSize: "16px", fontWeight: 500, color: C.text, letterSpacing: "-0.01em" }}>{m.name || "Trader"}</span>
                            {isMe && <span style={{ fontFamily: MONO, fontSize: "10px", color: C.green, letterSpacing: "0.12em" }}>· YOU</span>}
                            {(m.code === activeCircle.createdBy || m.isOwner) ? <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.1em" }}>OWNER</span> : null}
                          </div>
                          {m.handle && <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.04em", marginTop: "2px" }}>@{stripHandlePrefix(m.handle)}</div>}
                          {!m.handle && m.alias && <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.06em", marginTop: "2px" }}>{m.alias}</div>}
                          {lbEntry && <div style={{ fontFamily: MONO, fontSize: "10px", color: lbEntry.totalPnL >= 0 ? C.green : C.red, letterSpacing: "0.06em", marginTop: "2px" }}>{lbEntry.totalPnL >= 0 ? "+" : ""}{lbEntry.totalPnL.toFixed(1)}R · {Number(lbEntry.winRate ?? 0).toFixed(0)}% WR</div>}
                        </div>
                        {!isMe && (
                          <button onClick={(e) => { e.stopPropagation(); if (isFollowing) { unfollowUser(m.code); } else { followUser(m.code); } }}
                            style={{ background: isFollowing ? "transparent" : C.text, color: isFollowing ? C.muted : C.bg, border: `1px solid ${isFollowing ? C.border2 : C.text}`, borderRadius: "999px", padding: "6px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, flexShrink: 0 }}>
                            {isFollowing ? "✓" : "+Follow"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* \u2500\u2500 TROPHIES \u2500\u2500 */}
            {circleTab === "trophies" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                {trophiesLoading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[0,1].map(i => (
                      <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 15px", display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 1, height: 36, background: C.border2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <Skeleton height={14} width="45%" mb={6} />
                          <Skeleton height={10} width="30%" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Start Challenge \u2014 Pro owners only, or K\u014dda admin in K\u014dda Global */}
                {(activeCircle?.isOwner || (activeCircle?.code === KODA_GLOBAL_CODE && !!import.meta.env.VITE_KODA_ADMIN_UID && profile?.uid === import.meta.env.VITE_KODA_ADMIN_UID)) && isPro && !activeChallenge && (
                  <button
                    onClick={() => setShowChallengeSheet(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 9, cursor: "pointer", marginBottom: 4, width: "100%" }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: DISPLAY, fontSize: 13, fontWeight: 600, color: C.text }}>Start New Challenge</div>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>Pro · Owner Only</div>
                    </div>
                    <div style={{ color: C.muted, fontSize: 14 }}>→</div>
                  </button>
                )}

                {activeChallenge && (
                  <>
                    <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase", padding: "4px 0 6px" }}>Active</div>
                    <div style={{ background: C.panel, border: `1px solid ${C.border2}`, borderTop: `1.5px solid ${C.text2}`, borderRadius: 10, padding: "13px 15px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.text2, writingMode: "vertical-lr", transform: "rotate(180deg)", flexShrink: 0, textTransform: "uppercase" }}>Live</div>
                      <div style={{ width: 1, height: 36, background: C.border2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 700, color: C.text2 }}>{activeChallenge.title}</div>
                        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 1 }}>In progress</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{activeChallenge.metric.toUpperCase()}</div>
                          <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, flexShrink: 0 }}>{formatCountdown(activeChallenge.endsAt)}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {trophies.length > 0 && (
                  <>
                    <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase", padding: "8px 0 6px" }}>Past Challenges</div>
                    {trophies.map(r => (
                      <div key={r.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderTop: `1.5px solid ${TROPHY_GOLD}`, borderRadius: 10, padding: "13px 15px", display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: TROPHY_GOLD, writingMode: "vertical-lr", transform: "rotate(180deg)", flexShrink: 0, textTransform: "uppercase" }}>1st</div>
                        <div style={{ width: 1, height: 36, background: C.border2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: DISPLAY, fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.winnerHandle ? `@${r.winnerHandle}` : r.winnerName}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.text2, marginTop: 1 }}>{formatTrophyValue(r)}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.challenge?.title ?? ""}</div>
                            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, flexShrink: 0 }}>{new Date(r.snapshotAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {!trophiesLoading && trophies.length === 0 && !activeChallenge && (
                  <div style={{ fontFamily: BODY, fontSize: 13, color: C.muted, textAlign: "center", padding: "32px 0" }}>No challenges yet</div>
                )}
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
              <button onClick={() => { navigator.clipboard?.writeText(`https://kodatrade.co.uk/?join=${activeCircle.code}`); showToast("Link copied"); }}
                style={{ ...pillGhost, padding: "8px 16px" }}>LINK</button>
              <button onClick={() => shareInviteLink(activeCircle)}
                style={{ ...pillPrimary(true), width: "auto", padding: "8px 16px" }}>SHARE</button>
            </div>
            <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted, lineHeight: 1.5 }}>
              LINK copies a join URL · SHARE sends a ready-made invite.
            </div>
          </section>

          {/* Compose bar \u2014 fixed bottom, feed tab only */}
          {circleTab === "feed" && (
            <div style={{ position: "fixed" as const, bottom: "calc(80px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 500, padding: "10px 16px", background: `linear-gradient(to top, ${C.bg} 80%, transparent)`, display: "flex", alignItems: "center", gap: 7, zIndex: 40 }}>
              <input
                value={composeText}
                onChange={e => setComposeText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFeedMessage(); } }}
                placeholder="Message the circle…"
                style={{ flex: 1, background: C.panel, border: `1px solid ${C.border2}`, borderRadius: 999, padding: "9px 15px", fontSize: 13, color: C.text, outline: "none", fontFamily: BODY }}
              />
              <button
                onClick={sendFeedMessage}
                disabled={!composeText.trim() || composeSending}
                style={{ width: 36, height: 36, borderRadius: "50%", background: C.text, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: (!composeText.trim() || composeSending) ? 0.4 : 1 }}
              >
                <span style={{ fontSize: 14, color: C.bg }}>→</span>
              </button>
            </div>
          )}
        </div>
      )}
      {/* Leave circle confirmation sheet */}
      {showLeaveSheet && activeCircle && (
        <div
          onClick={() => setShowLeaveSheet(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, background: C.panel, borderRadius: "16px 16px 0 0", padding: "22px 18px 30px", border: `1px solid ${C.border2}`, borderBottom: "none", animation: "kRise 0.32s ease-out" }}
          >
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8, letterSpacing: "-0.01em" }}>
              Leave “{activeCircle.name}”?
            </div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: C.text2, lineHeight: 1.55, marginBottom: 22 }}>
              You can rejoin anytime with the code <span style={{ fontFamily: MONO, color: C.text }}>{activeCircle.code}</span>.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowLeaveSheet(false)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 999, background: "transparent", color: C.text, border: `1px solid ${C.border2}`, fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { leaveCircle(activeCircle.code); setShowLeaveSheet(false); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 999, background: C.red, color: "#fff", border: "none", fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontWeight: 600 }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Challenge creation bottom sheet */}
      {showChallengeSheet && (
        <div
          onClick={() => { setShowChallengeSheet(false); setChallengeForm({ title: "", metric: "r", duration: "7" }); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, background: C.panel, borderRadius: "16px 16px 0 0", padding: "20px 16px 32px", border: `1px solid ${C.border2}`, borderBottom: "none" }}
          >
            <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 18 }}>Start Challenge</div>

            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>Title</div>
              <input
                placeholder="e.g. Best R This Week"
                value={challengeForm.title}
                onChange={e => setChallengeForm(f => ({ ...f, title: e.target.value }))}
                style={{ ...inp, width: "100%" }}
              />
            </div>

            {/* Metric */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>Metric</div>
              <select
                value={challengeForm.metric}
                onChange={e => setChallengeForm(f => ({ ...f, metric: e.target.value as CircleChallenge["metric"] }))}
                style={{ ...sel, width: "100%" }}
              >
                <option value="r">R-Multiple</option>
                <option value="dollar">$ P&L</option>
                <option value="winrate">Win Rate</option>
                <option value="avgr">Avg R</option>
                <option value="discipline">Discipline</option>
              </select>
              {challengeForm.metric === "discipline" && (
                <div style={{ fontFamily: BODY, fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
                  Ranks members with at least 3 tagged trades in the last 7 days.
                </div>
              )}
            </div>

            {/* Duration */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.muted, marginBottom: 8, textTransform: "uppercase" }}>Duration</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["3","7","14","30"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setChallengeForm(f => ({ ...f, duration: d }))}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${challengeForm.duration === d ? C.text : C.border}`, background: challengeForm.duration === d ? C.text : "transparent", color: challengeForm.duration === d ? C.bg : C.muted, fontFamily: MONO }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={createChallengeFromForm}
              disabled={!challengeForm.title.trim() || challengeCreating}
              style={{ width: "100%", padding: "13px", background: C.text, border: "none", borderRadius: 10, color: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: (!challengeForm.title.trim() || challengeCreating) ? 0.4 : 1, fontFamily: MONO }}
            >
              {challengeCreating ? "Starting…" : "Start Challenge"}
            </button>
          </div>
        </div>
      )}
    </div>
  ); // TradingCircles render
}
