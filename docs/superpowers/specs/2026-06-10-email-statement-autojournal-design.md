# Email Statement AutoJournal — Tradovate v1

**Date:** 2026-06-10
**Author:** Dylon (with Claude)
**Status:** Design — awaiting plan
**Wedge sprint:** Yes (`[[project_koda_wedge_sprint]]`)

---

## 1 · Overview

The wedge promise is "log a trade in three taps." AutoJournal raises the bar to **zero taps**: the user sets their broker to email them daily, forwards that email to a unique Kōda alias once, and from then on every trade is journaled automatically.

This spec covers **Tradovate only**. Research (this session, 2026-06-10) confirmed Tradovate auto-sends a daily PDF "Daily Account Statement" containing per-fill detail. A single Tradovate parser unlocks the entire wedge ICP: Topstep-on-Tradovate, Apex, MyFundedFutures, TickTickTrader, and Tradeify all route through Tradovate. Topstep's own platform (TopstepX) sends nothing automated and is **explicitly out of scope** — those users keep using the existing CSV import.

---

## 2 · Non-goals

- Multi-broker on day one. NinjaTrader Brokerage is the obvious second target but lands in a follow-up spec.
- Real-time / per-trade ingestion. Tradovate emails are end-of-day; we mirror that cadence.
- LLM-based parsing. Out of scope for v1. If regex confidence drops, we patch the regex.
- TopstepX coverage. No email path exists; CSV import remains.
- Replacing the existing CSV import. The two ingestion paths coexist; users who want manual control keep using upload.

---

## 3 · User flow

### 3a · One-time setup (Settings → Auto-import)

1. User taps **Settings → Auto-import**.
2. Sees a panel containing:
   - **Their unique forwarding address:** `statements+a1b2c3d4@in.kodatrade.co.uk` with a one-tap copy button.
   - **A 3-step Tradovate setup card:**
     1. In Tradovate → Account → Statements → toggle "Email daily statement" ON.
     2. In Gmail (or any client) → create a filter: From `noreply@tradovate.com` → Forward to `<your alias>`.
     3. Done — your next statement will be auto-logged.
   - **A "Send test email" link** that mails the user a sample statement they can forward back, so they confirm the round-trip works before relying on it for real data.
3. The unique token is generated on first visit and stored on `profiles.email_ingest_token`.

### 3b · Daily run (zero-touch)

1. Tradovate sends statement → user's Gmail filter forwards it to their Kōda alias.
2. Postmark Inbound receives → POSTs JSON to `/api/email/inbound`.
3. Endpoint authenticates the alias, allowlists the original sender, parses the PDF, dedupes, and saves trades with `source: 'email_statement'` + `import_id`.
4. Trades are **immediately live** — stats, discipline score, streaks all update.
5. Next time the user opens Kōda, top of feed shows a dismissible **AutoJournalBanner**: `5 trades auto-logged from your Tradovate statement · 06:00 GMT · Review · Undo all`.
6. **Review** opens a sheet listing the 5 trades. Each row has the standard auto badge.
7. **Undo all** deletes every trade in that `import_id` and the banner.

### 3c · Failure flow

- If parsing fails → no trades saved → user gets a push (and an email reply) saying `We received your Tradovate statement but couldn't parse it. Forward to support@kodatrade.co.uk and we'll look into it.` PDF is retained for 30 days in the `trade-imports` bucket under the synthetic `email-failed/{token}/...` folder.
- If sender allowlist rejects (not from Tradovate) → silent drop + Sentry breadcrumb. We never email the user about random forwards — that's the spam vector.
- If token is unknown → silent drop + Sentry breadcrumb. Spam vector.

---

## 4 · Architecture

```
   Tradovate ── auto email ──▶  user's Gmail
                                      │
                                      ▼  (user's Gmail filter forwards)
                          Postmark Inbound MX (in.kodatrade.co.uk)
                                      │
                                      ▼  (JSON webhook + base64 attachments)
                          POST /api/email/inbound  (Vercel function)
                                      │
                ┌─────────────────────┴───────────────────┐
                ▼                                          ▼
        Postmark HMAC verify                 Look up user by `+token` alias
                ▼                                          ▼
        Sender allowlist                       Reject unknown / replay
   (`noreply@tradovate.com`)                              │
                                                          ▼
                                            Extract first PDF attachment
                                                          ▼
                                      pdf-parse → text → Tradovate regex
                                                          ▼
                                            Map rows to Kōda Trade[]
                                                          ▼
                                   Dedupe by `external_id` against `trades`
                                                          ▼
                                  Insert `imports` row + `trades` rows + raw PDF
                                                          ▼
                                       Web push to user's devices
```

