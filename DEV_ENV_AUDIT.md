# Kōda Dev Env Audit

## SECURITY

No real secrets in git history. `git log --all -- .env .env.local .env.production .env.development` returns nothing; only `.env.example` and `.env.local.example` were ever committed. `.env` is gitignored (`.gitignore:16`) and currently untracked. **Soft concern:** the live `.env` (containing the real Supabase URL + anon JWT) sits inside `C:\Users\Dylon\OneDrive\Desktop\tradr-fresh\`, so OneDrive is replicating it to Microsoft's cloud. Anon JWT is browser-public so impact is low, but principle is bad.

## 1. Top 5 Quick Wins (under 30 min each)

1. **Move repo out of OneDrive** (or exclude it). CLAUDE.md already documents OneDrive truncating `Koda.tsx` to 0 bytes. 20 min.
2. **Add Prettier + `format`/`format:check` scripts.** None installed; ESLint has zero stylistic rules. 25 min.
3. **Wire `tsconfig.api.json` into checks.** It exists but `tsconfig.json` doesn't reference it and `typecheck` doesn't cover it. Add `typecheck:api` script + CI step. 10 min.
4. **Prune stale remote branches.** 35+ remotes, ~10 untouched 3–4 weeks (`chore/audit-phase-1`, `feat/perf-fixes-audit`, `dtrades4459-patch-1`, etc.). 20 min.
5. **Delete empty `koda/` directory** at repo root — TRADR-rename leftover. 1 min.

## 2. Findings by Section

### 2.1 Package Management
- Scripts present: `dev`, `build`, `lint`, `typecheck`, `preview`, `test`, `test:watch`, `test:e2e`, `prepare`. **Missing:** `format`, `format:check`, `lint:fix`, `typecheck:api`.
- Dev/runtime deps cleanly separated. Single `package-lock.json` (no yarn/pnpm/bun).
- Node pinned: `.nvmrc` = `20`, `engines.node` = `20.x`, CI uses `node-version-file: .nvmrc`. Good.
- `.npmrc` has `legacy-peer-deps=true` — code smell, likely masks a React 19/typescript-eslint peer-dep conflict. Try removing.
- `prepare: husky` — modern Husky v9 idiom. Correct.
- `lint-staged` inline; covers `src/**/*.{ts,tsx}` and `api/**/*.ts` only — no Prettier, no `.js`/`.md`/`.json`.

### 2.2 TypeScript Config (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.api.json`)
- `tsconfig.json` references `app` + `node` only — **`tsconfig.api.json` is orphaned**. High severity.
- All three configs have `strict: true`.
- **`noUncheckedIndexedAccess` not set anywhere** — gap given financial calc code. High severity.
- `noImplicitAny` implicit via `strict`; backed up by `@typescript-eslint/no-explicit-any` (warn) + pre-commit grep blocking new `: any`. Well-defended.
- Other strict flags on: `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`, `erasableSyntaxOnly`, `verbatimModuleSyntax`.
- **No path aliases** anywhere — consistent.
- `tsconfig.app.json` `exclude` lists stale `src/TRADR (1).tsx` … `(4).tsx` (Mac/iCloud duplicates) — delete them rather than excluding.
- `target`: `ES2023` in app+node, `ES2022` in api. Inconsistent.

### 2.3 Linting and Formatting (`eslint.config.js`)
- ESLint v9 flat config, extends `js.recommended`, `tseslint.recommended`, `react-hooks` (incl. compiler rules), `react-refresh/vite`. Modern.
- **All rules currently `warn`** — incl. `no-explicit-any`, `no-unused-vars`, `exhaustive-deps`, 11 react-hooks v7 compiler rules. Comment says "Pre-existing issues -- warn only so CI passes". CI lint cannot fail on the most dangerous rules.
- **No Prettier installed**, no config file. ESLint has zero stylistic rules.
- Tailwind not installed — design system is `src/theme.ts` + `src/shared.tsx`. Tailwind audit criterion does not apply.

### 2.4 Git Hygiene
- `.gitignore` covers `node_modules`, `dist`, `dist-ssr`, `*.local`, `.env*`, `.vscode/*` (allowlists `extensions.json`), `.idea`, `.DS_Store`, `.vercel`, `.claude/`, `.superpowers/`. **Missing:** `dev-dist/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`, `coverage/`, `.gstack/`.
- No `.env` ever committed.
- Conventional Commits in use consistently (`feat:`, `fix:`, `chore:`, `docs:`, `perf:`, `refactor:`, `test:`, with scopes like `feat(csv):`).
- **35+ remote branches**; 10+ untouched 3–4 weeks. Local stale: `feat/batch1-quick-fixes`, `feat/batch3-visual-pass`, `feat/csv-day-2`, `feat/koda-rename`.
- `.gitattributes`: text→LF, forced LF on `.husky/*` and `*.sh`. Solid Windows setup. Add `*.ps1 text eol=crlf` and binary patterns for images/woff2.
- Current `git status`: modified `docs/DEV_ENV_AUDIT.md`; untracked `UX_AUDIT.md`, `dev-dist/`, several `docs/*.md`, `docs/superpowers/plans/*.md`.

