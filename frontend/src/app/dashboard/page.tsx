'use client';

import { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-2">Bem-vindo ao WhatsApp CRM</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-whatsapp">
            <p className="text-gray-500 text-sm mb-2">Status</p>
            <p className="text-3xl font-bold text-whatsapp">🟢 Online</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <p className="text-gray-500 text-sm mb-2">Conversas</p>
            <p className="text-3xl font-bold text-green-600">0</p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm mb-2">Leads</p>
            <p className="text-3xl font-bold text-blue-600">0</p>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Configuração</h2>
          <p className="text-gray-600">Sistema pronto para usar. Configure sua conta WhatsApp para começar.</p>
        </div>
      </div>
    </div>
  );
}
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
