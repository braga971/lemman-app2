$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $root "excel-vba"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$envFile = Join-Path $root "backup\.env"
$config = @{}
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $parts = $line.Split("=", 2)
    $config[$parts[0].Trim()] = $parts[1].Trim()
  }
}

$supabaseUrl = $config["SUPABASE_URL"]
$serviceKey = $config["SUPABASE_SERVICE_ROLE_KEY"]
$year = (Get-Date).Year
$outFile = Join-Path $outDir "Rapportini_Supabase_Dashboard.xlsm"

$vba = @'
Option Explicit

Private Const SHEET_DASH As String = "DASHBOARD"
Private Const SHEET_CONFIG As String = "CONFIG"
Private Const SHEET_RAP As String = "RAPPORTINI"
Private Const SHEET_TOT As String = "TOTALE"
Private Const SHEET_RES As String = "RESOCONTO"

Public Sub ScaricaRapportiniApprovati()
    On Error GoTo ErrHandler
    Application.ScreenUpdating = False
    Application.EnableEvents = False

    Dim baseUrl As String, apiKey As String, anno As String
    baseUrl = Trim(GetConfig("SUPABASE_URL"))
    apiKey = Trim(GetConfig("SUPABASE_SERVICE_ROLE_KEY"))
    anno = Trim(GetConfig("ANNO"))
    If Len(anno) = 0 Then anno = CStr(Year(Date))

    If Len(baseUrl) = 0 Or Len(apiKey) = 0 Then
        MsgBox "Config mancante: apri CONFIG e imposta Supabase URL e Service Role Key.", vbExclamation
        GoTo CleanExit
    End If

    Dim profiles As Object, commesse As Object, posizioni As Object, rapportini As Collection
    Set profiles = LoadProfiles(baseUrl, apiKey)
    Set commesse = LoadCommesse(baseUrl, apiKey)
    Set posizioni = LoadPosizioni(baseUrl, apiKey)
    Set rapportini = LoadRapportini(baseUrl, apiKey, anno)

    SyncRapportini rapportini, profiles, commesse, posizioni, anno
    BuildTotale
    BuildResoconto
    UpdateDashboard rapportini.Count, anno

    MsgBox "Aggiornamento completato: " & rapportini.Count & " rapportini approvati.", vbInformation

CleanExit:
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    Exit Sub
ErrHandler:
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    MsgBox "Errore aggiornamento: " & Err.Description, vbCritical
End Sub

Private Function GetConfig(ByVal key As String) As String
    Dim ws As Worksheet, lastRow As Long, r As Long
    Set ws = ThisWorkbook.Worksheets(SHEET_CONFIG)
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    For r = 1 To lastRow
        If UCase$(Trim(CStr(ws.Cells(r, 1).Value))) = UCase$(key) Then
            GetConfig = CStr(ws.Cells(r, 2).Value)
            Exit Function
        End If
    Next r
End Function

Private Function HttpGetCsv(ByVal url As String, ByVal apiKey As String) As String
    Dim http As Object
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", url, False
    http.setRequestHeader "apikey", apiKey
    http.setRequestHeader "Authorization", "Bearer " & apiKey
    http.setRequestHeader "Accept", "text/csv"
    http.Send
    If http.Status < 200 Or http.Status >= 300 Then
        Err.Raise vbObjectError + 100, , "Supabase HTTP " & http.Status & ": " & http.responseText
    End If
    HttpGetCsv = http.responseText
End Function

Private Function Endpoint(ByVal baseUrl As String, ByVal path As String) As String
    If Right$(baseUrl, 1) = "/" Then
        Endpoint = Left$(baseUrl, Len(baseUrl) - 1) & path
    Else
        Endpoint = baseUrl & path
    End If
End Function

