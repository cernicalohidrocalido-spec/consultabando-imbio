# Regenera todos los PDF desde los Word actuales (congela DATE del Código y exporta).
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

Write-Host "== Congelar campos DATE =="
python (Join-Path $PSScriptRoot "freeze_docx_dates.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "== Exportar PDF con Word =="
& cscript.exe //Nologo (Join-Path $PSScriptRoot "regenerar_pdfs_desde_docx.vbs")
$code = $LASTEXITCODE

$tmp = Join-Path $PSScriptRoot "_docx_freeze_tmp"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }

exit $code
