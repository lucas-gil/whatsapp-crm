'use client';

import Link from 'next/link';

export default function BillingAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel de Cobrança</h1>
        <p className="text-gray-500 mb-6">Mini-CRM de cobrança — cobranças, clientes, campanhas e caixa de entrada.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total em aberto</p>
            <p className="text-2xl font-bold text-red-600">R$ -</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total vencido</p>
            <p className="text-2xl font-bold text-orange-600">R$ -</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total a vencer hoje</p>
            <p className="text-2xl font-bold text-green-600">R$ -</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/dashboard/admin/billing/clients" className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Clientes</p>
            <p className="text-sm text-gray-500">Gerenciar clientes e vencimentos</p>
          </Link>
          <Link href="/dashboard/admin/billing/charges" className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Cobranças</p>
            <p className="text-sm text-gray-500">Calendário / Lista / Kanban</p>
          </Link>
          <Link href="/dashboard/admin/billing/campaigns" className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Campanhas</p>
            <p className="text-sm text-gray-500">Envio em lote com limites</p>
          </Link>
          <Link href="/dashboard/admin/billing/inbox" className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Caixa de entrada</p>
            <p className="text-sm text-gray-500">Respostas dos clientes</p>
          </Link>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="font-bold">Relatórios rápidos</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Atrasados por faixa</p>
              <p className="font-semibold">-</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Recuperado</p>
              <p className="font-semibold">-</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Taxa de pagamento</p>
              <p className="font-semibold">-</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
