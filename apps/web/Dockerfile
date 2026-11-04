# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Copy source
COPY apps/web ./apps/web
COPY tsconfig.json ./

# Build
WORKDIR /app/apps/web
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm build

# Production stage - nginx to serve static files
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
