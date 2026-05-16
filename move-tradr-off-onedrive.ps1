# TRADR Repo — Copy off OneDrive to C:\Dev\tradr
# Safe copy (non-destructive — OneDrive original stays until you delete it)

$src = "C:\Users\Dylon\OneDrive\Desktop\tradr"
$dst = "C:\Dev\tradr"

Write-Host ""
Write-Host "=== TRADR: Moving repo off OneDrive ===" -ForegroundColor Cyan
Write-Host "From: $src"
Write-Host "To:   $dst"
Write-Host ""

# Create C:\Dev if it doesn't exist
New-Item -ItemType Directory -Force "C:\Dev" | Out-Null

# Robocopy: /E = all subdirs incl empty, /COPYALL = preserve all attrs, quiet mode
Write-Host "Copying files (this may take a moment)..." -ForegroundColor Yellow
robocopy $src $dst /E /COPYALL /NFL /NDL /NJH /NJS
$exitCode = $LASTEXITCODE

# Robocopy exit codes 0-7 are success (8+ = errors occurred)
if ($exitCode -lt 8) {
    Write-Host ""
    Write-Host "SUCCESS! Repo is now at: $dst" -ForegroundColor Green
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "  1. Open Cursor/VS Code from C:\Dev\tradr"
    Write-Host "  2. cd C:\Dev\tradr && npm run dev — confirm it boots"
    Write-Host "  3. Git still works (the .git folder was copied)"
    Write-Host "  4. Delete the OneDrive copy when you're happy"
    Write-Host ""
    Write-Host "File truncation risk: ELIMINATED" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR — robocopy exited with code $exitCode" -ForegroundColor Red
    Write-Host "Try running this script as Administrator."
}

Write-Host ""
Read-Host "Press Enter to close"
