'use client';

import Link from 'next/link';

export default function DisparoNovoPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Envio 1:1</h1>
          <Link
            href="/dashboard/disparos"
            className="text-sm text-whatsapp hover:text-whatsapp-dark"
          >
            Voltar para Disparos
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600">
            Configure aqui o envio individual. Selecione contatos, escreva a mensagem e dispare.
          </p>
        </div>
      </div>
    </div>
  );
}
