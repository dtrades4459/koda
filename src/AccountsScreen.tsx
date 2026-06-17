// ═══════════════════════════════════════════════════════════════════════════════
// AccountsScreen.tsx — multi-account dashboard.
// Card per account (P&L, eval progress, drawdown proximity), create/edit/archive,
// and a Pro gate on adding more than one account. Accessible via Home → Accounts.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import type { Account, AccountType, DrawdownType, Trade } from "./types";
import type { Theme } from "./theme";
import { MONO, BODY, DISPLAY } from "./shared";
import { tradesForAccount, evalProgress, drawdownProximity, canAddAccount } from "./lib/accounts";
import type { AccountInput } from "./data/accounts";

interface Props {
  C: Theme;
  accounts: Account[];
  trades: Trade[];
  isPro: boolean;
  defaultAccountId?: string;
  activeAccountId: string | null;
  onSelectAccount: (id: string | null) => void;
  onSaveAccount: (input: AccountInput, editingId?: string) => Promise<void> | void;
  onArchiveAccount: (id: string) => Promise<void> | void;
  onUpgrade: () => void;
}

const TYPES: AccountType[] = ["eval", "funded", "personal", "demo"];
const DD_TYPES: DrawdownType[] = ["trailing", "eod", "static"];

function fmt$(n: number): string {
  const v = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n >= 0 ? `+$${v}` : `-$${v}`;
}

function meterColor(pct: number | null, C: Theme): string {
  if (pct === null) return C.muted;
  if (pct >= 75) return C.red;
  if (pct >= 50) return "#f59e0b";
  return C.green;
}

