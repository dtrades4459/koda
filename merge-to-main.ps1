# TRADR — Merge fix/accessibility-d to main via GitHub PR
Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"

Remove-Item .git\*.lock -ErrorAction SilentlyContinue
Remove-Item .git\refs\heads\*.lock -ErrorAction SilentlyContinue

Write-Host "Fetching latest..." -ForegroundColor Yellow
git fetch origin

# Check if gh CLI is available
$ghAvailable = (Get-Command gh -ErrorAction SilentlyContinue) -ne $null

if ($ghAvailable) {
    Write-Host "Creating PR via GitHub CLI..." -ForegroundColor Yellow
    gh pr create `
        --base main `
        --head "fix/accessibility-d" `
        --title "feat: prop firm mode, rule adherence, per-setup P&L, refactored components" `
        --body "Merges all development from fix/accessibility-d to main for production deploy."

    Write-Host "Merging PR..." -ForegroundColor Yellow
    gh pr merge "fix/accessibility-d" --merge --delete-branch=false

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Done! Vercel is deploying — check tradrjournal.xyz in ~60s." -ForegroundColor Green
    } else {
        Write-Host "`n✗ Merge failed. Try option B below." -ForegroundColor Red
    }
} else {
    Write-Host "`nGitHub CLI (gh) not found. Two options:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Option A — Disable branch protection temporarily:" -ForegroundColor White
    Write-Host "  1. Go to: https://github.com/dtrades4459/tradr/settings/branches" -ForegroundColor Gray
    Write-Host "  2. Edit the 'main' protection rule" -ForegroundColor Gray
    Write-Host "  3. Uncheck 'Require a pull request before merging'" -ForegroundColor Gray
    Write-Host "  4. Save — then re-run this script" -ForegroundColor Gray
    Write-Host "  5. Re-enable the protection after push succeeds" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option B — Merge via GitHub UI (recommended):" -ForegroundColor White
    Write-Host "  1. Go to: https://github.com/dtrades4459/tradr/compare/main...fix/accessibility-d" -ForegroundColor Gray
    Write-Host "  2. Click 'Create pull request'" -ForegroundColor Gray
    Write-Host "  3. Click 'Merge pull request' → 'Confirm merge'" -ForegroundColor Gray
    Write-Host "  Vercel will auto-deploy once merged." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option C — Install gh CLI:" -ForegroundColor White
    Write-Host "  winget install --id GitHub.cli" -ForegroundColor Gray
    Write-Host "  gh auth login" -ForegroundColor Gray
    Write-Host "  Then re-run this script." -ForegroundColor Gray
}

Read-Host "`nPress Enter to close"
