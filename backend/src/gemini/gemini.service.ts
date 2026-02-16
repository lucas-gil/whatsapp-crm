import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '../common/utils/logger.util';

/**
 * Serviço de integração com Gemini API (Google AI)
 */
@Injectable()
export class GeminiService {
  private logger = new Logger('GeminiService');

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getSettings(workspaceId: string) {
    return this.prisma.geminiSettings.findUnique({
      where: { workspaceId },
    });
  }

  async updateSettings(workspaceId: string, data: any) {
    const settings = await this.prisma.geminiSettings.upsert({
      where: { workspaceId },
      update: {
        isEnabled: data.isEnabled,
        apiKey: data.apiKey, // TODO: Encriptar em produção
        systemPrompt: data.systemPrompt,
        respondToAllMessages: data.respondToAllMessages,
        rules: data.rules,
      },
      create: {
        workspaceId,
        isEnabled: data.isEnabled || false,
        apiKey: data.apiKey || '',
        systemPrompt: data.systemPrompt || 'Você é um assistente útil.',
      },
    });

    return settings;
  }

  async attachContextFile(workspaceId: string, file: Express.Multer.File) {
    if (!file) throw new Error('Arquivo nao enviado');

    const StorageUtilModule = require('../common/utils/storage.util');
    const StorageUtil = StorageUtilModule.StorageUtil;
    const storage = new StorageUtil({ provider: 'local', path: process.env.STORAGE_PATH || './storage' });

    const saved = await storage.saveFile(file.buffer, `${workspaceId}-gemini-${Date.now()}-${file.originalname}`, 'gemini');

    const settings = await this.prisma.geminiSettings.findUnique({ where: { workspaceId } });
    const files = Array.isArray(settings?.contextFiles) ? [...settings!.contextFiles] : [];
    files.push(saved.url || saved.path);

    const updated = await this.prisma.geminiSettings.update({
      where: { workspaceId },
      data: { contextFiles: files },
    });

    return updated;
  }

  async generateReply(
    workspaceId: string,
    leadName: string,
    messageHistory: any[],
  ): Promise<string> {
    const settings = await this.getSettings(workspaceId);

    if (!settings?.isEnabled || !settings.apiKey) {
      return this.fallbackReply();
    }

    try {
      // TODO: Implementar chamada real à Gemini API
      // const { GoogleGenerativeAI } = require("@google/generative-ai");
      // const genAI = new GoogleGenerativeAI(settings.apiKey);
      // const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      // const chat = model.startChat({ history: [...] });
      // const result = await chat.sendMessage(userMessage);

      this.logger.info(
        `Gemini responderia para ${leadName}`,
      );
      return `Obrigado por sua mensagem! Responderemos em breve.`;
    } catch (error) {
      this.logger.error(`Erro ao chamar Gemini: ${error}`);
      return this.fallbackReply();
    }
  }

  private fallbackReply(): string {
    return 'Obrigado por sua mensagem. Entraremos em contato em breve!';
  }
}
