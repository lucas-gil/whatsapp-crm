import { useState, useEffect, useCallback } from 'react';

interface WhatsAppStatus {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'waiting';
  qrCode?: string | null;
  error?: string;
  message?: string;
  timestamp?: string;
}

export function useWhatsAppConnection(token: string | null) {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    status: 'disconnected',
    qrCode: null,
  });
  const [loading, setLoading] = useState(false);

  const api = typeof window !== 'undefined' 
    ? `${window.location.origin}/api`
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  /**
   * Iniciar conexão QR
   */
  const startQRConnection = useCallback(async () => {
    if (!token) {
      setStatus((s) => ({
        ...s,
        error: 'Token não disponível',
      }));
      return;
    }

    try {
      setLoading(true);
      setStatus((s) => ({
        ...s,
        status: 'connecting',
        error: undefined,
      }));

      const response = await fetch(`${api}/whatsapp/connect-qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro: ${response.statusText}`);
      }

      const data = await response.json();
      setStatus((s) => ({
        ...s,
        message: data.message,
      }));

      // Carregar QR Code
      await fetchQRCode();
    } catch (error) {
      setStatus((s) => ({
        ...s,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        status: 'disconnected',
      }));
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Buscar QR Code
   */
  const fetchQRCode = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${api}/whatsapp/qr-code`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Falha ao buscar QR');

      const data = await response.json();

      setStatus((s) => ({
        ...s,
        qrCode: data.qrCode,
        status: data.status,
        message: data.message,
      }));
    } catch (error) {
      setStatus((s) => ({
        ...s,
        error: error instanceof Error ? error.message : 'Erro ao buscar QR',
      }));
    }
  }, [token]);

  /**
   * Verificar status de conexão
   */
  const checkStatus = useCallback(async () => {
    if (!token) return false;

    try {
      const response = await fetch(`${api}/whatsapp/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();

      setStatus((s) => ({
        ...s,
        connected: data.connected,
        status: data.status,
        timestamp: data.timestamp,
      }));

      return data.connected;
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return false;
    }
  }, [token]);

  /**
   * Desconectar WhatsApp
   */
  const disconnect = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${api}/whatsapp/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Falha ao desconectar');

      const data = await response.json();
      setStatus({
        connected: false,
        status: 'disconnected',
        qrCode: null,
        message: data.message,
      });
    } catch (error) {
      setStatus((s) => ({
        ...s,
        error: error instanceof Error ? error.message : 'Erro ao desconectar',
      }));
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Verificar status periodicamente
   */
  useEffect(() => {
    if (!token) return;

    let retries = 0;
    const maxRetries = 30; // 30 tentativas = ~5 minutos com polling de 10s

    const checkAndRetry = async () => {
      const isConnected = await checkStatus();

      if (isConnected) {
        setStatus((s) => ({
          ...s,
          connected: true,
          status: 'connected',
          qrCode: null,
        }));
        clearInterval(interval);
      } else if (retries >= maxRetries) {
        setStatus((s) => ({
          ...s,
          error: 'Timeout na conexão com WhatsApp',
        }));
        clearInterval(interval);
      }

      retries++;
    };

    const interval = setInterval(checkAndRetry, 10000); // A cada 10 segundos

    return () => clearInterval(interval);
  }, [token, checkStatus]);

  return {
    status,
    loading,
    startQRConnection,
    fetchQRCode,
    checkStatus,
    disconnect,
  };
}
