'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useUIStore } from '@/lib/store';
import api from '@/lib/api';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setAuth } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    const openSession = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken') || '';
        if (accessToken) {
          const response = await api.get('/auth/me');
          if (active) setAuth(response.data.data, accessToken, refreshToken);
        } else {
          const response = await api.post('/auth/local');
          const data = response.data.data;
          if (active) setAuth(data.user, data.accessToken, data.refreshToken);
        }
      } catch {
        if (active) router.replace('/auth/login');
      } finally {
        if (active) setInitializing(false);
      }
    };
    void openSession();
    return () => { active = false; };
  }, [router, setAuth]);

  if (initializing || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Abrindo o LeadHunter...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn('transition-all duration-300', sidebarOpen ? 'lg:pl-64' : 'lg:pl-0')}>
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