Private Function ParseCsv(ByVal text As String) As Collection
    Dim rows As New Collection, row As Collection
    Dim i As Long, ch As String, cell As String, inQuotes As Boolean
    Set row = New Collection
    text = Replace(text, vbCrLf, vbLf)
    text = Replace(text, vbCr, vbLf)
    For i = 1 To Len(text)
        ch = Mid$(text, i, 1)
        If inQuotes Then
            If ch = """" Then
                If i < Len(text) And Mid$(text, i + 1, 1) = """" Then
                    cell = cell & """"
                    i = i + 1
                Else
                    inQuotes = False
                End If
            Else
                cell = cell & ch
            End If
        Else
            Select Case ch
                Case """"
                    inQuotes = True
                Case ","
                    row.Add cell
                    cell = ""
                Case vbLf
                    row.Add cell
                    rows.Add row
                    Set row = New Collection
                    cell = ""
                Case Else
                    cell = cell & ch
            End Select
        End If
    Next i
    If Len(cell) > 0 Or row.Count > 0 Then
        row.Add cell
        rows.Add row
    End If
    Set ParseCsv = rows
End Function

Private Function CsvToRecords(ByVal csv As String) As Collection
    Dim rows As Collection, out As New Collection
    Set rows = ParseCsv(csv)
    If rows.Count < 2 Then Set CsvToRecords = out: Exit Function

    Dim headers As Collection, r As Long, c As Long, rec As Object
    Set headers = rows(1)
    For r = 2 To rows.Count
        If rows(r).Count = 1 And Len(rows(r)(1)) = 0 Then GoTo NextRow
        Set rec = CreateObject("Scripting.Dictionary")
        For c = 1 To headers.Count
            If c <= rows(r).Count Then
                rec(CStr(headers(c))) = CStr(rows(r)(c))
            Else
                rec(CStr(headers(c))) = ""
            End If
        Next c
        out.Add rec
NextRow:
    Next r
    Set CsvToRecords = out
End Function

Private Function LoadProfiles(ByVal baseUrl As String, ByVal apiKey As String) As Object
    Dim dict As Object, recs As Collection, r As Variant, name As String
    Set dict = CreateObject("Scripting.Dictionary")
    Set recs = CsvToRecords(HttpGetCsv(Endpoint(baseUrl, "/rest/v1/profiles?select=id,full_name,email"), apiKey))
    For Each r In recs
        name = Nz(r("full_name"))
        If Len(name) = 0 Then name = Nz(r("email"))
        dict(Nz(r("id"))) = name
    Next r
    Set LoadProfiles = dict
End Function

Private Function LoadCommesse(ByVal baseUrl As String, ByVal apiKey As String) As Object
    Dim dict As Object, recs As Collection, r As Variant
    Set dict = CreateObject("Scripting.Dictionary")
    Set recs = CsvToRecords(HttpGetCsv(Endpoint(baseUrl, "/rest/v1/commesse?select=id,code,cantiere,archived_at"), apiKey))
    For Each r In recs
        dict(Nz(r("id"))) = Nz(r("code")) & "|" & Nz(r("cantiere"))
    Next r
    Set LoadCommesse = dict
End Function

Private Function LoadPosizioni(ByVal baseUrl As String, ByVal apiKey As String) As Object
    Dim dict As Object, recs As Collection, r As Variant
    Set dict = CreateObject("Scripting.Dictionary")
    Set recs = CsvToRecords(HttpGetCsv(Endpoint(baseUrl, "/rest/v1/posizioni?select=id,name,commessa_id"), apiKey))
    For Each r In recs
        dict(Nz(r("id"))) = Nz(r("name"))
    Next r
    Set LoadPosizioni = dict
End Function

Private Function LoadRapportini(ByVal baseUrl As String, ByVal apiKey As String, ByVal anno As String) As Collection
    Dim url As String
    url = Endpoint(baseUrl, "/rest/v1/rapportini?select=id,user_id,data,ore,descrizione,commessa_id,posizione_id,cantiere,stato" & _
        "&data=gte." & anno & "-01-01" & _
        "&data=lte." & anno & "-12-31" & _
        "&or=%28stato.eq.approvato,stato.eq.approved%29" & _
        "&order=data.asc")
    Set LoadRapportini = CsvToRecords(HttpGetCsv(url, apiKey))
