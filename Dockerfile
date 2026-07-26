# ─── deps ───
# Используем slim (debian) вместо alpine: Prisma engine требует совместимый OpenSSL,
# а alpine 3.19+ имеет openssl 3.x, под который Prisma генерирует неподходящий engine.
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --include=dev

# ─── dev (локальная разработка через docker-compose.dev.yml) ───
FROM node:20-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── builder (production-сборка) ───
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ─── runner (production-образ) ───
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]
