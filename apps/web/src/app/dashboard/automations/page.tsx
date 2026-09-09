'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock3, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function AutomationsPage() {
  const [items, setItems] = useState<any[]>([]); const [busy,setBusy]=useState('');
  const [form,setForm]=useState({name:'Barbearias em Lisboa',category:'barbearia',city:'Lisboa',country:'Portugal',radius:5000,frequencyHours:24});
  const load=useCallback(async()=>{const response=await api.get('/prospecting/automations');setItems(response.data.data||[]);},[]);
  useEffect(()=>{void load();},[load]);
  const create=async()=>{setBusy('create');try{await api.post('/prospecting/automations',form);await load();}finally{setBusy('');}};
  const run=async(id:string)=>{setBusy(id);try{await api.post(`/prospecting/automations/${id}/run`);await load();}finally{setBusy('');}};
  const toggle=async(item:any)=>{await api.patch(`/prospecting/automations/${item.id}`,{enabled:!item.enabled});await load();};
  const remove=async(id:string)=>{await api.delete(`/prospecting/automations/${id}`);await load();};
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Pesquisas Automáticas</h1><p className="mt-1 text-muted-foreground">Encontre periodicamente empresas novas sem repetir trabalho manual.</p></div><Card><CardHeader><strong>Nova automação</strong></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><Input placeholder="Nome" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/><Input placeholder="Categoria" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}/><Input placeholder="Cidade" value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/><Input placeholder="País" value={form.country} onChange={(e)=>setForm({...form,country:e.target.value})}/><Input type="number" min={1000} max={100000} value={form.radius} onChange={(e)=>setForm({...form,radius:Number(e.target.value)})}/><Input type="number" min={1} max={720} value={form.frequencyHours} onChange={(e)=>setForm({...form,frequencyHours:Number(e.target.value)})}/><Button onClick={create} disabled={!!busy}>{busy==='create'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Plus className="mr-2 h-4 w-4"/>}Criar automação</Button></CardContent></Card><div className="space-y-3">{items.map((item)=><Card key={item.id}><CardContent className="flex flex-wrap items-center gap-4 p-5"><div className="min-w-64 flex-1"><strong>{item.name}</strong><p className="mt-1 text-sm text-muted-foreground">{item.category} · {item.city}, {item.country} · a cada {item.frequencyHours}h</p><p className="mt-1 text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3 w-3"/>Próxima: {new Date(item.nextRunAt).toLocaleString('pt-PT')}{item.lastError&&<span className="ml-2 text-red-500">{item.lastError}</span>}</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.enabled} onChange={()=>toggle(item)}/>Ativa</label><Button variant="outline" onClick={()=>run(item.id)} disabled={!!busy}>{busy===item.id?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Play className="mr-2 h-4 w-4"/>}Executar agora</Button><Button variant="ghost" size="icon" onClick={()=>remove(item.id)}><Trash2 className="h-4 w-4 text-red-500"/></Button></CardContent></Card>)}{items.length===0&&<Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nenhuma pesquisa automática configurada.</CardContent></Card>}</div></div>;
}
