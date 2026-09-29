<#
.SYNOPSIS
  Crea un proyecto nuevo con el pipeline DevSecOps completo, listo para trabajar.

.DESCRIPTION
  A partir del repositorio plantilla, crea un repositorio nuevo y lo deja configurado:
  secretos, etiquetas, ambientes DEV y QA, proyecto en SonarQube Cloud y ruleset con
  los quality gates obligatorios. Al final, el pipeline corre por primera vez en main.

.EXAMPLE
  .\scripts\nuevo-proyecto.ps1 -Nombre parqueadero-norte

.NOTES
  Requisitos: GitHub CLI autenticado (gh auth login) y Git.
  Los secretos se leen de variables de entorno si existen (ANTHROPIC_API_KEY, SONAR_TOKEN,
  CHAT_WEBHOOK_URL); si no, el script los pide de forma oculta. Nunca se guardan en archivos.
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9][a-z0-9-]{2,60}$')]
  [string]$Nombre,

  [string]$Owner = 'JCG097',
  [string]$Plantilla = 'JCG097/ai-sdlc-quality-pipeline-demo',
  [string]$SonarOrg = 'jcg097'
)

$ErrorActionPreference = 'Stop'
$Repo = "$Owner/$Nombre"
$SonarKey = "${Owner}_$Nombre"

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "    [OK] $texto" -ForegroundColor Green }

# Ejecuta un comando de GitHub CLI y detiene el script si falla.
# (El nombre no puede ser "gh": PowerShell no distingue mayúsculas y la función se llamaría a sí misma.)
function Invoke-Gh {
  & gh.exe @args
  if ($LASTEXITCODE -ne 0) { throw "Falló: gh $($args -join ' ')" }
}

