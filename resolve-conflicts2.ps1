Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"
Remove-Item .git\*.lock -ErrorAction SilentlyContinue

git fetch origin

# Merge origin/main, keeping our version of any conflicted files
git merge origin/main -X ours -m "merge: resolve ci.yml conflict with main"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Merge had issues, forcing ci.yml to our version..." -ForegroundColor Yellow
    git checkout --ours .github/workflows/ci.yml
    git add .github/workflows/ci.yml
    git commit -m "merge: resolve ci.yml conflict, keep our version"
}

git push origin feat/block1-fixes
Write-Host "`nDone — conflict resolved and pushed." -ForegroundColor Green
Read-Host "Press Enter to close"
