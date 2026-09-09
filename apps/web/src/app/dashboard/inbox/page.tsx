'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, MessageCircle, RefreshCw, ShieldX } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function InboxPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('whatsapp');
  const [loading, setLoading] = useState(true);
  const filterOptions: Array<[string, string]> = [['whatsapp','WhatsApp'],['email','E-mail'],['all','Todos']];
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await api.get('/prospecting/events', { params: filter === 'all' ? {} : { channel: filter } }); setEvents(response.data.data || []); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);
  const block = async (event: any) => { await api.patch(`/prospecting/leads/${event.companyId}`, { doNotContact: true, doNotContactReason: 'Bloqueado na caixa de entrada' }); await load(); };
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><h1 className="text-3xl font-bold">Central de Contatos</h1><p className="mt-1 text-muted-foreground">Envios, respostas e estados do WhatsApp e e-mail.</p></div><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button></div><div className="flex gap-2">{filterOptions.map(([value,label]) => <Button key={value} variant={filter === value ? 'default' : 'outline'} size="sm" onClick={() => setFilter(value)}>{label}</Button>)}</div><div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Respostas automáticas exigem um webhook público configurado na WhatsApp Cloud API. Os envios e simulações locais aparecem aqui imediatamente.</div>{loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : events.length === 0 ? <Card><CardContent className="p-12 text-center"><Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><strong>Nenhuma conversa ainda</strong><p className="mt-1 text-sm text-muted-foreground">Crie uma campanha em simulação para testar o histórico.</p></CardContent></Card> : <div className="space-y-2">{events.map((event) => <Card key={event.id}><CardContent className="flex items-start gap-3 p-4"><div className={`rounded-lg p-2 ${event.direction === 'inbound' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}><MessageCircle className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{event.companyName}</strong><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{event.direction === 'inbound' ? 'Recebida' : 'Enviada'} · {event.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{event.content}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString('pt-PT')}</p></div><Button variant="ghost" size="sm" onClick={() => block(event)} title="Não contactar"><ShieldX className="h-4 w-4 text-red-500" /></Button></CardContent></Card>)}</div>}</div>;
}
