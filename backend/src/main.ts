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
      let workspace = await prisma.workspace.findFirst({ where: { slug: 'default' } });
      
      if (!workspace) {
        console.log('📦 Criando workspace padrão...');
        workspace = await prisma.workspace.create({
          data: { name: 'Default Workspace', slug: 'default' },
        });
      }
      
      const adminKey = process.env.ADMIN_KEY || nanoid(32);
      const adminKeyHash = await bcrypt.hash(adminKey, 12);
      const adminKeyPreview = `${adminKey.slice(0, 8)}****${adminKey.slice(-4)}`;
      
      console.log(`📝 Admin key preview: ${adminKeyPreview}`);
      console.log(`🔐 Hash bcrypt gerado: ${adminKeyHash.substring(0, 20)}...`);
      
      // Deletar e recriar chave admin
      const deletedCount = await prisma.licenseKey.deleteMany({
        where: { workspaceId: workspace.id },
      });
      console.log(`🗑️  Chaves antigas deletadas: ${deletedCount.count}`);
      
      const createdKey = await prisma.licenseKey.create({
        data: {
          workspaceId: workspace.id,
          keyHash: adminKeyHash,
          keyPreview: adminKeyPreview,
          type: 'ADMIN_INFINITE',
          expiresAt: null, // Garante que NÃO vai expirar
          revokedAt: null,
        },
      });
      console.log(`✅ Chave admin criada com sucesso (ID: ${createdKey.id})`);
      console.log(`📌 Tipo: ${createdKey.type}, Expiração: ${createdKey.expiresAt || 'Nunca'}`);
    } catch (seedErr) {
      console.error('❌ Erro ao executar seed:', seedErr instanceof Error ? seedErr.message : 'Desconhecido');
      if (seedErr instanceof Error) {
        console.error('Stack:', seedErr.stack);
      }
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