---

## 5 · Data model changes

### 5a · `profiles` — new column

```sql
alter table public.profiles
  add column if not exists email_ingest_token text unique;
create index if not exists profiles_email_ingest_token_idx
  on public.profiles (email_ingest_token)
  where email_ingest_token is not null;
```

Token format: 8 lowercase hex chars from `crypto.randomBytes(4)`. Generated lazily on first Auto-import settings visit. Regeneratable from the same panel (with a "this will break your current forwarding" confirm).

### 5b · `imports` — new columns

```sql
alter table public.imports
  add column if not exists source         text not null default 'manual_upload',
  add column if not exists email_message_id text,
  add column if not exists review_state   text not null default 'pending',
  add column if not exists parse_confidence numeric;

create unique index if not exists imports_email_message_id_uniq
  on public.imports (email_message_id)
  where email_message_id is not null;
```

- `source` — `'manual_upload' | 'email_statement'`. Default keeps existing rows truthful.
- `email_message_id` — RFC 5322 Message-ID; uniqueness prevents replay if Postmark double-delivers.
- `review_state` — `'pending' | 'reviewed' | 'undone'`. Drives the AutoJournalBanner.
- `parse_confidence` — 0–1 score from the regex parser (fields-found / fields-expected). Used for telemetry and to gate the future "auto-import without review" toggle.

### 5c · `trades` — new columns

```sql
alter table public.trades
  add column if not exists import_id   uuid references public.imports(id) on delete set null,
  add column if not exists source      text not null default 'manual',
  add column if not exists auto_logged boolean not null default false;

create index if not exists trades_import_idx
  on public.trades (import_id)
  where import_id is not null;
```

- `source` — `'manual' | 'csv' | 'email_statement'`.
- `auto_logged` — render an "auto" badge in the UI; also lets the user filter their history.
- `import_id` — enables bulk Undo and ties trades back to the raw PDF.

### 5d · RLS

All existing RLS policies on `imports` and `trades` are owner-only and already correct. New columns inherit. The webhook writes via **service-role**, bypassing RLS — same pattern as the existing news/cron endpoints.

---

## 6 · Components and files

### New (server)

| File | Responsibility |
|---|---|
| `api/email/inbound.ts` | Postmark webhook handler. Verifies HMAC, routes by token, allowlists sender, kicks off pipeline. |
| `api/lib/email-ingest.ts` | Orchestration: PDF extract → parse → dedupe → save → push. Pure-ish, testable. |
| `src/lib/parsers/tradovate-statement.ts` | Pure regex parser. Input: PDF text. Output: `{ trades: ParsedTrade[]; confidence: number; warnings: string[] }`. Heavily unit-tested. |

### New (client)

| File | Responsibility |
|---|---|
| `src/screens/AutoImportSettings.tsx` | The Settings → Auto-import panel: address, copy button, setup steps, regenerate token, send-test-email link. |
| `src/components/AutoJournalBanner.tsx` | Top-of-feed banner for the most recent `pending` import. Review / Undo / Dismiss actions. |
| `src/components/AutoJournalReviewSheet.tsx` | Bottom sheet listing the trades in a batch. |
| `src/data/autoImport.ts` | Client data layer: `getPendingImports()`, `markReviewed(id)`, `undoImport(id)`, `regenerateToken()`. |

### Touched

| File | Change |
|---|---|
| `src/lib/csvParser.ts` | Export the `mapRowToTrade()` helper currently inlined inside `parseCSV`, so `tradovate-statement.ts` can reuse it for `B/S` direction parsing and P&L sign handling. |
| `src/lib/imports.ts` | Accept `source` and `email_message_id` on `persistImport()`. |
| `src/Koda.tsx` (Home feed) | Mount `<AutoJournalBanner />` above the existing feed list. |
| `src/SettingsScreen.tsx` | Add the Auto-import section link. |
| `supabase/migrations/20260610_autojournal_email_ingest.sql` | All three schema changes above. |

### Untouched / explicitly reused

- `parseCSV()` for header-mapping logic — **not** called directly; we extract specific helpers.
- `persistImport()` Storage upload — reused for storing the raw PDF.
- `saveTrades()` dedupe-by-external_id path — unchanged.
- `useNotifyPush()` send path — reused for the success / failure notifications.

---

## 7 · Parse pipeline detail

### Input
Postmark webhook body (Postmark Inbound schema), with `Attachments[]` of base64 PDF.

