import './globals.css';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';
const AuthShell = dynamic(() => import('@/components/AuthShell'), { ssr: false });

export const metadata: Metadata = {
  title: 'WhatsApp CRM',
  description: 'Plataforma de CRM integrada com WhatsApp',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <AuthShell>{children}</AuthShell>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