End Function

Private Sub SyncRapportini(ByVal rapportini As Collection, ByVal profiles As Object, ByVal commesse As Object, ByVal posizioni As Object, ByVal anno As String)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(SHEET_RAP)
    EnsureRapHeaders ws

    Dim desired As Object, rowById As Object, r As Long, id As String
    Set desired = CreateObject("Scripting.Dictionary")
    Set rowById = CreateObject("Scripting.Dictionary")

    For r = 2 To ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
        id = Trim(CStr(ws.Cells(r, 1).Value))
        If Len(id) > 0 Then rowById(id) = r
    Next r

    Dim rec As Variant, rowIdx As Long, comm As String, cant As String, parts() As String
    For Each rec In rapportini
        id = Nz(rec("id"))
        desired(id) = True
        If rowById.Exists(id) Then
            rowIdx = CLng(rowById(id))
        Else
            rowIdx = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 1
            rowById(id) = rowIdx
        End If

        comm = "": cant = Nz(rec("cantiere"))
        If commesse.Exists(Nz(rec("commessa_id"))) Then
            parts = Split(CStr(commesse(Nz(rec("commessa_id")))), "|")
            comm = parts(0)
            If Len(cant) = 0 And UBound(parts) >= 1 Then cant = parts(1)
        End If

        ws.Cells(rowIdx, 1).Value = id
        ws.Cells(rowIdx, 2).Value = Nz(rec("data"))
        ws.Cells(rowIdx, 3).Value = DictValue(profiles, Nz(rec("user_id")), Nz(rec("user_id")))
        ws.Cells(rowIdx, 4).Value = comm
        ws.Cells(rowIdx, 5).Value = cant
        ws.Cells(rowIdx, 6).Value = DictValue(posizioni, Nz(rec("posizione_id")), "")
        ws.Cells(rowIdx, 7).Value = Nz(rec("descrizione"))
        ws.Cells(rowIdx, 8).Value = Val(Replace(Nz(rec("ore")), ",", "."))
        ws.Cells(rowIdx, 9).Value = Nz(rec("stato"))
    Next rec

    For r = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row To 2 Step -1
        id = Trim(CStr(ws.Cells(r, 1).Value))
        If Len(id) > 0 Then
            If Left$(CStr(ws.Cells(r, 2).Value), 4) = anno And Not desired.Exists(id) Then ws.Rows(r).Delete
        End If
    Next r

    ws.Columns(1).Hidden = True
    ws.Columns.AutoFit
End Sub

Private Sub EnsureRapHeaders(ByVal ws As Worksheet)
    Dim headers As Variant, i As Long
    headers = Array("ID", "Data", "Dipendente", "Commessa", "Cantiere", "Posizione", "Descrizione", "Ore", "Stato")
    For i = 0 To UBound(headers)
        ws.Cells(1, i + 1).Value = headers(i)
        ws.Cells(1, i + 1).Font.Bold = True
    Next i
End Sub

Private Sub BuildTotale()
    Dim wsR As Worksheet, ws As Worksheet, agg As Object, people As Object
    Set wsR = ThisWorkbook.Worksheets(SHEET_RAP)
    Set ws = ThisWorkbook.Worksheets(SHEET_TOT)
    ws.Cells.Clear
    Set agg = CreateObject("Scripting.Dictionary")
    Set people = CreateObject("Scripting.Dictionary")

    Dim r As Long, lastRow As Long, person As String, m As Long, key As String, ore As Double
    lastRow = wsR.Cells(wsR.Rows.Count, 2).End(xlUp).Row
    For r = 2 To lastRow
        If Len(wsR.Cells(r, 2).Value) = 0 Then GoTo NextRow
        person = CStr(wsR.Cells(r, 3).Value)
        m = Month(CDate(wsR.Cells(r, 2).Value))
        ore = CDbl(Val(Replace(CStr(wsR.Cells(r, 8).Value), ",", ".")))
        people(person) = True
        key = person & "|" & CStr(m)
        agg(key) = CDbl(NzNum(agg, key)) + ore
