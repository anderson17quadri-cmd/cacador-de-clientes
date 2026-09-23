'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ExternalLink,
  Globe2,
  Instagram,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  Square,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Batch {
  id: string;
  name: string;
  status: string;
  totalJobs: number;
  completedJobs: number;
  progress: number;
  totalInstagram: number;
  createdAt: string;
  activeJob?: {
    category: string;
    city: string;
    candidatesTotal?: number;
    candidatesChecked?: number;
  } | null;
}
interface Company {
  id: string;
  name: string;
  category: string;
  city?: string;
  instagram: string;
  whatsapp?: string;
  phone?: string;
  website?: string;
  hasWebsite: boolean;
  hasWhatsapp: boolean;
}

const splitList = (value: string) =>
  value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
const instagramUrl = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://instagram.com/${value.replace(/^@/, '')}`;

export default function InstagramMassPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Company[]>([]);
  const [name, setName] = useState('Instagram Portugal');
  const [categories, setCategories] = useState('barbearia\ncabeleireiro');
  const [cities, setCities] = useState('Lisboa');
  const [country, setCountry] = useState('Portugal');
  const [radius, setRadius] = useState(5000);
  const [query, setQuery] = useState('');
  const [hasWhatsapp, setHasWhatsapp] = useState(false);
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadBatches = useCallback(async () => {
    const response = await api.get('/instagram-mass');
    const data = response.data.data || [];
    setBatches(data);
    if (!selected && data[0]) setSelected(data[0].id);
  }, [selected]);
  const loadResults = useCallback(async () => {
    if (!selected) return setResults([]);
    const params: Record<string, string | number | boolean> = { limit: 500 };
    if (query) params.search = query;
    if (hasWhatsapp) params.hasWhatsapp = true;
    if (websiteFilter !== 'all') params.hasWebsite = websiteFilter === 'yes';
    const response = await api.get(`/instagram-mass/${selected}/results`, { params });
    setResults(response.data.data.data || []);
  }, [selected, query, hasWhatsapp, websiteFilter]);

  useEffect(() => {
    loadBatches().catch(() => setNotice('Não foi possível carregar as pesquisas.'));
  }, [loadBatches]);
  useEffect(() => {
    loadResults().catch(() => setNotice('Não foi possível carregar os resultados.'));
  }, [loadResults]);
  useEffect(() => {
    if (!batches.some((batch) => batch.status === 'RUNNING')) return;
    const timer = window.setInterval(() => {
      loadBatches();
      loadResults();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [batches, loadBatches, loadResults]);

  const create = async () => {
    const categoryList = splitList(categories);
    const cityList = splitList(cities);
    if (!categoryList.length || !cityList.length)
      return setNotice('Informe pelo menos uma categoria e uma cidade.');
    setBusy('create');
    setNotice('');
    try {
      const response = await api.post('/instagram-mass', {
        name,
        categories: categoryList,
        cities: cityList,
        country,
        radius,
      });
      setSelected(response.data.data.id);
      setNotice('Pesquisa Instagram adicionada à fila.');
      await loadBatches();
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'Não foi possível criar a pesquisa.');
    } finally {
      setBusy(null);
    }
  };
  const action = async (id: string, value: 'pause' | 'resume' | 'cancel') => {
    setBusy(`${value}-${id}`);
    try {
      await api.post(`/instagram-mass/${id}/${value}`);
      await loadBatches();
    } finally {
      setBusy(null);
    }
  };
  const validate = async () => {
    if (!selected) return;
    setBusy('validate');
    setNotice('');
    try {
      const response = await api.post(`/instagram-mass/${selected}/validate`);
      setNotice(`${response.data.data.total} perfis e contactos verificados.`);
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'A validação falhou.');
    } finally {
      setBusy(null);
    }
  };
  const rediscover = async () => {
    if (!selected) return;
    setBusy('rediscover');
    setNotice('');
    try {
      await api.post(`/instagram-mass/${selected}/rediscover`);
      setNotice('Descoberta ampliada iniciada. O app está procurando perfis pelo nome e cidade.');
      await loadBatches();
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'Não foi possível procurar mais perfis.');
    } finally {
      setBusy(null);
    }
  };
  const selectWhatsapp = async () => {
    if (!selected) return;
    setBusy('select');
    try {
      const params: Record<string, string | boolean> = { hasWhatsapp: true };
      if (query) params.search = query;
      if (websiteFilter !== 'all') params.hasWebsite = websiteFilter === 'yes';
      const response = await api.get(`/instagram-mass/${selected}/selection`, { params });
      localStorage.setItem('campaignLeadIds', JSON.stringify(response.data.data.ids));
      router.push('/dashboard/campaigns');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instagram em Massa</h1>
        <p className="mt-1 text-muted-foreground">
          Pesquisas separadas que mantêm somente empresas com Instagram identificado.
        </p>
      </div>
      {notice && (
        <div className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-sm">
          {notice}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Nova pesquisa em massa</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Categorias, uma por linha</label>
                <textarea
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  className="mt-1 min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cidades, uma por linha</label>
                <textarea
                  value={cities}
                  onChange={(e) => setCities(e.target.value)}
                  className="mt-1 min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">País</label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Raio</label>
                  <Input
                    type="number"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={create} disabled={busy !== null}>
                {busy === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Iniciar
                pesquisa
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => setSelected(batch.id)}
                className={`w-full rounded-xl border p-4 text-left ${selected === batch.id ? 'border-primary bg-primary/10' : 'bg-card'}`}
              >
                <div className="flex items-center justify-between">
                  <strong>{batch.name}</strong>
                  <span className="text-xs">{batch.status}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${batch.progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {batch.completedJobs}/{batch.totalJobs} buscas · {batch.totalInstagram} com
                  Instagram
                </p>
                {batch.status === 'RUNNING' && batch.activeJob?.candidatesTotal !== undefined && (
                  <p className="mt-1 text-xs text-primary">
                    {batch.activeJob.candidatesChecked || 0}/{batch.activeJob.candidatesTotal}{' '}
                    empresas verificadas em {batch.activeJob.city}
                  </p>
                )}
                <div className="mt-3 flex gap-2" onClick={(event) => event.stopPropagation()}>
                  {batch.status === 'RUNNING' && (
                    <Button size="sm" variant="outline" onClick={() => action(batch.id, 'pause')}>
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {batch.status === 'PAUSED' && (
                    <Button size="sm" variant="outline" onClick={() => action(batch.id, 'resume')}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!['COMPLETED', 'CANCELLED'].includes(batch.status) && (
                    <Button size="sm" variant="outline" onClick={() => action(batch.id, 'cancel')}>
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Resultados exclusivos</h2>
                <p className="text-sm text-muted-foreground">{results.length} empresas exibidas</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={validate} disabled={!selected || busy !== null}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Validar perfis
                </Button>
                <Button variant="outline" onClick={rediscover} disabled={!selected || busy !== null}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${busy === 'rediscover' ? 'animate-spin' : ''}`} />
                  Procurar mais perfis
                </Button>
                <Button onClick={selectWhatsapp} disabled={!selected || busy !== null}>
                  <Send className="mr-2 h-4 w-4" />
                  Todos com WhatsApp
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar empresa ou Instagram"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button
                variant={hasWhatsapp ? 'default' : 'outline'}
                onClick={() => setHasWhatsapp(!hasWhatsapp)}
              >
                Com WhatsApp
              </Button>
              <select
                className="rounded-md border bg-background px-3 text-sm"
                value={websiteFilter}
                onChange={(e) => setWebsiteFilter(e.target.value as any)}
              >
                <option value="all">Todos os sites</option>
                <option value="yes">Com site</option>
                <option value="no">Sem site</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {results.map((company) => (
                <article key={company.id} className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{company.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {company.category} · {company.city || 'Sem cidade'}
                      </p>
                    </div>
                    <Instagram className="h-5 w-5 text-pink-500" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={instagramUrl(company.instagram)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-pink-600 px-2 py-1 text-xs text-white"
                    >
                      Instagram <ExternalLink className="h-3 w-3" />
                    </a>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${company.hasWebsite ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}
                    >
                      <Globe2 className="h-3 w-3" />
                      {company.hasWebsite ? 'Com site' : 'Sem site'}
                    </span>
                    {company.hasWhatsapp && (
                      <span className="rounded-md bg-green-500/15 px-2 py-1 text-xs text-green-500">
                        WhatsApp
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!results.length && (
              <div className="py-16 text-center text-muted-foreground">
                <Instagram className="mx-auto mb-3 h-10 w-10" />
                <p>Escolha ou inicie uma pesquisa Instagram.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
