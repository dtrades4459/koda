// ═══════════════════════════════════════════════════════════════════════════════
// useCircles — circle membership state + sync for Kōda
//
// Owns:  myCircles[], circlesView, activeCircle, circleForm,
//        circleJoinCode, circleMsg, circleLatestMsgs
//        isCreatingCircle, isJoiningCircle
//        createCircle(), joinCircle(), leaveCircle(), kickMember()
//        publishToCircle(), fetchCircleLeaderboard()
//        readCircleMembers(), readCircleBans(), myMemberRecord()
//        saveMyCircles()
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import { subscribeToCircle } from "../data/circles";
import type { Circle, CircleMember, Profile } from "../types";
import { COMP_CIRCLE_CODE, COMP_STAFF_UIDS, type CompEligibility } from "../lib/competition";
import { METRIC_VALUE, type CircleMetric } from "../lib/leaderboardSort";
import { readVisibility, applyRequiredMetrics } from "../lib/circleVisibility";
import { buildLeaderboardEntry, type PublishedVizFlags } from "../lib/leaderboardEntry";
import { isFounder } from "../lib/team";

// ── Constants ─────────────────────────────────────────────────────────────────

export const KODA_GLOBAL_CODE = "KODA-GLOBAL";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape of a leaderboard row returned by fetchCircleLeaderboard. */
export interface LeaderboardEntry {
  memberCode: string;
  name: string;
  handle: string;
  avatar: string;
  alias?: string;
  wins: number;
  losses: number;
  total: number;
  /** null = withheld by the member's privacy toggle (check viz.winRate). */
  winRate: number | string | null;
  totalPnL: number;
  totalPnLDollar?: number | null;
  weekPnL?: number | null;
  avgRR: number | null;
  streak: { type: string; count: number } | null;
  topStrategy: string | null;
  pnlPercent?: number | null;
  /** Process-metric score 0-100; null when the user has <3 tagged trades in the window. */
  disciplineScore?: number | null;
  /** Letter grade ("A+"..."F") matching disciplineScore. */
  disciplineGrade?: string | null;
  /** % of tagged trades that followed the member's rules. */
  ruleCompliancePct?: number | null;
  taggedCount?: number | null;
  /** Echoed privacy toggles — absent on entries published before 2026-06-12;
   *  readers treat absence as all-visible. */
  viz?: PublishedVizFlags;
  updatedAt: string | null;
  /** True for competition staff — shown as referees, stats excluded from scoring. */
  staff?: true;
  /** Comp-window trades missing a screenshot. Absent on entries published before 2026-06-11. */
  shotsMissing?: number;
}

export interface CircleForm {
  name: string;
  description: string;
  strategy: string;
  privacy: string;
  emoji: string;
  metric: string;
  /** Metrics members must share — written to the circle meta as requiredMetrics. */
  requiredMetrics?: ("pnl" | "winRate" | "discipline" | "avgRR")[];
}

/** Snapshot of the computed trade stats needed by publishToCircle. */
export interface CircleStats {
  wins: number;
  losses: number;
  total: number;
  winRate: string | number;
  totalPnL: string;
  totalPnlDollar: number;
  weekPnL: number;
  avgRR: string;
  streak: { type: string | null; count: number };
  stratStats: Record<string, { w: number; l: number; be: number; pnl: number; count: number }>;
  /** 0-100 discipline score from calcDisciplineScore, or null when not enough tagged trades. */
  disciplineScore: number | null;
  /** Letter grade matching disciplineScore. */
  disciplineGrade: string | null;
  /** % of tagged trades that followed rules (breakdown.rules earned/max). */
  ruleCompliancePct: number | null;
  /** How many trades were rule-tagged in the window. */
  taggedCount: number | null;
}

