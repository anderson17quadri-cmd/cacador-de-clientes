'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Users, Star, Globe, Instagram, Phone, Mail,
  Search, BarChart3, ChevronRight, Zap, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { formatNumber } from '@leadhunter/utils';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [overview, leadStats] = await Promise.all([
          api.get('/companies/stats/overview'),
          api.get('/leads/stats'),
        ]);
        setStats({ ...overview.data.data, ...leadStats.data.data });
      } catch {
        // Stats not critical
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Empresas', value: stats?.totalCompanies, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Com Instagram', value: stats?.withInstagram, icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Com Website', value: stats?.withWebsite, icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Com WhatsApp', value: stats?.withWhatsapp, icon: Phone, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Com Email', value: stats?.withEmail, icon: Mail, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Média Avaliações', value: stats?.averageRating?.toFixed(1), icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10', suffix: '★' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da sua prospecção</p>
        </div>
        <Button onClick={() => router.push('/dashboard/search')} size="lg" className="shadow-lg shadow-primary/25">
          <Search className="h-4 w-4 mr-2" />
          Nova Pesquisa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <div className={cn('p-2 rounded-lg', stat.bg)}>
                  <stat.icon className={cn('h-4 w-4', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-20" /> : formatNumber(stat.value || 0)}{stat.suffix || ''}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Nova Pesquisa', icon: Search, description: 'Encontre empresas por categoria e localização', action: () => router.push('/dashboard/search') },
              { label: 'Ver Leads', icon: Users, description: 'Gerencie seus leads encontrados', action: () => router.push('/dashboard/leads') },
              { label: 'Favoritos', icon: Star, description: 'Empresas salvas como favoritas', action: () => router.push('/dashboard/favorites') },
              { label: 'Análises', icon: BarChart3, description: 'Métricas e relatórios detalhados', action: () => router.push('/dashboard/analytics') },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.action}
                className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 transition-all text-left"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Leads Premium</h3>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                <div>
                  <p className="text-2xl font-bold text-emerald-500">{stats?.premiumLeads || 0}</p>
                  <p className="text-xs text-muted-foreground">Alto potencial</p>
                </div>
                <Zap className="h-8 w-8 text-emerald-500/50" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
                <div>
                  <p className="text-2xl font-bold text-amber-500">{stats?.leadsWithoutWebsite || 0}</p>
                  <p className="text-xs text-muted-foreground">Sem website</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500/50" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                <div>
                  <p className="text-2xl font-bold text-blue-500">{stats?.leadsWithoutInstagram || 0}</p>
                  <p className="text-xs text-muted-foreground">Sem Instagram</p>
                </div>
                <Instagram className="h-8 w-8 text-blue-500/50" />
              </div>
            </div>
          )}
          <Button className="w-full mt-4" variant="outline" onClick={() => router.push('/dashboard/leads?premium=true')}>
            Ver Leads Premium
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
