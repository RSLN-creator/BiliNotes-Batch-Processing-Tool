Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

Set objExec = WshShell.Exec("netstat -ano")
strOutput = objExec.StdOut.ReadAll()
arrLines = Split(strOutput, vbCrLf)
For Each strLine In arrLines
    If InStr(strLine, ":8765") > 0 And InStr(strLine, "LISTENING") > 0 Then
        arrParts = Split(strLine)
        strPID = arrParts(UBound(arrParts))
        On Error Resume Next
        WshShell.Run "taskkill /PID " & strPID & " /F", 0, True
        On Error GoTo 0
    End If
Next
WScript.Sleep 1000

WshShell.Run "pythonw app.py", 0, False