interface UseCirclesParams {
  /** True while the initial data load is still in flight — defers sync until false. */
  loading: boolean;
  /** Supabase auth user ID — pass `profile.uid` so the effect dep stays a primitive. */
  uid: string | undefined;
  /** Current user profile — used for member records and publish entries. */
  profile: Profile;
  /** Returns the current user's short trading code. */
  getMyCode: () => string;
  /** Which home-tab sub-section is active — controls the latest-msg fetch. */
  homeSection: string;
  /** Snapshot of computed trade stats — used by publishToCircle. Updated via ref. */
  stats: CircleStats;
  /** Cheap hash of win/loss/pnl/avgR — triggers auto-publish when it changes. */
  statsFingerprint: string;
  /** Competition-window filtered stats (June 15–July 15). Used only for the 50K-EVAL-2026 circle. */
  compStats?: CircleStats;
  /** Competition eligibility snapshot — published as shotsMissing on the comp entry. */
  compEligibility?: CompEligibility;
  /** Toast callback. */
  showToast: (msg: string) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCircles({
  loading,
  uid,
  profile,
  getMyCode,
  homeSection,
  stats,
  compStats,
  compEligibility,
  statsFingerprint,
  showToast,
}: UseCirclesParams) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [myCircles, setMyCircles] = useState<Circle[]>([]);
  const [circlesView, setCirclesView] = useState<string>("browse");
  const [activeCircle, setActiveCircle] = useState<Circle | null>(null);
  const [circleForm, setCircleForm] = useState<CircleForm>({
    name: "", description: "", strategy: "", privacy: "public", emoji: "◆", metric: "dollar", requiredMetrics: [],
  });
  const [circleJoinCode, setCircleJoinCode] = useState<string>("");
  const [circleMsg, setCircleMsg] = useState<string>("");
  const [circleLatestMsgs, setCircleLatestMsgs] = useState<Record<string, any>>({});
  const [isCreatingCircle, setIsCreatingCircle] = useState(false);
  const [isJoiningCircle, setIsJoiningCircle] = useState(false);

  // ── Stable refs — avoids stale-closure issues in effects / intervals ───────
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const getMyCodeRef = useRef(getMyCode);
  getMyCodeRef.current = getMyCode;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const compStatsRef = useRef(compStats);
  compStatsRef.current = compStats;
  const compEligibilityRef = useRef(compEligibility);
  compEligibilityRef.current = compEligibility;
  const myCirclesRef = useRef<Circle[]>(myCircles);
  myCirclesRef.current = myCircles;

  // ── Internal helpers ───────────────────────────────────────────────────────

  /** Build the calling user's member record from the current profile snapshot. */
  function myMemberRecord() {
    const storageCode = getMyCodeRef.current();
    const alias = profileRef.current.alias?.trim() || storageCode;
    return {
      name: profileRef.current.name || "Trader",
      handle: profileRef.current.handle || "@trader",
      avatar: profileRef.current.avatar || "",
      code: storageCode,
      alias,
      joinedAt: new Date().toISOString(),
    };
  }

  async function saveMyCircles(u: Circle[]) {
    setMyCircles(u);
    await storage.set("koda_circles", JSON.stringify(u));
  }

