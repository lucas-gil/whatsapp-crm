'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  unitPrice?: number | null;
  productType?: 'PHYSICAL' | 'DIGITAL';
  digitalUrl?: string | null;
  description?: string | null;
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

type WhatsAppContact = {
  id: string;
  name?: string | null;
  phoneNumber?: string | null;
  jid?: string | null;
};

type WhatsAppGroup = {
  id: string;
  name: string;
  participantCount: number;
  whatsappGroupId?: string | null;
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
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  const api = apiBase
    ? apiBase.replace(/\/$/, '')
    : typeof window !== 'undefined'
      ? `${window.location.origin}/api`
      : 'http://localhost:3000';
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [waTab, setWaTab] = useState<'contatos' | 'grupos'>('contatos');
  const [waSearch, setWaSearch] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    description: '',
    productType: 'PHYSICAL',
    digitalUrl: '',
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
    sendMessage: true,
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
      const [productsRes, inventoryRes, ordersRes, leadsRes, contactsRes, groupsRes] = await Promise.all([
        fetch(`${api}/crm/products`, { headers }),
        fetch(`${api}/crm/inventory`, { headers }),
        fetch(`${api}/crm/orders`, { headers }),
        fetch(`${api}/crm/leads`, { headers }),
        fetch(`${api}/whatsapp/contacts`, { headers }),
        fetch(`${api}/whatsapp/groups`, { headers }),
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
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        setContacts(Array.isArray(data) ? data : []);
      }
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setGroups(Array.isArray(data) ? data : []);
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

  const filteredContacts = useMemo(() => {
    const search = waSearch.trim().toLowerCase();
    if (!search) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.phoneNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search),
    );
  }, [contacts, waSearch]);

  const filteredGroups = useMemo(() => {
    const search = waSearch.trim().toLowerCase();
    if (!search) return groups;
    return groups.filter((group) =>
      String(group.name || '').toLowerCase().includes(search),
    );
  }, [groups, waSearch]);

  const handleCreateProduct = async () => {
    if (!token || !newProduct.name.trim()) return;
    setStatus('');
    try {
      const response = await fetch(`${api}/crm/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProduct.name,
          sku: newProduct.sku || null,
          description: newProduct.description || null,
          productType: newProduct.productType,
          digitalUrl: newProduct.digitalUrl || null,
          unitPrice: Number(newProduct.unitPrice) || 0,
          initialStock:
            newProduct.productType === 'PHYSICAL'
              ? Number(newProduct.initialStock) || 0
              : 0,
          minStock:
            newProduct.productType === 'PHYSICAL'
              ? Number(newProduct.minStock) || 0
              : 0,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar produto');
      }

      setNewProduct({
        name: '',
        sku: '',
        description: '',
        productType: 'PHYSICAL',
        digitalUrl: '',
        unitPrice: '',
        initialStock: '',
        minStock: '',
      });
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
      const response = await fetch(`${api}/crm/inventory/adjust`, {
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
    // Validação extra: todos os itens devem ter productId preenchido e quantity > 0
    const invalidItem = newOrder.items.find(
      (item) => !item.productId || !item.quantity || item.quantity <= 0
    );
    if (invalidItem) {
      setStatus('Preencha todos os itens do pedido corretamente (produto e quantidade > 0)');
      return;
    }
    setStatus('');
    try {
      const response = await fetch(`${api}/crm/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadId: newOrder.leadId || null,
          phoneNumber: newOrder.phoneNumber || null,
          notes: newOrder.notes || null,
          sendMessage: newOrder.sendMessage !== false,
          items: newOrder.items,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao criar pedido');
      }

      setNewOrder({
        leadId: '',
        phoneNumber: '',
        notes: '',
        sendMessage: true,
        items: [{ productId: '', quantity: 1 }],
      });
      await loadData();
      setStatus('Pedido criado');
    } catch (err) {
      setStatus('Erro ao criar pedido');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!token) return;
    const confirmed = window.confirm('Remover este produto? Isso apaga itens e movimentos ligados.');
    if (!confirmed) return;
    setStatus('');
    try {
      const response = await fetch(`${api}/crm/products/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao remover produto');
      }

      await loadData();
      setStatus('Produto removido');
    } catch (err) {
      setStatus('Erro ao remover produto');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, statusValue: string) => {
    if (!token) return;
    try {
      await fetch(`${api}/crm/orders/${orderId}/status`, {
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
      await fetch(`${api}/crm/orders/${orderId}/delivery`, {
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
                  const isDigital = product.productType === 'DIGITAL';
                  return (
                    <div
                      key={product.id}
                      className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-xs text-white/60">SKU: {product.sku || 'sem SKU'}</p>
                          <p className="text-xs text-white/50">
                            {isDigital ? 'Produto digital' : 'Produto fisico'}
                          </p>
                        </div>
                        <div className="text-right text-xs text-emerald-200">
                          {isDigital ? (
                            <p>Entrega: link digital</p>
                          ) : (
                            <>
                              <p>Estoque: {quantity}</p>
                              <p>Minimo: {minStock}</p>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="mt-2 text-xs text-rose-200 hover:text-rose-100"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      {isDigital && product.digitalUrl && (
                        <p className="mt-2 text-xs text-emerald-100/80 break-all">
                          Link: {product.digitalUrl}
                        </p>
                      )}
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
                <select
                  value={newProduct.productType}
                  onChange={(event) =>
                    setNewProduct({ ...newProduct, productType: event.target.value })
                  }
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                >
                  <option value="PHYSICAL">Produto fisico</option>
                  <option value="DIGITAL">Produto digital</option>
                </select>
                <input
                  value={newProduct.description}
                  onChange={(event) =>
                    setNewProduct({ ...newProduct, description: event.target.value })
                  }
                  placeholder="Descricao"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                <input
                  value={newProduct.unitPrice}
                  onChange={(event) => setNewProduct({ ...newProduct, unitPrice: event.target.value })}
                  placeholder="Preco"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                />
                {newProduct.productType === 'PHYSICAL' ? (
                  <>
                    <input
                      value={newProduct.initialStock}
                      onChange={(event) =>
                        setNewProduct({ ...newProduct, initialStock: event.target.value })
                      }
                      placeholder="Estoque inicial"
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                    />
                    <input
                      value={newProduct.minStock}
                      onChange={(event) =>
                        setNewProduct({ ...newProduct, minStock: event.target.value })
                      }
                      placeholder="Estoque minimo"
                      className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                    />
                  </>
                ) : (
                  <input
                    value={newProduct.digitalUrl}
                    onChange={(event) =>
                      setNewProduct({ ...newProduct, digitalUrl: event.target.value })
                    }
                    placeholder="Link do produto digital"
                    className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
                  />
                )}
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
                  {products
                    .filter((product) => product.productType !== 'DIGITAL')
                    .map((product) => (
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
              <h2 className="text-sm font-semibold">WhatsApp conectado</h2>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setWaTab('contatos')}
                  className={`rounded-full px-3 py-1 border ${
                    waTab === 'contatos'
                      ? 'border-emerald-400 text-emerald-200'
                      : 'border-white/10 text-white/60'
                  }`}
                >
                  Contatos
                </button>
                <button
                  type="button"
                  onClick={() => setWaTab('grupos')}
                  className={`rounded-full px-3 py-1 border ${
                    waTab === 'grupos'
                      ? 'border-emerald-400 text-emerald-200'
                      : 'border-white/10 text-white/60'
                  }`}
                >
                  Grupos
                </button>
              </div>
              <input
                value={waSearch}
                onChange={(event) => setWaSearch(event.target.value)}
                placeholder="Buscar no WhatsApp"
                className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm"
              />
              <div className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">
                {waTab === 'contatos' && (
                  <>
                    {filteredContacts.length === 0 && (
                      <p className="text-white/50">Nenhum contato encontrado.</p>
                    )}
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() =>
                          setNewOrder({
                            ...newOrder,
                            phoneNumber: contact.phoneNumber || '',
                            leadId: '',
                            sendMessage: true,
                          })
                        }
                        className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-left"
                      >
                        <p className="text-white">
                          {contact.name || contact.phoneNumber || 'Sem nome'}
                        </p>
                        <p className="text-white/60">{contact.phoneNumber || 'Sem numero'}</p>
                      </button>
                    ))}
                  </>
                )}
                {waTab === 'grupos' && (
                  <>
                    {filteredGroups.length === 0 && (
                      <p className="text-white/50">Nenhum grupo encontrado.</p>
                    )}
                    {filteredGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() =>
                          setNewOrder({
                            ...newOrder,
                            phoneNumber: '',
                            leadId: '',
                            sendMessage: false,
                            notes: `Pedido vinculado ao grupo: ${group.name}`,
                          })
                        }
                        className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-left"
                      >
                        <p className="text-white">{group.name}</p>
                        <p className="text-white/60">
                          {group.participantCount} participantes
                        </p>
                      </button>
                    ))}
                  </>
                )}
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                Se voce selecionar um grupo, a notificacao automatica fica desativada.
              </p>
            </div>

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
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={newOrder.sendMessage}
                    onChange={(event) =>
                      setNewOrder({ ...newOrder, sendMessage: event.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  Enviar mensagem automatica no WhatsApp
                </label>
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
