# base
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# dev
FROM base AS dev
EXPOSE 5173
CMD ["npm", "run", "dev"]

# build
FROM base AS build
RUN npm run build

# prod 
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
