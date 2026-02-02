#!/bin/bash

# WhatsApp CRM - Deploy Script para EasyPanel/Hostinger
# Uso: ./deploy.sh [build|up|down|restart|logs|pull]

set -e

PROJECT_NAME="whatsapp-crm"
DOCKER_COMPOSE_FILE="docker-compose.yml"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  WhatsApp CRM - Deploy Script${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Função para exibir mensagens
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Função para verificar se docker/docker-compose estão instalados
check_requirements() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_warn "docker-compose não encontrado, usando 'docker compose'"
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
    
    log_info "Docker encontrado: $(docker --version)"
}

# Build das imagens
build() {
    log_info "Construindo imagens Docker..."
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE build --no-cache
    log_info "Build concluído com sucesso!"
}

# Iniciar serviços
up() {
    log_info "Iniciando serviços..."
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE up -d
    log_info "Serviços iniciados!"
    
    # Aguardar services ficarem healthy
    log_info "Aguardando services ficarem prontos..."
    sleep 10
    
    # Exibir status
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE ps
}

# Parar serviços
down() {
    log_info "Parando serviços..."
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE down
    log_info "Serviços parados!"
}

# Reiniciar serviços
restart() {
    log_info "Reiniciando serviços..."
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE restart
    log_info "Serviços reiniciados!"
}

# Exibir logs
logs() {
    log_info "Exibindo logs (Ctrl+C para sair)..."
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE logs -f
}

# Exibir status
ps() {
    log_info "Status dos containers:"
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE ps
}

# Deploy com git pull
pull() {
    log_info "Puxando código mais recente do GitHub..."
    git pull origin main
    
    log_info "Reconstruindo imagens..."
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE up -d --build
    
    log_info "Deploy concluído!"
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE ps
}

# Health check
health() {
    log_info "Verificando saúde dos serviços..."
    
    echo ""
    echo -e "${BLUE}Backend:${NC}"
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log_info "Backend está rodando ✓"
    else
        log_error "Backend não respondendo ✗"
    fi
    
    echo ""
    echo -e "${BLUE}Frontend:${NC}"
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        log_info "Frontend está rodando ✓"
    else
        log_error "Frontend não respondendo ✗"
    fi
    
    echo ""
    echo -e "${BLUE}Database:${NC}"
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE exec -T database pg_isready -U whatsapp_user 2>/dev/null && log_info "Database está rodando ✓" || log_error "Database não respondendo ✗"
    
    echo ""
    echo -e "${BLUE}Redis:${NC}"
    $DOCKER_COMPOSE -f $DOCKER_COMPOSE_FILE exec -T cache redis-cli ping 2>/dev/null && log_info "Redis está rodando ✓" || log_error "Redis não respondendo ✗"
}

# Mostrar uso
usage() {
    echo "Uso: $0 {build|up|down|restart|logs|ps|pull|health}"
    echo ""
    echo "Comandos disponíveis:"
    echo "  build   - Construir imagens Docker"
    echo "  up      - Iniciar serviços"
    echo "  down    - Parar serviços"
    echo "  restart - Reiniciar serviços"
    echo "  logs    - Exibir logs em tempo real"
    echo "  ps      - Mostrar status dos containers"
    echo "  pull    - Git pull + rebuild + restart"
    echo "  health  - Verificar saúde dos serviços"
    exit 0
}

# Main
check_requirements

case "${1:-help}" in
    build)
        build
        ;;
    up)
        up
        ;;
    down)
        down
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    ps)
        ps
        ;;
    pull)
        pull
        ;;
    health)
        health
        ;;
    help|*)
        usage
        ;;
esac
