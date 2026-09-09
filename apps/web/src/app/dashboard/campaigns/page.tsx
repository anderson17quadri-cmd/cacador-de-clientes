'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, MessageCircle, Pause, Play, Send, Settings2, WandSparkles, X } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Channel = 'email' | 'whatsapp';
type Notice = { type: 'success' | 'error'; text: string } | null;

interface Config {
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string;
  smtpPassConfigured: boolean; smtpFromEmail: string; smtpFromName: string;
  whatsappPhoneNumberId: string; whatsappTokenConfigured: boolean;
  whatsappApiVersion: string; emailReady: boolean; whatsappReady: boolean;
  maxDailyMessages: number;
}

interface Campaign {
  id: string; name: string; channels: Channel[]; status: string; dryRun: boolean;
  totalRecipients: number; totalDeliveries: number; processed: number; sent: number;
  simulated: number; failed: number; skipped: number; createdAt: string; error?: string;
}

const initialConfig: Config = {
  smtpHost: '', smtpPort: 587, smtpSecure: false, smtpUser: '', smtpPassConfigured: false,
  smtpFromEmail: '', smtpFromName: '', whatsappPhoneNumberId: '', whatsappTokenConfigured: false,
  whatsappApiVersion: 'v22.0', emailReady: false, whatsappReady: false,
  maxDailyMessages: 50,
};

const fieldClass = 'space-y-1.5';
const labelClass = 'block text-sm font-medium';

