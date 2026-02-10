'use client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-whatsapp text-white p-4 shadow-lg">
        <h2 className="text-xl font-bold mb-6">WhatsApp CRM</h2>
        <nav className="space-y-2">
          <a href="/dashboard" className="block px-4 py-2 rounded hover:bg-whatsapp-dark">
            📊 Dashboard
          </a>
          <a href="/dashboard/conversas" className="block px-4 py-2 rounded hover:bg-whatsapp-dark">
            💬 Conversas
          </a>
          <a href="/dashboard/leads" className="block px-4 py-2 rounded hover:bg-whatsapp-dark">
            👥 Leads
          </a>
          <a href="/dashboard/disparos" className="block px-4 py-2 rounded hover:bg-whatsapp-dark">
            📢 Disparos
          </a>
          <a href="/dashboard/whatsapp" className="block px-4 py-2 rounded hover:bg-whatsapp-dark">
            📱 WhatsApp
          </a>
          <a href="/dashboard/configuracoes" className="block px-4 py-2 rounded hover:bg-whatsapp-dark">
            ⚙️ Configurações
          </a>
          <a href="/dashboard/admin" className="block px-4 py-2 rounded hover:bg-whatsapp-dark">
            👨‍💼 Admin
          </a>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
