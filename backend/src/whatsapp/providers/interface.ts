/**
 * Interface abstrata para providers de WhatsApp
 * Permite trocar entre Web QR (Baileys) e Cloud API sem mudanças no código
 */
export interface WhatsAppProvider {
  /**
   * Inicializar sessão para um workspace
   */
  initSession(workspaceId: string): Promise<void>;

  /**
   * Obter QR Code para scanning (null se não aplicável)
   */
  getQRCode(workspaceId: string): Promise<string | null>;

  /**
   * Verificar se está conectado
   */
  isConnected(workspaceId: string): Promise<boolean>;

  /**
   * Desconectar
   */
  disconnect(workspaceId: string): Promise<void>;

  /**
   * Enviar mensagem de texto
   */
  sendText(workspaceId: string, to: string, text: string): Promise<string>;

  /**
   * Enviar mídia (arquivo)
   */
  sendMedia(
    workspaceId: string,
    to: string,
    media: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<string>;

  /**
   * Enviar enquete
   */
  sendPoll(
    workspaceId: string,
    to: string,
    question: string,
    options: string[],
  ): Promise<string>;

  /**
   * Listar todos os grupos
   */
  listGroups(workspaceId: string): Promise<any[]>;

  /**
   * Obter informações do grupo
   */
  getGroupInfo(workspaceId: string, groupId: string): Promise<any>;

  /**
   * Obter foto do perfil
   */
  getProfilePicture(
    workspaceId: string,
    phoneNumber: string,
  ): Promise<string | null>;

  /**
   * Registrar listeners de eventos
   */
  on(event: string, callback: (data: any) => void): void;

  /**
   * Remover listeners de eventos
   */
  off(event: string, callback?: (data: any) => void): void;

  /**
   * Testar conexão
   */
  testConnection(workspaceId: string): Promise<boolean>;
}

export enum WhatsAppEvent {
  QR_GENERATED = 'qr_generated',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_ACK = 'message_ack',
  GROUP_CREATED = 'group_created',
  CONTACT_CHANGED = 'contact_changed',
  ERROR = 'error',
}
