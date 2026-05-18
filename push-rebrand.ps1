Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"
Remove-Item .git\*.lock -ErrorAction SilentlyContinue
git add public\icon.svg public\favicon.svg public\apple-touch-icon.svg public\apple-touch-icon.png public\manifest.webmanifest index.html src\shared.tsx src\TRADR.tsx
git status --short
git commit -m "brand: TRADR OS rebrand + 4-chevron logo + iOS PNG icon"
git push origin feat/block1-fixes
Write-Host "Done!" -ForegroundColor Green
