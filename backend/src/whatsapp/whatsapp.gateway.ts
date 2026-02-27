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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/whatsapp',
})
export class WhatsAppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private logger = new Logger('WhatsAppGateway');
  private clientWorkspaceMap: Map<string, string> = new Map(); // socketId -> workspaceId

  constructor(
    private whatsAppService: WhatsAppService,
    private jwtService: JwtService,
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
    const workspaceId = this.clientWorkspaceMap.get(client.id);
    if (workspaceId) {
      this.clientWorkspaceMap.delete(client.id);
    }
    this.logger.info(`Cliente desconectado do WebSocket: ${client.id}`);
  }

  /**
   * Subscribe para eventos do WhatsApp de um workspace
   */
  @SubscribeMessage('subscribe')
  onSubscribe(client: Socket, data: { token: string }): void {
    try {
      const decoded = this.jwtService.verify(data.token);
      const workspaceId = decoded.workspaceId;

      this.clientWorkspaceMap.set(client.id, workspaceId);
      client.join(`whatsapp:${workspaceId}`);

      this.logger.info(
        `Cliente ${client.id} subscribed a eventos de ${workspaceId}`,
      );

      client.emit('subscribed', {
        workspaceId,
        timestamp: new Date(),
      });

      // Registrar listeners de eventos
      this.setupEventListeners(workspaceId);
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
    if (workspaceId) {
      client.leave(`whatsapp:${workspaceId}`);
      this.clientWorkspaceMap.delete(client.id);
      this.logger.info(`Cliente ${client.id} unsubscribed`);
    }
  }

  /**
   * Configurar listeners de eventos
   */
  private setupEventListeners(workspaceId: string): void {
    // QR Code
    this.whatsAppService.onEvent(workspaceId, 'qr', (payload: any) => {
      this.server.to(`whatsapp:${workspaceId}`).emit('qr_updated', payload);
    });

    // Status de conexão
    this.whatsAppService.onEvent(workspaceId, 'connection_status', (payload: any) => {
      this.server
        .to(`whatsapp:${workspaceId}`)
        .emit('connection_status', payload);
    });

    // Mensagem recebida
    this.whatsAppService.onEvent(workspaceId, 'message_received', (payload: any) => {
      this.server
        .to(`whatsapp:${workspaceId}`)
        .emit('message_received', payload);
    });

    // Status de mensagem
    this.whatsAppService.onEvent(workspaceId, 'message_status', (payload: any) => {
      this.server.to(`whatsapp:${workspaceId}`).emit('message_status', payload);
    });

    // Mensagem enviada
    this.whatsAppService.onEvent(workspaceId, 'message_sent', (payload: any) => {
      this.server.to(`whatsapp:${workspaceId}`).emit('message_sent', payload);
    });
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
