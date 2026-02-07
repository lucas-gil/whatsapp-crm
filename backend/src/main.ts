import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from './common/utils/logger.util';

async function bootstrap() {
  try {
    console.log('🔍 Iniciando aplicação...');
    console.log(`📌 DATABASE_URL: ${process.env.DATABASE_URL ? '✅ configurada' : '❌ NÃO configurada'}`);
    console.log(`📌 JWT_SECRET: ${process.env.JWT_SECRET ? '✅ configurado' : '❌ NÃO configurado'}`);
    console.log(`📌 NODE_ENV: ${process.env.NODE_ENV || 'não definida'}`);

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

    const port = configService.get<number>('PORT', 3000);
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
