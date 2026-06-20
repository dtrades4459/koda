# Mentor Mode — Design Spec

- **Date:** 2026-06-19
- **Status:** Draft for review
- **Owner:** Dylon
- **Flag:** `mentorMode` (off by default)

## Summary

**Mentor Mode = the existing coach/instructor dashboard**, branded and gated as a
product. A trading mentor (or training group) runs a cohort of students inside
Kōda: the existing discipline roster (`instructorRoster.ts`,
`TradingCircles.tsx:743`) is what they see, and the new capability is leaving
**rated annotations** on the trades students share into the cohort. The mentor
pays Kōda on a **B2B seat model** — a base subscription plus volume-discounted
seats — and bundles that cost into their own course price, which they collect
from students outside Kōda.

**Scope correction (2026-06-19, confirmed with Dylon):**
- The coach/instructor dashboard already exists and is live — Mentor Mode *is*
  that dashboard, not a net-new screen. No roster to build.
- Annotations attach to **trades the student shares into the cohort** (reusing
  `circle_shared_trades`), **not** the student's full private journal. A "share
  all my trades to this cohort" toggle keeps it from being a one-at-a-time
  trickle. Full-journal read is an explicit fast-follow, out of Phase A.

This is **not** a consumer marketplace. Kōda never sits between mentor and
student money: no Stripe Connect, no payouts, no KYC. Mentors bring their own
students (invite link/code); there is no public mentor directory in v1.

## Core decisions (locked)

1. **Coach-style tooling, B2B seat billing.** Mentor/group pays Kōda per
   seat/month; they price their own course separately.
2. **A seat grants the mentee full Pro** for as long as they hold it.
3. **Volume-discounted, tiered seat pricing.**
4. **Bring-your-own students** — invite by link/code. No directory, reviews, or
   vetting in v1.
5. **Mentor cohort = a flagged Circle** (`type: "mentor"`), reusing existing
   Circles infrastructure rather than building parallel mentor tables.

## Architecture

### Reuse: mentor cohort is a Circle

A cohort is a Circle with a new `type: "mentor"`, owned by the mentor, members
are mentees. This inherits, with no new code:

- membership + invite/join
- chat (v2, PR #56)
- leaderboard
- required-metrics
- challenges
- **Coach roster** (`src/lib/instructorRoster.ts`) — members ranked by
  discipline, threshold 70, rule-compliance %, withheld/not-publishing states,
  CSV export.

We explicitly **do not** build the original Phase-4 `mentors` / `mentor_slots`
table empire — it duplicates Circles.

### How Pro is gated today (verified — this shapes everything)

Pro is **not** computed live. It is a **written JWT claim** `app_metadata.plan`
(`free` | `pro` | `elite`), which after `20260531_security_fixes.sql` is set
**exclusively by the Stripe webhook** via the admin API (`setUserPlan` →
`auth.admin.updateUserById`). `app_metadata` is admin-API-only — users cannot
write it (reading plan from the user-writable `user_kv` was closed as a security
hole). `src/lib/entitlements.ts::computeIsPro()` reads that `plan` value (plus
grandfathering / paywall-go-live / founder overrides).

### The one seam: an admin-only "entitlement sync" (write-on-event)

Because the plan is a *written* value and a mentee's seat-Pro flips on **circle
join/leave** (which fires **no Stripe event**), entitlement is a
**write-on-event sync**, not a read-time resolver. A single service-role
function — `syncMenteeEntitlement(userId)` — is the only thing that writes
seat-derived plan. It:

1. Recomputes `hasPro = (own active sub) OR (holds a mentor seat)`.
   - "own active sub" = the user's existing Stripe subscription state (already
     tracked in `koda_stripe_customer` / webhook).
   - "holds a mentor seat" = member of a `type:"mentor"` circle within capacity.
2. Writes `app_metadata.plan` accordingly via the admin API (same path the
   Stripe webhook already uses), so the JWT claim and `computeIsPro` stay
   correct.

