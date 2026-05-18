Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"

# Clear any stale lock files
Remove-Item .git\*.lock -ErrorAction SilentlyContinue

# Add .claude/ to .gitignore so it never gets committed
$ignore = Get-Content .gitignore -Raw
if ($ignore -notmatch "\.claude/") {
    Add-Content .gitignore "`n# Local Claude AI session files`n.claude/"
    Write-Host "Added .claude/ to .gitignore"
}

# Stage all real project changes (not .claude/ skills)
git add `
    .env.example `
    .gitignore `
    .github\workflows\ci.yml `
    CLAUDE.md `
    DEPLOYMENT.md `
    MIGRATION.md `
    README.md `
    TRADR-BRAIN.md `
    api\feedback.ts `
    api\stripe-checkout.ts `
    api\stripe-portal.ts `
    api\stripe-webhook.ts `
    api\tradovate.ts `
    index.html `
    package.json `
    playwright.config.ts `
    public\apple-touch-icon.svg `
    public\favicon.svg `
    public\icon.svg `
    public\manifest.webmanifest `
    public\privacy.html `
    public\terms.html `
    src\TRADR.tsx `
    src\TradrAuth.tsx `
    src\CsvImportPanel.tsx `
    src\FriendsFeed.tsx `
    src\OnboardingFlow.tsx `
    src\ProfileModal.tsx `
    src\UpgradeModal.tsx `
    src\charts.tsx `
    src\shared.tsx `
    src\types.ts `
    src\lib\flags.ts `
    src\lib\tradovate.ts `
    supabase\migrations\001_rls_cleanup.sql `
    supabase\migrations\002_v2_schema_additive.sql `
    tests\smoke.spec.ts `
    vercel.json `
    vite.config.ts

git status --short

git commit -m "refactor: split TRADR.tsx into components + Stripe/CORS/FIFO fixes + prop firm mode"

git push origin feat/block1-fixes

Write-Host "`nDone! Branch is pushed." -ForegroundColor Green
Read-Host "Press Enter to close"
