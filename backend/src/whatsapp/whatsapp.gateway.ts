import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '../common/utils/logger.util';
import { WhatsAppService } from './whatsapp.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/whatsapp',
})
export class WhatsAppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private logger = new Logger('WhatsAppGateway');
  private clientWorkspaceMap: Map<string, string> = new Map(); // socketId -> workspaceId:sessionId
  private registeredWorkspaces: Set<string> = new Set();
  private workspaceHandlers: Map<string, Record<string, Function>> = new Map();

  constructor(
    private whatsAppService: WhatsAppService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    // Log connection details to aid debugging when clients fail to connect
    const tokenFromAuth = (client.handshake && (client.handshake.auth as any)?.token) || null;
    const tokenFromQuery = (client.handshake && (client.handshake.query as any)?.token) || null;
    const tokenPresent = tokenFromAuth || tokenFromQuery ? true : false;
    this.logger.info(`Cliente conectado ao WebSocket: ${client.id} namespace=${client.nsp?.name} tokenPresent=${tokenPresent}`);
    this.logger.info(`  handshake.headers=${JSON.stringify(client.handshake.headers || {})}`);
  }

  handleDisconnect(client: Socket) {
    const mapKey = this.clientWorkspaceMap.get(client.id);
    if (mapKey) {
      this.clientWorkspaceMap.delete(client.id);

      // If no more sockets are in the room after this disconnect, remove handlers
      const roomName = `whatsapp:${mapKey}`;
      const room = this.server.sockets.adapter.rooms.get(roomName);
      const roomSize = room ? room.size : 0;
      if (roomSize === 0) {
        this.removeEventListenersForWorkspace(mapKey);
      }
    }

    this.logger.info(`Cliente desconectado do WebSocket: ${client.id}`);
  }

  /**
   * Subscribe para eventos do WhatsApp de um workspace
   */
  @SubscribeMessage('subscribe')
  async onSubscribe(client: Socket, data: { token: string }): Promise<void> {
    try {
      const decoded = this.jwtService.verify(data.token);
      const workspaceId = decoded.workspaceId;
      let sessionId = decoded.sessionId || null;

      if (!sessionId) {
        try {
          const sess = await this.prisma.userSession.findFirst({ where: { jwtToken: data.token } });
          sessionId = sess?.id || null;
        } catch (e) {
          this.logger.warn('Não foi possível buscar sessionId pelo token');
        }
      }

      if (!sessionId) {
        this.logger.error('Token válido mas sessionId não encontrado');
        client.emit('error', { message: 'Session inválida' });
        return;
      }

      const mapKey = `${workspaceId}:${sessionId}`;
      this.clientWorkspaceMap.set(client.id, mapKey);
      client.join(`whatsapp:${mapKey}`);

      this.logger.info(`Cliente ${client.id} subscribed a eventos de ${mapKey}`);

      client.emit('subscribed', {
        workspaceId,
        sessionId,
        timestamp: new Date(),
      });

      // Garantir que exista sessão WhatsApp para este login
      await this.whatsAppService.initializeWorkspace(workspaceId, sessionId);

      // Registrar listeners de eventos para este sessionKey
      this.setupEventListeners(mapKey, workspaceId, sessionId);
    } catch (error) {
      this.logger.error('Erro ao validar token:', error);
      client.emit('error', {
        message: 'Token inválido',
      });
    }
  }

  /**
   * Unsubscribe de eventos
   */
  @SubscribeMessage('unsubscribe')
  onUnsubscribe(client: Socket): void {
    const workspaceId = this.clientWorkspaceMap.get(client.id);
    if (!workspaceId) return;

    client.leave(`whatsapp:${workspaceId}`);
    this.clientWorkspaceMap.delete(client.id);
    this.logger.info(`Cliente ${client.id} unsubscribed from ${workspaceId}`);

    // If no more sockets are in the room, remove the gateway-level handlers to avoid memory leaks
    const roomName = `whatsapp:${workspaceId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    const roomSize = room ? room.size : 0;
    if (roomSize === 0) {
      this.removeEventListenersForWorkspace(workspaceId);
    }
  }

  /**
   * Configurar listeners de eventos para um sessionKey
   */
  private setupEventListeners(mapKey: string, workspaceId: string, sessionId: string): void {
    // Register handlers only once per sessionKey to avoid duplicate emits and memory leaks
    if (this.registeredWorkspaces.has(mapKey)) return;

    const handlers: Record<string, Function> = {};

    handlers['qr'] = (payload: any) => {
      this.server.to(`whatsapp:${mapKey}`).emit('qr_updated', payload);
    };

    handlers['connection_status'] = (payload: any) => {
      this.server.to(`whatsapp:${mapKey}`).emit('connection_status', payload);
    };

    handlers['message_received'] = (payload: any) => {
      this.server.to(`whatsapp:${mapKey}`).emit('message_received', payload);
    };

    handlers['message_status'] = (payload: any) => {
      this.server.to(`whatsapp:${mapKey}`).emit('message_status', payload);
    };

    handlers['message_sent'] = (payload: any) => {
      this.server.to(`whatsapp:${mapKey}`).emit('message_sent', payload);
    };

    Object.keys(handlers).forEach((event) => {
      this.whatsAppService.onEvent(mapKey, event, handlers[event]);
    });

    this.workspaceHandlers.set(mapKey, handlers);
    this.registeredWorkspaces.add(mapKey);
  }

  private removeEventListenersForWorkspace(mapKey: string): void {
    if (!this.registeredWorkspaces.has(mapKey)) return;
    const handlers = this.workspaceHandlers.get(mapKey) || {};
    Object.keys(handlers).forEach((event) => {
      try {
        this.whatsAppService.offEvent(mapKey, event, handlers[event]);
      } catch (e) {
        const msg = (e as any)?.message ? (e as any).message : String(e);
        this.logger.warn(`Erro ao remover handler ${event} para ${mapKey}: ${msg}`);
      }
    });
    this.workspaceHandlers.delete(mapKey);
    this.registeredWorkspaces.delete(mapKey);
    this.logger.info(`Gateway handlers removed for ${mapKey}`);
  }

  /**
   * Enviar QR Code request para todos os clientes conectados
   */
  emitQRCode(workspaceId: string, qrCode: string): void {
    this.server.to(`whatsapp:${workspaceId}`).emit('qr_updated', {
      qrCode,
      timestamp: new Date(),
    });
  }

  /**
   * Notificar novo status de conexão
   */
  emitConnectionStatus(
    workspaceId: string,
    status: 'connecting' | 'connected' | 'disconnected',
  ): void {
    this.server.to(`whatsapp:${workspaceId}`).emit('connection_status', {
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Notificar mensagem recebida
   */
  emitMessageReceived(
    workspaceId: string,
    messageData: {
      from: string;
      text: string;
      timestamp: number;
    },
  ): void {
    this.server.to(`whatsapp:${workspaceId}`).emit('message_received', {
      ...messageData,
      receivedAt: new Date(),
    });
  }

  /**
   * Notificar status de mensagem
   */
  emitMessageStatus(
    workspaceId: string,
    data: {
      messageId: string;
      status: 'sent' | 'delivered' | 'read';
    },
  ): void {
    this.server.to(`whatsapp:${workspaceId}`).emit('message_status', {
      ...data,
      timestamp: new Date(),
    });
  }
}