### 2.5 Pre-commit Hooks (`.husky/pre-commit`)
- Husky v9.1.7.
- `pre-commit` runs `lint-staged`, then **full project `npm run typecheck`** (5–10s — heavy for every commit), then greps staged additions for forbidden `eslint-disable` and `: any`. Well-defended but expensive.
- `lint-staged`: ESLint only on `src/**/*.{ts,tsx}` + `api/**/*.ts`.
- **No `pre-push`, no `commit-msg`.**
- Recommend: move project-wide typecheck to `pre-push`; keep `pre-commit` to lint-staged + grep.

### 2.6 Environment Variables
Code references vs `.env.example`: **1:1 match**. No missing keys either direction.

Client (`import.meta.env.*`): `VITE_BETA_PASSWORD`, `VITE_VAPID_PUBLIC_KEY`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN`, `VITE_APP_VERSION`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus built-ins `DEV`, `MODE`.

Server (`process.env.*`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `KODA_ENCRYPTION_KEY`, `CRON_SECRET`, `TRADOVATE_APP_ID/VERSION/CID/SEC`, `TELEGRAM_BOT_TOKEN/CHAT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PROMO_CODE_ID_K0DA/FOUNDERS/BETA`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY/PRIVATE_KEY/EMAIL`. `api/lib/supabaseAdmin.ts` falls back to `VITE_SUPABASE_URL` if `SUPABASE_URL` absent.

- `.env.example` and `.env.local.example` overlap — consider deleting the latter or adding a pointer comment.
- `STRIPE_PRICE_ID` is a documented legacy fallback — plan deprecation.
- No central env-validation module (no zod parser) — every call site does `process.env.X ?? throw`.

### 2.7 Vite Config (`vite.config.ts`)
- `build.target: "es2022"` (tsconfig is `ES2023` — mild mismatch, fine).
- **No `build.sourcemap`** — Sentry can't symbolicate. High severity. Set to `"hidden"` + add `@sentry/vite-plugin`.
- `manualChunks` splits `vendor-react` and `vendor-supabase` — solid. Consider also `posthog-js`, `@sentry/react`, `xlsx`, `stripe`.
- No path aliases (consistent with tsconfig).
- Plugins: `@vitejs/plugin-react`, `vite-plugin-pwa@0.21.2` with custom `sw.ts`, `injectManifest`. **Potential compat issue:** `vite-plugin-pwa@0.21` was released against Vite 5; `package.json` has `vite ^8.0.1`. Prior commit `fix: pin Node to 20.x to prevent Vercel auto-upgrade to Node 24 (Rolldown breaks vite-plugin-pwa)` confirms ongoing fragility.
- Vitest config embedded in `vite.config.ts` — works but extract to `vitest.config.ts` for cleanliness.
- `PWA devOptions.enabled: true` — service worker in dev. CLAUDE.md notes this confuses HMR.

### 2.8 Claude Code Config (`CLAUDE.md`)
- 501 lines. Operating Rules 1–5, project context, key files, env vars, DNS notes, lessons-learned patterns.
- **TRADR → Kōda rebrand fully reflected** — title is "Kōda", live URL `kodatrade.co.uk`, file refs `src/Koda.tsx`/`src/KodaAuth.tsx`, env var `KODA_ENCRYPTION_KEY`.
- Legacy `tradr_*` KV key prefixes are documented and intentional (data migration would be required to rename).
- `.claude/` and `.superpowers/` correctly gitignored.
- **`.gstack/` NOT gitignored** — contains `browse-startup-error.log`.
- `tasks/lessons.md` referenced by Rule #3 — existence/freshness not verified.

### 2.9 CI / Deploy (`.github/workflows/ci.yml`, `sync-cron.yml`, `vercel.json`)
- CI: Lint → Typecheck → Build (PRs + push to main). Parallel `test` job runs Vitest. `e2e` runs Playwright on push-to-main only with `continue-on-error: true`.
- Uses `npm install` everywhere — should be `npm ci` for reproducibility.
- `typecheck:api` not added (per §2.2).
- `sync-cron.yml`: 5-min cron to `/api/cron/sync` with `CRON_SECRET` header. Clean.
- `vercel.json`: strong CSP headers (`script-src 'self'`, `frame-ancestors 'none'`, etc.), daily cron for `complete-challenges`. No `Strict-Transport-Security`.
- CI uses dummy build-time `VITE_SUPABASE_*` (correct — bundle compiles without connecting).

