FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install all dependencies (including workspace links)
RUN npm ci

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
COPY packages/client/ ./packages/client/

# Build in dependency order: shared -> server + client
RUN npm -w packages/shared run build && \
    npm -w packages/server run build && \
    npm -w packages/client run build

# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3001

# Copy production dependencies
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy workspace packages needed at runtime
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/

# Copy built client files (served as static by the server)
COPY --from=builder /app/packages/client/dist ./packages/client/dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3001/api/health || exit 1

CMD ["npx", "tsx", "packages/server/dist/index.js"]
