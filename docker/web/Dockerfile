FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/config/package.json packages/config/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/types/src packages/types/src
COPY packages/utils/src packages/utils/src
COPY packages/config/src packages/config/src
COPY apps/web apps/web

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build --filter=@leadhunter/web

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public /app/apps/web/public
COPY --from=builder /app/apps/web/.next/standalone /app/
COPY --from=builder /app/apps/web/.next/static /app/apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "apps/web/server.js"]
