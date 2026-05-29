import { useState } from "react";
import type React from "react";
import type { Theme } from "../theme";
import type { StrategyDef } from "../types";
import { MONO, BODY } from "../shared";

// Modal-style card rendered inside the Checklist view when the user clicks
// "+ New" or "Edit". Handles name, code abbreviation, and optional setups list.
// Checklist items and rules are managed separately in the checklist tab itself.
interface StrategyEditorProps {
  draft: StrategyDef & { name: string };
  setDraft: React.Dispatch<React.SetStateAction<StrategyDef & { name: string }>>;
  onSave: () => void;
  onCancel: () => void;
  isEdit: boolean;
  C: Theme;
  inp: React.CSSProperties;
  lbl: React.CSSProperties;
}

export function StrategyEditor({ draft, setDraft, onSave, onCancel, isEdit, C, inp, lbl }: StrategyEditorProps) {
  const [newSetup, setNewSetup] = useState("");
  const canSave = !!(draft.name || "").trim();
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px 16px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {isEdit ? "Edit Strategy" : "New Strategy"}
      </div>

      {/* Name */}
      <div>
        <label style={lbl}>Strategy Name *</label>
        <input
          autoFocus
          value={draft.name}
          onChange={e => setDraft((d) => ({ ...d, name: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter" && canSave) onSave(); if (e.key === "Escape") onCancel(); }}
          placeholder="e.g. Opening Range Breakout"
          style={{ ...inp }}
        />
      </div>

      {/* Code */}
      <div>
        <label style={lbl}>Code (up to 4 chars · auto-derived if blank)</label>
        <input
          value={draft.code}
          onChange={e => setDraft((d) => ({ ...d, code: e.target.value.replace(/[^A-Z0-9&]/gi, "").slice(0, 4).toUpperCase() }))}
          placeholder={draft.name ? (draft.name.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase() || "CODE") : "CODE"}
          maxLength={4}
          style={{ ...inp, fontFamily: MONO, letterSpacing: "0.14em", textTransform: "uppercase" }}
        />
      </div>

      {/* Setups */}
      <div>
        <label style={lbl}>Setups (optional — used when tagging trades)</label>
        {(draft.setups || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
            {(draft.setups || []).map((s: string, i: number) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: C.panel2 ?? C.bg, border: `1px solid ${C.border2}`, borderRadius: "999px", padding: "4px 10px 4px 12px", fontFamily: MONO, fontSize: "10px", color: C.text2 ?? C.muted, letterSpacing: "0.06em" }}>
                {s}
                <button
                  aria-label={`Remove setup ${s}`}
                  onClick={() => setDraft((d) => ({ ...d, setups: d.setups.filter((_: string, j: number) => j !== i) }))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 0, fontSize: "13px", lineHeight: 1, display: "flex", alignItems: "center" }}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            value={newSetup}
            onChange={e => setNewSetup(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && newSetup.trim()) {
                setDraft((d) => ({ ...d, setups: [...(d.setups || []), newSetup.trim()] }));
                setNewSetup("");
              }
              if (e.key === "Escape") setNewSetup("");
            }}
            placeholder="Type a setup name, press Enter to add"
            style={{ ...inp, flex: 1 }}
          />
          {newSetup.trim() && (
            <button
              onClick={() => { setDraft((d) => ({ ...d, setups: [...(d.setups || []), newSetup.trim()] })); setNewSetup(""); }}
              style={{ background: C.text, color: C.bg, border: "none", borderRadius: "999px", padding: "8px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
              Add
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={onSave}
          disabled={!canSave}
          style={{ flex: 1, background: canSave ? C.text : "transparent", color: canSave ? C.bg : C.muted, border: canSave ? "none" : `1px solid ${C.border2}`, borderRadius: "999px", padding: "13px 20px", fontSize: "13px", cursor: canSave ? "pointer" : "not-allowed", fontFamily: BODY, letterSpacing: "0.02em", transition: "opacity 0.15s" }}>
          {isEdit ? "Save Changes" : "Add Strategy"}
        </button>
        <button
          onClick={onCancel}
          style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border2}`, borderRadius: "999px", padding: "13px 18px", fontSize: "12px", cursor: "pointer", fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
