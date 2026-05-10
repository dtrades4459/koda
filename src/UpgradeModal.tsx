import { useState } from "react";

export function UpgradeModal({ C, userId, userEmail, stripeCustomerId, onCustomerId, onClose }: {
  C: Record<string, string>;
  userId: string;
  userEmail: string;
  stripeCustomerId?: string;
  onCustomerId: (id: string) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email: userEmail, stripeCustomerId }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(msg ?? `Request failed (${res.status})`);
      }
      const { url, customerId: newCid } = await res.json();
      if (newCid) onCustomerId(newCid);
      window.location.href = url;
    } catch (err: any) {
      console.error("[upgrade]", err);
      setError(err.message ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: "20px",
  };
  const card: React.CSSProperties = {
    background: "#1A1A18", border: `1px solid ${C.border2 ?? "#3A3A34"}`,
    borderRadius: "16px", padding: "28px 24px", width: "100%", maxWidth: "360px",
    display: "flex", flexDirection: "column", gap: "18px",
  };

  const FEATURES = [
    { icon: "📊", text: "Unlimited trade history" },
    { icon: "📥", text: "CSV & broker auto-import" },
    { icon: "🔍", text: "Advanced analytics & heatmaps" },
    { icon: "🧠", text: "Full insights — patterns & edge detection" },
    { icon: "📤", text: "Export reports (CSV + PDF)" },
  ];

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#000", borderRadius: "6px", padding: "3px 10px",
            fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
          }}>⚡ PRO</div>
          <div style={{ marginTop: "12px", fontSize: "21px", fontWeight: 800, color: C.text ?? "#EDEDE8", lineHeight: 1.2 }}>
            Upgrade to TRADR Pro
          </div>
          <div style={{ marginTop: "4px", fontSize: "13px", color: C.muted ?? "#8A8A82" }}>
            Everything you need to trade with a real edge.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "38px", fontWeight: 900, color: C.text ?? "#EDEDE8", lineHeight: 1 }}>£5.99</span>
          <span style={{ fontSize: "13px", color: C.muted ?? "#8A8A82" }}>/month · cancel any time</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {FEATURES.map(f => (
            <div key={f.text} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: C.text2 ?? "#BCBCB4" }}>
              <span style={{ fontSize: "15px", width: "20px", flexShrink: 0 }}>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: "#ef444422", border: "1px solid #ef444455", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#ef4444" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            background: loading ? (C.muted ?? "#8A8A82") : "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#000", border: "none", borderRadius: "10px",
            padding: "14px", fontSize: "15px", fontWeight: 800,
            cursor: loading ? "default" : "pointer", width: "100%",
            transition: "opacity 0.2s", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Redirecting to checkout…" : "Upgrade Now — £5.99/mo"}
        </button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: C.muted ?? "#8A8A82", cursor: "pointer", fontSize: "12px", textAlign: "center", letterSpacing: "0.06em" }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
