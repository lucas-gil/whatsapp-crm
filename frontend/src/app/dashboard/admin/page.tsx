'use client';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Painel Admin</h1>
        <p className="text-gray-500 mb-8">Gerencie usuários, licenças e estatísticas do sistema</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Usuários */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-500 text-sm mb-2">Usuários Ativos</p>
            <p className="text-3xl font-bold text-blue-600">-</p>
            <p className="text-xs text-gray-500 mt-2">Gerenciando acesso de usuários</p>
          </div>

          {/* Licenças */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-500 text-sm mb-2">Licenças Ativas</p>
            <p className="text-3xl font-bold text-green-600">-</p>
            <p className="text-xs text-gray-500 mt-2">Controle de chaves de acesso</p>
          </div>

          {/* Sistemas */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-gray-500 text-sm mb-2">Status do Sistema</p>
            <p className="text-3xl font-bold text-green-600">🟢 Online</p>
            <p className="text-xs text-gray-500 mt-2">Todos os serviços operacionais</p>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">⚙️ Funções Administrativas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="p-4 border border-gray-300 rounded hover:bg-gray-50 text-left">
              <p className="font-semibold text-gray-900">📋 Gerenciar Usuários</p>
              <p className="text-sm text-gray-500 mt-1">Criar, editar ou remover usuários</p>
            </button>
            <button className="p-4 border border-gray-300 rounded hover:bg-gray-50 text-left">
              <p className="font-semibold text-gray-900">🔑 Gerenciar Licenças</p>
              <p className="text-sm text-gray-500 mt-1">Gerar e revogar chaves de acesso</p>
            </button>
            <button className="p-4 border border-gray-300 rounded hover:bg-gray-50 text-left">
              <p className="font-semibold text-gray-900">📊 Auditoria</p>
              <p className="text-sm text-gray-500 mt-1">Ver logs de ações do sistema</p>
            </button>
            <button className="p-4 border border-gray-300 rounded hover:bg-gray-50 text-left">
              <p className="font-semibold text-gray-900">🔒 Segurança</p>
              <p className="text-sm text-gray-500 mt-1">Configurar políticas de segurança</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
