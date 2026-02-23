'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function BillingAdminPage() {
  const { fetchWithAuth, loading: authLoading, token } = useAuth();
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase ? apiBase.replace(/\/$/, '') : typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3000';

  const [totalDueToday, setTotalDueToday] = useState<number | null>(null);
  const [totalOpen, setTotalOpen] = useState<number | null>(null);
  const [totalOverdue, setTotalOverdue] = useState<number | null>(null);
  const [faixas, setFaixas] = useState<any[]>([]);
  const [recuperado, setRecuperado] = useState<number | null>(null);
  const [taxaPagamento, setTaxaPagamento] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !token) return;
    loadTotals();
    loadRelatorios();
  }, [authLoading, token]);

  const loadTotals = async () => {
    try {
      // buscar informações do usuário para workspaceId
      const meRes = await fetchWithAuth(`${api}/auth/me`);
      if (!meRes.ok) return;
      const me = await meRes.json();
      const workspaceId = me?.workspaceId;

      const res = await fetchWithAuth(`${api}/billing/charges?workspaceId=${workspaceId}&limit=1000`);
      if (!res.ok) return;
      const data = await res.json();
      const charges = data?.charges || data || [];

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      let dueToday = 0;
      let open = 0;
      let overdue = 0;

      charges.forEach((c: any) => {
        const due = c.dueDate ? String(c.dueDate).slice(0, 10) : null;
        const amount = Number(c.amount || 0);
        const status = c.status || '';
        if (status !== 'PAID') {
          open += amount;
        }
        if (due && due === todayStr && status !== 'PAID') {
          dueToday += amount;
        }
        if (due && due < todayStr && status !== 'PAID') {
          overdue += amount;
        }
      });

      setTotalDueToday(dueToday);
      setTotalOpen(open);
      setTotalOverdue(overdue);
    } catch (err) {
      console.error('Erro ao carregar totais de cobrança', err);
    }
  };

  const loadRelatorios = async () => {
    try {
      const meRes = await fetchWithAuth(`${api}/auth/me`);
      if (!meRes.ok) return;
      const me = await meRes.json();
      const workspaceId = me?.workspaceId;
      const res = await fetchWithAuth(`${api}/billing/charges?workspaceId=${workspaceId}&limit=1000`);
      if (!res.ok) return;
      const data = await res.json();
      const charges = data?.charges || data || [];

      // Faixas de atraso
      const faixasData = [
        { label: 'Até 7 dias', value: 0 },
        { label: '8-30 dias', value: 0 },
        { label: '31-90 dias', value: 0 },
        { label: 'Acima de 90 dias', value: 0 }
      ];
      const now = new Date();
      charges.forEach((c: any) => {
        if (c.status !== 'PAID' && c.dueDate) {
          const venc = new Date(c.dueDate);
          const diff = Math.floor((now.getTime() - venc.getTime()) / (1000*60*60*24));
          if (diff > 0 && diff <= 7) faixasData[0].value += Number(c.amount || 0);
          else if (diff > 7 && diff <= 30) faixasData[1].value += Number(c.amount || 0);
          else if (diff > 30 && diff <= 90) faixasData[2].value += Number(c.amount || 0);
          else if (diff > 90) faixasData[3].value += Number(c.amount || 0);
        }
      });
      setFaixas(faixasData);

      // Recuperado
      const recuperadoValor = charges.filter((c: { status: string; amount: number }) => c.status === 'PAID').reduce((acc: number, c: { amount: number }) => acc + Number(c.amount || 0), 0);
      setRecuperado(recuperadoValor);

      // Taxa de pagamento
      const total = charges.length;
      const pagos = charges.filter((c: any) => c.status === 'PAID').length;
      setTaxaPagamento(total > 0 ? (pagos/total)*100 : null);
    } catch (err) {
      setFaixas([]);
      setRecuperado(null);
      setTaxaPagamento(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel de Cobrança</h1>
        <p className="text-gray-500 mb-6">Mini-CRM de cobrança — cobranças, clientes, campanhas e caixa de entrada.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total em aberto</p>
            <p className="text-2xl font-bold text-red-600">{totalOpen !== null ? `R$ ${totalOpen.toFixed(2)}` : 'R$ -'}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total vencido</p>
            <p className="text-2xl font-bold text-orange-600">{totalOverdue !== null ? `R$ ${totalOverdue.toFixed(2)}` : 'R$ -'}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500">Total a vencer hoje</p>
            <p className="text-2xl font-bold text-green-600">{totalDueToday !== null ? `R$ ${totalDueToday.toFixed(2)}` : 'R$ -'}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link href="/dashboard/admin/billing/clients" prefetch={false} className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Clientes</p>
            <p className="text-sm text-gray-500">Gerenciar clientes e vencimentos</p>
          </Link>
          <Link href="/dashboard/admin/billing/charges" prefetch={false} className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Cobranças</p>
            <p className="text-sm text-gray-500">Calendário / Lista / Kanban</p>
          </Link>
          <Link href="/dashboard/admin/billing/campaigns" prefetch={false} className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Campanhas</p>
            <p className="text-sm text-gray-500">Envio em lote com limites</p>
          </Link>
          <Link href="/dashboard/admin/billing/inbox" prefetch={false} className="block bg-white rounded p-4 shadow">
            <p className="font-semibold">Caixa de entrada</p>
            <p className="text-sm text-gray-500">Respostas dos clientes</p>
          </Link>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="font-bold">Relatórios rápidos</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Atrasados por faixa</p>
              <ul className="text-xs mt-2">
                {faixas.map((f, idx) => (
                  <li key={idx}>{f.label}: <span className="font-semibold text-red-600">R$ {f.value.toFixed(2)}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm text-gray-500">Recuperado</p>
              <p className="font-semibold text-green-600 text-xl">{recuperado !== null ? `R$ ${recuperado.toFixed(2)}` : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Taxa de pagamento</p>
              <p className="font-semibold text-blue-600 text-xl">{taxaPagamento !== null ? `${taxaPagamento.toFixed(1)}%` : '-'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