export default function CampaignsPage() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [smtpPass, setSmtpPass] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [channels, setChannels] = useState<Channel[]>(['email', 'whatsapp']);
  const [name, setName] = useState('Campanha barbearias Lisboa');
  const [category, setCategory] = useState('barbearia');
  const [city, setCity] = useState('Lisboa');
  const [maxRecipients, setMaxRecipients] = useState(50);
  const [subject, setSubject] = useState('Uma ideia para {empresa}');
  const [message, setMessage] = useState('Olá, equipe da {empresa}! Encontrei o vosso negócio em {cidade} e gostaria de apresentar uma proposta que pode ajudar a atrair mais clientes. Podemos conversar?');
  const [template, setTemplate] = useState('primeiro_contato');
  const [language, setLanguage] = useState('pt_PT');
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [dryRun, setDryRun] = useState(true);
  const [consent, setConsent] = useState(false);
  const [preview, setPreview] = useState<{ leads: number; email: number; whatsapp: number; deliveries: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [personalizedMessages, setPersonalizedMessages] = useState<Record<string, string>>({});

  const errorText = (error: any, fallback: string) => {
    const value = error?.response?.data?.message;
    return Array.isArray(value) ? value.join(' ') : value || fallback;
  };

  const load = useCallback(async () => {
    try {
      const [configResponse, campaignResponse] = await Promise.all([api.get('/campaigns/config'), api.get('/campaigns')]);
      setConfig(configResponse.data.data);
      setCampaigns(campaignResponse.data.data || []);
    } catch (error) { setNotice({ type: 'error', text: errorText(error, 'Não foi possível carregar as campanhas.') }); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('campaignLeadIds') || '[]');
      if (Array.isArray(stored) && stored.every((id) => typeof id === 'string') && stored.length > 0) {
        setSelectedLeadIds(stored);
        setChannels(['whatsapp']);
        setCategory('');
        setCity('');
        setMaxRecipients(stored.length);
        setName(`Campanha WhatsApp - ${stored.length} leads`);
      }
    } catch { localStorage.removeItem('campaignLeadIds'); }
  }, []);
  useEffect(() => {
    if (!campaigns.some((item) => item.status === 'RUNNING')) return;
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, [campaigns, load]);

  const toggleChannel = (channel: Channel) => {
    setChannels((old) => old.includes(channel) ? old.filter((item) => item !== channel) : [...old, channel]);
    setPreview(null);
  };

  const payload = () => ({
    channels,
    category: selectedLeadIds.length ? undefined : (category || undefined),
    city: selectedLeadIds.length ? undefined : (city || undefined),
    maxRecipients,
    companyIds: selectedLeadIds.length ? selectedLeadIds : undefined,
  });

  const clearSelectedLeads = () => {
    localStorage.removeItem('campaignLeadIds');
    setSelectedLeadIds([]);
    setPersonalizedMessages({});
    setPreview(null);
  };

  const generatePersonalized = async () => {
    if (!selectedLeadIds.length) return setNotice({ type: 'error', text: 'Selecione leads na página Leads antes de gerar mensagens individuais.' });
    setBusy('generate'); setNotice(null);
    try {
      const response = await api.post('/prospecting/generate-messages', { companyIds: selectedLeadIds, offer: 'presença digital, automação e captação de clientes', tone: 'profissional e cordial' });
      const messages = response.data.data.messages || [];
      const mapped = Object.fromEntries(messages.map((item: any) => [item.companyId, item.message]));
      setPersonalizedMessages(mapped);
      if (messages[0]?.message) setMessage(messages[0].message);
      setNotice({ type: 'success', text: `${messages.length} mensagens personalizadas geradas (${response.data.data.mode === 'ai' ? 'com IA' : 'modo inteligente local'}).` });
    } catch (error) { setNotice({ type: 'error', text: errorText(error, 'Não foi possível gerar as mensagens.') }); }
    finally { setBusy(null); }
  };

  const getPreview = async () => {
    if (!channels.length) return setNotice({ type: 'error', text: 'Escolha pelo menos um canal.' });
    setBusy('preview'); setNotice(null);
    try { const response = await api.post('/campaigns/preview', payload()); setPreview(response.data.data); }
    catch (error) { setNotice({ type: 'error', text: errorText(error, 'Não foi possível contar os destinatários.') }); }
    finally { setBusy(null); }
  };

  const createCampaign = async () => {
    setBusy('create'); setNotice(null);
    try {
      await api.post('/campaigns', {
        ...payload(), name, subject, message, whatsappTemplate: template,
        whatsappLanguage: language, intervalSeconds, dryRun, consentConfirmed: consent,
        personalizedMessages: Object.keys(personalizedMessages).length ? personalizedMessages : undefined,
      });
      clearSelectedLeads();
      setNotice({ type: 'success', text: 'Campanha criada. Confira os totais e clique em iniciar.' });
      await load();
    } catch (error) { setNotice({ type: 'error', text: errorText(error, 'Não foi possível criar a campanha.') }); }
    finally { setBusy(null); }
  };

  const saveConfig = async () => {
    setBusy('config'); setNotice(null);
    try {
      const response = await api.patch('/campaigns/config', {
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpFromEmail: config.smtpFromEmail,
        smtpFromName: config.smtpFromName,
        whatsappPhoneNumberId: config.whatsappPhoneNumberId,
        whatsappApiVersion: config.whatsappApiVersion,
        maxDailyMessages: config.maxDailyMessages,
        ...(smtpPass ? { smtpPass } : {}),
        ...(whatsappToken ? { whatsappToken } : {}),
      });
      setConfig(response.data.data); setSmtpPass(''); setWhatsappToken('');
      setNotice({ type: 'success', text: 'Integrações salvas com proteção local.' });
    } catch (error) { setNotice({ type: 'error', text: errorText(error, 'Não foi possível salvar as integrações.') }); }
    finally { setBusy(null); }
  };

  const testConfig = async (channel: Channel) => {
    setBusy(`test-${channel}`); setNotice(null);
    try {
      const response = await api.post('/campaigns/config/test', { channel });
      setNotice({ type: 'success', text: response.data.data.message });
    } catch (error) { setNotice({ type: 'error', text: errorText(error, 'A conexão não foi validada.') }); }
    finally { setBusy(null); }
  };

  const action = async (campaign: Campaign, actionName: 'start' | 'cancel') => {
    if (actionName === 'start' && !window.confirm(`${campaign.dryRun ? 'Iniciar a simulação' : 'Iniciar os envios reais'} da campanha “${campaign.name}”?`)) return;
    setBusy(`${actionName}-${campaign.id}`); setNotice(null);
    try {
      await api.post(`/campaigns/${campaign.id}/${actionName}`);
      setNotice({ type: 'success', text: actionName === 'start' ? 'Campanha iniciada.' : 'Campanha cancelada.' });
      await load();
    } catch (error) { setNotice({ type: 'error', text: errorText(error, 'A ação não pôde ser concluída.') }); }
    finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Campanhas</h1><p className="mt-1 text-muted-foreground">Envie abordagens personalizadas por e-mail e WhatsApp.</p></div>

      {notice && <div className={`rounded-lg border p-3 text-sm ${notice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-red-500/30 bg-red-500/10 text-red-500'}`}>{notice.text}</div>}

      <Card>
        <CardHeader><div className="flex items-center gap-3"><Send className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Nova campanha</h2><p className="text-sm text-muted-foreground">Use {'{empresa}'}, {'{cidade}'} e {'{categoria}'} para personalizar.</p></div></div></CardHeader>
        <CardContent className="space-y-5">
          {selectedLeadIds.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
              <span><strong>{selectedLeadIds.length} leads com WhatsApp selecionados</strong> na página Leads.</span>
              <Button variant="ghost" size="sm" onClick={clearSelectedLeads}><X className="mr-2 h-4 w-4" />Limpar seleção</Button>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <div className={fieldClass}><label className={labelClass}>Nome da campanha</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className={fieldClass}><label className={labelClass}>Categoria</label><Input value={category} disabled={selectedLeadIds.length > 0} onChange={(e) => setCategory(e.target.value)} /></div>
            <div className={fieldClass}><label className={labelClass}>Cidade</label><Input value={city} disabled={selectedLeadIds.length > 0} onChange={(e) => setCity(e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-3">
            {([['email', Mail, 'E-mail'], ['whatsapp', MessageCircle, 'WhatsApp']] as const).map(([channel, Icon, label]) => <button key={channel} type="button" onClick={() => toggleChannel(channel)} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${channels.includes(channel) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}><Icon className="h-4 w-4" />{label}</button>)}
          </div>
          {channels.includes('email') && <div className={fieldClass}><label className={labelClass}>Assunto do e-mail</label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>}
          <div className={fieldClass}><label className={labelClass}>Mensagem</label><textarea className="min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
          <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={generatePersonalized} disabled={busy !== null || !selectedLeadIds.length}>{busy === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}Gerar mensagens personalizadas</Button>{Object.keys(personalizedMessages).length > 0 && <span className="text-sm text-emerald-500">{Object.keys(personalizedMessages).length} mensagens individuais prontas</span>}</div>
          {channels.includes('whatsapp') && <div className="grid gap-4 md:grid-cols-2"><div className={fieldClass}><label className={labelClass}>Modelo aprovado no WhatsApp</label><Input value={template} onChange={(e) => setTemplate(e.target.value)} /><p className="text-xs text-muted-foreground">O modelo deve conter uma variável no corpo para receber a mensagem.</p></div><div className={fieldClass}><label className={labelClass}>Idioma do modelo</label><Input value={language} onChange={(e) => setLanguage(e.target.value)} /></div></div>}
          <div className="grid gap-4 md:grid-cols-2"><div className={fieldClass}><label className={labelClass}>Máximo de leads</label><Input type="number" min={1} max={10000} value={maxRecipients} onChange={(e) => setMaxRecipients(Number(e.target.value))} /></div><div className={fieldClass}><label className={labelClass}>Intervalo entre envios (segundos)</label><Input type="number" min={5} max={3600} value={intervalSeconds} onChange={(e) => setIntervalSeconds(Number(e.target.value))} /></div></div>
          <label className="flex items-start gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" className="mt-1" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /><span><strong>Modo simulação</strong><span className="block text-muted-foreground">Processa e registra tudo, sem enviar mensagens. Recomendado para o primeiro teste.</span></span></label>
          <label className="flex items-start gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>Confirmo que estes contatos podem receber a comunicação e que respeitarei pedidos de remoção.</span></label>
          {preview && <div className="rounded-lg bg-muted/50 p-4 text-sm"><strong>{preview.leads} leads elegíveis</strong> · {preview.email} e-mails · {preview.whatsapp} WhatsApps · {preview.deliveries} envios</div>}
          <div className="flex gap-3"><Button variant="outline" onClick={getPreview} disabled={busy !== null}>{busy === 'preview' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ver destinatários</Button><Button onClick={createCampaign} disabled={busy !== null || (!dryRun && !consent)}>{busy === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar campanha</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Integrações de envio</h2><p className="text-sm text-muted-foreground">Credenciais ficam criptografadas neste computador.</p></div></div></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4"><div className="flex items-center gap-2"><Mail className="h-4 w-4" /><strong>E-mail SMTP</strong>{config.emailReady && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</div><div className="grid gap-3 md:grid-cols-3"><Input placeholder="Servidor SMTP" value={config.smtpHost} onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })} /><Input type="number" placeholder="Porta" value={config.smtpPort} onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) })} /><Input placeholder="Usuário" value={config.smtpUser} onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })} /><Input type="password" placeholder={config.smtpPassConfigured ? 'Senha já configurada' : 'Senha'} value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} /><Input type="email" placeholder="E-mail remetente" value={config.smtpFromEmail} onChange={(e) => setConfig({ ...config, smtpFromEmail: e.target.value })} /><Input placeholder="Nome remetente" value={config.smtpFromName} onChange={(e) => setConfig({ ...config, smtpFromName: e.target.value })} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.smtpSecure} onChange={(e) => setConfig({ ...config, smtpSecure: e.target.checked })} />Conexão SSL direta (normalmente porta 465)</label></div>
          <div className="space-y-4 border-t pt-5"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /><strong>WhatsApp Cloud API</strong>{config.whatsappReady && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</div><div className="grid gap-3 md:grid-cols-4"><Input placeholder="ID do número" value={config.whatsappPhoneNumberId} onChange={(e) => setConfig({ ...config, whatsappPhoneNumberId: e.target.value })} /><Input type="password" placeholder={config.whatsappTokenConfigured ? 'Token já configurado' : 'Token permanente'} value={whatsappToken} onChange={(e) => setWhatsappToken(e.target.value)} /><Input placeholder="Versão da API" value={config.whatsappApiVersion} onChange={(e) => setConfig({ ...config, whatsappApiVersion: e.target.value })} /><Input type="number" min={1} max={1000} title="Limite diário" value={config.maxDailyMessages} onChange={(e) => setConfig({ ...config, maxDailyMessages: Number(e.target.value) })} /></div><p className="text-xs text-muted-foreground">O último campo define o limite máximo de mensagens reais por 24 horas.</p></div>
          <div className="flex flex-wrap gap-3"><Button onClick={saveConfig} disabled={busy !== null}>{busy === 'config' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar integrações</Button><Button variant="outline" onClick={() => testConfig('email')} disabled={busy !== null || !config.emailReady}>Testar SMTP</Button><Button variant="outline" onClick={() => testConfig('whatsapp')} disabled={busy !== null || !config.whatsappReady}>Testar WhatsApp</Button></div>
        </CardContent>
      </Card>

      <div className="space-y-3"><h2 className="text-xl font-semibold">Histórico</h2>{campaigns.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma campanha criada.</CardContent></Card> : campaigns.map((campaign) => <Card key={campaign.id}><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><strong>{campaign.name}</strong><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{campaign.status}</span>{campaign.dryRun && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-500">simulação</span>}</div><p className="mt-1 text-sm text-muted-foreground">{campaign.totalRecipients} leads · {campaign.processed}/{campaign.totalDeliveries} processados · {campaign.sent} enviados · {campaign.simulated} simulados · {campaign.failed} falhas</p>{campaign.error && <p className="mt-1 text-xs text-red-500">{campaign.error}</p>}</div><div>{campaign.status === 'RUNNING' ? <Button variant="outline" onClick={() => action(campaign, 'cancel')} disabled={busy !== null}><Pause className="mr-2 h-4 w-4" />Cancelar</Button> : campaign.status !== 'COMPLETED' && <Button onClick={() => action(campaign, 'start')} disabled={busy !== null}><Play className="mr-2 h-4 w-4" />Iniciar</Button>}</div></CardContent></Card>)}</div>
    </div>
  );
}
