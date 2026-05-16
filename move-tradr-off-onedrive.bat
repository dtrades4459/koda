@echo off
echo.
echo === TRADR: Copying repo off OneDrive ===
echo From: C:\Users\Dylon\OneDrive\Desktop\tradr
echo To:   C:\Dev\tradr
echo.

if not exist "C:\Dev" mkdir "C:\Dev"

echo Copying files (this may take a minute for node_modules)...
robocopy "C:\Users\Dylon\OneDrive\Desktop\tradr" "C:\Dev\tradr" /E /COPYALL /NFL /NDL /NJH /NJS

if %ERRORLEVEL% LSS 8 (
    echo.
    echo SUCCESS! Repo is now at: C:\Dev\tradr
    echo.
    echo NEXT STEPS:
    echo   1. Open Cursor/VS Code from C:\Dev\tradr
    echo   2. Run: cd C:\Dev\tradr ^&^& npm run dev
    echo   3. Confirm it boots, then delete the OneDrive copy
    echo.
    echo File truncation risk: ELIMINATED
) else (
    echo.
    echo ERROR - robocopy failed with code %ERRORLEVEL%
    echo Try running as Administrator.
)

echo.
pause
