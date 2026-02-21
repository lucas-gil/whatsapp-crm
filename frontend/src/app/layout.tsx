import './globals.css';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/hooks/useAuth';

const AuthGate = dynamic(() => import('@/components/AuthGate'), { ssr: false });

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
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
