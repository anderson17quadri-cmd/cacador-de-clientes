# Setup — LeadHunter AI

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9.5.0 (`npm install -g pnpm@9.5.0`)
- Docker e Docker Compose (produção)
- PostgreSQL 16 e Redis 7 (local ou via Docker)
- Flutter >= 3.24 (apenas para mobile)

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Obrigatória | Como obter |
|----------|-------------|------------|
| `DATABASE_URL` | Sim | URL do PostgreSQL |
| `REDIS_URL` | Sim | URL do Redis |
| `JWT_SECRET` | Sim | String aleatória longa (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Sim | String aleatória longa |
| `GOOGLE_PLACES_API_KEY` | Recomendado | [Google Cloud Console](https://console.cloud.google.com/) → APIs → Places API |
| `OPENAI_API_KEY` | Recomendado | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `FOURSQUARE_API_KEY` | Opcional | [Foursquare Developer](https://foursquare.com/developers/) |
| `YELP_API_KEY` | Opcional | [Yelp Fusion](https://fusion.yelp.com/) |
| `GOOGLE_CLIENT_ID` | Opcional | Google Cloud Console → OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | Opcional | Google Cloud Console → OAuth 2.0 |
| `GITHUB_CLIENT_ID` | Opcional | GitHub → Settings → Developer Settings → OAuth Apps |
| `GITHUB_CLIENT_SECRET` | Opcional | GitHub → Settings → Developer Settings → OAuth Apps |
| `SMTP_HOST` | Opcional | Servidor de email |
| `SMTP_USER` | Opcional | Usuário SMTP |
| `SMTP_PASS` | Opcional | Senha SMTP |
| `NEXT_PUBLIC_API_URL` | Sim (web) | URL da API (`http://localhost:3001/api`) |

## Google Places API

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione existente
3. Ative a **Places API (New)**
4. Vá em APIs & Services → Credentials
5. Crie uma API Key
6. (Recomendado) Restrinja a key por IP/HTTP referrer

## OpenAI API

1. Acesse [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Crie uma nova secret key
3. Adicione créditos (mínimo $5)
4. O modelo usado é `gpt-4o-mini` (~$0.15/1M tokens input)

## Instalação

```bash
# Clone
git clone https://github.com/anderson17quadri-cmd/cacador-de-clientes.git
cd cacador-de-clientes

# Copie .env
cp .env.example .env
# Edite .env com suas chaves

# Instale dependências
pnpm install

# Setup banco de dados
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Iniciar desenvolvimento
pnpm dev
```

## Docker (Produção)

```bash
./scripts/prod.sh
```
