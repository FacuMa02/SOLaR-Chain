Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c """ & Replace(WScript.ScriptFullName, ".vbs", ".cmd") & """", 0, False
