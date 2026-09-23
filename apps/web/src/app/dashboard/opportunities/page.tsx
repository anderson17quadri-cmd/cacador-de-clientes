'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, CheckSquare, Download, Globe2, Instagram, Loader2, Map,
  MapPin, MessageCircle, Search, Sparkles, Target, WandSparkles,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const LeadsMap = dynamic(() => import('@/components/map/leads-map'), { ssr: false });

interface Opportunity { score: number; priority: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[]; recommendedAction: string }
interface WebsiteAudit { status: string; score: number; findings: string[]; checkedAt: string }
interface Lead {
  id: string; name: string; category: string; city?: string; latitude?: number; longitude?: number;
  rating?: number; googleMapsLink?: string; website?: string; instagram?: string; whatsapp?: string; phone?: string; email?: string;
  hasWebsite: boolean; hasInstagram: boolean; hasWhatsapp: boolean;
  opportunity: Opportunity; crm: { status: string; doNotContact: boolean; websiteAudit?: WebsiteAudit };
}

function instagramUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, '')}`;
}

export default function OpportunitiesPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'high' | 'no-site' | 'contact'>('high');
  const [showMap, setShowMap] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { const response = await api.get('/prospecting/pipeline'); setLeads(response.data.data.leads || []); }
    catch { setNotice('Não foi possível carregar as oportunidades.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => leads.filter((lead) => {
    const text = `${lead.name} ${lead.category} ${lead.city || ''}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (filter === 'high' && lead.opportunity.priority !== 'HIGH') return false;
    if (filter === 'no-site' && lead.hasWebsite) return false;
    if (filter === 'contact' && !(lead.whatsapp || lead.phone || lead.email)) return false;
    return !lead.crm.doNotContact;
  }), [leads, query, filter]);

  const toggle = (id: string) => setSelected((old) => {
    const next = new Set(old);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleVisible = () => setSelected((old) => {
    const next = new Set(old); const all = visible.length > 0 && visible.every((lead) => next.has(lead.id));
    visible.forEach((lead) => all ? next.delete(lead.id) : next.add(lead.id)); return next;
  });
  const audit = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy('audit'); setNotice('');
    try {
      const response = await api.post('/prospecting/audit-websites', { companyIds: ids });
      setNotice(`${response.data.data.total} empresas auditadas. As oportunidades foram recalculadas.`);
      await load();
    } catch (error: any) { setNotice(error?.response?.data?.message || 'A auditoria falhou.'); }
    finally { setBusy(null); }
  };
  const preparePack = async (lead: Lead) => {
    setBusy(`pack-${lead.id}`); setNotice('');
    try {
      const response = await api.post(`/prospecting/commercial-pack/${lead.id}`);
      const pack = response.data.data;
      if (pack.siteProject?.id) {
        localStorage.setItem('siteStudioProjectId', pack.siteProject.id);
        localStorage.setItem('siteStudioCompanyId', lead.id);
      }
      setNotice(`Pacote de ${lead.name} preparado: auditoria, mensagem e demonstração prontas para revisão.`);
      await load();
    } catch (error: any) { setNotice(error?.response?.data?.message || 'Não foi possível preparar o pacote.'); }
    finally { setBusy(null); }
  };
  const downloadPdf = async (lead: Lead) => {
    setBusy(`pdf-${lead.id}`);
    try {
      const response = await api.get(`/prospecting/commercial-pack/${lead.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const link = document.createElement('a');
      link.href = url; link.download = `proposta-${lead.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch { setNotice('Não foi possível gerar o PDF.'); }
    finally { setBusy(null); }
  };
  const campaign = () => {
    const ids = [...selected].filter((id) => { const lead = leads.find((item) => item.id === id); return lead?.whatsapp || lead?.phone; });
    if (!ids.length) return setNotice('Selecione empresas com telefone ou WhatsApp.');
    localStorage.setItem('campaignLeadIds', JSON.stringify(ids)); router.push('/dashboard/campaigns?channel=whatsapp');
  };

  const high = leads.filter((lead) => lead.opportunity.priority === 'HIGH' && !lead.crm.doNotContact).length;
  const noSite = leads.filter((lead) => !lead.hasWebsite && !lead.crm.doNotContact).length;
  const withContact = leads.filter((lead) => (lead.whatsapp || lead.phone || lead.email) && !lead.crm.doNotContact).length;

  return <div className="mx-auto max-w-7xl space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Oportunidades</h1><p className="mt-1 text-muted-foreground">Escolha os melhores clientes e prepare tudo antes de contactar.</p></div>
    <div className="grid gap-3 md:grid-cols-4">
      {[['1', 'Encontrar', 'Pesquisar empresas'], ['2', 'Qualificar', 'Priorizar e auditar'], ['3', 'Preparar', 'Site, mensagem e PDF'], ['4', 'Acompanhar', 'CRM e respostas']].map(([number, title, text]) => <Card key={number}><CardContent className="flex items-center gap-3 p-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{number}</span><div><strong className="text-sm">{title}</strong><p className="text-xs text-muted-foreground">{text}</p></div></CardContent></Card>)}
    </div>
    {notice && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">{notice}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Alta prioridade</p><strong className="text-2xl">{high}</strong></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sem site</p><strong className="text-2xl">{noSite}</strong></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Com contacto público</p><strong className="text-2xl">{withContact}</strong></CardContent></Card>
    </div>
    <Card><CardContent className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Nome, categoria ou cidade" value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        {[['high','Melhores'],['no-site','Sem site'],['contact','Com contacto'],['all','Todos']].map(([value,label]) => <Button key={value} size="sm" variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value as typeof filter)}>{label}</Button>)}
        <Button size="sm" variant="outline" onClick={() => setShowMap(!showMap)}><Map className="mr-2 h-4 w-4"/>{showMap ? 'Ocultar mapa' : 'Ver mapa'}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={toggleVisible}><CheckSquare className="mr-2 h-4 w-4"/>Selecionar visíveis</Button>
        <span className="text-sm text-muted-foreground">{selected.size} selecionadas</span>
        <Button size="sm" variant="outline" disabled={!selected.size || busy !== null} onClick={() => audit([...selected])}>{busy === 'audit' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BarChart3 className="mr-2 h-4 w-4"/>}Auditar sites</Button>
        <Button size="sm" disabled={!selected.size || busy !== null} onClick={campaign}><MessageCircle className="mr-2 h-4 w-4"/>Preparar campanha</Button>
      </div>
    </CardContent></Card>
    {showMap && <Card><CardContent className="p-3"><LeadsMap companies={visible.filter((lead) => lead.latitude && lead.longitude).slice(0, 300).map((lead) => ({ id: lead.id, name: lead.name, latitude: lead.latitude!, longitude: lead.longitude!, rating: lead.rating, googleMapsLink: lead.googleMapsLink, category: lead.category }))} height="420px"/></CardContent></Card>}
    {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> : <div className="grid gap-3 lg:grid-cols-2">
      {visible.map((lead) => <Card key={lead.id} className="overflow-hidden"><CardContent className="p-5">
        <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)}/><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><strong className="truncate">{lead.name}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${lead.opportunity.priority === 'HIGH' ? 'bg-emerald-500/15 text-emerald-600' : lead.opportunity.priority === 'MEDIUM' ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'}`}>{lead.opportunity.score}/100</span></div>
          <p className="mt-1 text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3"/>{lead.category} · {lead.city || 'Sem cidade'}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{lead.opportunity.reasons.slice(0,3).map((reason) => <span key={reason} className="rounded-md bg-muted px-2 py-1 text-xs">{reason}</span>)}</div>
          <p className="mt-3 text-sm font-medium text-primary"><Target className="mr-1 inline h-4 w-4"/>{lead.opportunity.recommendedAction}</p>
          {lead.crm.websiteAudit && <div className="mt-3 rounded-lg border p-2 text-xs"><strong>Site: {lead.crm.websiteAudit.score}/100</strong><span className="ml-2 text-muted-foreground">{lead.crm.websiteAudit.findings.slice(0,2).join(' · ')}</span></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => audit([lead.id])}><Globe2 className="mr-2 h-3.5 w-3.5"/>Auditar</Button>
            <Button size="sm" disabled={busy !== null} onClick={() => preparePack(lead)}>{busy === `pack-${lead.id}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Sparkles className="mr-2 h-3.5 w-3.5"/>}Preparar pacote</Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => downloadPdf(lead)}>{busy === `pdf-${lead.id}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : <Download className="mr-2 h-3.5 w-3.5"/>}PDF</Button>
            {lead.instagram && <a href={instagramUrl(lead.instagram)} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><Instagram className="h-4 w-4"/></Button></a>}
          </div>
        </div></div>
      </CardContent></Card>)}
      {!visible.length && <Card className="lg:col-span-2"><CardContent className="p-12 text-center text-muted-foreground">Nenhuma oportunidade corresponde aos filtros.</CardContent></Card>}
    </div>}
    <Card><CardHeader><strong>Ferramentas do fluxo</strong></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => router.push('/dashboard/crm')}>Abrir CRM</Button><Button variant="outline" onClick={() => router.push('/dashboard/site-studio')}><WandSparkles className="mr-2 h-4 w-4"/>Estúdio IA</Button><Button variant="outline" onClick={() => router.push('/dashboard/campaigns')}>Campanhas</Button><Button variant="outline" onClick={() => router.push('/dashboard/inbox')}>Respostas</Button></CardContent></Card>
  </div>;
}
