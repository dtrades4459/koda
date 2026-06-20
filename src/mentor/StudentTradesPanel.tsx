// ─────────────────────────────────────────────────────────────────────────────
// Kōda · Mentor Mode — per-student drill-in inside the coach dashboard.
// Lists the trades a student shared into the cohort; the owner grades + notes
// each via AnnotationEditor. Reuses the Task-4 data layer; no new queries here.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { fetchSharedTrades } from "../data/circlesSharedTrades";
import { upsertAnnotation, type TradeAnnotation, type AnnotationGrade } from "../data/tradeAnnotations";
import { AnnotationEditor } from "../components/AnnotationEditor";
import type { SharedTrade } from "../types";

interface PanelTheme {
  text: string;
  text2: string;
  muted: string;
  border: string;
  border2: string;
  panel: string;
  bg: string;
  surface?: string;
  accent?: string;
}

interface Props {
  circleCode: string;
  student: { code: string; name: string };
  annotations: Record<string, TradeAnnotation>;
  onSaved: () => void;
  myUid: string;
  C: PanelTheme;
}

export function StudentTradesPanel({ circleCode, student, annotations, onSaved, myUid, C }: Props) {
  const [trades, setTrades] = useState<SharedTrade[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setTrades(null);
    fetchSharedTrades(circleCode, 200).then(all => {
      if (alive) setTrades(all.filter(t => t.authorCode === student.code));
    });
    return () => { alive = false; };
  }, [circleCode, student.code]);

  async function save(sharedTradeId: string, grade: AnnotationGrade | null, note: string) {
    setSavingId(sharedTradeId);
    const res = await upsertAnnotation({ sharedTradeId, mentorUid: myUid, grade, note });
    setSavingId(null);
    if (res === "ok") onSaved();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ color: C.text, fontWeight: 600 }}>{student.name}'s shared trades</div>
      {trades === null && <div style={{ color: C.muted }}>Loading…</div>}
      {trades !== null && trades.length === 0 && (
        <div style={{ color: C.muted }}>
          {student.name} hasn't shared any trades into this cohort yet.
        </div>
      )}
      {(trades ?? []).map(t => {
        const existing = annotations[t.id];
        return (
          <div key={t.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: C.panel, display: "grid", gap: 8 }}>
            <div style={{ color: C.text2, fontSize: "0.8125rem" }}>
              {t.pair} · {t.side} · {t.outcome} · {t.date}
            </div>
            {existing && (
              <div style={{ color: C.muted, fontSize: "0.75rem" }}>
                Current: {existing.grade ? `[${existing.grade}] ` : ""}{existing.note}
              </div>
            )}
            <AnnotationEditor
              value={{ grade: existing?.grade ?? null, note: existing?.note ?? "" }}
              saving={savingId === t.id}
              onSave={(grade, note) => save(t.id, grade, note)}
              C={C}
            />
          </div>
        );
      })}
    </div>
  );
}
