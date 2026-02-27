import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Logger } from '../common/utils/logger.util';

interface QueueConfig {
  name: string;
  handler: (job: any) => Promise<void>;
}

/**
 * Serviço de gerenciamento de filas com BullMQ
 */
@Injectable()
export class QueueService {
  private logger = new Logger('QueueService');
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redisUrl: string;
  private redisPassword?: string;
  private disabledQueues: Set<string> = new Set();

  constructor(private configService: ConfigService) {
    this.redisUrl = this.configService.get('REDIS_URL', 'redis://localhost:6379');
    this.redisPassword = this.configService.get<string | undefined>('REDIS_PASSWORD');
  }

  registerQueue(config: QueueConfig) {
    // Criar fila
    // BullMQ/redis clients usually read credentials from the URL (recommended).
    // We ensure `REDIS_URL` contains credentials earlier (see validation/main bootstrap).
    const connectionOptions: any = { url: this.redisUrl };

    let queue: Queue;
    let worker: Worker;
    try {
      queue = new Queue(config.name, {
        connection: connectionOptions,
      });

      // Criar worker
      worker = new Worker(config.name, config.handler, {
        connection: connectionOptions,
        concurrency: 5,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      this.logger.error(`Falha ao registrar fila ${config.name}: ${msg}`);
      // Disable this queue to avoid runtime exceptions later
      this.disabledQueues.add(config.name);
      return;
    }

    // Listeners
    worker.on('completed', (job: any) => {
      this.logger.info(`✅ Job ${job.id} concluído`);
    });

    worker.on('failed', (job: any, err: any) => {
      this.logger.error(`❌ Job ${job.id} falhou: ${err.message}`);
    });

    this.queues.set(config.name, queue);
    this.workers.set(config.name, worker);

    this.logger.info(`Fila registrada: ${config.name}`);
  }

  async enqueueJob(queueName: string, data: any, options?: any) {
    if (this.disabledQueues.has(queueName)) {
      throw new Error(`Fila ${queueName} está desabilitada (problema de conexão com Redis)`);
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Fila ${queueName} não registrada`);
    }

    const job = await queue.add(queueName, data, {
      attempts: options?.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    });

    this.logger.info(`Job enfileirado: ${job.id} em ${queueName}`);
    return job;
  }

  async getJobStatus(queueName: string, jobId: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress;

    return { id: job.id, state, progress };
  }

  async closeQueues() {
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.info(`Fila fechada: ${name}`);
    }

    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.info(`Worker fechado: ${name}`);
    }
  }
}

@Injectable()
export class BroadcastProducer {
  constructor(private queueService: QueueService) {}

  async enqueueBroadcast(mapKey: string | null, broadcastId: string, recipientBatch: any[]) {
    return this.queueService.enqueueJob('broadcast', {
      mapKey,
      broadcastId,
      recipients: recipientBatch,
    });
  }
}

@Injectable()
export class AIProducer {
  constructor(private queueService: QueueService) {}

  async enqueueAIProcessing(messageId: string, context: any) {
    return this.queueService.enqueueJob('ai-processing', {
      messageId,
      context,
    });
  }
}
