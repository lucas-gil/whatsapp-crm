"use client";

import { useState, useEffect } from 'react';

export default function ConfiguracoesPage() {
  const [whatsappKey, setWhatsappKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  const handleSave = async () => {
    try {
      // salvar WhatsApp
      await fetch('/api/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappKey }),
      });

      // salvar Gemini
      await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey }),
      });

      alert('Configurações salvas!');
    } catch (err) {
      alert('Erro ao salvar configurações');
      console.error(err);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const r1 = await fetch('/api/settings/whatsapp');
        if (r1.ok) {
          const j1 = await r1.json();
          const d1 = j1?.data ?? j1;
          setWhatsappKey(d1?.whatsappKey || '');
        }

        const r2 = await fetch('/api/settings/gemini');
        if (r2.ok) {
          const j2 = await r2.json();
          const d2 = j2?.data ?? j2;
          setGeminiKey(d2?.apiKey || '');
        }
      } catch (err) {
        console.error('Erro ao carregar configurações', err);
      }
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Configurações</h1>
        <p className="text-gray-500 mb-8">Gerencie suas integrações e preferências</p>

        <div className="space-y-8">
          {/* WhatsApp Config */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🟢 WhatsApp</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chave de API / Telefone ID
                </label>
                <input
                  type="text"
                  value={whatsappKey}
                  onChange={(e) => setWhatsappKey(e.target.value)}
                  placeholder="Cole sua chave aqui"
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-whatsapp"
                />
              </div>
              <p className="text-sm text-gray-500">
                Configure sua chave do WhatsApp Cloud API para ativar integrações avançadas
              </p>
            </div>
          </div>

          {/* Gemini Config */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🤖 Gemini AI</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key do Gemini
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Cole sua API Key aqui"
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-whatsapp"
                />
              </div>
              <p className="text-sm text-gray-500">
                Obtenha sua chave em: https://makersuite.google.com/app/apikey
              </p>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full px-6 py-3 bg-whatsapp text-white rounded-lg hover:bg-whatsapp-dark font-medium"
          >
            💾 Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
