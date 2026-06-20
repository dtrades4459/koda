import { useState } from "react";
import { ANNOTATION_GRADES, type AnnotationGrade } from "../data/tradeAnnotations";
import { MONO, BODY } from "../shared";

export function gradeOptions(): { value: string; label: string }[] {
  return [{ value: "", label: "No grade" },
    ...ANNOTATION_GRADES.map(g => ({ value: g, label: g }))];
}

interface EditorTheme {
  text: string;
  text2: string;
  muted: string;
  border: string;
  border2: string;
  panel: string;
  bg: string;
  accent?: string;
}

interface Props {
  value: { grade: AnnotationGrade | null; note: string };
  onSave: (grade: AnnotationGrade | null, note: string) => void;
  saving?: boolean;
  C: EditorTheme;
}

export function AnnotationEditor({ value, onSave, saving, C }: Props) {
  const [grade, setGrade] = useState<AnnotationGrade | null>(value.grade ?? null);
  const [note, setNote] = useState<string>(value.note ?? "");
  const accent = C.accent ?? C.text;
  const canSave = !saving && note.trim().length > 0;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontFamily: MONO, fontSize: "0.5625rem", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Grade
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ANNOTATION_GRADES.map(g => {
          const on = grade === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(on ? null : g)}
              style={{ minWidth: 40, padding: "9px 0", background: on ? accent : "transparent", border: `1px solid ${on ? accent : C.border2}`, borderRadius: 8, cursor: "pointer", fontFamily: MONO, fontSize: "0.8125rem", fontWeight: 700, color: on ? C.bg : C.text2, transition: "all 100ms" }}
            >
              {g}
            </button>
          );
        })}
      </div>
      <textarea
        value={note}
        maxLength={2000}
        rows={3}
        placeholder="Note for this trade…"
        onChange={e => setNote(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontFamily: BODY, fontSize: "0.8125rem", lineHeight: 1.5, resize: "vertical", outline: "none" }}
      />
      <button
        type="button"
        disabled={!canSave}
        onClick={() => onSave(grade, note.trim())}
        style={{ alignSelf: "flex-start", padding: "9px 18px", background: canSave ? accent : "transparent", border: `1px solid ${canSave ? accent : C.border2}`, borderRadius: 999, cursor: canSave ? "pointer" : "default", fontFamily: MONO, fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", color: canSave ? C.bg : C.muted, opacity: saving ? 0.6 : 1, transition: "all 100ms" }}
      >
        {saving ? "Saving…" : "Save annotation"}
      </button>
    </div>
  );
}
