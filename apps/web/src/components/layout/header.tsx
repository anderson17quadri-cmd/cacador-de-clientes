'use client';

import { useUIStore } from '@/lib/store';
import { Bell, Sun, Moon, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export function Header() {
  const { toggleSidebar, sidebarOpen } = useUIStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    api.get('/notifications/unread-count').then((response) => setUnread(response.data.data.count || 0)).catch(() => undefined);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-xl px-6">
      {!sidebarOpen && (
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg p-2 hover:bg-muted transition-colors"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <Button variant="ghost" size="icon" className="relative" onClick={() => router.push('/dashboard/notifications')}>
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">{unread > 99 ? '99+' : unread}</span>}
        </Button>
      </div>
    </header>
  );
}
