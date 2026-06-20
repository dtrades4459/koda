import { useState } from "react";
import { ANNOTATION_GRADES, type AnnotationGrade } from "../data/tradeAnnotations";

export function gradeOptions(): { value: string; label: string }[] {
  return [{ value: "", label: "No grade" },
    ...ANNOTATION_GRADES.map(g => ({ value: g, label: g }))];
}

interface Props {
  value: { grade: AnnotationGrade | null; note: string };
  onSave: (grade: AnnotationGrade | null, note: string) => void;
  saving?: boolean;
  C: { text2: string; muted: string; surface?: string };
}

export function AnnotationEditor({ value, onSave, saving, C }: Props) {
  const [grade, setGrade] = useState<string>(value.grade ?? "");
  const [note, setNote] = useState<string>(value.note ?? "");
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select
        value={grade}
        onChange={e => setGrade(e.target.value)}
        style={{ color: C.text2, background: C.surface ?? "transparent" }}
      >
        {gradeOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <textarea
        value={note} maxLength={2000} placeholder="Note for this trade…"
        onChange={e => setNote(e.target.value)} rows={3}
        style={{ color: C.text2, background: C.surface ?? "transparent" }}
      />
      <button
        disabled={saving || note.trim().length === 0}
        onClick={() => onSave((grade || null) as AnnotationGrade | null, note.trim())}
        style={{ color: C.muted }}
      >
        {saving ? "Saving…" : "Save annotation"}
      </button>
    </div>
  );
}
