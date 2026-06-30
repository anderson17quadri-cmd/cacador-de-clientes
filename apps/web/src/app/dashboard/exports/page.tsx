'use client';

import { useState, useEffect } from 'react';
import { Download, FileText, Loader2, CheckCircle2, XCircle, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDate } from '@leadhunter/utils';
import type { ExportRecord } from '@leadhunter/types';

export default function ExportsPage() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExports();
  }, []);

  const fetchExports = async () => {
    try {
      const res = await api.get('/exports');
      const data = res.data.data;
      setExports(Array.isArray(data.data) ? data.data : []);
    } catch {
      setExports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (exp: ExportRecord) => {
    window.open(`/api/exports/${exp.id}/download`, '_blank');
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success' as const;
      case 'failed': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      case 'pending': return 'Pendente';
      case 'processing': return 'Processando';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exportações</h1>
        <p className="text-muted-foreground mt-1">Download dos seus dados exportados</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : exports.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma exportação</h3>
            <p className="text-muted-foreground mb-4">Exporte seus leads nos resultados da pesquisa</p>
            <a href="/dashboard/search">
              <Button>
                <FileDown className="h-4 w-4 mr-2" />
                Nova Pesquisa
              </Button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {exports.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {exp.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : exp.status === 'failed' ? (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">{exp.fileName}.{exp.format.toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(exp.createdAt)}
                      {exp.fileSize ? ` - ${(exp.fileSize / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(exp.status)}>
                    {statusLabel(exp.status)}
                  </Badge>
                  {exp.status === 'completed' && (
                    <Button size="sm" onClick={() => handleDownload(exp)}>
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
