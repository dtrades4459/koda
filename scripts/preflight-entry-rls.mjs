// Pre-flight for the shared_kv entry-row RLS migration (Phase C).
// READ-ONLY. Run: node scripts/preflight-entry-rls.mjs [path-to-env-file]
//
// NOTE: needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY with real values.
// They are marked Sensitive in Vercel, so `vercel env pull` returns them
// BLANK — paste them into a local env file (never commit it) or run the
// equivalent SQL pre-flight embedded in
// supabase/migrations/20260612_shared_kv_entry_member_select.sql instead.
//
// Answers, against prod via service role:
//   1. Is shared_kv.value text or jsonb? (policy cast syntax depends on it)
//   2. Circle roster: every koda_circle_<CODE> meta row + its privacy.
//   3. THE BLOCKER: KV circle-member rows whose owner has NO circle_members
//      row for that circle. Such users would lose PRIVATE-circle leaderboard
//      reads after the policy lands. Must be empty (public circles exempt).
//   4. Does each circle also exist in the v2 circles table? (informational)

import { readFileSync } from "node:fs";

const env = {};
// Env file: pass as argv[2] (e.g. ../.env.preflight pulled via `vercel env
// pull`), default .env.local.
const ENV_FILE = process.argv[2] || "../.env.local";
for (const line of readFileSync(new URL(ENV_FILE, import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const URL_ = env.SUPABASE_URL?.replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error("missing SUPABASE_URL / SERVICE_ROLE_KEY in .env.local"); process.exit(1); }

async function rest(path) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// 1+2. Circle meta rows (excluding member/entry/bans sub-keys)
const metas = (await rest(
  "shared_kv?select=key,value&key=like.koda_circle_*&limit=2000"
)).filter(r =>
  !r.key.startsWith("koda_circle_member_") &&
  !r.key.startsWith("koda_circle_entry_") &&
  !r.key.startsWith("koda_circle_bans_")
);
const valueIsJsonb = metas.length > 0 && typeof metas[0].value === "object";
console.log(`shared_kv.value type: ${valueIsJsonb ? "jsonb (object over REST)" : "text (string over REST)"}`);

const circles = metas.map(r => {
  const code = r.key.slice("koda_circle_".length);
  let privacy = "?";
  try {
    const v = valueIsJsonb ? r.value : JSON.parse(r.value);
    privacy = v?.privacy ?? "?";
  } catch { privacy = "UNPARSEABLE"; }
  return { code, privacy };
});
console.log(`\ncircles in KV meta (${circles.length}):`);
for (const c of circles) console.log(`  ${c.code.padEnd(24)} privacy=${c.privacy}`);

// 3. Gap check: KV member rows vs circle_members
const kvMembers = await rest(
  "shared_kv?select=key,owner_id&key=like.koda_circle_member_*&limit=10000"
);
const cmRows = await rest("circle_members?select=circle_code,user_id,role&limit=10000");
const cmSet = new Set(cmRows.map(r => `${r.circle_code}::${r.user_id}`));

const codesByLen = [...circles].sort((a, b) => b.code.length - a.code.length);
let gaps = 0;
const gapDetails = [];
for (const row of kvMembers) {
  const rest_ = row.key.slice("koda_circle_member_".length);
  // Codes can contain '_': resolve against the known roster, longest first.
  const circle = codesByLen.find(c => rest_.startsWith(c.code + "_"));
  if (!circle) { gapDetails.push(`UNRESOLVED key: ${row.key}`); continue; }
  if (!row.owner_id) continue;
  if (!cmSet.has(`${circle.code}::${row.owner_id}`)) {
    gaps++;
    gapDetails.push(`GAP: circle=${circle.code} privacy=${circle.privacy} uid=${row.owner_id}`);
  }
}
console.log(`\nKV member rows: ${kvMembers.length} · circle_members rows: ${cmRows.length}`);
console.log(`membership gaps (KV member without circle_members row): ${gaps}`);
for (const g of gapDetails) console.log("  " + g);

// 4. v2 circles table coverage (informational)
const v2 = await rest("circles?select=code,privacy&limit=2000");
const v2Codes = new Set(v2.map(r => r.code));
const missing = circles.filter(c => !v2Codes.has(c.code)).map(c => c.code);
console.log(`\nv2 circles table rows: ${v2.length}; KV circles missing from v2 table: ${missing.length ? missing.join(", ") : "none"}`);

console.log(`\nVERDICT: ${gaps === 0 ? "SAFE — private-circle reads keep working for everyone" : "DO NOT APPLY — backfill the gaps above first"}`);
