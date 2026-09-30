# Web (Vue 3 + Vuexy): se compila con Vite y se sirve con Nginx.
# La URL de la API se fija al compilar: en Dokploy va como Build Argument VITE_API_BASE_URL.
FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

ARG VITE_API_BASE_URL=https://inventariocontable-backend.codecraft.net.pe/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
