'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const load = useCallback(async () => { const response = await api.get('/notifications?limit=100'); setItems(response.data.data.data || []); }, []);
  useEffect(() => { void load(); }, [load]);
  const read = async (id: string) => { await api.patch(`/notifications/${id}/read`); await load(); };
  const readAll = async () => { await api.patch('/notifications/read-all'); await load(); };
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><h1 className="text-3xl font-bold">Notificações</h1><p className="mt-1 text-muted-foreground">Pesquisas, validações, respostas e alertas.</p></div><Button variant="outline" onClick={readAll}><CheckCheck className="mr-2 h-4 w-4" />Marcar todas como lidas</Button></div>{items.length === 0 ? <Card><CardContent className="p-12 text-center"><Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p>Nenhuma notificação.</p></CardContent></Card> : <div className="space-y-2">{items.map((item) => <button key={item.id} onClick={() => read(item.id)} className={`w-full rounded-lg border p-4 text-left ${item.read ? 'bg-card opacity-70' : 'border-primary/30 bg-primary/5'}`}><div className="flex justify-between gap-3"><strong>{item.title}</strong><span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('pt-PT')}</span></div><p className="mt-1 text-sm text-muted-foreground">{item.message}</p></button>)}</div>}</div>;
}
