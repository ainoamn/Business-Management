# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Copy source
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Generate Prisma client and build
WORKDIR /app/apps/api
RUN pnpm prisma generate
RUN pnpm build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
