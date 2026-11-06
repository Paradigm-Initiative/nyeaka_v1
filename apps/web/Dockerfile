# syntax=docker/dockerfile:1

ARG NODE_VERSION=24-alpine

# ---- deps: install with frozen lockfile ----
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- builder: prisma generate + next build ----
FROM node:${NODE_VERSION} AS builder
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders so prisma.config.ts / module-level env reads don't throw at build.
# Real values come from Coolify at runtime.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
ARG BETTER_AUTH_SECRET="build-time-placeholder"
ARG BETTER_AUTH_URL="http://localhost:3000"
ENV DATABASE_URL=${DATABASE_URL} \
    BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET} \
    BETTER_AUTH_URL=${BETTER_AUTH_URL}

RUN pnpm exec prisma generate && pnpm build

# ---- runner: minimal standalone image ----
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl curl
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fs http://127.0.0.1:3000/ -o /dev/null || exit 1

CMD ["node", "server.js"]
