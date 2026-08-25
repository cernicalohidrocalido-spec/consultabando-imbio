Option Explicit
' Regenera pdfs/*.pdf desde scripts/_docx_freeze_tmp/*.docx (DOCX con DATE congelado).
Dim word, fso, docxDir, pdfDir, folder, file, doc, pdfPath, ok, fail, msg

Set fso = CreateObject("Scripting.FileSystemObject")
docxDir = fso.GetAbsolutePathName(fso.GetParentFolderName(WScript.ScriptFullName) & "\..\_docx_freeze_tmp")
If Not fso.FolderExists(docxDir) Then
  docxDir = fso.GetAbsolutePathName(fso.GetParentFolderName(WScript.ScriptFullName) & "\_docx_freeze_tmp")
End If
pdfDir = fso.GetAbsolutePathName(fso.GetParentFolderName(WScript.ScriptFullName) & "\..\pdfs")

If Not fso.FolderExists(docxDir) Then
  WScript.Echo "ERROR: no existe " & docxDir & " — corre antes: python scripts/freeze_docx_dates.py"
  WScript.Quit 2
End If

Set word = CreateObject("Word.Application")
word.Visible = False
word.DisplayAlerts = 0
On Error Resume Next
word.Options.UpdateFieldsAtPrint = False
word.Options.UpdateLinksAtOpen = False
On Error GoTo 0

ok = 0
fail = 0
msg = ""

Set folder = fso.GetFolder(docxDir)
For Each file In folder.Files
  If LCase(fso.GetExtensionName(file.Name)) = "docx" Then
    pdfPath = pdfDir & "\" & fso.GetBaseName(file.Name) & ".pdf"
    WScript.Echo ">> " & file.Name
    On Error Resume Next
    Err.Clear
    Set doc = word.Documents.Open(file.Path, False, True)
    If Err.Number <> 0 Then
      msg = msg & "OPEN " & file.Name & ": " & Err.Description & vbCrLf
      fail = fail + 1
      Err.Clear
    Else
      If fso.FileExists(pdfPath) Then fso.DeleteFile pdfPath, True
      doc.ExportAsFixedFormat pdfPath, 17, False, 0
      If Err.Number <> 0 Then
        msg = msg & "PDF " & file.Name & ": " & Err.Description & vbCrLf
        fail = fail + 1
        Err.Clear
      Else
        ok = ok + 1
        WScript.Echo "   OK"
      End If
      doc.Close False
      Err.Clear
    End If
    On Error GoTo 0
  End If
Next

word.Quit
WScript.Echo "Listos: " & ok & "  Fallidos: " & fail
If Len(msg) > 0 Then WScript.Echo msg
If fail > 0 Then WScript.Quit 1
WScript.Quit 0
