Set-Location "C:\Users\Dylon\OneDrive\Desktop\tradr"
Remove-Item .git\*.lock -ErrorAction SilentlyContinue
git fetch origin
git checkout feat/block1-fixes
git merge origin/main -X ours -m "merge: absorb main into feat/block1-fixes, keep our changes"
git push origin feat/block1-fixes
Write-Host "Done - PR conflict resolved, ready to merge on GitHub!" -ForegroundColor Green
