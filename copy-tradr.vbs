Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

src = "C:\Users\Dylon\OneDrive\Desktop\tradr"
dst = "C:\Dev\tradr"
log = "C:\Dev\copy-log.txt"

' Run robocopy - simple flags, skip node_modules (run npm install after)
cmd = "cmd /c robocopy """ & src & """ """ & dst & """ /E /XD node_modules dist .git /XF *.tmp > """ & log & """ 2>&1"
objShell.Run cmd, 0, True

' Copy .git separately (needed for git to work)
cmd2 = "cmd /c robocopy """ & src & "\.git"" """ & dst & "\.git"" /E /MIR >> """ & log & """ 2>&1"
objShell.Run cmd2, 0, True

If fso.FolderExists(dst & "\src") Then
    MsgBox "SUCCESS! Repo copied to C:\Dev\tradr" & Chr(13) & Chr(10) & "Run 'npm install' in C:\Dev\tradr to restore dependencies.", 64, "TRADR Move Complete"
Else
    MsgBox "Copy may have failed. Check C:\Dev\copy-log.txt for details.", 48, "TRADR Move"
End If
