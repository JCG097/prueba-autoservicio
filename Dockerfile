# Etapa 1: instala solo las dependencias de producción.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Etapa 2: imagen final mínima, sin npm ni herramientas de build.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
# Se quita npm de la imagen final: no se necesita para ejecutar la app y reduce vulnerabilidades.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY app ./app
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "app/src/server.js"]
