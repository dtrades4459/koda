// src/components/InSessionStatsCard.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · InSessionStatsCard
//
// Stats-tab card showing the 7-day rollup of in-session intervention firings.
// Hides itself if nothing has fired yet so users don't see an empty box.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { Trade } from "../types";
import { getInterventionStats, type InterventionStats } from "../data/interventions";

export function InSessionStatsCard({
  userUid, trades, C,
}: { userUid: string; trades: Trade[]; C: Theme }) {
  const [stats, setStats] = useState<InterventionStats | null>(null);

  useEffect(() => {
    if (!userUid) return;
    let alive = true;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    (async () => {
      const s = await getInterventionStats(userUid, sevenDaysAgo);
      if (alive) setStats(s);
    })();
    return () => { alive = false; };
  }, [userUid, trades.length]);

  if (!stats) return null;
  if (stats.fired === 0) return null;

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 16, marginBottom: 12,
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: C.muted, marginBottom: 10,
      }}>
        In-Session Check-Ins · Last 7d
      </div>
      <div style={{ fontFamily: BODY, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
        <strong>{stats.fired}</strong> fired · <strong>{stats.continued}</strong> continued · <strong>{stats.cancelled}</strong> cancelled
      </div>
      {stats.continued > 0 && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 6, letterSpacing: "0.04em" }}>
          Post-intervention trades: {stats.postInterventionTrades}
        </div>
      )}
    </div>
  );
}
