'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, Search, ShieldCheck, UserRoundCheck } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const columns = [
  ['NEW', 'Novos'], ['CONTACTED', 'Contactados'], ['REPLIED', 'Responderam'],
  ['MEETING', 'Reunião'], ['PROPOSAL', 'Proposta'], ['WON', 'Clientes'], ['REJECTED', 'Encerrados'],
] as const;

const validityLabel: Record<string, string> = { UNKNOWN: 'Não validado', VALID: 'Válido', PARTIAL: 'Atenção', INVALID: 'Inválido' };
const validityClass: Record<string, string> = { UNKNOWN: 'bg-muted text-muted-foreground', VALID: 'bg-emerald-500/10 text-emerald-500', PARTIAL: 'bg-amber-500/10 text-amber-500', INVALID: 'bg-red-500/10 text-red-500' };

export default function CrmPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const response = await api.get('/prospecting/pipeline');
    setLeads(response.data.data.leads || []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => leads.filter((lead) => `${lead.name} ${lead.category} ${lead.city}`.toLowerCase().includes(query.toLowerCase())), [leads, query]);

  const update = async (id: string, values: Record<string, any>) => {
    setBusy(id); setNotice('');
    try {
      const response = await api.patch(`/prospecting/leads/${id}`, values);
      setLeads((old) => old.map((lead) => lead.id === id ? { ...lead, crm: response.data.data } : lead));
      setSelected((old: any) => old?.id === id ? { ...old, crm: response.data.data } : old);
      setNotice('Lead atualizado.');
    } finally { setBusy(null); }
  };

  const validate = async () => {
    setBusy('validate'); setNotice('');
    try {
      const response = await api.post('/prospecting/validate', { limit: 200 });
      setNotice(`${response.data.data.total} contatos verificados.`);
      await load();
    } catch (error: any) { setNotice(error?.response?.data?.message || 'Falha na validação.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold">CRM de Prospecção</h1><p className="mt-1 text-muted-foreground">Acompanhe cada empresa desde a descoberta até se tornar cliente.</p></div>
        <Button onClick={validate} disabled={busy !== null}>{busy === 'validate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Validar contatos</Button>
      </div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar no funil..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {notice && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">{notice}</div>}
      {selected && (
        <Card>
          <CardHeader><div className="flex items-center justify-between"><strong>{selected.name}</strong><Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Fechar</Button></div></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div><label className="mb-1 block text-xs text-muted-foreground">Etapa</label><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selected.crm.status} onChange={(e) => update(selected.id, { status: e.target.value })}>{columns.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">Próximo contato</label><Input type="datetime-local" value={selected.crm.nextFollowUpAt?.slice(0, 16) || ''} onChange={(e) => update(selected.id, { nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} /></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">Base do contato</label><Input value={selected.crm.consentBasis || ''} placeholder="Ex.: contato empresarial público" onChange={(e) => setSelected({ ...selected, crm: { ...selected.crm, consentBasis: e.target.value } })} onBlur={(e) => update(selected.id, { consentBasis: e.target.value })} /></div>
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={selected.crm.doNotContact} onChange={(e) => update(selected.id, { doNotContact: e.target.checked, doNotContactReason: e.target.checked ? 'Bloqueado manualmente' : '' })} />Não contactar</label>
            <div className="md:col-span-4"><label className="mb-1 block text-xs text-muted-foreground">Notas</label><textarea className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm" value={selected.crm.notes || ''} onChange={(e) => setSelected({ ...selected, crm: { ...selected.crm, notes: e.target.value } })} onBlur={(e) => update(selected.id, { notes: e.target.value })} /></div>
          </CardContent>
        </Card>
      )}
      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[1750px] grid-cols-7 gap-3">
          {columns.map(([status, label]) => {
            const items = visible.filter((lead) => lead.crm.status === status);
            return <div key={status} className="rounded-xl border bg-muted/20 p-3"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">{label}</strong><span className="rounded-full bg-muted px-2 text-xs">{items.length}</span></div><div className="space-y-2">{items.map((lead) => <button key={lead.id} onClick={() => setSelected(lead)} className="w-full rounded-lg border bg-card p-3 text-left hover:border-primary"><div className="flex items-start justify-between gap-2"><strong className="text-sm">{lead.name}</strong>{busy === lead.id && <Loader2 className="h-3 w-3 animate-spin" />}</div><p className="mt-1 text-xs text-muted-foreground">{lead.category} · {lead.city || 'Sem cidade'}</p><div className="mt-2 flex flex-wrap gap-1"><span className={`rounded px-1.5 py-0.5 text-[10px] ${validityClass[lead.crm.validity]}`}>{validityLabel[lead.crm.validity]}</span>{lead.crm.doNotContact && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-500">bloqueado</span>}{lead.crm.nextFollowUpAt && <CalendarClock className="h-3 w-3 text-primary" />}{status === 'WON' && <UserRoundCheck className="h-3 w-3 text-emerald-500" />}</div></button>)}{!items.length && <p className="py-8 text-center text-xs text-muted-foreground">Nenhum lead</p>}</div></div>;
          })}
        </div>
      </div>
    </div>
  );
}
