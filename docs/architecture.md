# Arquitetura LeadHunter AI

## Visão Geral

LeadHunter AI é uma plataforma SaaS para prospecção de empresas. O usuário informa localização + categoria → o sistema coleta dados de APIs públicas → enriquece com IA → exibe dashboard.

## Fluxo de Dados

```
Usuário (Web/Mobile)
       │
       ▼
  POST /api/search  ──►  SearchService.create()
       │                     │
       │                     ▼
       │              BullMQ Queue "search"
       │                     │
       │                     ▼
       │         SearchProcessor.process()
       │              │
       │              ├─► GooglePlacesService.searchPlaces()
       │              ├─► NominatimService.searchPlaces()
       │              ├─► OverpassService.searchPlaces()
       │              ├─► FoursquareService.searchPlaces()
       │              └─► YelpService.searchPlaces()
       │                     │
       │                     ▼
       │         CompaniesService.deduplicateAndSave()
       │                     │
       │                     ▼
       │         WebsiteEnricherService.enrichFromWebsite()
       │          (extrai contactos dos sites das empresas)
       │                     │
       │                     ▼
       │         BullMQ Queue "enrichment"
       │                     │
       │                     ▼
       │         EnrichmentProcessor.process()
       │                     │
       │                     ▼
       │         EnrichmentService.enrichCompany()
       │          (OpenAI GPT-4o-mini ou fallback heurístico)
       │                     │
       │                     ▼
       │         Resultados armazenados em companies + enriched_data
       │                     │
       ▼                     ▼
  SSE stream           GET /search/:id/results
  (progresso real-time)     │
                            ▼
                      Dashboard Web / App Mobile
```

## Módulos do Backend

| Módulo | Responsabilidade |
|--------|-----------------|
| `AuthModule` | Autenticação JWT + OAuth2 (Google, GitHub) |
| `UsersModule` | CRUD de usuários, perfis, stats |
| `SearchModule` | Criação e gestão de pesquisas |
| `CompaniesModule` | CRUD de empresas, deduplicação, filtros |
| `LeadsModule` | Leads premium, estatísticas de prospecção |
| `FavoritesModule` | Favoritos dos usuários |
| `ExportsModule` | Exportação CSV/JSON/Excel/PDF |
| `EnrichmentModule` | Análise IA (OpenAI + fallback) |
| `QueueModule` | Processors BullMQ (search, enrichment, exports) |
| `NotificationsModule` | Notificações push |

## Serviços de Coleta

| Serviço | Fonte | Requer Key |
|---------|-------|-----------|
| `GooglePlacesService` | Google Places API | Sim |
| `NominatimService` | OpenStreetMap Nominatim | Não |
| `OverpassService` | Overpass API (OSM) | Não |
| `FoursquareService` | Foursquare Places | Sim (opcional) |
| `YelpService` | Yelp Fusion | Sim (opcional) |
| `WebsiteEnricherService` | Site da própria empresa | Não |

## Banco de Dados

PostgreSQL com Prisma ORM. Principais entidades:

- `users` — autenticação, plano, roles
- `searches` — histórico de pesquisas
- `companies` — empresas coletadas (dados públicos)
- `enriched_data` — análise IA por empresa (1:1)
- `favorites` — relação N:M usuários ↔ empresas
- `data_exports` — exportações geradas
- `notifications` — notificações push
- `audit_logs` — auditoria de ações
- `search_jobs` — jobs de coleta por fonte
- `search_logs` — logs de execução de pesquisa
- `cache_entries` — cache de consultas
- `rate_limits` — controle de rate limiting

## Frontend

Next.js 14 com App Router:
- `/dashboard` — KPIs e ações rápidas
- `/dashboard/search` — formulário de pesquisa + resultados + mapa
- `/dashboard/leads` — listagem paginada com filtros
- `/dashboard/favorites` — favoritos
- `/dashboard/exports` — histórico de exportações
- `/auth/login` — login email/senha + OAuth
- `/auth/register` — cadastro

### Componentes principais
- `LeadsMap` — mapa Leaflet/OpenStreetMap com marcadores e popups
- `CompanyCard` — card de empresa com score IA, badges de redes sociais
- `Sidebar` / `Header` — navegação e tema claro/escuro

## Mobile

Flutter com Provider:
- Splash → Login → Home (Dashboard/Leads/Favoritos/Settings)
- Search com polling de progresso
- Lead detail com ações: ligar, WhatsApp, Maps, Instagram
