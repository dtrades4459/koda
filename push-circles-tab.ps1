Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"
Remove-Item .git\*.lock -ErrorAction SilentlyContinue
git add src\TRADR.tsx
git status --short
git commit -m "feat: circles chat tab on home screen"
git push origin feat/block1-fixes
Write-Host "Done!" -ForegroundColor Green
