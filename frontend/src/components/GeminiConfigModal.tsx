'use client';

import { useState } from 'react';

export default function GeminiConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [respondAll, setRespondAll] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/settings/gemini');
      if (!res.ok) return;
      const data = await res.json();
      setApiKey(data.apiKey || '');
      setSystemPrompt(data.systemPrompt || '');
      setRespondAll(!!data.respondToAllMessages);
    } catch (err) {
      console.error(err);
    }
  }

  async function save() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, systemPrompt, isEnabled: true, respondToAllMessages: respondAll }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const form = new FormData();
    form.append('file', f);
    setLoading(true);
    try {
      const res = await fetch('/api/settings/gemini/upload-context', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('Upload falhou');
      alert('Arquivo enviado com sucesso');
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar arquivo');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  // load settings when modal opens
  if (!apiKey && !systemPrompt && !respondAll) {
    load();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[720px] max-w-full p-6">
        <h2 className="text-xl font-bold mb-4">Configurações de IA (Gemini)</h2>

        <div className="space-y-3">
          <label className="block text-sm font-medium">API Key</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full border rounded px-3 py-2" />

          <label className="block text-sm font-medium">Prompt do Cliente (system prompt)</label>
          <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="w-full border rounded px-3 py-2 h-28" />

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={respondAll} onChange={(e) => setRespondAll(e.target.checked)} />
            <span className="text-sm">Responder automaticamente a todas as mensagens</span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">Upload de arquivo de contexto</label>
            <input type="file" onChange={uploadFile} />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 border rounded">Fechar</button>
            <button onClick={save} disabled={loading} className="px-4 py-2 bg-whatsapp text-white rounded">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
