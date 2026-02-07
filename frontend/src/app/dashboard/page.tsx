'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `/api/admin/stats`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          setStats(await response.json());
        }

        // Verificar conexão WhatsApp
        const waResponse = await fetch(
          `/api/whatsapp/status`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (waResponse.ok) {
          const { connected } = await waResponse.json();
          setWhatsappConnected(connected);
        }
      } catch (error) {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* WhatsApp Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">WhatsApp</p>
            <p className="text-2xl font-bold">
              {whatsappConnected ? '🟢 Conectado' : '🔴 Desconectado'}
            </p>
          </div>
        </div>
      </div>

      {/* Leads */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div>
          <p className="text-gray-500 text-sm">👥 Leads</p>
          <p className="text-3xl font-bold text-whatsapp">{stats?.leads || 0}</p>
        </div>
      </div>

      {/* Conversas */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div>
          <p className="text-gray-500 text-sm">💬 Conversas</p>
          <p className="text-3xl font-bold text-whatsapp-light">
            {stats?.conversations || 0}
          </p>
        </div>
      </div>

      {/* Mensagens */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div>
          <p className="text-gray-500 text-sm">📨 Mensagens</p>
          <p className="text-3xl font-bold text-blue-500">{stats?.messages || 0}</p>
        </div>
      </div>
    </div>
  );
}