NextRow:
    Next r

    Dim months As Variant, c As Long, outRow As Long, p As Variant, total As Double
    months = Array("Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic")
    ws.Cells(1, 1).Value = "Dipendente"
    For c = 0 To 11: ws.Cells(1, c + 2).Value = months(c): Next c
    ws.Cells(1, 14).Value = "Totale"
    ws.Rows(1).Font.Bold = True
    outRow = 2
    For Each p In people.Keys
        ws.Cells(outRow, 1).Value = p
        total = 0
        For c = 1 To 12
            ore = CDbl(NzNum(agg, CStr(p) & "|" & CStr(c)))
            ws.Cells(outRow, c + 1).Value = ore
            total = total + ore
        Next c
        ws.Cells(outRow, 14).Value = total
        outRow = outRow + 1
    Next p
    ws.Columns.AutoFit
End Sub

Private Sub BuildResoconto()
    Dim wsR As Worksheet, ws As Worksheet, agg As Object
    Set wsR = ThisWorkbook.Worksheets(SHEET_RAP)
    Set ws = ThisWorkbook.Worksheets(SHEET_RES)
    ws.Cells.Clear
    Set agg = CreateObject("Scripting.Dictionary")

    Dim r As Long, lastRow As Long, m As Long, key As String, ore As Double
    lastRow = wsR.Cells(wsR.Rows.Count, 2).End(xlUp).Row
    For r = 2 To lastRow
        If Len(wsR.Cells(r, 2).Value) = 0 Then GoTo NextRow
        m = Month(CDate(wsR.Cells(r, 2).Value))
        key = CStr(wsR.Cells(r, 5).Value) & "|" & CStr(wsR.Cells(r, 4).Value) & "|" & CStr(m)
        ore = CDbl(Val(Replace(CStr(wsR.Cells(r, 8).Value), ",", ".")))
        agg(key) = CDbl(NzNum(agg, key)) + ore
