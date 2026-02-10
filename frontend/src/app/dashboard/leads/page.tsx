'use client';

import { useState, useEffect } from 'react';

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/crm/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      setError('Erro ao carregar leads');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Carregando leads...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Leads</h1>
        <p className="text-gray-500 mb-8">Gerencie seus contatos e oportunidades</p>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          {leads.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum lead encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-4">Nome</th>
                    <th className="text-left py-2 px-4">Telefone</th>
                    <th className="text-left py-2 px-4">Email</th>
                    <th className="text-left py-2 px-4">Estágio</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead: any) => (
                    <tr key={lead.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">{lead.name}</td>
                      <td className="py-2 px-4">{lead.phoneNumber || '-'}</td>
                      <td className="py-2 px-4">{lead.email || '-'}</td>
                      <td className="py-2 px-4">{lead.pipelineStage || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