### 2.10 Editor Config
- `.editorconfig`: UTF-8, LF, 2-space, final newline, trim trailing whitespace (except `.md`). Solid.
- **`.vscode/settings.json` missing.**
- **`.vscode/extensions.json` missing** — `.gitignore` allowlists it but the file doesn't exist.

## 3. Suggested Sequencing — 30–60 min sessions (dependency order)

**A. Workspace foundation (30 min)** — OneDrive decision, delete empty `koda/`, expand `.gitignore` (`dev-dist/`, `playwright-report/`, `*.tsbuildinfo`, `coverage/`, `.gstack/`, `supabase/.temp`, `supabase/.branches`).
**B. Editor config (30 min)** — Add `.vscode/extensions.json` + `.vscode/settings.json`.
**C. Prettier + format script (45 min)** — Install `prettier` + `eslint-config-prettier`; add `.prettierrc`, `.prettierignore`, scripts, lint-staged glob, CI `format:check` step; commit reformat as separate `style:` commit.
**D. Tighten TS (45 min)** — Add `tsconfig.api.json` to refs, add `typecheck:api` script + CI, delete stray `src/TRADR (n).tsx` files, align `ES2023`.
**E. `noUncheckedIndexedAccess` migration (60 min, multi-session)** — Branch, enable flag, fix the 50–200 errors incrementally.
**F. Sourcemaps + Sentry upload (45 min)** — `build.sourcemap: "hidden"`, `@sentry/vite-plugin`, Vercel env vars.
**G. Hook hygiene (30 min)** — Move typecheck to `pre-push`, add `npm test` to `pre-push`, optional commitlint.
**H. Branch + CI cleanup (30 min)** — Delete merged branches; switch CI `npm install` → `npm ci`; document required GitHub secrets.
**I. Env-var validation (45 min, optional)** — Zod schemas in `src/lib/clientEnv.ts` + `api/lib/serverEnv.ts`.

## 4. System-Level Recommendations

**Global VS Code** — Cmd-Shift-P → "Preferences: Open User Settings (JSON)" → merge:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "git.autofetch": true,
  "git.confirmSync": false,
  "git.enableSmartCommit": true
}
```
Extensions: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`, `EditorConfig.EditorConfig`, `usernamehw.errorlens`, `streetsidesoftware.code-spell-checker`, `GitHub.vscode-pull-request-github`, `eamodio.gitlens`, `ms-playwright.playwright`, `vitest.explorer`.

**Global git config:**
```powershell
git config --global core.autocrlf input
git config --global core.eol lf
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global fetch.prune true
git config --global rebase.autostash true
git config --global merge.conflictstyle zdiff3
git config --global rerere.enabled true
git config --global push.autoSetupRemote true
git config --global alias.lg "log --oneline --graph --decorate -30"
git config --global alias.st "status -sb"
```

**PowerShell `$PROFILE`:**
```powershell
function prompt {
  $branch = (git branch --show-current 2>$null)
  $b = if ($branch) { " [$branch]" } else { "" }
  "$(Split-Path -Leaf (Get-Location))$b > "
}
Set-Alias gs 'git status'
Set-Alias gd 'git diff'
function gco { git checkout @args }
function gcb { git checkout -b @args }
# winget install CoreyButler.NVMforWindows
```

**Global Node:** keep npm-only; do not install pnpm/yarn globally. `npm install -g npm-check-updates serve`.

**OneDrive:** Settings → Accounts → OneDrive → Choose folders → uncheck `Desktop\tradr-fresh`. Or `robocopy "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh" "C:\dev\tradr-fresh" /E /XD node_modules .git\objects\pack`.

## 5. Questions for Dylon

1. **OneDrive intent** — deliberate or accidental? Drives whether we exclude vs move.
2. **`legacy-peer-deps=true`** — remember which dep needed this? Try a clean install without it.
3. **Prettier preferences** — quotes/commas/width? I'd default single/`all`/100.
4. **Branch retention** — enable GitHub auto-delete on merge?
5. **Sentry** — org + auth token already provisioned, or need creating?
6. **Promote ESLint rules** — comfortable making `react-hooks/exhaustive-deps` an error after audit?
7. **`tasks/lessons.md`** — actively maintained, or aspirational?
8. **Vercel runtime** — willing to move some routes (e.g. `feedback`, `push`) from `nodejs` to `edge`?
9. **Vite 8 + vite-plugin-pwa 0.21** — pin Vite at `~7.x` until upstream catches up?
10. **CSP `script-src 'self'`** — verified PostHog works under this on preview?
