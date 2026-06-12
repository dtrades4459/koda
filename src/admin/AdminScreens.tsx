import { useState } from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Card, AvatarCircle } from "../shared";
import { SettingsSub, SectionLabel, MonoTag } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Admin / moderation (cat20)
//
// Components:
//   • ReportQueueScreen — pending content reports list
//   • ReportDetailSheet — context + decide action
//   • AuditLogScreen — chronological account audit feed (support tool)
// ═══════════════════════════════════════════════════════════════════════════

function IconBack({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M14 6l-6 6 6 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Report queue
// ═══════════════════════════════════════════════════════════════════════════

export type ReportStatus = "pending" | "actioned" | "dismissed";
export interface ReportRow {
  id: string;
  contentSnippet: string;
  reporter: string;
  reportedUser: string;
  reason: string;
  reportedAt: string;
  status: ReportStatus;
}

export function ReportQueueScreen({
  C, reports, activeFilter = "pending", onFilter, onSelect, onBack,
}: {
  C: Theme;
  reports: ReportRow[];
  activeFilter?: ReportStatus;
  onFilter?: (s: ReportStatus) => void;
  onSelect?: (id: string) => void;
  onBack?: () => void;
}) {
  const filtered = reports.filter(r => r.status === activeFilter);
  const pendingCount = reports.filter(r => r.status === "pending").length;
  return (
    <SettingsSub
      C={C} title="Reports" onBack={onBack}
      right={pendingCount > 0 ? <MonoTag C={C} tone="red">{pendingCount} pending</MonoTag> : undefined}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
        {(["pending", "actioned", "dismissed"] as const).map(s => {
          const on = activeFilter === s;
          return (
            <button
              key={s}
              onClick={() => onFilter?.(s)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: on ? C.accentSoft : "transparent",
                color: on ? C.accent : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.accent} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                textTransform: "capitalize", whiteSpace: "nowrap",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <Card C={C} pad={24} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: BODY, fontSize: "0.875rem", color: C.text2 }}>
            No {activeFilter} reports.
          </div>
        </Card>
      ) : (
        filtered.map(r => (
          <Card C={C} pad={14} key={r.id} style={{ marginBottom: 8 }}>
            <button
              onClick={() => onSelect?.(r.id)}
              style={{
                width: "100%", display: "flex", flexDirection: "column", gap: 8,
                background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MonoTag C={C} tone="red">{r.reason}</MonoTag>
                <span style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, marginLeft: "auto" }}>
                  {r.reportedAt.toUpperCase()}
                </span>
              </div>
              <div style={{
                fontFamily: BODY, fontSize: "0.8125rem", color: C.text, lineHeight: 1.45,
                background: C.surfaceHi, padding: "10px 12px", borderRadius: 10,
                border: `1px solid ${C.line}`,
              }}>
                "{r.contentSnippet}"
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.04em",
              }}>
                REPORTED @{r.reportedUser.toUpperCase()} · BY @{r.reporter.toUpperCase()}
              </div>
            </button>
          </Card>
        ))
      )}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Report detail
// ═══════════════════════════════════════════════════════════════════════════

export function ReportDetailScreen({
  C, report,
  onWarn, onSuspend, onBan, onRemoveContent, onDismiss, onBack,
}: {
  C: Theme;
  report: ReportRow & { contextLines?: string[] };
  onWarn?: () => void;
  onSuspend?: (days: number) => void;
  onBan?: () => void;
  onRemoveContent?: () => void;
  onDismiss?: () => void;
  onBack?: () => void;
}) {
  const [suspendDays, setSuspendDays] = useState(7);
  return (
    <SettingsSub C={C} title="Report" onBack={onBack}>
      <MonoTag C={C} tone="red">{report.reason}</MonoTag>
      <div style={{
        marginTop: 16,
        background: C.surfaceHi, padding: 14, borderRadius: 12,
        border: `1px solid ${C.line}`,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.14em",
          color: C.muted, textTransform: "uppercase", marginBottom: 8,
        }}>
          Reported content
        </div>
        <div style={{ fontFamily: BODY, fontSize: "0.875rem", color: C.text, lineHeight: 1.55 }}>
          {report.contentSnippet}
        </div>
        {report.contextLines && report.contextLines.length > 0 && (
          <div style={{
            marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}`,
            fontFamily: BODY, fontSize: "0.78125rem", color: C.text2, lineHeight: 1.6,
          }}>
            {report.contextLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>
      <SectionLabel C={C}>Parties</SectionLabel>
      <Card C={C} pad={0}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
          <AvatarCircle name={report.reportedUser} size={36} C={C} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.84375rem", color: C.text, fontFamily: BODY }}>@{report.reportedUser}</div>
            <div style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, marginTop: 2 }}>REPORTED USER</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: `1px solid ${C.line}` }}>
          <AvatarCircle name={report.reporter} size={36} C={C} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.84375rem", color: C.text, fontFamily: BODY }}>@{report.reporter}</div>
            <div style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, marginTop: 2 }}>REPORTER</div>
          </div>
        </div>
      </Card>
      <SectionLabel C={C}>Decision</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={onWarn}
          style={{
            padding: "13px 18px", borderRadius: 999,
            background: "transparent", color: C.warn,
            border: `1px solid color-mix(in oklch, ${C.warn} 30%, transparent)`,
            fontFamily: BODY, fontSize: "0.84375rem", fontWeight: 600, cursor: "pointer", width: "100%",
            textAlign: "left",
          }}
        >
          Warn @{report.reportedUser}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={suspendDays}
            onChange={(e) => setSuspendDays(Number(e.target.value))}
            style={{
              padding: "13px 16px", borderRadius: 999,
              background: "transparent", color: C.text,
              border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: "0.8125rem", cursor: "pointer", minWidth: 110,
            }}
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
          <button
            onClick={() => onSuspend?.(suspendDays)}
            style={{
              flex: 1, padding: "13px 18px", borderRadius: 999,
              background: "transparent", color: C.warn,
              border: `1px solid color-mix(in oklch, ${C.warn} 30%, transparent)`,
              fontFamily: BODY, fontSize: "0.84375rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Suspend
          </button>
        </div>
        <button
          onClick={onRemoveContent}
          style={{
            padding: "13px 18px", borderRadius: 999,
            background: "transparent", color: C.red,
            border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
            fontFamily: BODY, fontSize: "0.84375rem", fontWeight: 600, cursor: "pointer", width: "100%",
            textAlign: "left",
          }}
        >
          Remove content only
        </button>
        <button
          onClick={onBan}
          style={{
            padding: "13px 18px", borderRadius: 999,
            background: C.red, color: "#fff", border: "none",
            fontFamily: BODY, fontSize: "0.84375rem", fontWeight: 600, cursor: "pointer", width: "100%",
            textAlign: "left",
          }}
        >
          Ban permanently
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: "13px 18px", borderRadius: 999,
            background: "transparent", color: C.text2,
            border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: "0.84375rem", fontWeight: 500, cursor: "pointer", width: "100%",
            textAlign: "left",
          }}
        >
          Dismiss · no action
        </button>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Audit log
// ═══════════════════════════════════════════════════════════════════════════

export type AuditLogKind =
  | "auth"
  | "trade"
  | "billing"
  | "data"
  | "social"
  | "admin"
  | "security";

export interface AuditEntry {
  id: string;
  kind: AuditLogKind;
  timestamp: string;          // ISO or display
  action: string;             // "Signed in"
  detail?: string;            // "Chrome · London · 2.103.45.218"
  actor?: string;             // for admin actions
}

const KIND_TONE: Record<AuditLogKind, "live" | "accent" | "green" | "warn" | "red"> = {
  auth: "live",
  trade: "green",
  billing: "accent",
  data: "accent",
  social: "live",
  admin: "warn",
  security: "red",
};

export function AuditLogScreen({
  C, entries, userHandle, filters, activeFilter = "All", onFilter, onBack,
}: {
  C: Theme;
  entries: AuditEntry[];
  userHandle?: string;
  filters?: string[];
  activeFilter?: string;
  onFilter?: (f: string) => void;
  onBack?: () => void;
}) {
  const filterList = filters ?? ["All", "Auth", "Trade", "Billing", "Data", "Social", "Admin", "Security"];
  const filtered = activeFilter === "All"
    ? entries
    : entries.filter(e => e.kind.toLowerCase() === activeFilter.toLowerCase());

  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      padding: "22px 22px 60px", maxWidth: 720, margin: "0 auto", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36, height: 36, borderRadius: 999, background: C.surface,
            border: `1px solid ${C.line}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <IconBack c={C.text} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: DISPLAY, fontSize: "1.375rem", fontWeight: 600,
            letterSpacing: "-0.02em", color: C.text,
          }}>
            Audit log
          </div>
          {userHandle && (
            <div style={{
              fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.08em",
              color: C.muted, marginTop: 4,
            }}>
              @{userHandle.toUpperCase()}
            </div>
          )}
        </div>
        <MonoTag C={C} tone="accent">Support</MonoTag>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {filterList.map(f => {
          const on = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => onFilter?.(f)}
              style={{
                padding: "7px 14px", borderRadius: 999, whiteSpace: "nowrap",
                background: on ? C.accentSoft : "transparent",
                color: on ? C.accent : C.text2,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.accent} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.08em",
                fontWeight: 500, cursor: "pointer", textTransform: "uppercase",
              }}
            >
              {f}
            </button>
          );
        })}
      </div>
      <Card C={C} pad={0}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", fontFamily: BODY, fontSize: "0.8125rem", color: C.text2 }}>
            No entries.
          </div>
        ) : (
          filtered.map((e, i) => {
            const tone = C[KIND_TONE[e.kind]];
            return (
              <div
                key={e.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: tone, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.84375rem", color: C.text, fontFamily: BODY }}>{e.action}</div>
                  {e.detail && (
                    <div style={{
                      fontFamily: MONO, fontSize: "0.59375rem", color: C.muted,
                      marginTop: 2, letterSpacing: "0.04em",
                    }}>
                      {e.detail.toUpperCase()}
                      {e.actor && ` · BY ${e.actor.toUpperCase()}`}
                    </div>
                  )}
                </div>
                <span style={{
                  fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, letterSpacing: "0.04em",
                }}>
                  {e.timestamp}
                </span>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
