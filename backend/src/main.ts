import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from './common/utils/logger.util';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

async function bootstrap() {
  try {
    console.log('🔍 Iniciando aplicação...');
    console.log(`📌 DATABASE_URL: ${process.env.DATABASE_URL ? '✅ configurada' : '❌ NÃO configurada'}`);
    console.log(`📌 JWT_SECRET: ${process.env.JWT_SECRET ? '✅ configurado' : '❌ NÃO configurado'}`);
    console.log(`📌 NODE_ENV: ${process.env.NODE_ENV || 'não definida'}`);

    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const prisma = app.get(PrismaService);
    const logger = new Logger('Bootstrap');

    console.log('✅ Módulos carregados com sucesso');

    // Executar seed se necessário
    try {
      console.log('🌱 Inicializando chave admin...');
      
      let workspace = await prisma.workspace.findFirst({ where: { slug: 'default' } });
      
      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: { name: 'Default Workspace', slug: 'default' },
        });
      }
      
      // Verificar se já existe chave
      let adminKey = await prisma.licenseKey.findFirst({
        where: {
          workspaceId: workspace.id,
          type: 'ADMIN_INFINITE',
        },
      });
      
      // Se não existir, criar
      if (!adminKey) {
        adminKey = await prisma.licenseKey.create({
          data: {
            workspaceId: workspace.id,
            keyHash: 'senha123', // Texto puro simples
            keyPreview: 'senha123',
            type: 'ADMIN_INFINITE',
            expiresAt: null,
            revokedAt: null,
          },
        });
        console.log('✅ Chave admin criada: senha123');
      } else {
        console.log('✅ Chave admin já existe');
      }
    } catch (seedErr) {
      console.error('❌ Erro ao executar seed:', seedErr instanceof Error ? seedErr.message : String(seedErr));
    }

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
