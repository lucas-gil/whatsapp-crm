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
      console.log('🌱 Verificando/criando chave admin...');
      const workspace = await prisma.workspace.findFirst({ where: { slug: 'default' } });
      
      if (!workspace) {
        console.log('📦 Criando workspace padrão...');
        await prisma.workspace.create({
          data: { name: 'Default Workspace', slug: 'default' },
        });
      }
      
      const adminKey = process.env.ADMIN_KEY || nanoid(32);
      const adminKeyHash = await bcrypt.hash(adminKey, 12);
      const adminKeyPreview = `${adminKey.slice(0, 8)}****${adminKey.slice(-4)}`;
      
      // Deletar e recriar chave admin
      await prisma.licenseKey.deleteMany({
        where: { workspaceId: workspace?.id || (await prisma.workspace.findFirst({ where: { slug: 'default' } }))?.id },
      });
      
      const wsId = workspace?.id || (await prisma.workspace.findFirst({ where: { slug: 'default' } }))?.id;
      if (wsId) {
        await prisma.licenseKey.create({
          data: {
            workspaceId: wsId,
            keyHash: adminKeyHash,
            keyPreview: adminKeyPreview,
            type: 'ADMIN_INFINITE',
          },
        });
        console.log(`✅ Chave admin criada: ${adminKeyPreview}`);
      }
    } catch (seedErr) {
      console.warn('⚠️ Erro ao executar seed (pode já existir):', seedErr instanceof Error ? seedErr.message : 'Desconhecido');
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
