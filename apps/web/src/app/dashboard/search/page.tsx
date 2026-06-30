'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Search, MapPin, Building2, Target, Play, Loader2,
  Globe, Phone, Star, Instagram, Mail, Filter,
  AlertCircle, CheckCircle2, Clock, ExternalLink, Map,
} from 'lucide-react';
import { useSearchStore } from '@/lib/store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber, getScoreColor, BUSINESS_CATEGORIES, SEARCH_RADIUS_OPTIONS } from '@leadhunter/utils';
import type { EnrichedCompany } from '@leadhunter/types';

const LeadsMap = dynamic(() => import('@/components/map/leads-map'), { ssr: false });

const searchSchema = z.object({
  category: z.string().min(1, 'Selecione uma categoria'),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional().default('Brasil'),
  radius: z.number().min(1000).max(100000).default(5000),
});

type SearchForm = z.infer<typeof searchSchema>;

export default function SearchPage() {
  const router = useRouter();
  const { currentSearch, searchProgress, searchLogs, setCurrentSearch, setSearchProgress, addSearchLog, clearSearch } = useSearchStore();
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [results, setResults] = useState<EnrichedCompany[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: { category: '', city: '', state: '', country: 'Brasil', radius: 5000 },
  });

  const selectedCategory = watch('category');
  const selectedRadius = watch('radius');

  const cancelSearch = useCallback(async () => {
    if (!currentSearch?.id) return;
    setCancelling(true);
    try {
      await api.post(`/search/${currentSearch.id}/cancel`);
      if (pollInterval) clearInterval(pollInterval);
      setLoading(false);
      toast.success('Pesquisa cancelada');
    } catch {
      // force stop polling anyway
      if (pollInterval) clearInterval(pollInterval);
      setLoading(false);
    } finally {
      setCancelling(false);
    }
  }, [currentSearch, pollInterval]);

  const fetchResults = useCallback(async (searchId: string) => {
    try {
      const res = await api.get(`/search/${searchId}/results?page=1&limit=50`);
      const data = res.data.data;
      setResults(Array.isArray(data.data) ? data.data : []);
      setShowResults(true);
    } catch {
      toast.error('Erro ao carregar resultados');
    }
  }, []);

  const onSubmit = useCallback(async (data: SearchForm) => {
    if (pollInterval) clearInterval(pollInterval);
    setLoading(true);
    setShowResults(false);
    setResults([]);
    clearSearch();

    try {
      const res = await api.post('/search', data);
      const search = res.data.data;
      setCurrentSearch(search);
      toast.success('Pesquisa iniciada!');

      const interval = setInterval(async () => {
        try {
          const progressRes = await api.get(`/search/${search.id}/progress`);
          const progress = progressRes.data.data;
          setSearchProgress(progress);

          const logsRes = await api.get(`/search/${search.id}/logs?limit=20`);
          const logs = logsRes.data.data;
          logs.forEach((log: any) => addSearchLog(log));

          if (progress.status === 'COMPLETED') {
            clearInterval(interval);
            setPollInterval(null);
            setLoading(false);
            toast.success(`Pesquisa concluída! ${progress.totalFound} empresas encontradas.`);
            fetchResults(search.id);
          } else if (progress.status === 'FAILED') {
            clearInterval(interval);
            setPollInterval(null);
            setLoading(false);
            toast.error('Pesquisa falhou. Tente novamente.');
          } else if (progress.status === 'CANCELLED') {
            clearInterval(interval);
            setPollInterval(null);
            setLoading(false);
          }
        } catch {
          clearInterval(interval);
          setPollInterval(null);
          setLoading(false);
        }
      }, 3000);

      setPollInterval(interval);
    } catch (err: any) {
      toast.error(err.response?.data?.message?.[0] || 'Erro ao iniciar pesquisa');
      setLoading(false);
    }
  }, [pollInterval, clearSearch, setCurrentSearch, setSearchProgress, addSearchLog, fetchResults]);

  const isRunning = searchProgress?.status === 'RUNNING' || searchProgress?.status === 'PENDING';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nova Pesquisa</h1>
        <p className="text-muted-foreground mt-1">Encontre empresas por categoria e localização</p>
      </div>

      <Card className="overflow-hidden border-2 border-primary/20">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  Categoria
                </label>
                <select
                  {...register('category')}
                  disabled={loading}
                  className={cn(
                    'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                    errors.category ? 'border-destructive' : 'border-input',
                  )}
                >
                  <option value="">Selecione uma categoria...</option>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                {errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  Cidade
                </label>
                <Input {...register('city')} placeholder="Ex: São Paulo" disabled={loading} />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5">Estado (UF)</label>
                <Input {...register('state')} placeholder="Ex: SP" maxLength={2} disabled={loading} />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5">País</label>
                <Input {...register('country')} placeholder="Brasil" defaultValue="Brasil" disabled={loading} />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-primary" />
                  Raio da busca: {selectedRadius ? `${selectedRadius / 1000} km` : '5 km'}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {SEARCH_RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={loading}
                      onClick={() => setValue('radius', opt.value)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                        selectedRadius === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 text-muted-foreground',
                      )}
                    >
                      {opt.value / 1000} km
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" size="lg" disabled={loading || !selectedCategory} className="shadow-lg shadow-primary/25">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Pesquisando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Pesquisa
                  </>
                )}
              </Button>
              {loading && (
                <Button type="button" variant="outline" size="lg" onClick={cancelSearch} disabled={cancelling}>
                  {cancelling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    'Cancelar'
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <AnimatePresence>
        {isRunning && searchProgress && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <h3 className="font-semibold">Pesquisando...</h3>
                  </div>
                  <Badge variant="secondary">
                    {searchProgress.totalFound || 0} empresas encontradas
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{searchProgress.progress || 0}%</span>
                  </div>
                  <Progress value={searchProgress.progress || 0} className="h-2" />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
                  {searchLogs.slice(0, 15).map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {log.level === 'error' ? (
                        <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                      ) : log.level === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                      ) : (
                        <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="text-muted-foreground">
                          {log.source && `[${log.source}] `}
                        </span>
                        {log.message}
                      </div>
                    </div>
                  ))}
                  {searchLogs.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aguardando logs...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResults && results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Resultados ({formatNumber(results.length)})
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/exports')}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Exportar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>

            {results.some((c) => c.latitude && c.longitude) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mt-4 mb-2">
                  <Map className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Mapa</h3>
                </div>
                <LeadsMap
                  companies={results
                    .filter((c) => c.latitude && c.longitude)
                    .map((c) => ({
                      id: c.id,
                      name: c.name,
                      latitude: c.latitude!,
                      longitude: c.longitude!,
                      rating: c.rating,
                      googleMapsLink: c.googleMapsLink,
                      category: c.category,
                    }))}
                  height="400px"
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResults && results.length === 0 && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum resultado encontrado</h3>
                <p className="text-muted-foreground">Tente ajustar os filtros ou aumentar o raio de busca</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompanyCard({ company }: { company: EnrichedCompany }) {
  const score = company.enrichedData?.qualityScore || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="group"
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 hover:border-primary/50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{company.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {company.city && `${company.city}${company.state ? `, ${company.state}` : ''}`}
              </p>
            </div>
            {score > 0 && (
              <div className={cn('shrink-0 ml-2 px-2 py-1 rounded-full text-xs font-bold', getScoreColor(score), 'text-white')}>
                {score}
              </div>
            )}
          </div>

          {company.rating && (
            <div className="flex items-center gap-1 mb-2">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span className="text-sm font-medium">{company.rating}</span>
              {company.totalRatings && (
                <span className="text-xs text-muted-foreground">({company.totalRatings})</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3">
            {company.hasWebsite && (
              <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                <Globe className="h-3 w-3" /> Site
              </span>
            )}
            {company.hasInstagram && (
              <span className="inline-flex items-center gap-0.5 text-xs text-pink-600 bg-pink-50 dark:bg-pink-950 px-1.5 py-0.5 rounded">
                <Instagram className="h-3 w-3" /> IG
              </span>
            )}
            {company.hasWhatsapp && (
              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 bg-green-50 dark:bg-green-950 px-1.5 py-0.5 rounded">
                <Phone className="h-3 w-3" /> WhatsApp
              </span>
            )}
            {company.hasEmail && (
              <span className="inline-flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                <Mail className="h-3 w-3" /> Email
              </span>
            )}
          </div>

          {company.enrichedData?.analysisText && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
              {company.enrichedData.analysisText}
            </p>
          )}

          <div className="flex items-center gap-2">
            {company.phone && (
              <a
                href={`tel:${company.phone}`}
                className="flex-1 text-center text-xs font-medium py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Ligar
              </a>
            )}
            {company.whatsapp && (
              <a
                href={`https://wa.me/${company.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs font-medium py-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
              >
                WhatsApp
              </a>
            )}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs font-medium py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                Site
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
