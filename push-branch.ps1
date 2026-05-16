# TRADR — push fix/accessibility-danger-zone to origin
Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"

# Clear any stale lock files
Remove-Item .git\*.lock -ErrorAction SilentlyContinue

# Unstage the mass-deletion left by the other chat session
git reset HEAD 2>$null

# Stage all the real changes
git add src\TRADR.tsx `
        src\PropFirmDashboard.tsx `
        src\types.ts `
        src\lib\tradovate.ts `
        index.html `
        vercel.json `
        public\manifest.webmanifest `
        .env.example

# Show what we're about to commit
git status --short

# Commit (will be a no-op if already committed locally)
git commit -m "feat: Tradovate live positions + Prop Firm Mode + fix truncated files" 2>$null; $true

# Push
git push origin fix/accessibility-danger-zone

Write-Host "`nDone! Check GitHub for the PR." -ForegroundColor Green
Read-Host "Press Enter to close"
