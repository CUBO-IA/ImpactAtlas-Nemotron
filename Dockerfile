FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN cp -r public .next/standalone/ \
 && cp -r .next/static .next/standalone/.next/ \
 && mkdir -p .next/standalone/src/data \
 && cp src/data/audited-catalog.json .next/standalone/src/data/

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder /app/.next/standalone/ ./
EXPOSE 3000
CMD ["node", "server.js"]
