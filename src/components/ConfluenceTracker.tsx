import { useState } from "react";
import type React from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, SectionKicker, stratShort } from "../shared";

// Pre-trade confluence score with threshold settings (min count + required confluences).
// Rendered inside the Checklist view's "pretrade" tab.
interface ConfluenceTrackerProps {
  checkItems: { id: number; text: string }[];
  checkedCount: number;
  totalItems: number;
  isChecked: (id: number) => boolean;
  activeStrategy: string;
  C: Theme;
  stratThresholds: Record<string, { minCount: number; required: number[] }>;
  saveStratThresholds: (u: Record<string, { minCount: number; required: number[] }>) => Promise<void>;
  inp: React.CSSProperties;
  pillGhost: React.CSSProperties;
}

export function ConfluenceTracker({ checkItems, checkedCount, totalItems, isChecked, activeStrategy, C, stratThresholds, saveStratThresholds, inp: _inp, pillGhost }: ConfluenceTrackerProps) {
  const [editMode, setEditMode] = useState(false);
  const thresh = stratThresholds[activeStrategy] || { minCount: Math.ceil(totalItems * 0.75), required: [] };
  const minCount = thresh.minCount || 1;
  const required = thresh.required || [];

  const reqMet = required.every((id: number) => isChecked(id));
  const countMet = checkedCount >= minCount;
  const greenLight = reqMet && countMet;
  const pct = totalItems ? Math.round((checkedCount / totalItems) * 100) : 0;

  const statusCol = greenLight ? C.green : countMet && !reqMet ? C.text2 : C.red;
  const statusText = greenLight ? "CLEAR TO ENTER" : (!countMet) ? `NEED ${minCount - checkedCount} MORE` : "REQUIRED CONFLUENCE MISSING";

  function toggleRequired(id: number) {
    const updated = required.includes(id) ? required.filter((r: number) => r !== id) : [...required, id];
    const u = { ...stratThresholds, [activeStrategy]: { ...thresh, required: updated } };
    saveStratThresholds(u);
  }
  function setMin(val: string) {
    const v = Math.max(1, Math.min(totalItems, parseInt(val) || 1));
    const u = { ...stratThresholds, [activeStrategy]: { ...thresh, minCount: v } };
    saveStratThresholds(u);
  }

  return (
    <div>
      {/* Score — editorial, no card */}
      <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "20px 0", marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.12em", marginBottom: "6px" }}>CONFLUENCE</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontFamily: DISPLAY, fontSize: "2.5rem", fontWeight: 700, color: C.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{checkedCount}</span>
              <span style={{ fontFamily: DISPLAY, fontSize: "1.125rem", color: C.muted, fontWeight: 500 }}>/ {totalItems}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: "6px", letterSpacing: "0.06em" }}>Min required: <span style={{ color: C.text }}>{minCount}</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: MONO, fontSize: "0.6875rem", color: statusCol, letterSpacing: "0.1em", maxWidth: "160px", lineHeight: 1.4 }}>{statusText}</div>
          </div>
        </div>
        {/* Progress bar — 1px hairline */}
        <div style={{ position: "relative", background: C.border, height: "1px", width: "100%" }}>
          <div style={{ background: statusCol, height: "1px", width: `${pct}%`, transition: "width 0.35s ease" }} />
          <div style={{ position: "absolute", top: "-3px", bottom: "-3px", left: `${Math.round((minCount / totalItems) * 100)}%`, width: "1px", background: C.text }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.04em" }}>
          <span>{pct}% MET</span>
          <span>THRESHOLD {Math.round((minCount / totalItems) * 100)}%</span>
        </div>
        {required.length > 0 && (
          <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.1em", marginBottom: "8px" }}>MUST-HAVES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.04em" }}>
              {required.map((rid: number) => {
                const item = checkItems.find((i) => i.id === rid);
                if (!item) return null;
                const met = isChecked(rid);
                return (
                  <span key={rid} style={{ color: met ? C.green : C.red }}>
                    {met ? "✓" : "✕"} {stratShort(item.text)}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        <button onClick={() => setEditMode(!editMode)} style={{ ...pillGhost, marginTop: "16px", width: "100%" }}>
          {editMode ? "CLOSE SETTINGS" : "ENTRY RULE SETTINGS"}
        </button>
      </div>

      {editMode && (
        <div style={{ padding: "4px 0 20px", marginBottom: "4px" }}>
          <SectionKicker label={`ENTRY RULES — ${stratShort(activeStrategy).toUpperCase()}`} C={C} />
          <div style={{ marginTop: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", alignItems: "baseline" }}>
              <label style={{ fontFamily: BODY, fontSize: "0.8125rem", color: C.text }}>Minimum confluences to enter</label>
              <span style={{ fontFamily: MONO, fontSize: "0.8125rem", color: C.text, letterSpacing: "0.04em" }}>{minCount} / {totalItems}</span>
            </div>
            <input type="range" min={1} max={totalItems} value={minCount} onChange={e => setMin(e.target.value)}
              style={{ width: "100%", accentColor: C.text, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontFamily: MONO, fontSize: "0.625rem", color: C.dim, letterSpacing: "0.06em" }}>
              <span>1 LENIENT</span>
              <span>{totalItems} STRICT</span>
            </div>
          </div>
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.1em", marginBottom: "8px" }}>MARK AS REQUIRED</div>
            <div style={{ fontFamily: BODY, fontSize: "0.75rem", color: C.muted, marginBottom: "14px", lineHeight: 1.55 }}>
              Toggle any confluence as required — the clear-to-enter signal only fires if these are checked, regardless of minimum count.
            </div>
            <div style={{ borderTop: `1px solid ${C.border}` }}>
              {checkItems.map((item: { id: number; text: string }) => {
                const isReq = required.includes(item.id);
                return (
                  <div key={item.id} onClick={() => toggleRequired(item.id)}
                    style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: `1px solid ${isReq ? C.text : C.border2}`, background: isReq ? C.text : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isReq && <span style={{ color: C.bg, fontSize: "0.5625rem", lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontFamily: BODY, fontSize: "0.8125rem", color: isReq ? C.text : C.text2, flex: 1, lineHeight: 1.5 }}>{item.text}</span>
                    <span style={{ fontFamily: MONO, fontSize: "0.625rem", color: isReq ? C.text : C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{isReq ? "Required" : "Optional"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
