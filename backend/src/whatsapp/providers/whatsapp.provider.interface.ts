export interface WhatsAppMessage {
  id?: string;
  to: string;
  text?: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'poll';
  caption?: string;
  media?: Buffer;
  filename?: string;
  mimetype?: string;
}

export interface WhatsAppMediaMessage extends WhatsAppMessage {
  media: Buffer;
  filename: string;
  mimetype: string;
}

export interface WhatsAppPoll {
  question: string;
  options: string[];
}

export interface WhatsAppEvent {
  type: 'message' | 'status' | 'media' | 'group' | 'connection';
  payload: any;
}

export interface WhatsAppProvider {
  // Ciclo de vida
  initSession(workspaceId: string): Promise<void>;
  getQRCode(workspaceId: string): Promise<string | null>;
  isConnected(workspaceId: string): Promise<boolean>;
  disconnect(workspaceId: string): Promise<void>;

  // Messaging
  sendText(workspaceId: string, to: string, text: string): Promise<string>;
  sendMedia(
    workspaceId: string,
    to: string,
    media: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<string>;
  sendPoll(
    workspaceId: string,
    to: string,
    question: string,
    options: string[],
  ): Promise<string>;

  // Groups
  listGroups(workspaceId: string): Promise<any[]>;
  getGroupInfo(workspaceId: string, groupId: string): Promise<any>;

  // Contacts
  getProfilePicture(workspaceId: string, phoneNumber: string): Promise<string | null>;

  // Event handlers
  on(event: string, callback: (data: WhatsAppEvent) => void): void;
  off(event: string, callback?: (data: WhatsAppEvent) => void): void;

  // Status
  testConnection(workspaceId: string): Promise<boolean>;
}
