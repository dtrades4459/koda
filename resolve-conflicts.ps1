Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"
Remove-Item .git\*.lock -ErrorAction SilentlyContinue

# Fetch latest main from origin
git fetch origin

# Merge origin/main into our branch to resolve conflicts
# We use "ours" strategy for any conflicts — our branch has the fixes, main is behind
git merge origin/main --strategy-option=ours -m "merge: bring in main to resolve conflicts, keep our fixes"

git push origin feat/block1-fixes

Write-Host "`nConflicts resolved and pushed." -ForegroundColor Green
Read-Host "Press Enter to close"
