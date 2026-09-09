FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/config/package.json packages/config/
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile

COPY packages/types/src packages/types/src
COPY packages/utils/src packages/utils/src
COPY packages/config/src packages/config/src
COPY apps/backend apps/backend

RUN pnpm --filter=@leadhunter/backend db:generate
RUN pnpm --filter=@leadhunter/backend build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/backend/node_modules /app/apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist /app/apps/backend/dist
COPY --from=builder /app/apps/backend/package.json /app/apps/backend/
COPY --from=builder /app/apps/backend/prisma /app/apps/backend/prisma

RUN mkdir -p /app/uploads/exports

EXPOSE 3001

CMD ["sh", "-c", "node apps/backend/node_modules/prisma/build/index.js db push --schema apps/backend/prisma/schema.prisma --skip-generate && node apps/backend/dist/src/main.js"]
