'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Company {
  id: string;
  name: string;
  category?: string;
  city?: string;
  website?: string;
  instagram?: string;
}
interface Content {
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  servicesTitle: string;
  services: Array<{ title: string; description: string }>;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  seoTitle: string;
  seoDescription: string;
  confirmationNeeded: string[];
}
interface Version {
  id: string;
  label: string;
  createdAt: string;
}
interface Project {
  id: string;
  companyId: string;
  name: string;
  template: string;
  status: string;
  primaryColor: string;
  accentColor: string;
  demoBadge: boolean;
  content: Content;
  versions?: Version[];
  versionCount?: number;
  company: Company;
}

const blankContent: Content = {
  heroTitle: '',
  heroSubtitle: '',
  aboutTitle: '',
  aboutText: '',
  servicesTitle: '',
  services: [],
  ctaTitle: '',
  ctaText: '',
  ctaLabel: '',
  seoTitle: '',
  seoDescription: '',
  confirmationNeeded: [],
};

export default function SiteStudioPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [objective, setObjective] = useState('contacts');
  const [template, setTemplate] = useState('local');
  const [services, setServices] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [content, setContent] = useState<Content>(blankContent);
  const [preview, setPreview] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [apiKey, setApiKey] = useState('');
  const [keyReady, setKeyReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  const loadProjects = useCallback(async () => {
    const response = await api.get('/site-studio');
    setProjects(response.data.data || []);
  }, []);
  const loadProject = useCallback(async (id: string) => {
    if (!id) return;
    const response = await api.get(`/site-studio/${id}`);
    const value = response.data.data;
    setProject(value);
    setContent(value.content);
    setSelectedId(id);
    const visual = await api.get(`/site-studio/${id}/preview`);
    setPreview(visual.data.data.html);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/companies', {
        params: { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
      }),
      api.get('/site-studio/config'),
    ])
      .then(([companyResponse, configResponse]) => {
        const list = companyResponse.data.data?.data || [];
        const config = configResponse.data.data;
        setCompanies(list);
        const preferred = localStorage.getItem('siteStudioCompanyId');
        setCompanyId(
          preferred && list.some((item: Company) => item.id === preferred)
            ? preferred
            : list[0]?.id || '',
        );
        setProvider(config.provider);
        setModel(config.model);
        setKeyReady(config.apiKeyConfigured);
      })
      .catch(() => setNotice('Não foi possível carregar os dados do estúdio.'));
    loadProjects().catch(() => setNotice('Não foi possível carregar os projetos.'));
  }, [loadProjects]);

  const createProject = async () => {
    if (!companyId) return setNotice('Selecione uma empresa.');
    setBusy('create');
    setNotice('');
    try {
      const response = await api.post('/site-studio', {
        companyId,
        objective,
        template,
        services: services
          .split(/[\n,;]/)
          .map((item) => item.trim())
          .filter(Boolean),
      });
      await loadProjects();
      await loadProject(response.data.data.id);
      setNotice('Projeto criado com dados reais do lead.');
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'Não foi possível criar o projeto.');
    } finally {
      setBusy('');
    }
  };
  const generate = async () => {
    if (!project) return;
    setBusy('generate');
    setNotice('');
    try {
      const response = await api.post(`/site-studio/${project.id}/generate`);
      await loadProject(project.id);
      await loadProjects();
      setNotice(
        response.data.data.mode === 'ai'
          ? 'Conteúdo criado pela IA.'
          : 'Modelo local criado. Configure uma chave para usar IA externa.',
      );
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'Falha ao gerar o site.');
    } finally {
      setBusy('');
    }
  };
  const save = async () => {
    if (!project) return;
    setBusy('save');
    try {
      await api.patch(`/site-studio/${project.id}`, {
        content,
        template: project.template,
        primaryColor: project.primaryColor,
        accentColor: project.accentColor,
        demoBadge: project.demoBadge,
      });
      await loadProject(project.id);
      await loadProjects();
      setNotice('Alterações guardadas numa nova versão.');
    } catch {
      setNotice('Não foi possível guardar.');
    } finally {
      setBusy('');
    }
  };
  const saveConfig = async () => {
    setBusy('config');
    try {
      const response = await api.patch('/site-studio/config', {
        provider,
        model,
        ...(apiKey ? { apiKey } : {}),
      });
      setKeyReady(response.data.data.apiKeyConfigured);
      setApiKey('');
      setNotice('Configuração de IA guardada com chave encriptada.');
    } catch {
      setNotice('Não foi possível guardar a configuração.');
    } finally {
      setBusy('');
    }
  };
  const testConfig = async () => {
    setBusy('test');
    try {
      await api.post('/site-studio/config/test');
      setNotice('Ligação com a IA validada.');
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'A ligação com a IA falhou.');
    } finally {
      setBusy('');
    }
  };
  const restore = async (versionId: string) => {
    if (!project) return;
    await api.post(`/site-studio/${project.id}/versions/${versionId}/restore`);
    await loadProject(project.id);
    setNotice('Versão restaurada.');
  };
  const exportZip = async () => {
    if (!project) return;
    const response = await api.get(`/site-studio/${project.id}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.company.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice('ZIP exportado. Reveja os dados antes de publicar.');
  };
  const serviceText = useMemo(
    () => content.services.map((item) => `${item.title} | ${item.description}`).join('\n'),
    [content.services],
  );
  const field = (key: keyof Content, label: string, multiline = false) => (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-24 w-full rounded-lg border border-input bg-background p-3"
          value={String(content[key] || '')}
          onChange={(event) => setContent({ ...content, [key]: event.target.value })}
        />
      ) : (
        <Input
          value={String(content[key] || '')}
          onChange={(event) => setContent({ ...content, [key]: event.target.value })}
        />
      )}
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <WandSparkles className="h-8 w-8 text-primary" /> Estúdio IA
        </h1>
        <p className="text-muted-foreground">
          Crie uma demonstração de site a partir dos dados reais dos seus leads.
        </p>
      </div>
      {notice && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {notice}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Novo projeto</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">Selecione o lead</option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.city ? ` — ${item.city}` : ''}
                  </option>
                ))}
              </select>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              >
                <option value="contacts">Receber contactos</option>
                <option value="bookings">Receber marcações</option>
                <option value="quotes">Pedir orçamentos</option>
                <option value="services">Apresentar serviços</option>
              </select>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="local">Negócio local</option>
                <option value="restaurant">Restaurante / beleza</option>
                <option value="professional">Serviço profissional</option>
              </select>
              <textarea
                className="min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
                placeholder="Serviços confirmados, um por linha (opcional)"
                value={services}
                onChange={(e) => setServices(e.target.value)}
              />
              <Button className="w-full" onClick={createProject} disabled={busy === 'create'}>
                {busy === 'create' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}{' '}
                Criar demonstração
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 font-semibold">
                <Settings2 className="h-4 w-4" /> IA opcional
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel(e.target.value === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
                }}
              >
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
              </select>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Modelo"
              />
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  keyReady ? 'Chave configurada — deixe vazio para manter' : 'Chave da API'
                }
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveConfig} disabled={busy === 'config'}>
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={testConfig}
                  disabled={!keyReady || busy === 'test'}
                >
                  Testar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A chave fica encriptada neste computador. Nenhum site é publicado automaticamente.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Projetos</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.length ? (
                projects.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadProject(item.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm ${selectedId === item.id ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <strong className="block">{item.company.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {item.status} · {item.versionCount || 1} versões
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Ainda não há projetos.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-5">
          {project ? (
            <>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-2 p-4">
                  <Button onClick={generate} disabled={busy === 'generate'}>
                    {busy === 'generate' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}{' '}
                    Gerar conteúdo
                  </Button>
                  <Button variant="outline" onClick={save}>
                    <Save className="mr-2 h-4 w-4" /> Guardar versão
                  </Button>
                  <Button variant="outline" onClick={exportZip}>
                    <Download className="mr-2 h-4 w-4" /> Exportar ZIP
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {project.demoBadge
                      ? 'Demonstração não oficial ativa'
                      : 'Sem aviso de demonstração'}
                  </span>
                </CardContent>
              </Card>
              <div className="grid gap-5 2xl:grid-cols-[420px_1fr]">
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Conteúdo e visual</h2>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        Modelo
                        <select
                          className="mt-1 h-10 w-full rounded-lg border bg-background px-2"
                          value={project.template}
                          onChange={(e) => setProject({ ...project, template: e.target.value })}
                        >
                          <option value="local">Local</option>
                          <option value="restaurant">Restaurante / beleza</option>
                          <option value="professional">Profissional</option>
                        </select>
                      </label>
                      <label className="text-xs">
                        Cor principal
                        <Input
                          className="mt-1"
                          type="color"
                          value={project.primaryColor}
                          onChange={(e) => setProject({ ...project, primaryColor: e.target.value })}
                        />
                      </label>
                    </div>
                    {field('heroTitle', 'Título principal')}
                    {field('heroSubtitle', 'Subtítulo', true)}
                    {field('aboutTitle', 'Título sobre')}
                    {field('aboutText', 'Texto sobre', true)}
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">Serviços (Título | descrição)</span>
                      <textarea
                        className="min-h-28 w-full rounded-lg border bg-background p-3"
                        value={serviceText}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            services: e.target.value
                              .split('\n')
                              .filter(Boolean)
                              .map((line) => {
                                const [title, ...rest] = line.split('|');
                                return { title: (title || '').trim(), description: rest.join('|').trim() };
                              }),
                          })
                        }
                      />
                    </label>
                    {field('ctaTitle', 'Título da chamada')}
                    {field('ctaText', 'Texto da chamada', true)}
                    {field('ctaLabel', 'Texto do botão')}
                    {!!content.confirmationNeeded.length && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                        <strong>Confirmar com a empresa:</strong>{' '}
                        {content.confirmationNeeded.join(', ')}
                      </div>
                    )}
                    {!!project.versions?.length && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Histórico</p>
                        <div className="max-h-36 space-y-1 overflow-auto">
                          {project.versions.map((version) => (
                            <button
                              key={version.id}
                              onClick={() => restore(version.id)}
                              className="flex w-full items-center justify-between rounded border px-2 py-1 text-xs"
                            >
                              <span>{version.label}</span>
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 font-semibold">
                        <Eye className="h-4 w-4" /> Pré-visualização
                      </h2>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={device === 'desktop' ? 'default' : 'outline'}
                          onClick={() => setDevice('desktop')}
                        >
                          Desktop
                        </Button>
                        <Button
                          size="sm"
                          variant={device === 'mobile' ? 'default' : 'outline'}
                          onClick={() => setDevice('mobile')}
                        >
                          Telemóvel
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex justify-center bg-muted/30 p-3">
                    <iframe
                      title="Pré-visualização do site"
                      srcDoc={preview}
                      className={`h-[760px] rounded-lg border bg-white transition-all ${device === 'mobile' ? 'w-[390px]' : 'w-full'}`}
                    />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="grid min-h-[520px] place-items-center text-center">
                <div>
                  <WandSparkles className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="font-medium">Crie ou selecione um projeto</p>
                  <p className="text-sm text-muted-foreground">
                    O editor e a pré-visualização aparecerão aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
