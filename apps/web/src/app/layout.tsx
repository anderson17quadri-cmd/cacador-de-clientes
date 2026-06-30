import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'LeadHunter AI - Prospecção Inteligente de Clientes',
  description: 'Plataforma SaaS para prospecção de clientes com enriquecimento por IA',
  keywords: 'prospecção, leads, empresas, IA, marketing, vendas, B2B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'text-sm',
              duration: 4000,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
