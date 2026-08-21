'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, Star, Download,
  Globe, Instagram, Phone, Mail, MapPin,
  Loader2, SlidersHorizontal, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useSearchStore } from '@/lib/store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, getScoreColor, formatDate } from '@leadhunter/utils';
import type { EnrichedCompany } from '@leadhunter/types';

interface Filters {
  hasWebsite?: boolean;
  hasInstagram?: boolean;
  hasWhatsapp?: boolean;
  hasEmail?: boolean;
  category?: string;
  minScore?: number;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<EnrichedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<EnrichedCompany | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, [page, filters, search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (search) params.search = search;
      if (filters.hasWebsite) params.hasWebsite = true;
      if (filters.hasInstagram) params.hasInstagram = true;
      if (filters.hasWhatsapp) params.hasWhatsapp = true;
      if (filters.hasEmail) params.hasEmail = true;
      if (filters.category) params.category = filters.category;
      if (filters.minScore) params.minScore = filters.minScore;

      const res = await api.get('/companies', { params });
      const data = res.data.data;
      setLeads(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters, search]);

  const toggleFilter = useCallback((key: keyof Filters, value: any) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (next[key] === value) {
        delete next[key];
      } else {
        (next as any)[key] = value;
      }
      return next;
    });
    setPage(1);
  }, []);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
    setSelectedLead(null);
  }, [searchInput]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params: Record<string, any> = { format: 'CSV' };
      if (search) params.search = search;
      if (filters.hasWebsite) params.hasWebsite = true;
      if (filters.hasInstagram) params.hasInstagram = true;
      if (filters.hasWhatsapp) params.hasWhatsapp = true;
      if (filters.hasEmail) params.hasEmail = true;
      if (filters.category) params.category = filters.category;

      await api.post('/exports', params);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }, [search, filters]);

  const quickFilters = [
    { key: 'hasWebsite' as const, label: 'Tem Site', icon: Globe },
    { key: 'hasInstagram' as const, label: 'Instagram', icon: Instagram },
    { key: 'hasWhatsapp' as const, label: 'WhatsApp', icon: Phone },
    { key: 'hasEmail' as const, label: 'Email', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus leads encontrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button onClick={handleExport} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Exportar
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, categoria..."
            className="pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" onClick={handleSearch}>Buscar</Button>

        <div className="flex flex-wrap gap-2">
          {quickFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key, true)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                filters[f.key]
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Score mínimo</label>
                  <select
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
                    value={filters.minScore || ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      toggleFilter('minScore', val);
                    }}
                  >
                    <option value="">Qualquer</option>
                    <option value="80">80+ (Excelente)</option>
                    <option value="60">60+ (Bom)</option>
                    <option value="40">40+ (Médio)</option>
                    <option value="20">20+ (Baixo)</option>
                  </select>
                </div>
              </div>
              {(filters.hasWebsite || filters.hasInstagram || filters.hasWhatsapp || filters.hasEmail || filters.minScore) && (
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setPage(1); }}>
                    <X className="h-3 w-3 mr-1" /> Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))
          ) : leads.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
                <p className="text-muted-foreground mb-4">Faça uma pesquisa para encontrar empresas</p>
                <a href="/dashboard/search">
                  <Button>
                    <Search className="h-4 w-4 mr-2" /> Nova Pesquisa
                  </Button>
                </a>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {formatNumber(total)} leads encontrados
              </p>
              {leads.map((lead) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={cn(
                      'cursor-pointer hover:shadow-md transition-all',
                      selectedLead?.id === lead.id && 'ring-2 ring-primary',
                    )}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{lead.name}</h3>
                            {lead.enrichedData?.qualityScore ? (
                              <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold text-white', getScoreColor(lead.enrichedData.qualityScore))}>
                                {lead.enrichedData.qualityScore}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{lead.category}</p>

                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {lead.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {lead.city}{lead.state ? `/${lead.state}` : ''}
                              </span>
                            )}
                            {lead.rating && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {lead.rating}
                              </span>
                            )}
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {lead.phone}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                            {(lead.whatsapp || lead.phone) && (
                              <a href={`https://wa.me/${(lead.whatsapp || lead.phone)!.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium px-2 py-1">
                                <Phone className="h-3 w-3" />WhatsApp
                              </a>
                            )}
                            {lead.phone && (
                              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium px-2 py-1">
                                <Phone className="h-3 w-3" />Ligar
                              </a>
                            )}
                            {lead.instagram && (
                              <a href={`https://instagram.com/${lead.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-medium px-2 py-1">
                                <Instagram className="h-3 w-3" />Instagram
                              </a>
                            )}
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md bg-gray-600 hover:bg-gray-700 text-white text-[11px] font-medium px-2 py-1">
                                <Globe className="h-3 w-3" />Site
                              </a>
                            )}
                            {lead.email && (
                              <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 rounded-md bg-gray-600 hover:bg-gray-700 text-white text-[11px] font-medium px-2 py-1">
                                <Mail className="h-3 w-3" />Email
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {selectedLead ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg">{selectedLead.name}</h3>
                    <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {selectedLead.enrichedData?.analysisText && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {selectedLead.enrichedData.analysisText}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {selectedLead.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{selectedLead.address}</span>
                      </div>
                    )}
                    {selectedLead.phone && (
                      <a href={`tel:${selectedLead.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Phone className="h-4 w-4 shrink-0" />
                        {selectedLead.phone}
                      </a>
                    )}
                    {selectedLead.email && (
                      <a href={`mailto:${selectedLead.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Mail className="h-4 w-4 shrink-0" />
                        {selectedLead.email}
                      </a>
                    )}
                    {selectedLead.website && (
                      <a href={selectedLead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Globe className="h-4 w-4 shrink-0" />
                        {selectedLead.website}
                      </a>
                    )}
                    {selectedLead.instagram && (
                      <a href={`https://instagram.com/${selectedLead.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Instagram className="h-4 w-4 shrink-0" />
                        @{selectedLead.instagram}
                      </a>
                    )}
                  </div>

                  {selectedLead.enrichedData && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Marketing', val: selectedLead.enrichedData.needsMarketing },
                        { label: 'Automação', val: selectedLead.enrichedData.needsAutomation },
                        { label: 'Chatbot', val: selectedLead.enrichedData.needsChatbot },
                        { label: 'Novo Site', val: selectedLead.enrichedData.needsNewWebsite },
                        { label: 'Tráfego Pago', val: selectedLead.enrichedData.needsPaidTraffic },
                      ].map((item) => (
                        <div key={item.label} className={cn(
                          'p-2 rounded-lg text-xs font-medium text-center',
                          item.val ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600',
                        )}>
                          {item.val ? 'Precisa' : 'OK'} - {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Selecione um lead para ver os detalhes</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
