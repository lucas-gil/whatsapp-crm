param(
    [switch]$Recreate
)

function Abort($msg){ Write-Host $msg -ForegroundColor Red; exit 1 }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Abort "Docker não foi encontrado. Instale Docker Desktop e certifique-se que 'docker' está no PATH."
}

Write-Host "Iniciando stack via docker compose..."

if ($Recreate) {
    Write-Host "Removendo containers existentes e volumes (recreate)..."
    docker compose down -v
}

docker compose up -d --build

Write-Host "Containers (status):"
docker compose ps

Write-Host "Aguardando alguns segundos para serviços se inicializarem..."
Start-Sleep -Seconds 5

Write-Host "Logs do backend (pressione Ctrl+C para sair):"
docker compose logs -f backend
