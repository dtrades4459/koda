// ═══════════════════════════════════════════════════════════════════════════════
// TRADR · LogTradeScreen
//
// Extracted from TRADR.tsx — the "log" view (view === "log").
// Adds the ruleAdherence Y/N toggle which was in the Trade type but had no UI.
// All state lives in the parent Tradr component and is passed down as props.
// ═══════════════════════════════════════════════════════════════════════════════

import React from "react";
import type { Trade } from "./types";
import { SectionKicker, StrategyPill, MONO, BODY, DISPLAY } from "./shared";
import { SESSIONS, BIAS, EMOTION_TAGS, getEmotionTags } from "./tradeConstants";

export interface LogTradeScreenProps {
  C: Record<string, string>;
  form: Partial<Trade>;
  setForm: (f: any) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleScreenshotUpload: (e: React.ChangeEvent<HTMLInputElement>, id: string | null) => void;
  removeScreenshot: (id: string | null) => void;
  submitTrade: () => void;
  savingTrade: boolean;
  allStrategyNames: string[];
  _allStratMap: Record<string, { setups: string[] }>;
  allSetups: string[];
  setView: (v: string) => void;
}

export function LogTradeScreen({
  C, form, setForm, editId, setEditId,
  handleChange, handleScreenshotUpload, removeScreenshot,
  submitTrade, savingTrade,
  allStrategyNames, _allStratMap, allSetups, setView,
}: LogTradeScreenProps) {
  const inp: React.CSSProperties = {
    background: "transparent", border: "none",
    borderBottom: `1px solid ${C.border2}`, borderRadius: 0,
    color: C.text, padding: "12px 0", minHeight: "44px",
    fontSize: "16px", width: "100%", outline: "none",
    fontFamily: BODY, boxSizing: "border-box", letterSpacing: "0.01em",
  };
  const sel: React.CSSProperties = { ...inp, cursor: "pointer" };
  const lbl: React.CSSProperties = {
    fontSize: "11px", color: C.muted, letterSpacing: "0.06em",
    marginBottom: "4px", display: "block", fontFamily: MONO, textTransform: "uppercase",
  };
  const pillGhost: React.CSSProperties = {
    background: "transparent", border: `1px solid ${C.border2}`, borderRadius: "999px",
    padding: "10px 20px", color: C.muted, cursor: "pointer",
    fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
    width: "100%", textAlign: "center",
  };

  const live = (C as any).live ?? "oklch(0.84 0.14 175)";
  const enabled = !!(form.pair && form.date && form.outcome && !savingTrade);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "clamp(16px, 4vw, 28px)" }}>
      <SectionKicker label={editId ? "EDIT TRADE" : "NEW TRADE"} C={C} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div><label style={lbl}>Date</label><input type="date" name="date" value={form.date} onChange={handleChange} style={inp} /></div>
        <div><label style={lbl}>Pair / Instrument</label><input name="pair" value={form.pair} onChange={handleChange} placeholder="EURUSD" style={inp} /></div>
      </div>

      <div>
        <label style={lbl}>Strategy</label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
          {allStrategyNames.map((s: string) => (
            <StrategyPill key={s} name={s} selected={form.strategy === s}
              onClick={() => setForm((f: any) => ({ ...f, strategy: form.strategy === s ? "" : s, setup: "" }))} C={C} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div><label style={lbl}>Session</label><select name="session" value={form.session} onChange={handleChange} style={sel}><option value="">Select</option>{SESSIONS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Bias</label><select name="bias" value={form.bias} onChange={handleChange} style={sel}><option value="">Select</option>{BIAS.map(b => <option key={b}>{b}</option>)}</select></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        <div><label style={lbl}>Entry Time</label><input type="time" name="entryTime" value={form.entryTime || ""} onChange={handleChange} style={inp} /></div>
        <div><label style={lbl}>Exit Time</label><input type="time" name="exitTime" value={form.exitTime || ""} onChange={handleChange} style={inp} /></div>
        <div><label style={lbl}>Direction</label><select name="direction" value={form.direction || ""} onChange={handleChange} style={sel}><option value="">Select</option><option>Long</option><option>Short</option></select></div>
      </div>

      <div>
        <label style={lbl}>Setup {form.strategy && <span style={{ color: C.muted, marginLeft: "6px" }}>· {form.strategy.slice(0, 3).toUpperCase()}</span>}</label>
        <select name="setup" value={form.setup} onChange={handleChange} style={sel}>
          <option value="">Select setup</option>
          {(form.strategy ? _allStratMap[form.strategy]?.setups || [] : allSetups).map((s: string) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "12px" }}>
        <div><label style={lbl}>Entry</label><input type="number" name="entryPrice" value={form.entryPrice} onChange={handleChange} placeholder="0.00" style={inp} /></div>
        <div><label style={lbl}>Stop Loss</label><input type="number" name="slPrice" value={form.slPrice} onChange={handleChange} placeholder="0.00" style={inp} /></div>
        <div><label style={lbl}>Take Profit</label><input type="number" name="tpPrice" value={form.tpPrice} onChange={handleChange} placeholder="0.00" style={inp} /></div>
      </div>

      {form.rr && (
        <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Calculated R:R</span>
          <span style={{ fontFamily: DISPLAY, fontSize: "22px", color: C.text, fontWeight: 500, letterSpacing: "-0.02em" }}>{form.rr}R</span>
        </div>
      )}

      {/* Outcome */}
      <div>
        <label style={lbl}>Outcome</label>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          {(["Win", "Loss", "Breakeven"] as const).map(o => {
            const active = form.outcome === o;
            const col = o === "Win" ? C.green : o === "Loss" ? C.red : C.muted;
            return (
              <button key={o} type="button"
                onClick={() => setForm((f: any) => ({ ...f, outcome: active ? "" : o }))}
                style={{
                  flex: 1, padding: "12px 8px", borderRadius: "12px", cursor: "pointer",
                  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase",
                  border: `1px solid ${active ? col : C.border2}`,
                  background: active ? `color-mix(in oklch, ${col} 16%, transparent)` : "transparent",
                  color: active ? col : C.muted, fontWeight: active ? 600 : 400, transition: "all 0.15s",
                }}>{o === "Breakeven" ? "BE" : o}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div><label style={lbl}>P&L (R)</label><input type="number" name="pnl" value={form.pnl} onChange={handleChange} placeholder="+2.5 or -1" style={inp} /></div>
        <div><label style={lbl}>P&L ($)</label><input type="number" name="pnlDollar" value={form.pnlDollar} onChange={handleChange} placeholder="e.g. +320" style={inp} /></div>
      </div>

      <div><label style={lbl}>Notes</label><textarea name="notes" value={form.notes} onChange={handleChange} placeholder="What did price do? Why did you enter?" rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={lbl}>MAE — Max adverse excursion <span style={{ color: C.dim }}>(R)</span></label>
          <input name="mae" type="number" step="0.01" value={form.mae || ""} onChange={handleChange} placeholder="e.g. 0.8" style={inp} />
        </div>
        <div>
          <label style={lbl}>MFE — Max favourable excursion <span style={{ color: C.dim }}>(R)</span></label>
          <input name="mfe" type="number" step="0.01" value={form.mfe || ""} onChange={handleChange} placeholder="e.g. 3.2" style={inp} />
        </div>
      </div>

      {/* Emotional State */}
      <div>
        <label style={lbl}>Emotional State</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
          {EMOTION_TAGS.map(tag => {
            const active = getEmotionTags(form.emotions).includes(tag.id);
            return (
              <button key={tag.id} type="button"
                onClick={() => {
                  const current = getEmotionTags(form.emotions);
                  const next = active ? current.filter(t => t !== tag.id) : [...current, tag.id];
                  setForm((f: any) => ({ ...f, emotions: next }));
                }}
                style={{ background: active ? tag.color + "22" : "transparent", color: active ? tag.color : C.muted, border: `1px solid ${active ? tag.color : C.border2}`, borderRadius: "999px", padding: "6px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.15s ease" }}>
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rule Adherence — was in Trade type but had no UI until now */}
      <div>
        <label style={lbl}>Followed your rules?</label>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          {([{ val: true, label: "YES", color: C.green }, { val: false, label: "NO", color: C.red }] as const).map(opt => {
            const active = form.ruleAdherence === opt.val;
            return (
              <button key={String(opt.val)} type="button"
                onClick={() => setForm((f: any) => ({ ...f, ruleAdherence: active ? null : opt.val }))}
                style={{
                  flex: 1, padding: "12px 8px", borderRadius: "12px", cursor: "pointer",
                  fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                  border: `1px solid ${active ? opt.color : C.border2}`,
                  background: active ? `color-mix(in oklch, ${opt.color} 16%, transparent)` : "transparent",
                  color: active ? opt.color : C.muted, fontWeight: active ? 600 : 400, transition: "all 0.15s",
                }}>{opt.label}</button>
            );
          })}
          {form.ruleAdherence !== null && form.ruleAdherence !== undefined && (
            <button type="button" onClick={() => setForm((f: any) => ({ ...f, ruleAdherence: null }))}
              style={{ padding: "12px 14px", borderRadius: "12px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, transition: "all 0.15s" }}>
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Screenshot */}
      <div>
        <label style={lbl}>Screenshot</label>
        {form.screenshot ? (
          <div style={{ position: "relative", marginTop: "6px" }}>
            <img src={form.screenshot} alt="screenshot" style={{ width: "100%", border: `1px solid ${C.border}`, display: "block", maxHeight: "200px", objectFit: "cover" }} />
            <button onClick={() => removeScreenshot(null)}
              style={{ position: "absolute", top: "8px", right: "8px", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: "999px", color: C.text, padding: "4px 10px", cursor: "pointer", fontSize: "10px", fontFamily: MONO, letterSpacing: "0.08em" }}>REMOVE</button>
          </div>
        ) : (
          <label htmlFor="ssUpload" style={{ display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${C.border2}`, padding: "20px", cursor: "pointer", color: C.muted, fontSize: "12px", fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "8px" }}>
            Upload screenshot
            <input id="ssUpload" type="file" accept="image/jpeg,image/png" onChange={e => handleScreenshotUpload(e, null)} />
          </label>
        )}
      </div>

      {/* Save button */}
      <button onClick={submitTrade} disabled={savingTrade || !(form.pair && form.date && form.outcome)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: enabled ? C.text : (C as any).panel2 ?? C.panel,
          color: enabled ? C.bg : C.muted, border: "none", borderRadius: "14px",
          padding: "5px 6px 5px 20px", fontSize: "14px", fontWeight: 600,
          cursor: enabled ? "pointer" : "not-allowed", width: "100%",
          fontFamily: BODY, marginTop: "8px", opacity: enabled ? 1 : 0.6, transition: "opacity 0.2s",
        }}>
        <span>{savingTrade ? "Saving…" : editId ? "Update trade" : "Save trade"}</span>
        <span style={{ width: "36px", height: "36px", borderRadius: "999px", background: enabled ? live : C.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: enabled ? `0 0 0 4px color-mix(in oklch, ${live} 25%, transparent)` : "none", transition: "box-shadow 0.2s" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke={enabled ? "#0A0A0A" : C.bg} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      {editId && (
        <button onClick={() => { setEditId(null); setView("history"); }}
          style={pillGhost}>CANCEL EDIT</button>
      )}
    </div>
  );
}
