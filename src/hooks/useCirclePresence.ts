// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useCirclePresence — live "who's online" + typing indicator (Phase 2)
//
// Uses Supabase Realtime Presence + broadcast — no database table required.
// Place at: src/hooks/useCirclePresence.ts
//
//   const { online, typingNames, setTyping } = useCirclePresence(circle.code, {
//     id: profile.uid, name: profile.name, handle: profile.handle,
//   });
//   // call setTyping(true) on keypress; it auto-clears after ~3s.
// ═══════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface PresenceUser {
  id: string;
  name: string;
  handle: string;
}

type Me = PresenceUser;

export function useCirclePresence(circleCode: string | undefined, me: Me | null) {
  const [online, setOnline] = useState<PresenceUser[]>([]);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // per-user timers that clear a "typing" flag if no refresh arrives
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!circleCode || !me?.id) return;

    const channel = supabase.channel(`presence_${circleCode}`, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, PresenceUser[]>;
      const users: PresenceUser[] = [];
      const seen = new Set<string>();
      for (const key of Object.keys(state)) {
        const meta = state[key][0];
        if (meta && !seen.has(meta.id)) {
          seen.add(meta.id);
          users.push({ id: meta.id, name: meta.name, handle: meta.handle });
        }
      }
      setOnline(users);
    });

    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      const p = payload as { id: string; name: string };
      if (!p?.id || p.id === me.id) return;
      setTypingNames((prev) => (prev.includes(p.name) ? prev : [...prev, p.name]));
      clearTimeout(typingTimers.current[p.id]);
      typingTimers.current[p.id] = setTimeout(() => {
        setTypingNames((prev) => prev.filter((n) => n !== p.name));
      }, 3500);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({ id: me.id, name: me.name || "Trader", handle: me.handle || "" });
      }
    });

    const timers = typingTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [circleCode, me?.id, me?.name, me?.handle]);

  /** Broadcast that I'm typing. Throttled by the receivers' 3.5s auto-clear. */
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!isTyping || !channelRef.current || !me) return;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { id: me.id, name: me.name || "Trader" },
      });
    },
    [me]
  );

  return { online, typingNames, setTyping };
}