### Steps inside `email-ingest.ts`

1. **Decode** first attachment whose `ContentType` is `application/pdf`. If none → fail with `no_pdf_attachment`.
2. **`pdf-parse` the buffer** → flat text string. If `pdf-parse` throws → fail with `pdf_decode_failed`.
3. **Call `parseTradovateStatement(text)`** → `{ trades, confidence, warnings }`.
4. **Dedupe** `trades` against existing `trades` rows for the same user, matching on `external_id` (the Tradovate exec ID). Skipped rows count as `duplicate_count`.
5. **Insert `imports` row** with `source: 'email_statement'`, `email_message_id`, `review_state: 'pending'`, `parse_confidence`, counts.
6. **Insert `trades` rows** with `import_id`, `source: 'email_statement'`, `auto_logged: true`.
7. **Upload raw PDF** to `trade-imports/{user_id}/email/{import_id}.pdf` — same bucket as manual imports for symmetry.
8. **Send web push** to the user's registered devices: `"5 trades auto-logged from your Tradovate statement."`
9. **Reply 200** to Postmark.

### `parseTradovateStatement(text)` contract

```ts
interface ParsedTrade {
  external_id: string;       // Tradovate exec or fill ID — required for dedupe
  symbol: string;            // "MESZ4"
  bias: "long" | "short";    // derived from B/S
  entry_price: number;
  exit_price: number;
  entry_time: string;        // ISO 8601 UTC
  exit_time: string;
  qty: number;
  pnl: number;
}

interface ParseResult {
  trades: ParsedTrade[];
  confidence: number;        // 0–1, fields-found / fields-expected
  warnings: string[];        // e.g. "Skipped 1 row with unparseable timestamp"
}
```

The regex set lives inline in `tradovate-statement.ts` with one anchor per field. A single failed row never fails the whole batch — it goes to `warnings`. If `confidence < 0.5` we still save (better partial than nothing) **but** flag the import row so the banner renders amber with "Parse quality low — please review."

### Fixture
`src/lib/parsers/__fixtures__/tradovate-statement.pdf` — a real anonymized statement Dylon provides from his own account. Without this we can't test, so it's a **plan blocker, not a spec blocker**.

---

## 8 · Dedupe strategy

Two layers:

1. **Email-level (replay protection):** `imports.email_message_id` is unique. Same message twice → second is rejected.
2. **Trade-level:** existing `trades.external_id` index. If user has a CSV-imported trade with the same Tradovate exec ID, the email import skips it. Same in reverse if user later uploads a CSV containing already-auto-logged trades.

**What if Tradovate's PDF doesn't include exec IDs?** Then we synthesize one as `tradovate:{symbol}:{entry_time_iso}:{qty}:{pnl}`. Brittle but deterministic. The real-statement fixture will tell us which path we're on. If exec IDs are absent, this becomes the most important risk in the v1 launch.

---

## 9 · Error handling and observability

- **Sentry**: every failure path captures structured context — token (hashed), sender, parse confidence, warnings, attachment count. No PII in messages.
- **Postmark dashboard**: built-in delivery / bounce visibility. We log inbound webhook latency in our own metrics too.
- **`imports.parse_confidence`**: daily cron rolls up p50/p10 across all email-source imports; if p10 drops below 0.7 we alert (likely template change).
- **User-visible**: failure → push + email reply. Never silent for a real ingestion attempt from a known token + allowlisted sender.

---

## 10 · Security

