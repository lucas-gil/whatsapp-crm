'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WhatsAppQRComponent } from '@/components/WhatsAppQRComponent';

export default function WhatsAppConfigPage() {
  const [activeTab, setActiveTab] = useState<'connection' | 'info'>('connection');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">WhatsApp</h1>
              <p className="mt-1 text-sm text-gray-600">
                Gerenciar conexão com WhatsApp
              </p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm transition-colors"
            >
              ← Voltar
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('connection')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'connection'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Conexão
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'info'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Informações
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'connection' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* QR Component - Left */}
            <div className="lg:col-span-1">
              <WhatsAppQRComponent />
            </div>

            {/* Info - Right */}
            <div className="lg:col-span-2 space-y-6">
              {/* Getting Started Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  🚀 Primeiros Passos
                </h3>
                <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
                  <li>
                    Clique em <strong>&quot;Conectar WhatsApp&quot;</strong>
                  </li>
                  <li>
                    Um código QR aparecerá na esquerda
                  </li>
                  <li>
                    Abra o WhatsApp Web no seu celular e escaneie o código
                  </li>
                  <li>
                    Aguarde a conexão ser estabelecida
                  </li>
                  <li>
                    Pronto! Você pode começar a enviar mensagens
                  </li>
                </ol>
              </div>

              {/* Features Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ✨ Funcionalidades
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">💬</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Mensagens de Texto</p>
                      <p className="text-sm text-gray-600">
                        Envie mensagens de texto para seus contatos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">📎</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Mídia</p>
                      <p className="text-sm text-gray-600">
                        Compartilhe imagens, vídeos e documentos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">🗳️</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Enquetes</p>
                      <p className="text-sm text-gray-600">
                        Crie enquetes interativas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">👥</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Grupos</p>
                      <p className="text-sm text-gray-600">
                        Gerencie grupos e envie mensagens em massa
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">✅</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Status de Entrega</p>
                      <p className="text-sm text-gray-600">
                        Acompanhe todas as mensagens
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">🔔</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Notificações</p>
                      <p className="text-sm text-gray-600">
                        Receba alertas de novas mensagens
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ❓ Dúvidas Frequentes
                </h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">
                      Onde vejo as conversas recebidas?
                    </p>
                    <p className="text-gray-600 mt-1">
                      Acesse a seção <strong>Conversas</strong> no menu lateral
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Como gerenciar contatos?
                    </p>
                    <p className="text-gray-600 mt-1">
                      Vá para <strong>Leads</strong> para adicionar e gerenciar contatos
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Posso desconectar e reconectar?
                    </p>
                    <p className="text-gray-600 mt-1">
                      Sim! Você pode desconectar a qualquer momento clicando no botão de
                      desconexão
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Sobre WhatsApp CRM
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                O WhatsApp CRM permite que você centralize todas as conversas com seus
                clientes, gerenciando contatos, histórico de mensagens e leads de forma
                eficiente.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 mt-6">
                Tecnologia
              </h3>
              <p>
                Este sistema utiliza a API do WhatsApp Web via conexão segura com
                autenticação QR Code, garantindo acesso autorizado à sua conta.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 mt-6">
                Privacidade
              </h3>
              <p>
                Todos os dados são criptografados e armazenados de forma segura. Sua
                sessão de WhatsApp permanece ativa apenas enquanto você estiver
                conectado.
              </p>
              <h3 className="text-lg font-semibold text-gray-900 mt-6">
                Suporte
              </h3>
              <p>
                Para suporte técnico, entre em contato com nosso time através do
                formulário de contato.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
