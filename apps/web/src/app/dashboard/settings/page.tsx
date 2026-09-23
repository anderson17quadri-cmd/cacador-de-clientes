'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Bell, CheckCircle2, Database, KeyRound, Loader2, Palette, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';

type Theme = 'light' | 'dark' | 'system';

interface SettingsData {
  theme: Theme;
  emailNotifications: boolean;
  searchNotifications: boolean;
  defaultRadius: number;
  defaultCountry: string;
}

interface DataProvider {
  id: string;
  name: string;
  purpose: string;
  keyRequired: boolean;
  configured: boolean;
  enabled: boolean;
  recommended: boolean;
  note: string;
}

const defaultSettings: SettingsData = {
  theme: 'system',
  emailNotifications: true,
  searchNotifications: true,
  defaultRadius: 5000,
  defaultCountry: 'Portugal',
};

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left hover:bg-muted/40"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const personalMode = user?.email === 'pesquisa.local@leadhunter.app';
  const { setTheme } = useTheme();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [providers, setProviders] = useState<DataProvider[]>([]);
  const [sourceKeys, setSourceKeys] = useState({ locationIqKey: '', mapboxToken: '', openCageKey: '', googlePlacesKey: '' });

  useEffect(() => {
    Promise.all([api.get('/auth/me'), api.get('/users/settings'), api.get('/data-sources')])
      .then(([profileResponse, settingsResponse, sourcesResponse]) => {
        const profile = profileResponse.data.data;
        const savedSettings = settingsResponse.data.data as SettingsData;
        setName(profile.name);
        setEmail(profile.email);
        setSettings(savedSettings);
        setTheme(savedSettings.theme);
        updateUser({ ...profile, ...savedSettings });
        setProviders(sourcesResponse.data.data.providers || []);
      })
      .catch(() => setNotice({ type: 'error', text: 'Não foi possível carregar as configurações.' }))
      .finally(() => setLoading(false));
  }, [setTheme, updateUser]);

  const errorText = (error: any, fallback: string) =>
    error?.response?.data?.message || error?.response?.data?.error || fallback;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving('profile');
    setNotice(null);
    try {
      const response = await api.patch('/users/profile', { name, email });
      updateUser(response.data.data);
      setNotice({ type: 'success', text: 'Perfil salvo com sucesso.' });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error, 'Não foi possível salvar o perfil.') });
    } finally {
      setSaving(null);
    }
  };

  const saveSettings = async () => {
    setSaving('settings');
    setNotice(null);
    try {
      const response = await api.patch('/users/settings', settings);
      const saved = response.data.data as SettingsData;
      setSettings(saved);
      setTheme(saved.theme);
      updateUser(saved);
      setNotice({ type: 'success', text: 'Preferências salvas com sucesso.' });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error, 'Não foi possível salvar as preferências.') });
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setNotice({ type: 'error', text: 'A confirmação da nova senha não confere.' });
      return;
    }
    setSaving('password');
    setNotice(null);
    try {
      await api.patch('/users/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice({ type: 'success', text: 'Senha alterada com sucesso.' });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error, 'Não foi possível alterar a senha.') });
    } finally {
      setSaving(null);
    }
  };

  const sourceField = (id: string) => id === 'locationiq' ? 'locationIqKey'
    : id === 'mapbox' ? 'mapboxToken' : id === 'opencage' ? 'openCageKey' : 'googlePlacesKey';

  const saveSources = async () => {
    setSaving('sources'); setNotice(null);
    try {
      const toggles = Object.fromEntries(providers.filter((item) => item.keyRequired).map((item) => [
        item.id === 'locationiq' ? 'locationIqEnabled' : item.id === 'mapbox' ? 'mapboxEnabled' : item.id === 'opencage' ? 'openCageEnabled' : 'googlePlacesEnabled',
        item.enabled,
      ]));
      const response = await api.patch('/data-sources', { ...toggles, ...Object.fromEntries(Object.entries(sourceKeys).filter(([, value]) => value.trim())) });
      setProviders(response.data.data.providers || []);
      setSourceKeys({ locationIqKey: '', mapboxToken: '', openCageKey: '', googlePlacesKey: '' });
      setNotice({ type: 'success', text: 'Fontes de dados guardadas com as chaves cifradas.' });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error, 'Não foi possível guardar as fontes.') });
    } finally { setSaving(null); }
  };

  const testSource = async (provider: string) => {
    setSaving(`test-${provider}`); setNotice(null);
    try {
      const response = await api.post('/data-sources/test', { provider });
      setNotice({ type: 'success', text: `${providers.find((item) => item.id === provider)?.name}: ligação confirmada em ${response.data.data.latencyMs} ms.` });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error, 'A fonte não respondeu corretamente.') });
    } finally { setSaving(null); }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Gerencie sua conta e as preferências do Caçador de Clientes.</p>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${notice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'border-red-500/30 bg-red-500/10 text-red-600'}`}>
          {notice.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {!personalMode && <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><User className="h-5 w-5 text-primary" /></div>
              <div><h2 className="font-semibold">Perfil</h2><p className="text-sm text-muted-foreground">Seus dados de identificação</p></div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div><label className="mb-1.5 block text-sm font-medium">Nome</label><Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required /></div>
              <div><label className="mb-1.5 block text-sm font-medium">Email</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <Button type="submit" disabled={saving !== null}>{saving === 'profile' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar perfil</Button>
            </form>
          </CardContent>
        </Card>}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Palette className="h-5 w-5 text-primary" /></div>
              <div><h2 className="font-semibold">Aparência</h2><p className="text-sm text-muted-foreground">Escolha o tema da interface</p></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'system'] as Theme[]).map((value) => (
                <button key={value} type="button" onClick={() => { setSettings((old) => ({ ...old, theme: value })); setTheme(value); }} className={`rounded-lg border p-4 text-sm font-medium transition-colors ${settings.theme === value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}>
                  {value === 'light' ? 'Claro' : value === 'dark' ? 'Escuro' : 'Sistema'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Search className="h-5 w-5 text-primary" /></div>
              <div><h2 className="font-semibold">Pesquisa</h2><p className="text-sm text-muted-foreground">Valores usados em novas buscas</p></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">País padrão</label><Input value={settings.defaultCountry} onChange={(e) => setSettings((old) => ({ ...old, defaultCountry: e.target.value }))} maxLength={100} /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Raio padrão (metros)</label><Input type="number" min={100} max={100000} value={settings.defaultRadius} onChange={(e) => setSettings((old) => ({ ...old, defaultRadius: Number(e.target.value) }))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Bell className="h-5 w-5 text-primary" /></div>
              <div><h2 className="font-semibold">Notificações</h2><p className="text-sm text-muted-foreground">Controle os avisos do sistema</p></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle checked={settings.searchNotifications} onChange={(value) => setSettings((old) => ({ ...old, searchNotifications: value }))} label="Pesquisas concluídas" description="Avisar quando uma pesquisa ou análise terminar" />
            <Toggle checked={settings.emailNotifications} onChange={(value) => setSettings((old) => ({ ...old, emailNotifications: value }))} label="Notificações por email" description="Receber atualizações importantes por email" />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end"><Button size="lg" onClick={saveSettings} disabled={saving !== null}>{saving === 'settings' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar preferências</Button></div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><Database className="h-5 w-5 text-primary" /></div>
            <div><h2 className="font-semibold">Fontes de dados</h2><p className="text-sm text-muted-foreground">O app escolhe automaticamente as fontes ativas em cada pesquisa</p></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.map((provider) => {
            const field = sourceField(provider.id) as keyof typeof sourceKeys;
            return <div key={provider.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><strong>{provider.name}</strong>{provider.recommended && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Recomendada</span>}<span className={`rounded-full px-2 py-0.5 text-xs ${provider.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{provider.enabled ? 'Ativa' : provider.configured ? 'Desativada' : 'Sem chave'}</span></div>
                  <p className="mt-1 text-sm">{provider.purpose}</p><p className="mt-1 text-xs text-muted-foreground">{provider.note}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => testSource(provider.id)} disabled={saving !== null || (provider.keyRequired && !provider.configured)}>{saving === `test-${provider.id}` && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Testar</Button>
              </div>
              {provider.keyRequired && <div className="mt-3 flex flex-wrap gap-3">
                <Input className="min-w-64 flex-1" type="password" placeholder={provider.configured ? 'Chave configurada — deixe vazio para manter' : 'Cole a chave da API'} value={sourceKeys[field]} onChange={(event) => setSourceKeys((old) => ({ ...old, [field]: event.target.value }))} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={provider.enabled} onChange={(event) => setProviders((old) => old.map((item) => item.id === provider.id ? { ...item, enabled: event.target.checked } : item))} />Usar nas pesquisas</label>
              </div>}
            </div>;
          })}
          <div className="flex justify-end"><Button onClick={saveSources} disabled={saving !== null}>{saving === 'sources' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar fontes</Button></div>
        </CardContent>
      </Card>

      {!personalMode && <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><KeyRound className="h-5 w-5 text-primary" /></div>
            <div><h2 className="font-semibold">Segurança</h2><p className="text-sm text-muted-foreground">Altere a senha da sua conta</p></div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="grid gap-4 md:grid-cols-3">
            <Input type="password" placeholder="Senha atual" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <Input type="password" placeholder="Nova senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            <Input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            <div className="md:col-span-3"><Button type="submit" variant="outline" disabled={saving !== null}>{saving === 'password' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Alterar senha</Button></div>
          </form>
        </CardContent>
      </Card>}
    </div>
  );
}
