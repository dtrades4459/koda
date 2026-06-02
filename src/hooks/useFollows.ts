// ═══════════════════════════════════════════════════════════════════════════════
// useFollows — follow-graph state + sync for Kōda
//
// Owns:  following[], followers[], followerProfiles[]
//        followUser(), unfollowUser()
//        syncFollows useEffect (per-row KV + Realtime sub)
//
// Data source: per-row shared_kv edges (two rows per follow edge, both
// owned by the follower so RLS never blocks a second writer).
//   koda_follow_<me>_<target>      — enumerates who I follow
//   koda_follower_<me>_<follower>  — enumerates who follows me
//
// V2 (public.follows) migration is tracked behind the 'newFollows' flag.
// That path is intentionally removed here to avoid a 3-source merge on
// every load. Wire it back in when the flag is ready to flip globally.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import {
  subscribeToFollows,
  migrateLegacyFollows,
  followUser as kvFollowUser,
  unfollowUser as kvUnfollowUser,
  followKeys,
} from "../data/follows";

// ── Types ───────────────────────────────────────────────────────────────────────────────

export interface FollowerProfile {
  code: string;
  name: string;
  handle: string;
}

interface UseFollowsParams {
  /** True while the initial data load is still in flight — defers sync until false. */
  loading: boolean;
  /** Returns the current user's short trading code. */
  getMyCode: () => string;
  /** Returns the current user's display info — written into new follower edges
   *  so the people following me see my real name/handle, not just my code. */
  getMyProfile: () => { name: string; handle: string };
  /** Profile uid — used for the Realtime channel key. */
  uid: string | undefined;
  /** Toast callback. */
  showToast: (msg: string) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────────────

/** One-time legacy migration per browser — guarded by localStorage flag. */
const MIGRATION_FLAG = "koda_follows_migrated_v1";

export function useFollows({ loading, getMyCode, getMyProfile, uid, showToast }: UseFollowsParams) {
  const [following, setFollowing]           = useState<string[]>([]);
  const [followers, setFollowers]           = useState<string[]>([]);
  const [followerProfiles, setFollowerProfiles]   = useState<FollowerProfile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<FollowerProfile[]>([]);

  // ── Stable refs ────────────────────────────────────────────────────────────────────
  const syncFollowsRef = useRef<() => void>(() => {});
  const getMyCodeRef   = useRef(getMyCode);
  getMyCodeRef.current = getMyCode;
  const getMyProfileRef = useRef(getMyProfile);
  getMyProfileRef.current = getMyProfile;

  // ── Sync effect ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!uid) return;

    let alive = true;

    async function syncFollows() {
      const mc = getMyCodeRef.current();
      try {
        // Two parallel reads — both sides of the edge, both owned by us.
        const [followRows, followerRows] = await Promise.all([
          storage.listByPrefix(followKeys.followPrefix(mc)),
          storage.listByPrefix(followKeys.followerPrefix(mc)),
        ]);
        if (!alive) return;

        const followingSet  = new Set<string>();
        const followersSet  = new Set<string>();
        const followingProfilesList: FollowerProfile[] = [];
        const followerProfilesList:  FollowerProfile[] = [];

        for (const row of followRows || []) {
          const target = String(row.key).slice(followKeys.followPrefix(mc).length);
          if (!target) continue;
          followingSet.add(target);
          try {
            const edge = JSON.parse(row.value || "{}");
            followingProfilesList.push({ code: target, name: edge.name || target, handle: edge.handle || "" });
          } catch {
            followingProfilesList.push({ code: target, name: target, handle: "" });
          }
        }

        for (const row of followerRows || []) {
          const follower = String(row.key).slice(followKeys.followerPrefix(mc).length);
          if (!follower) continue;
          followersSet.add(follower);
          try {
            const edge = JSON.parse(row.value || "{}");
            followerProfilesList.push({ code: follower, name: edge.name || follower, handle: edge.handle || "" });
          } catch {
            followerProfilesList.push({ code: follower, name: follower, handle: "" });
          }
        }

        setFollowing(Array.from(followingSet));
        setFollowers(Array.from(followersSet));
        setFollowerProfiles(followerProfilesList);
        setFollowingProfiles(followingProfilesList);
      } catch { /* network blip — keep previous state */ }
    }

    syncFollowsRef.current = syncFollows;
    syncFollowsRef.current();

    // One-time legacy migration per browser — skip if already done.
    if (!localStorage.getItem(MIGRATION_FLAG)) {
      migrateLegacyFollows(getMyCodeRef.current())
        .then(() => localStorage.setItem(MIGRATION_FLAG, "1"))
        .catch(() => {});
    }

    const unsub = subscribeToFollows(getMyCodeRef.current(), () => syncFollowsRef.current());
    const id    = setInterval(() => syncFollowsRef.current(), 120_000);

    return () => {
      alive = false;
      clearInterval(id);
      try { unsub(); } catch { /* noop */ }
    };
  }, [loading, uid]);

  // ── Follow / unfollow mutations ────────────────────────────────────────────────────────

  async function followUser(code: string, targetName?: string, targetHandle?: string) {
    const target = code.trim().toUpperCase();
    if (!target) return;
    const mc = getMyCodeRef.current();
    if (target === mc) { showToast("That's you"); return; }
    if (following.includes(target)) { showToast("Already following"); return; }

    setFollowing(prev => [...prev, target]);
    // Optimistically enrich the local list so the People tab shows the name
    // immediately, before the Realtime sync round-trip returns.
    if (targetName || targetHandle) {
      setFollowingProfiles(prev => [
        ...prev.filter(p => p.code !== target),
        { code: target, name: targetName || target, handle: targetHandle || "" },
      ]);
    }

    const me = getMyProfileRef.current();

    try {
      await kvFollowUser({
        myCode: mc,
        target,
        myName: me.name || undefined,
        myHandle: me.handle || undefined,
        targetName,
        targetHandle,
      });
    } catch (e) {
      log.error("useFollows.followUser", e, { target });
      // Roll back the optimistic add so the UI doesn't lie about success.
      setFollowing(prev => prev.filter(c => c !== target));
      setFollowingProfiles(prev => prev.filter(p => p.code !== target));
      showToast("Couldn't follow — try again");
      return;
    }
    showToast("Following");
  }

  async function unfollowUser(code: string) {
    const target = code.trim().toUpperCase();
    if (!target) return;
    const mc = getMyCodeRef.current();

    // Snapshot the existing profile so we can restore on rollback.
    const previousProfile = followingProfiles.find(p => p.code === target);

    setFollowing(prev => prev.filter(c => c !== target));
    setFollowingProfiles(prev => prev.filter(p => p.code !== target));

    try {
      await kvUnfollowUser({ myCode: mc, target });
    } catch (e) {
      log.error("useFollows.unfollowUser", e, { target });
      // Roll back so the UI matches reality.
      setFollowing(prev => prev.includes(target) ? prev : [...prev, target]);
      if (previousProfile) {
        setFollowingProfiles(prev => prev.some(p => p.code === target) ? prev : [...prev, previousProfile]);
      }
      showToast("Couldn't unfollow — try again");
      return;
    }
    showToast("Unfollowed");
  }

  return { following, followers, followerProfiles, followingProfiles, followUser, unfollowUser };
}