# Lee un secreto de una variable de entorno o lo pide sin mostrarlo en pantalla.
function Get-Secreto($nombre) {
  $valor = [Environment]::GetEnvironmentVariable($nombre)
  if ($valor) { return $valor }
  $seguro = Read-Host "Ingresa $nombre" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$inicio = Get-Date

# ---------------------------------------------------------------------------
Paso "Verificando requisitos"
& gh.exe auth status *> $null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI no está autenticado. Ejecuta: gh auth login' }
Ok 'GitHub CLI autenticado'

$anthropicKey = Get-Secreto 'ANTHROPIC_API_KEY'
$sonarToken = Get-Secreto 'SONAR_TOKEN'
$chatWebhook = Get-Secreto 'CHAT_WEBHOOK_URL'
Ok 'Secretos disponibles'

# ---------------------------------------------------------------------------
Paso "Creando el repositorio $Repo desde la plantilla"
Invoke-Gh repo edit $Plantilla --template *> $null
$ErrorActionPreference = 'Continue'
& gh.exe repo view $Repo --json name 2>&1 | Out-Null
$repoExiste = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = 'Stop'
if ($repoExiste) {
  Ok 'El repositorio ya existe; se continúa con la configuración'
} else {
  Invoke-Gh repo create $Repo --public --template $Plantilla --description "Proyecto con pipeline DevSecOps e IA"
}

# La copia desde la plantilla es asíncrona: se espera a que exista la rama main.
# Mientras se copia, GitHub responde 404; en este bloque esos errores no detienen el script.
$listo = $false
$ErrorActionPreference = 'Continue'
for ($i = 0; $i -lt 45 -and -not $listo; $i++) {
  Start-Sleep -Seconds 2
  & gh.exe api "repos/$Repo/branches/main" --silent 2>&1 | Out-Null
  $listo = ($LASTEXITCODE -eq 0)
}
$ErrorActionPreference = 'Stop'
if (-not $listo) { throw 'La rama main no apareció a tiempo en el repositorio nuevo.' }
Ok "Repositorio creado: https://github.com/$Repo"

# ---------------------------------------------------------------------------
Paso 'Configurando secretos del repositorio'
Invoke-Gh secret set ANTHROPIC_API_KEY --repo $Repo --body $anthropicKey
Invoke-Gh secret set SONAR_TOKEN --repo $Repo --body $sonarToken
Invoke-Gh secret set CHAT_WEBHOOK_URL --repo $Repo --body $chatWebhook
Ok 'ANTHROPIC_API_KEY, SONAR_TOKEN y CHAT_WEBHOOK_URL'

# ---------------------------------------------------------------------------
Paso 'Creando etiquetas y ambientes'
Invoke-Gh label create claude-dev --repo $Repo --color 0E8A16 --description 'Historia lista para desarrollo con IA' --force
Invoke-Gh label create needs-human --repo $Repo --color D93F0B --description 'Requiere revisión humana' --force
Ok 'Etiquetas claude-dev y needs-human'
Invoke-Gh api -X PUT "repos/$Repo/environments/dev" --silent
Invoke-Gh api -X PUT "repos/$Repo/environments/qa" --silent
Ok 'Ambientes dev y qa'

# ---------------------------------------------------------------------------
Paso "Creando el proyecto $SonarKey en SonarQube Cloud"
$sonarHeaders = @{ Authorization = "Bearer $sonarToken" }
$sonarPendiente = $false
$autoscanPendiente = $false
try {
  Invoke-RestMethod -Method Post -Uri 'https://sonarcloud.io/api/projects/create' -Headers $sonarHeaders -Body @{
    organization = $SonarOrg; project = $SonarKey; name = $Nombre; visibility = 'public'
  } | Out-Null
  Ok 'Proyecto creado'
} catch {
  # SonarQube explica el motivo en el cuerpo de la respuesta; en Windows PowerShell 5 hay que leerlo del stream.
  $errorSonar = $_
  $detalle = $errorSonar.ErrorDetails.Message
  if (-not $detalle -and $errorSonar.Exception.Response) {
    try {
      $lector = New-Object IO.StreamReader($errorSonar.Exception.Response.GetResponseStream())
      $detalle = $lector.ReadToEnd()
    } catch { }
  }
  if (-not $detalle) { $detalle = $errorSonar.Exception.Message }
  if ($detalle -match 'already exists|ya existe|similar key') {
    Ok 'El proyecto ya existe en SonarQube Cloud'
  } else {
    $sonarPendiente = $true
    Write-Host "    [AVISO] SonarQube Cloud rechazó la creación del proyecto." -ForegroundColor Yellow
    Write-Host "    Respuesta de SonarQube: $detalle" -ForegroundColor Yellow
    Write-Host "    El script continúa; al final se indica cómo completar este paso." -ForegroundColor Yellow
  }
}
if (-not $sonarPendiente) { try {
  # Los proyectos nuevos nacen con la rama principal llamada "master"; se alinea con "main".
  Invoke-RestMethod -Method Post -Uri 'https://sonarcloud.io/api/project_branches/rename' -Headers $sonarHeaders -Body @{
    project = $SonarKey; name = 'main'
  } | Out-Null
  Ok 'Rama principal configurada como main'
} catch {
  Write-Host '    [AVISO] No se pudo renombrar la rama principal; revísalo en SonarQube Cloud.' -ForegroundColor Yellow
}
try {
  # El análisis lo hace el pipeline; el análisis automático de SonarQube debe quedar apagado.
  Invoke-RestMethod -Method Post -Uri 'https://sonarcloud.io/api/autoscan/activation' -Headers $sonarHeaders -Body @{
    projectKey = $SonarKey; enable = 'false'
  } | Out-Null
  Ok 'Análisis automático desactivado (el análisis lo hace el pipeline)'
} catch {
  $autoscanPendiente = $true
  Write-Host '    [AVISO] No se pudo desactivar el análisis automático por API.' -ForegroundColor Yellow
} }

# ---------------------------------------------------------------------------
Paso 'Configurando sonar-project.properties para el proyecto nuevo'
$dir = Join-Path $env:TEMP "nuevo-proyecto-$Nombre"
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
Invoke-Gh repo clone $Repo $dir
$archivo = Join-Path $dir 'sonar-project.properties'
$contenido = [IO.File]::ReadAllText($archivo)
$contenido = $contenido -replace '(?m)^sonar\.organization=.*$', "sonar.organization=$SonarOrg"
$contenido = $contenido -replace '(?m)^sonar\.projectKey=.*$', "sonar.projectKey=$SonarKey"
$contenido = $contenido -replace '(?m)^sonar\.projectName=.*$', "sonar.projectName=$Nombre"
[IO.File]::WriteAllText($archivo, $contenido, (New-Object Text.UTF8Encoding $false))
git -C $dir add sonar-project.properties
if (git -C $dir status --porcelain) {
  git -C $dir commit -m "Configurar SonarQube para $Nombre" --quiet
  git -C $dir push --quiet
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo subir la configuración de SonarQube.' }
  Ok 'Configuración subida a main (esto dispara el primer pipeline)'
} else {
  Ok 'La configuración de SonarQube ya estaba aplicada'
}
Remove-Item $dir -Recurse -Force

# ---------------------------------------------------------------------------
Paso 'Protegiendo main con los quality gates obligatorios'
$checks = @(
  'TDD verificado',
  'Integridad de pruebas de aceptación',
  'Secretos en el código (Gitleaks)',
  'Análisis estático (ESLint)',
  'Pruebas unitarias y cobertura (Jest)',
  'Seguridad de dependencias (OSV-Scanner) / osv-scan',
  'Calidad de código (SonarQube Cloud)',
  'Build, escaneo y registro de imagen',
  'DEV - Despliegue y smoke',
  'QA - Despliegue y pruebas E2E'
)
$ruleset = @{
  name        = 'Proteger main'
  target      = 'branch'
  enforcement = 'active'
  conditions  = @{ ref_name = @{ include = @('~DEFAULT_BRANCH'); exclude = @() } }
  rules       = @(
    @{ type = 'deletion' },
    @{ type = 'non_fast_forward' },
    @{ type = 'pull_request'; parameters = @{
        required_approving_review_count   = 0
        dismiss_stale_reviews_on_push     = $false
        require_code_owner_review         = $false
        require_last_push_approval        = $false
        required_review_thread_resolution = $false
      } },
    @{ type = 'required_status_checks'; parameters = @{
        strict_required_status_checks_policy = $false
        required_status_checks = @($checks | ForEach-Object { @{ context = $_ } })
      } }
  )
}
$rulesetFile = Join-Path $env:TEMP "ruleset-$Nombre.json"
[IO.File]::WriteAllText($rulesetFile, ($ruleset | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
$existentes = & gh.exe api "repos/$Repo/rulesets" --jq '.[].name'
if ($existentes -contains 'Proteger main') {
  Ok 'El ruleset Proteger main ya existe'
} else {
  Invoke-Gh api -X POST "repos/$Repo/rulesets" --input $rulesetFile --silent
  Ok "Ruleset activo con $($checks.Count) quality gates obligatorios"
}
Remove-Item $rulesetFile -Force

# ---------------------------------------------------------------------------
$duracion = [int]((Get-Date) - $inicio).TotalSeconds
Write-Host "`nProyecto listo en $duracion segundos." -ForegroundColor Green
Write-Host "  Repositorio:  https://github.com/$Repo"
Write-Host "  Pipeline:     https://github.com/$Repo/actions"
Write-Host "  SonarQube:    https://sonarcloud.io/project/overview?id=$SonarKey"
if ($autoscanPendiente) {
  Write-Host "`nPendiente: en SonarQube Cloud, abre el proyecto $SonarKey > Administration > Analysis Method" -ForegroundColor Yellow
  Write-Host "  y desactiva Automatic Analysis. Luego vuelve a ejecutar el pipeline de main desde Actions."
}
if ($sonarPendiente) {
  Write-Host "`nPendiente: crear el proyecto $SonarKey en SonarQube Cloud (ver el aviso anterior)." -ForegroundColor Yellow
  Write-Host "  Luego vuelve a ejecutar el pipeline de main desde la pestaña Actions."
}
Write-Host "`nPara empezar: crea un Issue con una historia de usuario y agrégale la etiqueta claude-dev."