- **HMAC verify the Postmark webhook.** Reject unsigned requests.
- **Sender allowlist:** only `noreply@tradovate.com` (or its current SPF-verified equivalent — TBD on fixture). Forwarded mail preserves the original sender in `From` only sometimes; we may need to use the `Reply-To` or `X-Original-From` header set by Gmail filter forwarding. **This is a known risk** — see Open Questions.
- **Token entropy:** 8 hex chars = 32 bits. Sufficient for spam-deterrence (an attacker can't guess a token), insufficient for cryptographic auth — but the sender allowlist is the real gate. The token just routes.
- **Token rotation:** user-triggered, single-button. Old token rejected immediately.
- **Rate limit:** max 20 inbound emails per token per day via the existing `atomic_rate_limit` migration.
- **Raw PDF storage:** lives in the existing private `trade-imports` bucket; same RLS as manual uploads. Service-role inserts under the user's folder.
- **No tokens in URLs.** The settings panel displays it; the webhook accepts it via the `To` header only.

---

## 11 · Cost

- **Postmark Inbound:** $15/mo for the first 10k messages (`https://postmarkapp.com/pricing`). At wedge scale (≤ 50 users × 1 email/day = ~1500/mo) we sit on their free 10k tier — practically zero.
- **Vercel function:** within current plan.
- **Storage:** ~200KB/PDF × 1500/mo = 300 MB/mo. Negligible against current Supabase quota.
- **No LLM cost** — regex-only.

---

## 12 · Testing strategy

### Unit
- `tradovate-statement.test.ts` — 6+ cases: clean statement, missing field, weird timezone, multi-leg trade, partial fill, malformed row mixed with clean rows.
- `email-ingest.test.ts` — pipeline orchestration with mocked Postmark payload, mocked pdf-parse, mocked Supabase. Asserts dedupe, failure handling, push fired.

### Integration (Vitest + supabase test instance)
- End-to-end happy path: fixture PDF → trades land → banner data loads.
- Replay: same `email_message_id` posted twice → second is rejected, no duplicate trades.
- Bad sender: payload from `noreply@phisher.com` → 200 OK to Postmark (no retries) but zero side-effects.

### Playwright
- Settings → Auto-import panel renders token, copy works.
- Banner renders when a `pending` import exists.
- "Undo all" removes the trades and the banner.
- Defer the full inbound webhook E2E test until after a real fixture exists.

### Manual (Dylon, day-of-ship)
- Forward a real Tradovate statement from his own Gmail to his alias → trades appear, banner shows, undo works.
- Run for 3 days before announcing to other users.

---

## 13 · Telemetry (PostHog events)

| Event | Fired when |
|---|---|
| `autoimport_setup_started` | User opens Auto-import settings panel for the first time |
| `autoimport_test_email_sent` | "Send test email" link clicked |
| `autoimport_email_received` | Webhook processed an email (success OR failure) |
| `autoimport_parse_success` | Trades were saved |
| `autoimport_parse_failure` | Email arrived but no trades saved |
| `autoimport_banner_viewed` | User saw the AutoJournalBanner |
| `autoimport_batch_reviewed` | User opened the review sheet |
| `autoimport_batch_undone` | "Undo all" tapped |

---

## 14 · Open questions / risks

1. **PDF contains exec IDs?** Needs Dylon's real fixture. If no → synthetic key (lower-quality dedupe).
2. **Forwarded-email sender header:** Gmail strips the original `From` and replaces it with the user's own address; we need to read `X-Forwarded-For`, `Reply-To`, or parse the subject. Postmark gives us the parsed headers — we just need to confirm which one carries the original Tradovate address through Gmail's forwarder.
3. **Tradovate template stability.** No way to know in advance. Mitigation: store raw PDF + parse_confidence, alert on regressions.
4. **`in.kodatrade.co.uk` subdomain setup.** Need DNS MX record pointed at Postmark. ~10 minutes of ops work; non-blocking but on the runbook.
5. **Postmark account exists?** If not, create one before plan execution. Cost zero at our volume.
6. **Push notification permissions** — if user hasn't granted them, fall back to silent (banner still works on next open).

---

## 15 · Out of scope (future)

- NinjaTrader Brokerage statement parser (v2; same pipeline, different regex).
- LLM-fallback parsing when regex confidence is low.
- "Auto-import without review" Setting toggle for graduated users.
- IBKR Flex Query email integration.
- TopstepX scraper / Chrome extension.
- Multi-account support (user has two Tradovate accounts forwarding to one alias).

---

## 16 · Success criteria

- Dylon's own Tradovate statements auto-log for 7 consecutive days with zero parse failures.
- p10 `parse_confidence` ≥ 0.85 across all email imports.
- ≥ 3 wedge-sprint users complete the one-time setup within 5 minutes (measured via `autoimport_setup_started` → `autoimport_parse_success` funnel).
- Zero data-loss incidents (a trade auto-logged then silently disappearing).
- Mean time from email-sent to trade-visible-in-app < 30 seconds.

---

## 17 · Related memories / context

- `[[project_koda_wedge_sprint]]` — 30-day sprint, futures prop aspirants on Tradovate, day-30 verdict drives continue/stop.
- `[[project_koda_activation_insight]]` — Kōda is bursty-use; AutoJournal directly attacks the "I forgot to log" failure mode.
- `[[project_koda_dev_env_crashes]]` — implementation must avoid running Playwright + autonomous agent in parallel (OOM risk).
- NEXT_SESSION.md §0c — Tradovate Partner API confirmed unavailable; this spec is the alternative path.
