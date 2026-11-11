' DentSoft bekci betigini pencere acmadan calistirir.
' Klasor, bu dosyanin kendi konumundan bulunur (Turkce karakterli sabit yol yok).
Dim shell, fso, folder
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c """ & folder & "\start-dentsoft.bat""", 0, False
Set shell = Nothing
Set fso = Nothing
