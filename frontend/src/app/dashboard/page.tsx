'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Buscar leads
      const leadsRes = await fetch('/api/crm/leads');
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData);
      }

      // Buscar conversas
      const convsRes = await fetch('/api/crm/conversations');
      if (convsRes.ok) {
        const convsData = await convsRes.json();
        setConversations(convsData);
      }
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-2">Bem-vindo ao WhatsApp CRM</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card Status */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-whatsapp">
            <p className="text-gray-500 text-sm mb-2">Status</p>
            <p className="text-3xl font-bold text-whatsapp">🟢 Online</p>
          </div>

          {/* Card Conversas */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <p className="text-gray-500 text-sm mb-2">Conversas</p>
            <p className="text-3xl font-bold text-green-600">{conversations.length}</p>
          </div>

          {/* Card Leads */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm mb-2">Leads</p>
            <p className="text-3xl font-bold text-blue-600">{leads.length}</p>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Resumo</h2>
          <p className="text-gray-600">Sistema pronto para usar. Você está conectado e pode começar a gerenciar seus leads e conversas.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">🚀 Próximos Passos</h3>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li>✅ Configure a conexão WhatsApp</li>
              <li>✅ Crie seus primeiros leads</li>
              <li>✅ Inicie conversas com clientes</li>
              <li>✅ Configure automações com IA</li>
            </ul>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📚 Recursos Úteis</h3>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li>💬 <a href="#" className="text-blue-600 hover:underline">Conectar WhatsApp</a></li>
              <li>👥 <a href="#" className="text-blue-600 hover:underline">Gerenciar Leads</a></li>
              <li>⚙️ <a href="#" className="text-blue-600 hover:underline">Configurações</a></li>
              <li>📖 <a href="#" className="text-blue-600 hover:underline">Documentação</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
