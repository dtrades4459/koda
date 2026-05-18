Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"
Remove-Item .git\*.lock -ErrorAction SilentlyContinue
git add src\TRADR.tsx
git commit -m "fix: restore DEF_PROFILE constant missing after component-split refactor"
git push origin feat/block1-fixes
Write-Host "`nDone!" -ForegroundColor Green
Read-Host "Press Enter to close"
