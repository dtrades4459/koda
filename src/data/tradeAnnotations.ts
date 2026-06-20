// ─────────────────────────────────────────────────────────────────────────────
// Kōda · Mentor Mode — annotation data layer (annotations on shared trades).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "../lib/supabase";
import { log } from "../lib/log";

export type AnnotationGrade = "A" | "B" | "C" | "D" | "F";
export const ANNOTATION_GRADES: readonly AnnotationGrade[] = ["A", "B", "C", "D", "F"];

export interface TradeAnnotation {
  id: string;
  sharedTradeId: string;
  mentorUid: string;
  grade: AnnotationGrade | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export function rowToAnnotation(row: Record<string, unknown>): TradeAnnotation {
  return {
    id: row.id as string,
    sharedTradeId: row.shared_trade_id as string,
    mentorUid: row.mentor_uid as string,
    grade: (row.grade as AnnotationGrade | null) ?? null,
    note: (row.note as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function upsertAnnotation(input: {
  sharedTradeId: string;
  mentorUid: string;
  grade: AnnotationGrade | null;
  note: string;
}): Promise<"ok" | "error"> {
  const { error } = await supabase
    .from("trade_annotations")
    .upsert(
      {
        shared_trade_id: input.sharedTradeId,
        mentor_uid: input.mentorUid,
        grade: input.grade,
        note: input.note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shared_trade_id,mentor_uid" },
    );
  if (error) {
    log.error("tradeAnnotations.upsertAnnotation", error, { sharedTradeId: input.sharedTradeId });
    return "error";
  }
  return "ok";
}

export async function fetchAnnotationsForCircle(
  circleCode: string,
): Promise<Record<string, TradeAnnotation>> {
  // Inner-join shared trades of this circle; RLS already restricts visibility.
  const { data, error } = await supabase
    .from("trade_annotations")
    .select("*, circle_shared_trades!inner(circle_code)")
    .eq("circle_shared_trades.circle_code", circleCode);
  if (error) {
    log.error("tradeAnnotations.fetchAnnotationsForCircle", error, { circleCode });
    return {};
  }
  const out: Record<string, TradeAnnotation> = {};
  for (const row of data ?? []) {
    const a = rowToAnnotation(row as Record<string, unknown>);
    out[a.sharedTradeId] = a; // one mentor in Phase A → last write wins
  }
  return out;
}