function Bar({ pct, color, C }: { pct: number; color: string; C: Theme }) {
  return (
    <div style={{ height: "6px", borderRadius: "3px", background: C.border2, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", borderRadius: "3px", background: color, transition: "width 0.4s ease" }} />
    </div>
  );
}

const emptyForm: AccountInput = {
  name: "", type: "eval", propFirm: "", accountSize: null,
  startingBalance: null, profitTarget: null, maxDrawdown: null, drawdownType: "trailing",
};

export function AccountsScreen({
  C, accounts, trades, isPro, defaultAccountId, activeAccountId,
  onSelectAccount, onSaveAccount, onArchiveAccount, onUpgrade,
}: Props) {
  const live = (C as Theme & { live?: string }).live ?? C.green;
  const visible = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountInput>(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    if (!canAddAccount(visible.length, isPro)) { onUpgrade(); return; }
    setEditingId(null); setForm(emptyForm); setOpen(true);
  }
  function openEdit(a: Account) {
    setEditingId(a.id);
    setForm({
      name: a.name, type: a.type, propFirm: a.propFirm ?? "", accountSize: a.accountSize ?? null,
      startingBalance: a.startingBalance ?? null, profitTarget: a.profitTarget ?? null,
      maxDrawdown: a.maxDrawdown ?? null, drawdownType: a.drawdownType,
    });
    setOpen(true);
  }
  async function save() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try { await onSaveAccount(form, editingId ?? undefined); setOpen(false); }
    finally { setSaving(false); }
  }

  const label = { fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4, display: "block" };
  const input = { width: "100%", padding: "9px 12px", borderRadius: "10px", border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontFamily: BODY, fontSize: "0.8125rem", boxSizing: "border-box" as const };
  const chip = (on: boolean) => ({ padding: "6px 12px", borderRadius: "999px", border: `1px solid ${on ? C.text : C.border2}`, background: on ? C.text : "transparent", color: on ? C.bg : C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.06em", textTransform: "uppercase" as const });

  const numOrNull = (s: string): number | null => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: C.text }}>Accounts</span>
        <button onClick={openCreate} style={{ background: live, color: "#0A0A0A", border: "none", borderRadius: "999px", padding: "8px 16px", fontFamily: BODY, fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer" }}>
          + Add account
        </button>
      </div>

      {/* All-accounts toggle */}
      <button onClick={() => onSelectAccount(null)} style={{ ...chip(activeAccountId === null), alignSelf: "flex-start" }}>
        All accounts
      </button>

      {visible.length === 0 && (
        <div style={{ fontFamily: BODY, fontSize: "0.8125rem", color: C.muted, padding: "20px 0" }}>
          No accounts yet. Add one to start tracking per-account P&L, eval progress and drawdown.
        </div>
      )}

      {visible.map(a => {
        const at = tradesForAccount(trades, a.id, defaultAccountId);
        const prog = evalProgress(a, at);
        const dd = drawdownProximity(a, at);
        const active = activeAccountId === a.id;
        return (
          <div key={a.id} onClick={() => onSelectAccount(a.id)} style={{ border: `1px solid ${active ? live : C.border2}`, borderRadius: "16px", padding: "16px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "12px", background: active ? `${live}0d` : "transparent" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: DISPLAY, fontSize: "1rem", fontWeight: 600, color: C.text }}>{a.name}</div>
                <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>
                  {a.type}{a.propFirm ? ` · ${a.propFirm}` : ""} · {at.length} trade{at.length === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={e => { e.stopPropagation(); openEdit(a); }} style={{ background: "transparent", border: `1px solid ${C.border2}`, borderRadius: "8px", color: C.muted, fontFamily: MONO, fontSize: "0.625rem", padding: "4px 8px", cursor: "pointer" }}>Edit</button>
                <button onClick={e => { e.stopPropagation(); void onArchiveAccount(a.id); }} style={{ background: "transparent", border: `1px solid ${C.border2}`, borderRadius: "8px", color: C.muted, fontFamily: MONO, fontSize: "0.625rem", padding: "4px 8px", cursor: "pointer" }}>Archive</button>
              </div>
            </div>

            <div style={{ fontFamily: DISPLAY, fontSize: "1.5rem", fontWeight: 700, color: prog.netPnl >= 0 ? C.green : C.red }}>{fmt$(prog.netPnl)}</div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>To target</span>
                <span style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.text2 ?? C.muted }}>{prog.pct === null ? "—" : `${Math.round(prog.pct)}%`}</span>
              </div>
              <Bar pct={prog.pct ?? 0} color={live} C={C} />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Drawdown used</span>
                <span style={{ fontFamily: MONO, fontSize: "0.625rem", color: meterColor(dd.pct, C) }}>{dd.pct === null ? "—" : `${Math.round(dd.pct)}%`}</span>
              </div>
              <Bar pct={dd.pct ?? 0} color={meterColor(dd.pct, C)} C={C} />
            </div>
          </div>
        );
      })}

      {/* Create / edit sheet */}
      {open && (
        <div onClick={e => { if (e.target === e.currentTarget) setOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "420px", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.1rem", fontWeight: 600, color: C.text }}>{editingId ? "Edit account" : "New account"}</div>

            <div><label style={label}>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Apex #1" style={input} /></div>

            <div>
              <label style={label}>Type</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {TYPES.map(t => <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={chip(form.type === t)}>{t}</button>)}
              </div>
            </div>

            <div><label style={label}>Prop firm (optional)</label><input value={form.propFirm ?? ""} onChange={e => setForm(f => ({ ...f, propFirm: e.target.value }))} placeholder="Apex" style={input} /></div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}><label style={label}>Account size ($)</label><input inputMode="decimal" value={form.accountSize ?? ""} onChange={e => setForm(f => ({ ...f, accountSize: numOrNull(e.target.value) }))} placeholder="50000" style={input} /></div>
              <div style={{ flex: 1 }}><label style={label}>Starting balance ($)</label><input inputMode="decimal" value={form.startingBalance ?? ""} onChange={e => setForm(f => ({ ...f, startingBalance: numOrNull(e.target.value) }))} placeholder="50000" style={input} /></div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}><label style={label}>Profit target ($)</label><input inputMode="decimal" value={form.profitTarget ?? ""} onChange={e => setForm(f => ({ ...f, profitTarget: numOrNull(e.target.value) }))} placeholder="3000" style={input} /></div>
              <div style={{ flex: 1 }}><label style={label}>Max drawdown ($)</label><input inputMode="decimal" value={form.maxDrawdown ?? ""} onChange={e => setForm(f => ({ ...f, maxDrawdown: numOrNull(e.target.value) }))} placeholder="2000" style={input} /></div>
            </div>

            <div>
              <label style={label}>Drawdown type</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {DD_TYPES.map(t => <button key={t} onClick={() => setForm(f => ({ ...f, drawdownType: t }))} style={chip(form.drawdownType === t)}>{t}</button>)}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border2}`, borderRadius: "12px", color: C.muted, fontFamily: BODY, fontSize: "0.8125rem", padding: "11px", cursor: "pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim()} style={{ flex: 2, background: live, color: "#0A0A0A", border: "none", borderRadius: "12px", fontFamily: BODY, fontWeight: 600, fontSize: "0.8125rem", padding: "11px", cursor: saving ? "default" : "pointer", opacity: saving || !form.name.trim() ? 0.6 : 1 }}>{saving ? "Saving…" : editingId ? "Save" : "Create account"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
