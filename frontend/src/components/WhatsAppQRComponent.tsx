'use client';

import { useState, useEffect } from 'react';
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection';
import { useAuth } from '@/hooks/useAuth';

export function WhatsAppQRComponent() {
  const { token } = useAuth();
  const { status, loading, startQRConnection, disconnect, fetchQRCode } =
    useWhatsAppConnection(token);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Atualizar QR Code a cada 5 segundos enquanto está em estado "waiting"
  useEffect(() => {
    if (status.status === 'waiting' && !refreshInterval) {
      const interval = setInterval(() => {
        fetchQRCode();
      }, 5000);
      setRefreshInterval(interval);
    } else if (status.status !== 'waiting' && refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [status.status, refreshInterval, fetchQRCode]);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Conectar WhatsApp</h2>

      {/* Status Conectado */}
      {status.connected && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="font-semibold text-green-700">Conectado</span>
          </div>
          <p className="text-sm text-green-600">
            Seu WhatsApp está configurado e pronto para usar
          </p>
          <button
            onClick={disconnect}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            Desconectar
          </button>
        </div>
      )}

      {/* Erro */}
      {status.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-semibold">Erro</p>
          <p className="text-sm text-red-600 mt-1">{status.error}</p>
        </div>
      )}

      {/* QR Code */}
      {status.qrCode && !status.connected && (
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={status.qrCode}
              alt="WhatsApp QR Code"
              className="w-64 h-64"
            />
          </div>
          <p className="text-center text-sm text-gray-600 mb-4">
            {status.message || 'Escaneie o código QR com seu WhatsApp'}
          </p>
          <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <p className="font-semibold mb-1">📱 Como conectar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em Menu ou Configurações</li>
              <li>Selecione &quot;Aparelhos conectados&quot;</li>
              <li>Toque em &quot;Conectar um aparelho&quot;</li>
              <li>Escaneie este QR Code</li>
            </ol>
          </div>
        </div>
      )}

      {/* Conectando */}
      {status.status === 'connecting' && (
        <div className="mb-6 flex flex-col items-center py-8">
          <div className="mb-4 relative w-16 h-16">
            <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-600 rounded-full animate-spin" />
            <div className="absolute inset-1 bg-white rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-500 animate-bounce"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
          </div>
          <p className="text-center font-semibold text-gray-700">Conectando...</p>
          <p className="text-center text-sm text-gray-500 mt-2">
            Escaneie o QR Code com seu WhatsApp
          </p>
        </div>
      )}

      {/* Botão Iniciar Conexão */}
      {status.status === 'disconnected' && !status.qrCode && (
        <button
          onClick={startQRConnection}
          disabled={loading}
          className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Iniciando...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10.5 1.5H5.75A2.25 2.25 0 003.5 3.75v12.5A2.25 2.25 0 005.75 18.5h8.5a2.25 2.25 0 002.25-2.25V9.5m-12-4h6m-6 3h3m-3 3h6m3-8v4m0 0l-1-1m1 1l1-1"
                  clipRule="evenodd"
                />
              </svg>
              Conectar WhatsApp
            </>
          )}
        </button>
      )}

      {/* Status Message */}
      {status.message && status.status === 'waiting' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">{status.message}</p>
        </div>
      )}

      {/* Timestamp */}
      {status.timestamp && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Atualizado em: {new Date(status.timestamp).toLocaleTimeString('pt-BR')}
        </div>
      )}
    </div>
  );
}
