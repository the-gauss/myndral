# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /repo/apps/web

# Install deps before copying source so the node_modules layer is cached
# independently of application code changes.
COPY apps/web/package*.json ./
RUN npm ci --prefer-offline

# Recreate the repo layout the app expects so shared brand imports resolve
# identically in Docker and local builds.
WORKDIR /repo
COPY apps/web/ apps/web/
COPY shared/brand/ shared/brand/

WORKDIR /repo/apps/web
ARG VITE_API_URL
ARG VITE_STUDIO_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_STUDIO_URL=${VITE_STUDIO_URL}
RUN npm run build


# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Remove the default server config; supply our SPA-aware one.
RUN rm /etc/nginx/conf.d/default.conf
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf

COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

# nginx listens on 8080 (non-root, matches Cloud Run default PORT).
# The base image runs nginx as root by default; rebind to an unprivileged port.
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf 2>/dev/null || true

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
