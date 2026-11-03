# Multi-stage Dockerfile for apps/api
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/
RUN npm ci --workspace=apps/api
RUN cd apps/api && npx prisma generate

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json ./
COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

# Production Runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY package.json ./

EXPOSE 3001

CMD ["sh", "-c", "cd apps/api && npx prisma db push --skip-generate && node dist/src/main.js"]

