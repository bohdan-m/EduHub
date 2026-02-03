# base
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
# Устанавливаем зависимости
RUN npm ci
COPY . .

# dev
FROM base AS dev

RUN mkdir -p /app/node_modules/.vite-temp && chown -R node:node /app

USER node
EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5173', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# build
FROM base AS build
RUN npm run build

# prod 
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
