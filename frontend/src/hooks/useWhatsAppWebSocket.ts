import { useEffect, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface WhatsAppEvent {
  type: 'qr_updated' | 'connection_status' | 'message_received' | 'message_status' | 'message_sent';
  payload: any;
}

export function useWhatsAppWebSocket(token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<WhatsAppEvent[]>([]);

  const onEvent = useCallback(
    (type: WhatsAppEvent['type'], handler: (payload: any) => void) => {
      if (socket) {
        socket.on(type, handler);
        return () => {
          socket.off(type, handler);
        };
      }
    },
    [socket],
  );

  useEffect(() => {
    if (!token) return;

    try {
      const envWs = process.env.NEXT_PUBLIC_WS_URL || '';
      const envApi = process.env.NEXT_PUBLIC_API_URL || '';
      const clientOrigin = typeof window !== 'undefined' ? window.location.origin : '';

      // If NEXT_PUBLIC_WS_URL is provided, treat it as the full socket URL (may include namespace).
      // Otherwise build URL from NEXT_PUBLIC_API_URL or the current origin and append the namespace.
      let base = '';
      if (envWs && envWs.trim() !== '') {
        base = envWs.replace(/\/$/, '');
      } else {
        const apiBase = (envApi || clientOrigin).replace(/\/$/, '');
        base = `${apiBase}/whatsapp`;
      }

      console.log('Connecting WebSocket to', base);

      const socketIo = io(base, {
        path: '/socket.io',
        transports: ['websocket'],
        query: {
          token,
        },
        auth: {
          token,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socketIo.on('connect', () => {
        console.log('✅ WebSocket conectado');
        setConnected(true);

        // Subscribe para eventos
        socketIo.emit('subscribe', { token });
      });

      socketIo.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
        setConnected(false);
      });

      socketIo.on('subscribed', (data) => {
        console.log('📡 Subscribed:', data);
      });

      socketIo.on('error', (error) => {
        console.error('❌ Erro WebSocket:', error);
      });

      // Listeners de eventos
      socketIo.on('qr_updated', (payload) => {
        setEvents((prev) => [
          ...prev,
          { type: 'qr_updated', payload },
        ]);
      });

      socketIo.on('connection_status', (payload) => {
        setEvents((prev) => [
          ...prev,
          { type: 'connection_status', payload },
        ]);
      });

      socketIo.on('message_received', (payload) => {
        setEvents((prev) => [
          ...prev,
          { type: 'message_received', payload },
        ]);
      });

      socketIo.on('message_status', (payload) => {
        setEvents((prev) => [
          ...prev,
          { type: 'message_status', payload },
        ]);
      });

      socketIo.on('message_sent', (payload) => {
        setEvents((prev) => [
          ...prev,
          { type: 'message_sent', payload },
        ]);
      });

      setSocket(socketIo);

      return () => {
        socketIo.emit('unsubscribe');
        socketIo.disconnect();
      };
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
    }
  }, [token]);

  return {
    socket,
    connected,
    events,
    onEvent,
  };
}
