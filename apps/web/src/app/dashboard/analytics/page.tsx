'use client';

import { useEffect, useState } from 'react';
import { BarChart3, MessageCircleReply, ShieldX, Trophy, Users } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const labels: Record<string, string> = { NEW: 'Novos', CONTACTED: 'Contactados', REPLIED: 'Responderam', MEETING: 'Reunião', PROPOSAL: 'Proposta', WON: 'Clientes', REJECTED: 'Encerrados' };

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/prospecting/analytics').then((response) => setData(response.data.data)); }, []);
  const metric = (group: any, key: string) => Number(group?.[key] || 0);
  const validityItems: Array<[string, string]> = [['VALID','Válidos'],['PARTIAL','Atenção'],['INVALID','Inválidos'],['UNKNOWN','Não validados']];
  const cards = [
    ['Empresas', data?.totalCompanies || 0, Users], ['Respostas', data?.replies || 0, MessageCircleReply],
    ['Taxa de resposta', `${data?.replyRate || 0}%`, BarChart3], ['Clientes', data?.won || 0, Trophy],
    ['Follow-ups vencidos', data?.followUpsDue || 0, BarChart3], ['Bloqueados', data?.blocked || 0, ShieldX],
  ] as const;
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Análises</h1><p className="mt-1 text-muted-foreground">Resultados reais do funil e das comunicações.</p></div><div className="grid gap-4 md:grid-cols-3">{cards.map(([label,value,Icon]) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><Icon className="h-7 w-7 text-primary" /></CardContent></Card>)}</div><Card><CardHeader><strong>Funil de vendas</strong></CardHeader><CardContent className="space-y-3">{Object.entries(labels).map(([key,label]) => { const value=metric(data?.byStatus,key); const max=Math.max(1,...Object.values(data?.byStatus || {}).map(Number)); return <div key={key}><div className="mb-1 flex justify-between text-sm"><span>{label}</span><strong>{value}</strong></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${Math.max(value ? 4 : 0,(value/max)*100)}%`}} /></div></div>; })}</CardContent></Card><Card><CardHeader><strong>Qualidade dos contatos</strong></CardHeader><CardContent className="grid gap-3 md:grid-cols-4">{validityItems.map(([key,label]) => <div key={key} className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{metric(data?.validity,key)}</p></div>)}</CardContent></Card></div>;
}
