# base
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
# Устанавливаем зависимости
RUN npm ci
COPY . .

# dev
FROM base AS dev

RUN mkdir -p /app/.next && chown -R node:node /app

USER node
EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5173/api/auth/ok', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# build
FROM base AS build
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# placeholder only so module evaluation during the build doesn't complain; not stored in the image
RUN BETTER_AUTH_SECRET=build-time-placeholder npm run build

# prod: the standalone server from next.config's output: "standalone"
FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/ok || exit 1
CMD ["node", "server.js"]
