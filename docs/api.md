# API REST — LeadHunter AI

Base URL: `http://localhost:3001/api`

## Autenticação

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/auth/register` | Registrar novo usuário | Não |
| POST | `/auth/login` | Login email/senha | Não |
| POST | `/auth/refresh` | Renovar access token | Refresh |
| POST | `/auth/logout` | Logout | Bearer |
| GET | `/auth/me` | Perfil do usuário | Bearer |
| POST | `/auth/forgot-password` | Solicitar reset | Não |
| POST | `/auth/reset-password` | Resetar senha | Não |
| GET | `/auth/google` | Login Google OAuth | Não |
| GET | `/auth/google/callback` | Callback Google | Não |
| GET | `/auth/github` | Login GitHub OAuth | Não |
| GET | `/auth/github/callback` | Callback GitHub | Não |

## Pesquisa

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/search` | Criar pesquisa | Bearer |
| GET | `/search` | Listar pesquisas | Bearer |
| GET | `/search/:id` | Detalhes da pesquisa | Bearer |
| GET | `/search/:id/progress` | Progresso (status, %) | Bearer |
| GET | `/search/:id/logs` | Logs de execução | Bearer |
| POST | `/search/:id/cancel` | Cancelar pesquisa | Bearer |
| GET | `/search/:id/results` | Resultados paginados | Bearer |
| GET | `/search/:id/stream` | SSE progresso real-time | Bearer |

### Criar Pesquisa (POST /search)

```json
{
  "category": "barbearia",
  "city": "São Paulo",
  "state": "SP",
  "country": "Brasil",
  "radius": 5000,
  "sources": ["google_places", "nominatim", "overpass"]
}
```

## Empresas

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/companies` | Listar com filtros | Bearer |
| GET | `/companies/:id` | Detalhes | Bearer |
| GET | `/companies/:id/analysis` | Análise IA | Bearer |
| GET | `/companies/stats/overview` | Estatísticas globais | Bearer |

### Filtros (Query Params)

`search`, `category`, `city`, `state`, `country`, `minRating`, `maxRating`, `minTotalRatings`, `hasWebsite`, `hasInstagram`, `hasFacebook`, `hasWhatsapp`, `hasEmail`, `searchId`, `minQualityScore`, `page`, `limit`, `sortBy`, `sortOrder`

## Leads

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/leads` | Listar leads do usuário | Bearer |
| GET | `/leads/premium` | Leads premium (score >= 70) | Bearer |
| GET | `/leads/stats` | Estatísticas | Bearer |
| GET | `/leads/:id` | Detalhes | Bearer |
| PATCH | `/leads/:id/status` | Atualizar status | Bearer |

## Favoritos

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/favorites` | Listar favoritos | Bearer |
| POST | `/favorites/:companyId` | Adicionar | Bearer |
| DELETE | `/favorites/:companyId` | Remover | Bearer |
| GET | `/favorites/check/:companyId` | Verificar status | Bearer |

## Exportações

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/exports` | Criar exportação | Bearer |
| GET | `/exports` | Listar exportações | Bearer |
| GET | `/exports/:id` | Status | Bearer |
| GET | `/exports/:id/download` | Download | Bearer |

### Criar Exportação (POST /exports)

```json
{
  "format": "CSV",
  "searchId": "uuid-da-pesquisa",
  "filters": {}
}
```

Formatos: `CSV`, `JSON`, `EXCEL`, `PDF`

## Notificações

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/notifications` | Listar | Bearer |
| PATCH | `/notifications/:id/read` | Marcar lida | Bearer |
| PATCH | `/notifications/read-all` | Marcar todas lidas | Bearer |
| GET | `/notifications/unread-count` | Contagem não lidas | Bearer |

## Health Check

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do sistema |

## Swagger

Documentação interativa: `http://localhost:3001/api/docs`
