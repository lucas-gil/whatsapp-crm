import 'reflect-metadata';
// Ensure REDIS_URL includes password early, before modules import Redis clients.
// Some libraries read process.env.REDIS_URL at import time, so we must inject
// REDIS_PASSWORD into the URL here to avoid NOAUTH errors during bootstrap.
const _redisUrl = process.env.REDIS_URL;
const _redisPassword = process.env.REDIS_PASSWORD;
if (_redisUrl && _redisPassword && !/@/.test(_redisUrl)) {
  const m = _redisUrl.match(/^(redis(?:s)?:\/\/)(.*)$/i);
  if (m) {
    // build redis://:password@host:port
    process.env.REDIS_URL = `${m[1]}${':' + _redisPassword + '@' + m[2]}`;
  }
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from './common/utils/logger.util';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

// Small Redis health/auth check to fail fast with clear instructions when NOAUTH occurs
async function checkRedisAuth(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;

  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl, socket: { connectTimeout: 2000 } });
    client.on('error', () => {});
    // Try connect -> ping -> quit quickly
    await client.connect();
    await client.ping();
    await client.quit();
    console.log('✅ Redis connection OK');
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/NOAUTH|WRONGPASS|Authentication required/i.test(msg)) {
      console.error('\n❌ Redis authentication error detected (NOAUTH).');
      console.error('   O backend está configurado para usar um Redis com senha, mas a autenticação falhou.');
      console.error('   Corrija definindo as variáveis de ambiente: REDIS_PASSWORD e/ou REDIS_URL com credenciais.');
      console.error('   Exemplo: REDIS_URL=redis://:MINHA_SENHA@redis:6379');
      console.error('   Teste com: redis-cli -h <host> -p <port> -a <senha> ping');
      console.error('   Iniciando em modo degradado: filas/consumers serão desabilitados até que o Redis esteja disponível.\n');
      // Mark that Redis auth failed so other services can behave accordingly.
      process.env.REDIS_AUTH_FAILED = 'true';
      return;
    }

    // If other error (timeout/unavailable), warn but allow startup
    console.warn('⚠️ Redis check failed (continuando startup):', msg);
  }
}

async function bootstrap() {
  try {
    console.log('🔍 Iniciando aplicação...');
    console.log(`📌 DATABASE_URL: ${process.env.DATABASE_URL ? '✅ configurada' : '❌ NÃO configurada'}`);
    console.log(`📌 JWT_SECRET: ${process.env.JWT_SECRET ? '✅ configurado' : '❌ NÃO configurado'}`);
    console.log(`📌 NODE_ENV: ${process.env.NODE_ENV || 'não definida'}`);

    // Redis auth check: may mark REDIS_AUTH_FAILED and return to allow degraded startup
    await checkRedisAuth();
    if (process.env.REDIS_AUTH_FAILED === 'true') {
      console.warn('⚠️ Iniciando em modo degradado: Redis com autenticação falhou. Filas/consumers serão desabilitados.');
    }

    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const logger = new Logger('Bootstrap');

    console.log('✅ Módulos carregados com sucesso');

    // CORS
    app.enableCors({
      origin: configService.get('CORS_ORIGIN', '*'),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Validação global
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Backend SEMPRE usa porta 3000 (Nginx faz proxy na 80)
    const port = 3000;
    const env = configService.get('NODE_ENV', 'development');
    const dbUrl = configService.get('DATABASE_URL', 'não configurada');

    console.log(`🔧 Configuração: PORT=${port}, ENV=${env}`);
    console.log(`🗄️  Database: ${dbUrl.substring(0, 50)}...`);

    await app.listen(port, '0.0.0.0');
    logger.info(`🚀 WhatsAppCRM Backend rodando em porta ${port} (${env})`);
  } catch (err) {
    console.error('❌ Erro ao iniciar aplicação:', err);
    console.error('Stack:', err instanceof Error ? err.stack : 'N/A');
    if (err instanceof Error) {
      console.error('Message:', err.message);
    }
    process.exit(1);
  }
}

bootstrap();
