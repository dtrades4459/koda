# Kōda — durable lessons

Cross-session learnings that survive any refactor or restructure. Add an entry when you find yourself thinking "I knew this would bite me." Rule first, then a one-line why with a date.

---

## Test mocks drift when data sources move

When a hook switches its data source (e.g. `useNews` from `supabase` → `/api/news`), grep for the old mock (`vi.mock("./lib/supabase")` or whichever) in the same commit and update it. Otherwise the mock becomes dead code, the real fetch goes unmocked, tests stick on a loading state, and the suite goes red silently. — _2026-06-07, news widget_

## "Incidentally green" tests hide real bugs

A test passing because the setup is broken (no events loaded → no chips rendered → "no chips" assertion passes) is not validating behavior. When you fix the setup and an old assertion flips red, read the test name and the code — it's probably asserting the wrong invariant. Update it, don't delete it. — _2026-06-07, `NewsScreen.test.tsx` impact-chips test_

## `git add <file>` stages the whole working-tree state of that file

If a file had prior uncommitted edits, `git add <file>` scoops ALL of them, not just the diff you just made. Run `git diff --staged <file>` before commit. — _2026-06-02, stray `IdeasScreen` import broke prod for 5 min_

## Update the PR title before squash-merge

PR scope often grows mid-flight. The squashed commit on `main` uses the PR title as its subject. Edit the title to match the actual scope, or `main` history lies about what landed. — _2026-06-07, PR #27 grew from "4 social bugs" into a 5-fix bundle_

## Mobile sub-nav parity is invisible until you check

Desktop sidebar shows nested sub-sections; mobile dropdown is meant to mirror them — except when a new top-level view ships without one. Quick check on any new view: does it need `SubNavDropdown` on mobile? — _2026-06-07, Social view shipped without one; History/Checklist also missing parent-section access_

## Supabase PG numeric/decimal columns can come back as strings

A reducer doing `s + e.winRate` string-concatenates, then division → `NaN`. Wrap with `Number(...)` before summing any column that might be numeric/decimal. — _2026-06-07, circle aggregate `AVG WR` showed `NaN%`_

## Handles are stored with a leading `@`

DB convention: handle = `@username`. Any render that does `@${handle}` produces `@@username`. Use `stripHandlePrefix()` at every render site. If you see `@@x` or `@@@x` in the UI, this is the cause. — _2026-06-07_

## PWA service worker holds stale JS after deploy

"Fix didn't work" reports from prod are usually the SW cache. Diagnostic: ask the user to test in incognito before debugging the code. — _Memory; recurring_

## Sentinel UUIDs violate auth.users foreign key

`shared_kv.owner_id` references `auth.users(id)`. Using `'00000000-...'` as a system-cache sentinel violates the FK. Use a dedicated table for system cache. — _Memory_

## Supabase upsert can't `onConflict` a partial unique index

PostgREST refuses `ON CONFLICT (col)` when the unique index has a `WHERE` predicate (`42P10`). Drop the predicate, rely on `NULLS DISTINCT`, or use a full unique constraint. — _Memory, 2026-06-05 prod fix_

## `npm run typecheck` silently passes due to composite refs

The root `tsconfig.json` is a project reference container. Run `tsc -p tsconfig.app.json --noEmit` to actually see app errors. — _Memory_

## Vercel + Supabase preview deploys need an Auth allowlist

Supabase Auth must allowlist `*.vercel.app/**`, or every OAuth on a preview URL dies with "requested path is invalid." One-time 60s fix. — _Memory_
