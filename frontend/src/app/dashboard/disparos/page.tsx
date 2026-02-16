'use client';

import Link from 'next/link';
import { useState } from 'react';
import dynamic from 'next/dynamic';

const GeminiConfigModal = dynamic(() => import('@/src/components/GeminiConfigModal'), { ssr: false });

export default function DisparosPage() {
  const [openGemini, setOpenGemini] = useState(false);
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Disparos</h1>
        <p className="text-gray-500 mb-8">Envie mensagens em massa para seus contatos</p>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">📬</span>
                <h3 className="font-bold text-gray-900">Envio 1:1</h3>
              </div>
              <p className="text-gray-500 text-sm mb-3">
                Enviar mensagens individuais para contatos selecionados.
              </p>
              <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                <li>Selecao manual de contatos</li>
                <li>Historico por contato</li>
                <li>Controle de status por envio</li>
              </ul>
              <div className="mt-4">
                <Link
                  href="/dashboard/disparos/novo"
                  className="inline-flex items-center justify-center px-4 py-2 bg-whatsapp text-white rounded hover:bg-whatsapp-dark"
                >
                  Enviar 1:1
                </Link>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">👥</span>
                <h3 className="font-bold text-gray-900">Envio para Grupos</h3>
              </div>
              <p className="text-gray-500 text-sm mb-3">
                Enviar para grupos existentes do WhatsApp.
              </p>
              <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                <li>Listar e selecionar grupos</li>
                <li>Disparo em multiplos grupos</li>
                <li>Opcoes para envio individual por grupo</li>
              </ul>
              <div className="mt-4">
                <Link
                  href="/dashboard/disparos/grupos"
                  className="inline-flex items-center justify-center px-4 py-2 bg-whatsapp text-white rounded hover:bg-whatsapp-dark"
                >
                  Selecionar Grupos
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🤖</span>
                <h3 className="font-bold text-gray-900">Assistente IA (Gemini)</h3>
              </div>
              <p className="text-gray-500 text-sm mb-3">
                Configure a IA para gerar respostas automáticas, baseadas no prompt e arquivos de contexto.
              </p>
              <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                <li>Configurar prompt (persona/regra)</li>
                <li>Upload de arquivos de contexto (imagens, PDFs)</li>
                <li>Ativar/desativar respostas automáticas</li>
              </ul>
              <div className="mt-4">
                <button onClick={() => setOpenGemini(true)} className="inline-flex items-center justify-center px-4 py-2 bg-whatsapp text-white rounded hover:bg-whatsapp-dark">
                  Configurar IA
                </button>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🗳️</span>
                <h3 className="font-bold text-gray-900">Enquetes (Poll)</h3>
              </div>
              <p className="text-gray-500 text-sm mb-3">
                Crie enquetes com respostas e follow-up automatico.
              </p>
              <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                <li>Enviar para leads e grupos</li>
                <li>Opcoes com respostas guiadas</li>
                <li>Relatorio de interacoes</li>
              </ul>
              <div className="mt-4">
                <Link
                  href="/dashboard/disparos/enquetes"
                  className="inline-flex items-center justify-center px-4 py-2 bg-whatsapp text-white rounded hover:bg-whatsapp-dark"
                >
                  Criar Enquete
                </Link>
              </div>
            </div>
          </div>

          {openGemini && <GeminiConfigModal open={openGemini} onClose={() => setOpenGemini(false)} />}

          <div className="border-2 border-dashed border-gray-300 rounded p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🚀</span>
              <h3 className="font-bold text-gray-900">Envio em Massa</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Campanhas com segmentacao, templates e agendamento.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Segmentacao</p>
                <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                  <li>Tags e etapas do funil</li>
                  <li>Filtros combinados</li>
                  <li>Exclusoes por status</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Templates</p>
                <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                  <li>Variaveis {`{nome}`}, {`{cidade}`}, {`{empresa}`}</li>
                  <li>Preview antes do envio</li>
                  <li>Salvar e reutilizar</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Agendamento</p>
                <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                  <li>Data e hora programadas</li>
                  <li>Fuso horario configuravel</li>
                  <li>Janela de disparo</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Fila e Rate Limit</p>
                <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                  <li>Mensagens por minuto</li>
                  <li>Fila com retentativas</li>
                  <li>Logs e relatorios</li>
                </ul>
              </div>
            </div>
            <div className="mt-5">
              <Link
                href="/dashboard/disparos/campanhas"
                className="inline-flex items-center justify-center px-4 py-2 bg-whatsapp text-white rounded hover:bg-whatsapp-dark"
              >
                Criar Campanha
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
