'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  unitPrice?: number | null;
};

type InventoryItem = {
  id: string;
  quantity: number;
  reserved: number;
  minStock: number;
  product: Product;
};

type Lead = {
  id: string;
  name: string;
  phoneNumber?: string | null;
};

type OrderItem = {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type Delivery = {
  id: string;
  status: string;
  carrier?: string | null;
  trackingCode?: string | null;
  expectedAt?: string | null;
  deliveredAt?: string | null;
};

type Order = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  notes?: string | null;
  lead?: Lead | null;
  items: OrderItem[];
  delivery?: Delivery | null;
};

const orderStatusOptions = [
  'NEW',
  'PACKING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELED',
];

const deliveryStatusOptions = [
  'PENDING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
];

export default function EntregasPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    unitPrice: '',
    initialStock: '',
    minStock: '',
  });

  const [adjustStock, setAdjustStock] = useState({
    productId: '',
    quantity: '',
    reason: '',
  });

  const [newOrder, setNewOrder] = useState({
    leadId: '',
    phoneNumber: '',
    notes: '',
    items: [{ productId: '', quantity: 1 }],
  });

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [productsRes, inventoryRes, ordersRes, leadsRes] = await Promise.all([
        fetch('/api/crm/products', { headers }),
        fetch('/api/crm/inventory', { headers }),
        fetch('/api/crm/orders', { headers }),
        fetch('/api/crm/leads', { headers }),
      ]);

      if (productsRes.ok) {
        setProducts(await productsRes.json());
      }
      if (inventoryRes.ok) {
        setInventory(await inventoryRes.json());
      }
      if (ordersRes.ok) {
        setOrders(await ordersRes.json());
      }
      if (leadsRes.ok) {
        setLeads(await leadsRes.json());
      }
    } catch (err) {
      setError('Erro ao carregar dados de entrega');
    } finally {
      setLoading(false);
    }
  };

  const inventoryByProduct = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventory.forEach((item) => map.set(item.product.id, item));
    return map;
  }, [inventory]);

  const handleCreateProduct = async () => {
    if (!token || !newProduct.name.trim()) return;
    setStatus('');
    try {
      const response = await fetch('/api/crm/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProduct.name,
          sku: newProduct.sku || null,
          unitPrice: Number(newProduct.unitPrice) || 0,
          initialStock: Number(newProduct.initialStock) || 0,
          minStock: Number(newProduct.minStock) || 0,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar produto');
      }

      setNewProduct({ name: '', sku: '', unitPrice: '', initialStock: '', minStock: '' });
      await loadData();
      setStatus('Produto criado');
    } catch (err) {
      setStatus('Erro ao criar produto');
    }
  };

  const handleAdjustStock = async () => {
    if (!token || !adjustStock.productId || !adjustStock.quantity) return;
    setStatus('');
    try {
      const response = await fetch('/api/crm/inventory/adjust', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: adjustStock.productId,
          quantity: Number(adjustStock.quantity),
          reason: adjustStock.reason,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao ajustar estoque');
      }

      setAdjustStock({ productId: '', quantity: '', reason: '' });
      await loadData();
      setStatus('Estoque atualizado');
    } catch (err) {
      setStatus('Erro ao ajustar estoque');
    }
  };

  const handleCreateOrder = async () => {
    if (!token || newOrder.items.length === 0) return;
    setStatus('');
    try {
      const response = await fetch('/api/crm/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId: newOrder.leadId || null,
          phoneNumber: newOrder.phoneNumber || null,
          notes: newOrder.notes || null,
          items: newOrder.items,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar pedido');
      }

      setNewOrder({ leadId: '', phoneNumber: '', notes: '', items: [{ productId: '', quantity: 1 }] });
      await loadData();
      setStatus('Pedido criado');
    } catch (err) {
      setStatus('Erro ao criar pedido');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, statusValue: string) => {
    if (!token) return;
    try {
      await fetch(`/api/crm/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: statusValue }),
      });
      await loadData();
    } catch (err) {
      setStatus('Erro ao atualizar pedido');
    }
  };

  const handleUpdateDelivery = async (orderId: string, statusValue: string) => {
    if (!token) return;
    try {
      await fetch(`/api/crm/orders/${orderId}/delivery`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: statusValue }),
      });
      await loadData();
    } catch (err) {
      setStatus('Erro ao atualizar entrega');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Carregando entregas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      <div className="mx-auto max-w-6xl px-6 py-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Entrega e Estoque</h1>
            <p className="text-xs text-emerald-200/70">
              Controle de produtos, estoque, pedidos e status com mensagens automaticas.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100"
          >
            Atualizar
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-xs text-rose-100">
            {error}
          </div>
        )}
        {status && (
          <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            {status}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold">Produtos e Estoque</h2>
              <div className="mt-3 space-y-3 text-sm">
                {products.length === 0 && (
                  <p className="text-xs text-white/60">Nenhum produto cadastrado.</p>
                )}
                {products.map((product) => {
                  const stock = inventoryByProduct.get(product.id);
                  const quantity = stock?.quantity ?? 0;
                  const minStock = stock?.minStock ?? 0;
                  return (
                    <div
                      key={product.id}
                      className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-xs text-white/60">SKU: {product.sku || 'sem SKU'}</p>
                        </div>
                        <div className="text-right text-xs text-emerald-200">
                          <p>Estoque: {quantity}</p>
                          <p>Minimo: {minStock}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold">Novo produto</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={newProduct.name}
                  onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
                  placeholder="Nome"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                <input
                  value={newProduct.sku}
                  onChange={(event) => setNewProduct({ ...newProduct, sku: event.target.value })}
                  placeholder="SKU"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                <input
                  value={newProduct.unitPrice}
                  onChange={(event) => setNewProduct({ ...newProduct, unitPrice: event.target.value })}
                  placeholder="Preco"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                <input
                  value={newProduct.initialStock}
                  onChange={(event) => setNewProduct({ ...newProduct, initialStock: event.target.value })}
                  placeholder="Estoque inicial"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                <input
                  value={newProduct.minStock}
                  onChange={(event) => setNewProduct({ ...newProduct, minStock: event.target.value })}
                  placeholder="Estoque minimo"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateProduct}
                className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900"
              >
                Criar produto
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold">Ajuste rapido de estoque</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <select
                  value={adjustStock.productId}
                  onChange={(event) =>
                    setAdjustStock({ ...adjustStock, productId: event.target.value })
                  }
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                >
                  <option value="">Selecione o produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <input
                  value={adjustStock.quantity}
                  onChange={(event) => setAdjustStock({ ...adjustStock, quantity: event.target.value })}
                  placeholder="Quantidade (+/-)"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                <input
                  value={adjustStock.reason}
                  onChange={(event) => setAdjustStock({ ...adjustStock, reason: event.target.value })}
                  placeholder="Motivo"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleAdjustStock}
                className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900"
              >
                Atualizar estoque
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold">Criar pedido</h2>
              <div className="mt-3 grid gap-3">
                <select
                  value={newOrder.leadId}
                  onChange={(event) =>
                    setNewOrder({ ...newOrder, leadId: event.target.value, phoneNumber: '' })
                  }
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                >
                  <option value="">Selecionar cliente</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} {lead.phoneNumber ? `(${lead.phoneNumber})` : ''}
                    </option>
                  ))}
                </select>
                <input
                  value={newOrder.phoneNumber}
                  onChange={(event) =>
                    setNewOrder({ ...newOrder, phoneNumber: event.target.value, leadId: '' })
                  }
                  placeholder="Ou telefone do cliente"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                <textarea
                  value={newOrder.notes}
                  onChange={(event) => setNewOrder({ ...newOrder, notes: event.target.value })}
                  placeholder="Observacoes"
                  rows={2}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
              </div>

              <div className="mt-4 space-y-2">
                {newOrder.items.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px]">
                    <select
                      value={item.productId}
                      onChange={(event) => {
                        const nextItems = [...newOrder.items];
                        nextItems[index] = { ...nextItems[index], productId: event.target.value };
                        setNewOrder({ ...newOrder, items: nextItems });
                      }}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                    >
                      <option value="">Produto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => {
                        const nextItems = [...newOrder.items];
                        nextItems[index] = {
                          ...nextItems[index],
                          quantity: Number(event.target.value) || 1,
                        };
                        setNewOrder({ ...newOrder, items: nextItems });
                      }}
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setNewOrder({
                      ...newOrder,
                      items: [...newOrder.items, { productId: '', quantity: 1 }],
                    })
                  }
                  className="text-xs text-emerald-200"
                >
                  + Adicionar item
                </button>
              </div>

              <button
                type="button"
                onClick={handleCreateOrder}
                className="mt-4 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900"
              >
                Criar pedido e notificar
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-semibold">Pedidos e entregas</h2>
              <div className="mt-3 space-y-3">
                {orders.length === 0 && (
                  <p className="text-xs text-white/60">Nenhum pedido encontrado.</p>
                )}
                {orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Pedido {order.id}</p>
                        <p className="text-xs text-white/60">
                          Cliente: {order.lead?.name || order.lead?.phoneNumber || 'Sem cliente'}
                        </p>
                        <p className="text-xs text-white/60">Total: R$ {order.totalAmount.toFixed(2)}</p>
                      </div>
                      <div className="text-right text-xs text-white/60">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <select
                        value={order.status}
                        onChange={(event) => handleUpdateOrderStatus(order.id, event.target.value)}
                        className="rounded-xl border border-white/10 bg-slate-950/70 px-2 py-2 text-xs"
                      >
                        {orderStatusOptions.map((statusValue) => (
                          <option key={statusValue} value={statusValue}>
                            {statusValue}
                          </option>
                        ))}
                      </select>
                      <select
                        value={order.delivery?.status || 'PENDING'}
                        onChange={(event) => handleUpdateDelivery(order.id, event.target.value)}
                        className="rounded-xl border border-white/10 bg-slate-950/70 px-2 py-2 text-xs"
                      >
                        {deliveryStatusOptions.map((statusValue) => (
                          <option key={statusValue} value={statusValue}>
                            {statusValue}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
