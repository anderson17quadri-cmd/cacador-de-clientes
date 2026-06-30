# LeadHunter AI

Plataforma SaaS para prospecção de clientes com enriquecimento por Inteligência Artificial.

## Visão Geral

O LeadHunter AI permite que você pesquise qualquer categoria de negócio em qualquer cidade do mundo. O sistema coleta informações públicas de dezenas de APIs (Google Places, OpenStreetMap, etc.), elimina duplicatas, organiza os dados, e utiliza IA para analisar cada empresa — gerando scores de qualidade, identificando necessidades de marketing, automação, e muito mais.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Web** | Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion |
| **Mobile** | Flutter 3.24, Provider, url_launcher |
| **Backend** | NestJS 10, TypeScript, Prisma ORM, BullMQ, Redis, PostgreSQL |
| **IA** | OpenAI GPT-4o-mini para análise de dados públicos |
| **DevOps** | Docker, Docker Compose, Nginx, Turborepo (monorepo) |

## Estrutura do Projeto

```
leadhunter-ai/
├── apps/
│   ├── backend/          # API NestJS
│   │   ├── src/
│   │   │   ├── modules/  # auth, users, companies, search, leads, etc.
│   │   │   ├── common/   # guards, filters, interceptors, decorators
│   │   │   ├── services/ # coletores de dados (Google Places, Nominatim)
│   │   │   ├── config/   # configuração e validação
│   │   │   └── database/ # Prisma service e módulo
│   │   ├── prisma/       # schema, migrations, seed
│   │   └── test/
│   ├── web/              # Frontend Next.js
│   │   └── src/
│   │       ├── app/      # páginas (dashboard, search, leads, auth)
│   │       ├── components/ # UI, layout, charts, maps
│   │       └── lib/      # API client, stores, utils
│   └── mobile/           # App Flutter
│       └── lib/
│           ├── screens/  # splash, login, home, search, leads, etc.
│           ├── services/ # API, auth, search services
│           ├── providers/# state management
│           └── theme/    # app theme
├── packages/
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # formatting, categories, states
│   ├── config/           # app configuration
│   └── ui/               # shared UI components
├── docker/               # Dockerfiles e configs
├── scripts/              # dev e prod scripts
└── docs/                 # documentação
```

## Pré-requisitos

- **Node.js** >= 20
- **pnpm** >= 9.5.0 (`npm install -g pnpm@9.5.0`)
- **Docker** e **Docker Compose** (para produção)
- **PostgreSQL** 16 (local ou via Docker)
- **Redis** 7 (local ou via Docker)
- **Flutter** >= 3.24 (apenas para mobile)

### APIs externas (opcionais mas recomendadas)

- **Google Places API** — para coleta de dados de empresas
- **OpenAI API** — para enriquecimento com IA
- **Mapbox** — para mapas no frontend

## Instalação Rápida

```bash
# 1. Clone o repositório
git clone <repo-url> && cd leadhunter-ai

# 2. Copie e configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas chaves de API e secrets

# 3. Rode o script de desenvolvimento
chmod +x scripts/dev.sh
./scripts/dev.sh

# 4. Inicie o desenvolvimento
pnpm dev
```

## Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Gerar Prisma client
pnpm db:generate

# Rodar migrations
pnpm db:migrate

# Popular banco com dados de seed
pnpm db:seed

# Iniciar todos os serviços
pnpm dev

# Iniciar apenas backend
pnpm dev:backend

# Iniciar apenas frontend web
pnpm dev:web

# Rodar testes
pnpm test

# Lint
pnpm lint
```

### URLs de Desenvolvimento

| Serviço | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API | http://localhost:3001/api |
| Swagger Docs | http://localhost:3001/api/docs |
| Health Check | http://localhost:3001/health |

## Produção com Docker

```bash
# Build e deploy
chmod +x scripts/prod.sh
./scripts/prod.sh
```

Ou manualmente:

```bash
# Construir imagens
docker-compose build

# Rodar migrations em produção
docker-compose run --rm backend pnpm db:migrate:prod

# Popular banco
docker-compose run --rm backend pnpm db:seed

# Iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

### Serviços Docker

| Container | Porta | Descrição |
|-----------|-------|-----------|
| leadhunter-postgres | 5432 | PostgreSQL 16 |
| leadhunter-redis | 6379 | Redis 7 |
| leadhunter-backend | 3001 | API NestJS |
| leadhunter-web | 3000 | Next.js |
| leadhunter-nginx | 80 | Proxy reverso |

## Funcionalidades

### Pesquisa de Empresas
- Busca por categoria, cidade, estado, país, CEP, coordenadas
- Raio configurável: 1km até 100km ou sem limite
- Múltiplas fontes de dados: Google Places, OpenStreetMap/Nominatim
- Processamento paralelo com BullMQ workers
- Progresso em tempo real via SSE
- Deduplicação inteligente

### Coleta de Dados
Para cada empresa, o sistema captura:
- Nome, categoria, descrição
- Telefone, WhatsApp, email
- Website, Instagram, Facebook, LinkedIn, TikTok, YouTube
- Endereço completo (rua, número, bairro, cidade, estado, CEP, país)
- Coordenadas GPS, link Google Maps
- Horário de funcionamento
- Avaliação e quantidade de avaliações
- Fotos públicas

### Enriquecimento com IA
- Score de qualidade (0-100)
- Nível de presença digital (Muito Baixa a Excelente)
- Análises: identidade visual, website moderno, Instagram ativo
- Identificação de necessidades: marketing, automação, chatbot, novo site, tráfego pago
- Justificativa textual baseada em evidências públicas

### Dashboard
- Total de empresas, com/sem Instagram, Website, WhatsApp, Email
- Média de avaliações
- Leads Premium (alto potencial)
- KPIs e indicadores visuais

### Exportação
- CSV, JSON
- Filtros por categoria, cidade, avaliação, redes sociais, score IA

### Segurança
- JWT + Refresh Token
- OAuth2 (Google, GitHub)
- RBAC (USER, ADMIN, SUPER_ADMIN)
- Rate limiting
- Helmet, CORS
- Sanitização de inputs
- Auditoria completa

## API Endpoints

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Registro |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Perfil do usuário |
| GET | `/api/auth/google` | Google OAuth |
| GET | `/api/auth/github` | GitHub OAuth |

### Search
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/search` | Criar pesquisa |
| GET | `/api/search` | Listar pesquisas |
| GET | `/api/search/:id` | Detalhes da pesquisa |
| GET | `/api/search/:id/progress` | Progresso |
| GET | `/api/search/:id/logs` | Logs |
| POST | `/api/search/:id/cancel` | Cancelar |
| GET | `/api/search/:id/results` | Resultados |

### Companies
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/companies` | Listar com filtros |
| GET | `/api/companies/:id` | Detalhes |
| GET | `/api/companies/:id/analysis` | Análise IA |
| GET | `/api/companies/stats/overview` | Estatísticas |

### Leads
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/leads` | Listar leads |
| GET | `/api/leads/premium` | Leads premium |
| GET | `/api/leads/stats` | Estatísticas |

### Favorites
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/favorites` | Listar favoritos |
| POST | `/api/favorites/:companyId` | Adicionar |
| DELETE | `/api/favorites/:companyId` | Remover |

### Exports
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/exports` | Criar exportação |
| GET | `/api/exports` | Listar |
| GET | `/api/exports/:id/download` | Download |

## Banco de Dados

### Principais tabelas
- `users` — usuários com planos e roles
- `searches` — pesquisas realizadas
- `companies` — empresas encontradas
- `enriched_data` — dados enriquecidos por IA
- `favorites` — favoritos dos usuários
- `data_exports` — exportações geradas
- `notifications` — notificações
- `audit_logs` — auditoria
- `search_logs` — logs de pesquisa
- `search_jobs` — jobs de coleta
- `cache_entries` — cache
- `rate_limits` — controle de rate limit

## Contribuição

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

Este projeto é proprietário. Todos os direitos reservados.

---

**LeadHunter AI** — Prospecção Inteligente para o seu Negócio
