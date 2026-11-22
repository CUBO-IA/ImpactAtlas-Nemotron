FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN cp -r public .next/standalone/ \
 && cp -r .next/static .next/standalone/.next/ \
 && mkdir -p .next/standalone/src/data \
 && cp src/data/audited-catalog.json .next/standalone/src/data/

FROM node:24-bookworm-slim AS runner
# Librerías del Chromium empaquetado por @sparticuz/chromium para el PDF.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libasound2 libpangocairo-1.0-0 libgtk-3-0 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder /app/.next/standalone/ ./
# pnpm mantiene módulos nativos (onnxruntime/playwright) bajo .pnpm; el trace de
# standalone no los copia, así que se incluye node_modules completo para el POC.
COPY --from=builder /app/node_modules/ ./node_modules/
EXPOSE 3000
CMD ["node", "server.js"]
