'use client';

export default function DisparosPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Disparos</h1>
        <p className="text-gray-500 mb-8">Envie mensagens em massa para seus contatos</p>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center">
              <p className="text-2xl mb-2">📬</p>
              <h3 className="font-bold text-gray-900 mb-2">Novo Disparo</h3>
              <p className="text-gray-500 text-sm mb-4">Envie mensagens para múltiplos contatos</p>
              <button className="px-4 py-2 bg-whatsapp text-white rounded hover:bg-whatsapp-dark">
                Criar Disparo
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center">
              <p className="text-2xl mb-2">📋</p>
              <h3 className="font-bold text-gray-900 mb-2">Histórico</h3>
              <p className="text-gray-500 text-sm mb-4">Ver disparos anteriores</p>
              <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                Ver Histórico
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