**Critical:** on seat loss it must **never** blindly write `free` — it
recomputes the OR first, so a mentee who also has their own paid sub keeps Pro.

This sync is triggered from exactly three events:

- **Stripe webhook** — mentor subscription created/updated/deleted (seat count
  changes).
- **Circle membership change** — mentee joins/leaves a `type:"mentor"` circle.
- **Seat reassignment** — capacity changes who holds a seat (see below).

All three are server-side, service-role; the client never writes plan.

## Brick A — Trade annotations (the real new feature)

A mentor leaves a **rated note on a trade a student shared into the cohort**.

- **Access model (confirmed):** annotations attach to **shared trades**
  (`circle_shared_trades` rows), not the student's private journal. The student
  controls exposure by sharing; a **"share all my trades to this cohort"
  toggle** turns the manual one-at-a-time share into a bulk/auto share so the
  mentor has enough to work with. No new endpoint over private `koda_trades`;
  full-journal read is a documented fast-follow.
- **Storage:** new table `trade_annotations` keyed on the shared-trade row:
  `(shared_trade_id, mentor_user_id)` with `grade`, `note`, `created_at`,
  `updated_at`. Because it FKs `circle_shared_trades(id)`, the circle context is
  inherited — no need to denormalize circle/mentee ids.
  - Annotation shape: freeform `note` (required) + optional `grade` (letter
    A–F; finalize exact enum in plan).
- **RLS / access:**
  - **Write:** only a user who is `owner`/`moderator` of the shared trade's
    circle, and only when that circle is a mentor circle (`type:"mentor"`).
  - **Read:** the shared trade's author (the student) reads annotations on their
    own shared trades; the mentor (owner/moderator) reads all annotations in
    their circle. Enforced in RLS via the existing `circle_members` role rows —
    no client-side trust, matching the security-sprint convention.
- **Independent of billing:** annotations work with zero seats, so Phase A ships
  before any Stripe work.

## Phase A — exact scope (what "build Phase A" delivers)

1. `mentorMode` flag (default off) + a `type:"mentor"` marker on circle meta (and
   the `circles` table column, mirroring the `required_metrics` precedent).
2. Surface the **already-built** coach/instructor dashboard as "Mentor Mode" for
   `type:"mentor"` circles (branding/labels + flag gate). No roster code.
3. **Trade annotations** on shared trades: migration (`trade_annotations` +
   RLS), the annotate UI on `SharedTradeCard`, and the student's read view.
4. **"Share all my trades to this cohort"** toggle (bulk share into
   `circle_shared_trades`).
5. NO billing, NO seats, NO Stripe. Pilot mentor's Pro is hand-set manually
   (existing admin path) for Phase A validation.

## Brick B — Seat billing (plain Stripe, no Connect)

Built on the existing `api/stripe.ts` (single merged checkout/portal/webhook
function — Vercel Hobby 12-function limit).

### One subscription, multiple line items

The mentor has a **single Stripe subscription**:

- **Base item** — flat monthly. Grants the mentor their own Pro + mentor
  tooling. ("The set price.")
- **Seats item** — a tiered/volume recurring price; `quantity` = number of
  seats. Stripe computes the tier math; our code never calculates a price.
- **Add-on items (Phase C)** — anything extra is just another line item on the
  same subscription. No new billing infrastructure.

### Self-service via the existing Stripe portal

Mentors add/remove seats and add-ons through the **Stripe Customer Portal**
(already wired in `handlePortal`). Stripe handles proration, invoices, receipts.
We build **no** custom billing UI. Minimizing our own pricing code is a
deliberate safety choice (no internal backend reviewer).

### Webhook changes

- On checkout/subscription events, instead of mapping the buyer to personal
  `pro`, record a **mentor entitlement** `{ role: "mentor", seats: N }` where N
  is the seats line-item quantity.
- The mentor also gets Pro for themselves (they need the tooling).
- On `customer.subscription.updated/deleted`, re-sync `seats` (or revoke).

### Seats: separate "paid" from "assigned"

