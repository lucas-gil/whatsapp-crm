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
      console.log(`📌 ADMIN_KEY from ENV: ${process.env.ADMIN_KEY ? '✅ DEFINIDA' : '❌ NÃO DEFINIDA'}`);
      
      let workspace = await prisma.workspace.findFirst({ where: { slug: 'default' } });
      
      if (!workspace) {
        console.log('📦 Criando workspace padrão...');
        workspace = await prisma.workspace.create({
          data: { name: 'Default Workspace', slug: 'default' },
        });
        console.log(`✅ Workspace criado: ${workspace.id}`);
      } else {
        console.log(`✅ Workspace encontrado: ${workspace.id}`);
      }
      
      // Verificar se já existe chave ADMIN_INFINITE
      const existingAdminKey = await prisma.licenseKey.findFirst({
        where: {
          workspaceId: workspace.id,
          type: 'ADMIN_INFINITE',
        },
      });
      
      if (existingAdminKey) {
        console.log(`✅ Chave ADMIN_INFINITE já existe: ${existingAdminKey.keyPreview}`);
        console.log(`📌 Expiração: ${existingAdminKey.expiresAt || 'Nunca (infinita)'}`);
        console.log(`📌 Revogada: ${existingAdminKey.revokedAt ? 'SIM ❌' : 'NÃO ✅'}`);
      } else {
        console.log('⚠️ Nenhuma chave ADMIN_INFINITE encontrada. Criando nova...');
        
        // SÓ usar ADMIN_KEY se estiver definida
        const adminKeyValue = process.env.ADMIN_KEY;
        if (!adminKeyValue) {
          throw new Error('❌ ENV ADMIN_KEY não está definida no container!');
        }
        
        const adminKeyHash = await bcrypt.hash(adminKeyValue, 12);
        const adminKeyPreview = `${adminKeyValue.slice(0, 8)}****${adminKeyValue.slice(-4)}`;
        
        console.log(`📝 Criando chave com preview: ${adminKeyPreview}`);
        console.log(`🔐 Hash bcrypt (primeiros 30 chars): ${adminKeyHash.substring(0, 30)}...`);
        
        const createdKey = await prisma.licenseKey.create({
          data: {
            workspaceId: workspace.id,
            keyHash: adminKeyHash,
            keyPreview: adminKeyPreview,
            type: 'ADMIN_INFINITE',
            expiresAt: null,
            revokedAt: null,
          },
        });
        
        console.log(`✅ Chave criada com sucesso!`);
        console.log(`   ID: ${createdKey.id}`);
        console.log(`   Preview: ${createdKey.keyPreview}`);
        console.log(`   Tipo: ${createdKey.type}`);
        console.log(`   Expiração: ${createdKey.expiresAt || 'Nunca (infinita)'}`);
      }
    } catch (seedErr) {
      console.error('❌❌❌ ERRO AO EXECUTAR SEED:');
      console.error(seedErr instanceof Error ? seedErr.message : String(seedErr));
      if (seedErr instanceof Error) {
        console.error('Stack trace:', seedErr.stack);
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