NextRow:
    Next r

    ws.Range("A1:N1").Value = Array("Cantiere", "Commessa", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic")
    ws.Rows(1).Font.Bold = True

    Dim pairs As Object, k As Variant, parts() As String, pairKey As String
    Set pairs = CreateObject("Scripting.Dictionary")
    For Each k In agg.Keys
        parts = Split(CStr(k), "|")
        pairKey = parts(0) & "|" & parts(1)
        pairs(pairKey) = True
    Next k

    Dim outRow As Long, c As Long
    outRow = 2
    For Each k In pairs.Keys
        parts = Split(CStr(k), "|")
        ws.Cells(outRow, 1).Value = parts(0)
        ws.Cells(outRow, 2).Value = parts(1)
        For c = 1 To 12
            ws.Cells(outRow, c + 2).Value = CDbl(NzNum(agg, parts(0) & "|" & parts(1) & "|" & CStr(c)))
        Next c
        outRow = outRow + 1
    Next k
    ws.Columns.AutoFit
End Sub

Private Sub UpdateDashboard(ByVal countRap As Long, ByVal anno As String)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(SHEET_DASH)
    ws.Range("B5").Value = Now
    ws.Range("B6").Value = anno
    ws.Range("B7").Value = countRap
End Sub

Private Function Nz(ByVal v As Variant) As String
    If IsError(v) Or IsNull(v) Or IsEmpty(v) Then Nz = "" Else Nz = CStr(v)
End Function

Private Function DictValue(ByVal dict As Object, ByVal key As String, ByVal fallback As String) As String
    If dict.Exists(key) Then DictValue = CStr(dict(key)) Else DictValue = fallback
End Function

Private Function NzNum(ByVal dict As Object, ByVal key As String) As Double
    If dict.Exists(key) Then NzNum = CDbl(dict(key)) Else NzNum = 0
End Function
'@

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
  $wb = $excel.Workbooks.Add()
  while ($wb.Worksheets.Count -gt 1) {
    $wb.Worksheets.Item($wb.Worksheets.Count).Delete()
  }
  $wb.Worksheets.Item(1).Name = "DASHBOARD"
  $dash = $wb.Worksheets.Item("DASHBOARD")
  $configSheet = $wb.Worksheets.Add($null, $dash)
  $configSheet.Name = "CONFIG"
  $rap = $wb.Worksheets.Add($null, $configSheet)
  $rap.Name = "RAPPORTINI"
  $tot = $wb.Worksheets.Add($null, $rap)
  $tot.Name = "TOTALE"
  $res = $wb.Worksheets.Add($null, $tot)
  $res.Name = "RESOCONTO"

  $dash.Range("A1").Value2 = "Dashboard Rapportini Supabase"
  $dash.Range("A1").Font.Bold = $true
  $dash.Range("A1").Font.Size = 18
  $dash.Range("A3").Value2 = "Usa il pulsante per scaricare i rapportini approvati e aggiornare i riepiloghi."
  $dash.Range("A5").Value2 = "Ultimo aggiornamento"
  $dash.Range("A6").Value2 = "Anno"
  $dash.Range("A7").Value2 = "Rapportini approvati scaricati"
  $dash.Range("B6").Value2 = [string]$year
  $dash.Columns.AutoFit() | Out-Null
  $button = $dash.Buttons().Add(20, 100, 220, 36)
  $button.Caption = "Scarica rapportini approvati"
  $button.OnAction = "ScaricaRapportiniApprovati"

  $configSheet.Range("A1").Value2 = "SUPABASE_URL"
  $configSheet.Range("B1").Value2 = $supabaseUrl
  $configSheet.Range("A2").Value2 = "SUPABASE_SERVICE_ROLE_KEY"
  $configSheet.Range("B2").Value2 = $serviceKey
  $configSheet.Range("A3").Value2 = "ANNO"
  $configSheet.Range("B3").Value2 = [string]$year
  $configSheet.Range("A4").Value2 = "AGGIORNA_RIEPILOGHI"
  $configSheet.Range("B4").Value2 = "SI"
  $configSheet.Range("A5").Value2 = "PROJECT_ROOT"
  $configSheet.Range("B5").Value2 = $root.Path
  $configSheet.Visible = 2 # xlSheetVeryHidden

  $rap.Range("A1:I1").Value2 = @("ID","Data","Dipendente","Commessa","Cantiere","Posizione","Descrizione","Ore","Stato")
  $rap.Rows.Item(1).Font.Bold = $true
  $rap.Columns.Item(1).Hidden = $true
  $rap.Columns.AutoFit() | Out-Null

  try {
    $module = $wb.VBProject.VBComponents.Add(1)
    $module.Name = "modSupabaseRapportini"
    $module.CodeModule.AddFromString($vba)
  } catch {
    $basPath = Join-Path $outDir "modSupabaseRapportini.bas"
    Set-Content -LiteralPath $basPath -Value $vba -Encoding UTF8
    throw "Excel ha bloccato l'inserimento automatico del VBA. Modulo salvato in $basPath. Dettaglio: $($_.Exception.Message)"
  }

  if (Test-Path $outFile) { Remove-Item -LiteralPath $outFile -Force }
  $wb.SaveAs($outFile, 52) # xlOpenXMLWorkbookMacroEnabled
  $wb.Close($true)
  Write-Output $outFile
} finally {
  $excel.Quit()
  if ($wb) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