- **Paid seats** = Stripe `quantity` (source of truth: Stripe).
- **Assigned seats** = circle membership (source of truth: our DB).
- **Seat-holding is stored, not recomputed on read.** An explicit
  `seatHolder` set (`{ menteeId, assignedAt }`) is the source of truth for who
  holds a seat. We do **not** derive it live from join-order on every read —
  that would cause non-local Pro flips (e.g. a held seat freeing up silently
  promoting some other member). Instead, assignment changes only on **explicit
  events**, and each change triggers `syncMenteeEntitlement` for the affected
  mentee(s).
- **Assignment policy v1:** when a seat frees up (member leaves, or mentor
  raises capacity), assign it **FIFO by join order** among unseated members —
  but as a deliberate write to `seatHolder`, not an implicit recomputation. This
  keeps the door open for **manual pin/unpin** (Phase C) as a UI addition, no
  data migration.
- **Over-capacity** (members > paid seats): unseated members stay in the circle
  but are **not** Pro-via-seat; they see an "ask your mentor for a seat" state.

### Reclamation

A mentee reverts to free when they lose a seat — leave the circle, are removed,
the mentor lowers the seat count, or the mentor cancels — **unless** they hold
their own active sub. Every such event calls `syncMenteeEntitlement`, which
recomputes the OR and writes the correct plan claim — so there is no separate
"downgrade" code path, and a mentee with their own sub is never wrongly demoted.

## Invite flow (bring-your-own)

The mentor circle has an **invite link/code** (reuse existing circle join). A
student opens it → joins the circle → consumes a seat if one is free → becomes
Pro. No directory, reviews, or vetting.

## Pricing defaults (adjustable)

Seat tiers (volume discount), to be tuned against the current Pro price:

| Seats   | Per-seat price        |
| ------- | --------------------- |
| 1–4     | full Pro price        |
| 5–19    | 15% off Pro           |
| 20+     | 25% off Pro           |

Guardrail clarification: the bottom tier (1–4) = full Pro price, so a tiny
"cohort" can never undercut Pro — that floor is protected. At higher tiers we
**deliberately** sell Pro at a discount (bulk Pro through mentors); that is the
intended model, not a leak. The guardrail protects the floor; it does not
"prevent cannibalization" at volume.

## Phasing

- **Phase A — no money:** `type:"mentor"` circle + Coach roster reuse +
  annotations + invite/join. Hand-flag one real mentor's cohort to Pro manually.
  Goal: a real mentor annotating real trades. Validates the product before
  Stripe.
- **Phase B — money:** base item + tiered seat item + webhook seat sync +
  `resolveEntitlement` OR-logic + auto-FIFO seat consumption, managed via the
  existing portal.
- **Phase C — later, additive:** add-ons (more line items) + manual seat
  pinning. No rework — the seams are built in A/B.

## Testing focus

- `syncMenteeEntitlement` truth table: own sub only / seat only / both / neither;
  reclamation transitions; **a mentee with own sub keeps Pro when a seat is
  removed** (the OR must not write `free`).
- Sync is triggered by all three event sources (Stripe webhook, membership
  change, seat reassignment) and writes `app_metadata.plan` via the admin path.
- Webhook: seat-count up and down; cancellation revokes seats.
- Seat consumption: FIFO ordering; over-capacity state.
- Annotation RLS: mentor can only annotate their cohort's mentees; mentee reads
  only their own; non-cohort mentor blocked at the server endpoint.

## Out of scope (v1)

- Public mentor directory, search, ratings, reviews, vetting.
- Stripe Connect / mentor payouts / KYC.
- Manual seat assignment UI (Phase C).
- Mentee-side payment to the mentor inside Kōda.

## Open items to finalize in the implementation plan

- Exact annotation `grade` scale (letter vs 1–5).
- Exact tier breakpoints and discounts (numbers above are defaults).
- Whether over-capacity members can still chat/appear on the roster (proposed:
  yes — only the Pro-via-seat entitlement is gated).
