'use client';
import { useEffect, useState } from 'react';

export default function BillingChargesPage() {
  const [charges, setCharges] = useState<any[]>([]);
  const [view, setView] = useState<'calendario' | 'lista' | 'kanban'>('lista');
    const [search, setSearch] = useState("");
  const [totalOpen, setTotalOpen] = useState(0);

  useEffect(() => {
    fetch('/api/billing/charges?workspaceId=demo')
      .then(res => res.json())
      .then(data => {
        const charges = data.charges || [];
        setCharges(charges);
        // Soma apenas valores em aberto
        const sum = charges.filter((c: { status: string; amount: number }) => c.status !== 'PAID').reduce((acc: number, c: { amount: number }) => acc + Number(c.amount || 0), 0);
        setTotalOpen(sum);
      });
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Cobranças</h1>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-sm text-gray-500">Total em aberto</p>
          <p className="text-2xl font-bold text-red-600">R$ {totalOpen.toFixed(2)}</p>
        </div>
        <div className="flex gap-2 mt-4">
          <button className={view==='calendario' ? 'font-bold' : ''} onClick={()=>setView('calendario')}>Calendário</button>
          <button className={view==='lista' ? 'font-bold' : ''} onClick={()=>setView('lista')}>Lista</button>
          <button className={view==='kanban' ? 'font-bold' : ''} onClick={()=>setView('kanban')}>Kanban</button>
        </div>
          <div className="mt-6">
            <input
              type="text"
              className="border p-2 rounded w-full"
              placeholder="Pesquisar cobranças por cliente, valor, status..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        <div className="mt-6">
          {view === 'lista' && (
            <table className="w-full bg-white rounded shadow">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                  {charges
                    .filter(c => {
                      if (!search) return true;
                      const s = search.toLowerCase();
                      return (
                        (c.client?.name && c.client.name.toLowerCase().includes(s)) ||
                        (c.amount && String(c.amount).includes(s)) ||
                        (c.status && c.status.toLowerCase().includes(s)) ||
                        (c.dueDate && new Date(c.dueDate).toLocaleDateString().includes(s))
                      );
                    })
                    .map((c, idx) => (
                      <tr key={idx}>
                        <td>{c.client?.name || '-'}</td>
                        <td>R$ {Number(c.amount).toFixed(2)}</td>
                        <td>{c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '-'}</td>
                        <td>{c.status}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
          {view === 'calendario' && (
            <div className="bg-white rounded shadow p-4">[Calendário de vencimentos - em breve]</div>
          )}
          {view === 'kanban' && (
            <div className="bg-white rounded shadow p-4">[Kanban de cobranças - em breve]</div>
          )}
        </div>
      </div>
    </div>
  );
}