  /** Read the ban list for a circle. Returns a Set of banned member codes. */
  async function readCircleBans(circleCode: string): Promise<Set<string>> {
    try {
      const r = await storage.get(`koda_circle_bans_${circleCode}`, true);
      if (!r) return new Set();
      const arr = JSON.parse(r.value);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  }

  /** Read the moderator list for a circle. Returns a Set of member codes.
   *  Same owner-owned-KV pattern as the ban list — deliberately NOT
   *  circle_members.role, which a DB trigger mirrors from the KV member rows
   *  and would clobber on the next sync. */
  async function readCircleMods(circleCode: string): Promise<Set<string>> {
    try {
      const r = await storage.get(`koda_circle_mods_${circleCode}`, true);
      if (!r) return new Set();
      const arr = JSON.parse(r.value);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  }

  async function readCircleMembers(code: string, fallback: CircleMember[] = []) {
    try {
      const [rows, bans] = await Promise.all([
        storage.listByPrefix(`koda_circle_member_${code}_`),
        readCircleBans(code),
      ]);
      if (!rows.length) return fallback.filter((m: CircleMember) => !bans.has(m.code));
      return rows
        .map((r: { value: string }) => JSON.parse(r.value) as CircleMember)
        .filter((m: CircleMember) => !bans.has(m.code));
    } catch { return fallback; }
  }

  // ── Latest circle messages — feeds the Home → Circles sub-section ──────────
  useEffect(() => {
    if (homeSection !== "circles" || !myCircles.length) return;
    (async () => {
      const msgs: Record<string, any> = {};
      await Promise.all(myCircles.map(async (c: Circle) => {
        try {
          const { data } = await supabase
            .from("circle_messages")
            .select("text, author_name, created_at")
            .eq("circle_code", c.code)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) msgs[c.code] = data;
        } catch {}
      }));
      setCircleLatestMsgs(msgs);
    })();
  }, [homeSection, myCircles]);

  // ── Auto-publish to all circles when trade stats change ────────────────────
  // Ref keeps publishToCircle stable so it isn't listed as a dep (it changes
  // every render due to closure over state). The effect correctly re-runs on
  // its real deps: statsFingerprint, myCircles, loading.
  const _publishRef = useRef(publishToCircle);
  _publishRef.current = publishToCircle;
  const _lastPublishRef = useRef(0);
  useEffect(() => {
    if (loading) return;
    if (!myCircles.length) return;
    const publish = _publishRef.current;
    const t = setTimeout(() => {
      const now = Date.now();
      if (now - _lastPublishRef.current < 5000) return;
      _lastPublishRef.current = now;
      myCircles.forEach((c: Circle) => { publish(c.code, true); });
    }, 800);
    return () => clearTimeout(t);
  }, [statsFingerprint, myCircles, loading]); // publishToCircle accessed via ref

  // ── Circle membership sync + Realtime subscriptions ────────────────────────
  // Fix: local myCircles was snapshotted at create/join time. When another
  // member joined, this side never re-read the canonical koda_circle_<code>
  // from shared storage, so the members list (and leaderboard) stayed stale.
  // Pull fresh on mount + every 2 min. Realtime subs fire an immediate re-sync.
  useEffect(() => {
    if (loading) return;
    if (!uid) return;
    let alive = true;
    let migrated = false;

    async function ensureMyMemberRow(circle: Circle) {
      // For circles created before the per-member-row refactor, each user
      // needs to write their own koda_circle_member_<CODE>_<myCode> once.
      const myCode = getMyCodeRef.current();
      const me = {
        name: profileRef.current.name || "Trader",
        handle: profileRef.current.handle || "@trader",
        avatar: profileRef.current.avatar || "",
        code: myCode,
        joinedAt: new Date().toISOString(),
      };
      try {
        await storage.set(`koda_circle_member_${circle.code}_${myCode}`, JSON.stringify(me), true);
      } catch {}
    }

    async function syncCircles() {
      // Cross-device reconcile. koda_circles lives in user_kv, but storage.get()
      // returns the stale local cache first — so a circle created/joined on
      // another device wouldn't appear here, and writing the local list back
      // would CLOBBER it out of user_kv. Read the list fresh and union any
      // remote-only circles into the working set. Because every device unions
      // on each tick, a circle on any device propagates and survives a stale
      // write (self-healing): the device that owns it re-asserts it next tick.
      let working = myCirclesRef.current;
      try {
        const remoteRaw = await storage.getFresh("koda_circles");
        if (remoteRaw) {
          const remoteCircles = JSON.parse(remoteRaw.value) as Circle[];
          if (Array.isArray(remoteCircles)) {
            const localCodes = new Set(working.map((c: Circle) => c.code));
            const extras = remoteCircles.filter((c: Circle) => c?.code && !localCodes.has(c.code));
            if (extras.length) working = [...working, ...extras];
          }
        }
      } catch { /* offline / bad JSON — fall back to the local list */ }
      if (!alive) return;
      if (!working.length) return;
      // One-shot migration on first tick: ensure every circle I'm in has my
      // own member row in shared_kv. Fixes old data that only had inline
      // members[] on the creator's row.
      if (!migrated) {
        migrated = true;
        await Promise.all(working.map(ensureMyMemberRow));
      }
      const refreshed = await Promise.all(working.map(async (c: Circle) => {
        try {
          const [metaRes, members] = await Promise.all([
            storage.get("koda_circle_" + c.code, true),
            readCircleMembers(c.code, c.members || []),
          ]);
          const fresh = metaRes ? JSON.parse(metaRes.value) : c;
          return { ...fresh, members, isOwner: c.isOwner };
        } catch { return c; }
      }));
      if (!alive) return;
      // Compare against actual state (not `working`) so newly-discovered remote
      // circles always land in state even if their meta/members were unchanged.
      const changed = JSON.stringify(refreshed) !== JSON.stringify(myCirclesRef.current);
      if (changed) {
        // Merge refreshed circles with any joined since this sync started.
        // Use the ref (not closure state) for the latest value, then write
        // the same merged array to both React state and KV so they stay in sync.
        const refreshedCodes = new Set(refreshed.map((c: Circle) => c.code));
        const merged = [...refreshed, ...myCirclesRef.current.filter((c: Circle) => !refreshedCodes.has(c.code))];
        setMyCircles(merged);
        try { await storage.set("koda_circles", JSON.stringify(merged)); } catch {}
      }
    }

    syncCircles();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") syncCircles();
    }, 120_000);

    // Realtime: subscribe to every circle the user is currently a member of.
    // The set of circles can change (join/leave/create), so we keep the live
    // unsubs in a map keyed by circle code and reconcile on each tick.
    const liveSubs = new Map<string, () => void>();
    function reconcileSubs() {
      const wantCodes = new Set(myCirclesRef.current.map((c: Circle) => c.code));
      // Drop subs for circles we are no longer in.
      for (const code of Array.from(liveSubs.keys())) {
        if (!wantCodes.has(code)) {
          try { liveSubs.get(code)!(); } catch {}
          liveSubs.delete(code);
        }
      }
      // Add subs for new circles.
      for (const code of wantCodes) {
        if (!liveSubs.has(code)) {
          try { liveSubs.set(code, subscribeToCircle(code, () => { syncCircles(); })); } catch {}
        }
      }
    }
    reconcileSubs();
    // Reconcile every tick so newly-joined circles get a live channel without
    // waiting for a full reload. Cheap — Map lookups + a few subscribe calls.
    const recId = setInterval(() => {
      if (document.visibilityState === "visible") reconcileSubs();
    }, 30_000);

    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(recId);
      for (const off of liveSubs.values()) { try { off(); } catch {} }
      liveSubs.clear();
    };
  }, [loading, uid]); // syncCircles + helpers accessed via refs / closures above

  // ── Circle CRUD ────────────────────────────────────────────────────────────

  async function createCircle() {
    if (!circleForm.name.trim() || isCreatingCircle) return;
    const plan = profileRef.current.plan ?? "free";
    const unlimited = plan === "pro" || plan === "elite" || isFounder(profileRef.current.uid);
    if (!unlimited && myCirclesRef.current.filter((c: Circle) => c.code !== KODA_GLOBAL_CODE).length >= 1) {
      showToast("Upgrade to Pro for unlimited Trading Circles");
      return;
    }
    setIsCreatingCircle(true);
    try {
      const code =
        circleForm.name.replace(/\s+/g, "").toUpperCase().slice(0, 6) +
        "-" +
        Math.random().toString(36).slice(2, 6).toUpperCase();
      const me = myMemberRecord();
      const circle = {
        id: Date.now(),
        code,
        name: circleForm.name.trim(),
        description: circleForm.description.trim(),
        strategy: circleForm.strategy,
        privacy: circleForm.privacy,
        emoji: circleForm.emoji || "◆",
        metric: circleForm.metric || "dollar",
        ...(circleForm.requiredMetrics && circleForm.requiredMetrics.length
          ? { requiredMetrics: circleForm.requiredMetrics }
          : {}),
        createdBy: profileRef.current.name || "Trader",
        createdAt: new Date().toISOString(),
      };
      // Write metadata (owned by me) + my own member row.
      await storage.set("koda_circle_" + code, JSON.stringify(circle), true);
      await storage.set(`koda_circle_member_${code}_${me.code}`, JSON.stringify(me), true);
      const updated = [...myCirclesRef.current, { ...circle, members: [me], isOwner: true }];
      await saveMyCircles(updated as Circle[]);
      setCircleForm({ name: "", description: "", strategy: "", privacy: "public", emoji: "◆", metric: "dollar", requiredMetrics: [] });
      setCirclesView("browse");
      showToast("Circle created");
    } catch {
      showToast("Failed to create circle — try again");
    } finally {
      setIsCreatingCircle(false);
    }
  }

  async function joinCircle() {
    const code = circleJoinCode.trim().toUpperCase();
    if (!code) { setCircleMsg("Enter a circle code."); return; }
    if (myCirclesRef.current.find(c => c.code === code)) {
      setCircleMsg("Already a member.");
      setTimeout(() => setCircleMsg(""), 2000);
      return;
    }
    const plan = profileRef.current.plan ?? "free";
    const unlimited = plan === "pro" || plan === "elite" || isFounder(profileRef.current.uid);
    if (!unlimited && myCirclesRef.current.filter((c: Circle) => c.code !== KODA_GLOBAL_CODE).length >= 1) {
      setCircleMsg("Upgrade to Pro for unlimited circles.");
      setTimeout(() => setCircleMsg(""), 3000);
      return;
    }
    // Check ban list before allowing rejoin
    const bans = await readCircleBans(code);
    if (bans.has(getMyCodeRef.current())) {
      setCircleMsg("You cannot join this circle.");
      setTimeout(() => setCircleMsg(""), 3000);
      return;
    }
    if (isJoiningCircle) return;
    setIsJoiningCircle(true);
    try {
      const res = await storage.get("koda_circle_" + code, true);
      if (!res) {
        setCircleMsg("Circle not found. Check the code.");
        setTimeout(() => setCircleMsg(""), 2500);
        return;
      }
      const circle = JSON.parse(res.value);
      const me = myMemberRecord();
      // Only write my OWN member row. Do not mutate the creator's circle row.
      await storage.set(`koda_circle_member_${code}_${me.code}`, JSON.stringify(me), true);
      const members = await readCircleMembers(code, [me]);
      const updated = [...myCirclesRef.current, { ...circle, members, isOwner: false }];
      await saveMyCircles(updated as Circle[]);

      // Best-effort: notify the circle owner that someone joined
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) {
          const { data: ownerRow } = await supabase
            .from("circle_members")
            .select("user_id")
            .eq("circle_code", code)
            .eq("role", "owner")
            .maybeSingle();
          const ownerUid = ownerRow?.user_id;
          if (ownerUid && ownerUid !== uid) {
            void fetch("/api/push?action=notify-circle-join", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                circleCode: code,
                circleName: circle.name ?? null,
                ownerUid,
                joinerName: profileRef.current.name,
                joinerHandle: profileRef.current.handle,
              }),
            }).catch(() => { /* best-effort */ });
          }
        }
      } catch { /* best-effort */ }

      setCircleJoinCode("");
      setCircleMsg("Joined.");
      setTimeout(() => setCircleMsg(""), 2000);
    } catch {
      setCircleMsg("Error joining. Try again.");
      setTimeout(() => setCircleMsg(""), 2500);
      showToast("Failed to join circle — check the code and try again");
    } finally {
      setIsJoiningCircle(false);
    }
  }

  /** Silent join by code — used by onboarding. Reads from ref to avoid stale closure. */
  async function joinCircleByCode(code: string): Promise<void> {
    if (myCirclesRef.current.find((c: Circle) => c.code === code)) return;
    let res = await storage.get("koda_circle_" + code, true);
    if (!res && code === KODA_GLOBAL_CODE) {
      const circle = {
        id: 1,
        code: KODA_GLOBAL_CODE,
        name: "Kōda",
        description: "The official Kōda community. All traders welcome.",
        strategy: "", privacy: "public", emoji: "◆", metric: "dollar",
        createdBy: "Kōda", createdAt: new Date().toISOString(),
      };
      try { await storage.set("koda_circle_" + KODA_GLOBAL_CODE, JSON.stringify(circle), true); } catch {}
      res = await storage.get("koda_circle_" + code, true);
    }
    if (!res) return;
    const circle = JSON.parse(res.value);
    const me = myMemberRecord();
    await storage.set(`koda_circle_member_${code}_${me.code}`, JSON.stringify(me), true);
    const members = await readCircleMembers(code, [me]);
    await saveMyCircles([...myCirclesRef.current, { ...circle, members, isOwner: false }] as Circle[]);
  }

  /** Circle owner removes a member via ban list (RLS-safe — owner writes a row they own). */
  async function kickMember(circleCode: string, memberCode: string) {
    try {
      const bans = await readCircleBans(circleCode);
      bans.add(memberCode);
      await storage.set(`koda_circle_bans_${circleCode}`, JSON.stringify([...bans]), true);
      // Delete the kicked member's leaderboard entry so they don't stay on the board
      try {
        await storage.del(`koda_circle_entry_${circleCode}_${memberCode}`, true);
      } catch { /* non-fatal */ }
      const filterKicked = (m: CircleMember) => m.code !== memberCode;
      const updated = myCirclesRef.current.map((c: Circle) =>
        c.code !== circleCode ? c : { ...c, members: c.members.filter(filterKicked) }
      );
      await saveMyCircles(updated);
      setActiveCircle((prev: Circle | null) =>
        prev?.code !== circleCode ? prev : { ...prev, members: prev.members.filter(filterKicked) }
      );
      showToast("Member removed");
    } catch (e) {
      log.error("kickMember", e);
      showToast("Couldn't remove member — try again");
    }
  }

  /** Owner promotes/demotes a moderator via the mods list (RLS-safe — owner
   *  writes a row they own). on=true adds, on=false removes. Returns the new
   *  Set so callers can update UI without a re-read. */
  async function setMemberModerator(circleCode: string, memberCode: string, on: boolean): Promise<Set<string>> {
    const mods = await readCircleMods(circleCode);
    if (on) mods.add(memberCode); else mods.delete(memberCode);
    try {
      await storage.set(`koda_circle_mods_${circleCode}`, JSON.stringify([...mods]), true);
      showToast(on ? "Moderator added" : "Moderator removed");
    } catch (e) {
      log.error("setMemberModerator", e, { circleCode });
      showToast("Couldn't update moderators — try again");
    }
    return mods;
  }

  /** Member leaves a circle they joined. Deletes their own member + entry rows. */
  async function leaveCircle(circleCode: string) {
    if (circleCode === KODA_GLOBAL_CODE) {
      showToast("You can't leave the Kōda community.");
      return;
    }
    const myCode = getMyCodeRef.current();
    try {
      await Promise.all([
        storage.del(`koda_circle_member_${circleCode}_${myCode}`, true),
        storage.del(`koda_circle_entry_${circleCode}_${myCode}`, true),
      ]);
    } catch { /* rows may not exist — that's fine */ }
    const updated = myCirclesRef.current.filter((c: Circle) => c.code !== circleCode);
    await saveMyCircles(updated);
    setActiveCircle(null);
    setCirclesView("browse");
    showToast("Left circle");
  }

  async function publishToCircle(circleCode: string, silent = false) {
    const myCode = getMyCodeRef.current();
    const p = profileRef.current;
    const isCompStaff = circleCode === COMP_CIRCLE_CODE && COMP_STAFF_UIDS.has(p.uid ?? "");
    const s = circleCode === COMP_CIRCLE_CODE && compStatsRef.current != null
      ? compStatsRef.current
      : statsRef.current;
    const accountSize = parseFloat((p as any).fundedAmount || (p as any).accountBalance || "0") || 0;
    // Privacy: hidden metrics are nulled BEFORE the row is written — they never
    // reach shared_kv. Circle-required metrics (and the comp circle, hardcoded)
    // override the user's toggles; that requirement is shown at join time.
    const circle = myCirclesRef.current.find((c: Circle) => c.code === circleCode);
    const viz = applyRequiredMetrics(
      await readVisibility(circleCode),
      circleCode,
      circle?.requiredMetrics,
    );
    const entry = buildLeaderboardEntry({
      me: {
        memberCode: myCode,
        name: p.name || "Trader",
        handle: p.handle || "@trader",
        avatar: p.avatar || "",
        alias: p.alias?.trim() || myCode,
      },
      stats: s,
      viz,
      accountSize,
      extras: {
        ...(circleCode === COMP_CIRCLE_CODE && compEligibilityRef.current
          ? { shotsMissing: compEligibilityRef.current.missingShots }
          : {}),
        ...(isCompStaff ? { staff: true as const } : {}),
      },
    });
    try {
      await storage.set(
        "koda_circle_entry_" + circleCode + "_" + myCode,
        JSON.stringify(entry),
        true
      );
    } catch (e) {
      if (!silent) showToast("Publish failed");
      return;
    }
    if (!silent) showToast("Stats published");
  }

  async function fetchCircleLeaderboard(circle: Circle, sort: "all" | "week" = "all") {
    // Always pull members fresh — sync effect may not have run yet, or a new
    // member may have joined since the last tick.
    const members = await readCircleMembers(circle.code, circle.members || []);

    // Batch fetch all entry rows in a single query instead of one per member.
    const prefix = `koda_circle_entry_${circle.code}_`;
    const rowMap: Record<string, LeaderboardEntry> = {};
    try {
      const rows = await storage.listByPrefix(prefix);
      for (const row of rows || []) {
        try {
          const parsed = JSON.parse(row.value);
          const memberCode = row.key.slice(prefix.length);
          rowMap[memberCode] = parsed;
        } catch { /* skip malformed rows */ }
      }
    } catch { /* fall through to per-member defaults */ }

    const entries: LeaderboardEntry[] = [];
    for (const m of members) {
      if (rowMap[m.code]) {
        entries.push(rowMap[m.code] as LeaderboardEntry);
      } else {
        entries.push({
          memberCode: m.code, name: m.name, handle: m.handle, avatar: m.avatar,
          wins: 0, losses: 0, total: 0, winRate: 0, totalPnL: 0, avgRR: 0,
          streak: null, topStrategy: null,
          disciplineScore: null, disciplineGrade: null,
          updatedAt: null,
        });
      }
    }

    if (sort === "week") {
      entries.sort((a, b) => (b.weekPnL || 0) - (a.weekPnL || 0));
    } else {
      // Unknown/missing circle.metric falls back to dollar, as before.
      const mv = METRIC_VALUE[(circle.metric || "dollar") as CircleMetric] ?? METRIC_VALUE.dollar;
      entries.sort((a, b) => mv(b) - mv(a));
    }
    return entries;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    // State
    myCircles, setMyCircles,
    circlesView, setCirclesView,
    activeCircle, setActiveCircle,
    circleForm, setCircleForm,
    circleJoinCode, setCircleJoinCode,
    circleMsg, setCircleMsg,
    circleLatestMsgs,
    isCreatingCircle,
    isJoiningCircle,
    // Helpers exposed for use in Koda.tsx (onboarding + loadAll)
    saveMyCircles,
    myMemberRecord,
    readCircleMembers,
    readCircleMods,
    // Actions
    createCircle,
    joinCircle,
    joinCircleByCode,
    kickMember,
    setMemberModerator,
    leaveCircle,
    publishToCircle,
    fetchCircleLeaderboard,
  };
}
