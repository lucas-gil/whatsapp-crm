# Start WhatsApp-CRM stack (PowerShell)
# Usage: Open PowerShell as Administrator (if Docker needs it) and run:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\scripts\start-stack.ps1

param(
  [string]$Mode = "full" # full | db-only
)

function Write-Status($msg) { Write-Host "[start-stack] $msg" -ForegroundColor Cyan }

Write-Status "Verificando se Docker está instalado..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker não encontrado. Instale Docker Desktop e tente novamente." -ForegroundColor Red
  exit 1
}

Write-Status "Iniciando containers necessários via Docker Compose..."
if ($Mode -eq 'db-only') {
  docker compose up -d postgres redis
} else {
  docker compose up -d postgres redis backend frontend
}

# Esperar Postgres ficar healthy (max 3 minutos)
$timeout = 180
$elapsed = 0
$interval = 3
Write-Status "Aguardando Postgres ficar healthy (até $timeout s)..."
while ($elapsed -lt $timeout) {
  try {
    $status = docker inspect -f '{{.State.Health.Status}}' whatsapp-crm-postgres 2>$null
  } catch {
    $status = $null
  }

  if ($status -eq 'healthy') {
    Write-Status "Postgres está healthy"
    break
  }

  Start-Sleep -Seconds $interval
  $elapsed += $interval
}

if ($status -ne 'healthy') {
  Write-Host "Atenção: Postgres não ficou healthy em $timeout segundos. Verifique logs: docker compose logs postgres" -ForegroundColor Yellow
} else {
  Write-Status "Executando migrações e seed (no container backend não é necessário se o backend fizer automaticamente)"
  Write-Host "Você pode executar as migrações manualmente (opcional):" -ForegroundColor Green
  Write-Host "  cd backend" -ForegroundColor DarkGreen
  Write-Host "  npm run db:push    # aplica schema (não destrutivo)" -ForegroundColor DarkGreen
  Write-Host "  npm run db:seed    # opcional: popula dados iniciais" -ForegroundColor DarkGreen
}

Write-Status "Status dos containers:"
docker compose ps

Write-Host "";
Write-Host "Acompanhar logs do backend em tempo real (em novo terminal):" -ForegroundColor Green
Write-Host "  docker compose logs -f backend" -ForegroundColor DarkGreen
Write-Host "Frontend disponível em http://localhost:3002 e API em http://localhost:3001 (se mapeadas conforme docker-compose)." -ForegroundColor Green

Write-Status "Pronto. Se quiser que eu inicie apenas o backend localmente (sem containers para backend/frontend), execute o modo db-only e eu te passo os comandos para iniciar o backend." 

# Abrir navegador automaticamente se possível
try {
  Write-Status "Abrindo frontend e API no navegador..."
  Start-Process "http://localhost:3002"
  Start-Process "http://localhost:3001"
} catch {
  Write-Host "Não foi possível abrir o navegador automaticamente. Abra http://localhost:3002 e http://localhost:3001 manualmente." -ForegroundColor Yellow
}
