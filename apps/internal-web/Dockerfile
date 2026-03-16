# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY apps/internal-web/package*.json ./
RUN npm ci --prefer-offline

COPY apps/internal-web/ .
ARG VITE_API_URL
ARG VITE_WEB_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WEB_URL=${VITE_WEB_URL}
RUN npm run build


# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
