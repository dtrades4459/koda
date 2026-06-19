# Circles Chat v2 — full feature handoff

Branch: `feat/circles-chat-phase2` (worktree `projects/koda-circles-chat`, off `main`).
Flag: **`circleChatV2`** (default OFF). The entire feature is inert until you apply the
migration AND turn the flag on. The pre-v2 inline chat is preserved as the flag-off path.

This lands the whole Phase-2 package (README steps 1–6) in two slices on one branch/flag.

## Slice 1 — reactions + reply + @mention highlight (README 1–3)
- **Migration** `supabase/migrations/20260620_circle_chat_upgrades.sql`.
- Redesigned `ChatMessage` bubble (reaction pills, reply quote, @mention highlight, delete).
- `ChatComposer` (reply-context strip) — its `<input>` was changed to `<textarea>` to keep your existing multiline / Shift+Enter behaviour (the package shipped a single-line input).
- Reactions data layer + optimistic toggle; flag-gated realtime `circle_rx_*` channel (uses a `chatMessagesRef` to avoid the README's stale-closure bug).
- `reply_to_id` is written **only when the flag is on** → inserts stay compatible with the pre-migration schema.

## Slice 2 — pinned + presence/typing + mention push (README 4–6)
- **Pinned announcement** (`PinnedBanner`): owner taps **Pin** on any message → `circles.pinned_message_id`; banner renders above the message list with an owner-only unpin. `loadPinned` runs on circle open (flag-gated, wrapped in try/catch).
- **Presence + typing** (`useCirclePresence`): `{n} online` line at the top of chat, a "… is typing" row above the composer, `onTyping` on the composer. No DB table — rides Supabase Realtime presence/broadcast. The presence channel only opens when a circleCode is passed, so it's inert when the flag is off.
- **Mention push fan-out** (`api/push.ts`): the client parses `@handle` tokens and sends them as `mentions[]`; the server resolves them to circle-member uids and sends those members a "{sender} mentioned you" notification instead of the generic one. Handle matching tries both `bare` and `@bare` forms so handle-storage drift can't silently drop it; non-members can never be targeted. **Backward-compatible** — no `mentions` in the body = exactly the old behaviour, so flag-off clients are unaffected.

## ⚠️ Enable sequence — read before flipping
1. **Apply the migration to prod Supabase FIRST** (SQL editor; additive, idempotent, rollback block at the bottom). If the flag goes on before the migration, reaction/pinned queries and `reply_to_id` writes hit columns/tables that don't exist.
2. **Test on localhost:** `window.kodaFlags.enableFlag("circleChatV2"); location.reload();` (this hits prod Supabase, which now has the schema).
3. **`window.kodaFlags` only exists in DEV builds** — you CANNOT flip this from the production console. To ship to everyone, add `"circleChatV2"` to `DEFAULT_ON` in `src/lib/flags.ts` and redeploy.

## As-built behaviours to know (not bugs)
- **The Pin affordance matches the RLS owner check.** `isOwner` is true only for the circle creator (set in `createCircle`), which is exactly what the `created_by = auth.uid()` pin policy authorizes — so a non-creator never sees Pin. `pinMessage`/`unpinMessage` also toast on RLS denial as a backstop. (The global circle's `VITE_KODA_ADMIN_UID` admin is not a creator, so they won't see Pin there — acceptable for v1.)
- **The pinned banner is not realtime for other members.** `loadPinned` runs on circle open, so a member already viewing the circle sees a newly-pinned message only after re-entering. The owner who pins sees it immediately.
- **Mentions are case-sensitive end-to-end.** The `@[A-Za-z0-9_]+` capture and the `in("handle", …)` lookup are both exact-case, so `@Bruno` won't resolve `bruno`. Graceful (they still get the normal circle notification), just not the "mentioned you" elevation.

## Known limitation carried from the audit
`loadChatMessages` caps at `.limit(100)` ordered **ascending** (oldest 100). Under the redesign this is more visible — reactions/reply quotes anchor to old messages, and a reply whose parent is outside the loaded window renders with no quote (graceful, not a crash). The pin resolves by a direct id fetch, so pinning an older message still works. Worth switching to newest-100 in a follow-up; out of scope here.

## Not automated-tested
`api/push.ts` mention targeting has no unit test (would need supabase + Vercel req/res mocks). It's defensively written (graceful no-op on unresolved handles / missing subs). Verify live after enabling: @mention a circle member and confirm they get the "mentioned you" title.

## Verification (this branch)
- `npx tsc -p tsconfig.app.json --noEmit` → 0 errors
- `npx tsc -p tsconfig.api.json --noEmit` → 0 errors
- `npx eslint <changed files> --quiet` → 0 errors (warnings are pre-existing)
- `npx vitest run src/data/circleMessageReactions.test.ts src/components/ChatMessage.test.tsx --maxWorkers=1` → **17 passed** (pure toggle logic + render-smoke of the flag-ON bubble, composer, Pin affordance, and pinned banner incl. all callbacks)
- Flag-OFF path unchanged: original inline bubble + textarea bar still render; backend unaffected.
