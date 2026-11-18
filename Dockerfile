# syntax=docker/dockerfile:1
# Jellyfin web client (Svelte). Targets:
#   docker build --target export -o out .   → static files in ./out (for any Jellyfin install)
#   docker build --target server -t jellyfin-svelte .   → official Jellyfin image serving this client
ARG NODE_VERSION=22
ARG JELLYFIN_IMAGE=jellyfin/jellyfin:latest

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM scratch AS export
COPY --from=build /app/build /

FROM ${JELLYFIN_IMAGE} AS server
# Installed beside the stock client; unset JELLYFIN_WEB_DIR to switch back.
COPY --from=build /app/build /jellyfin/jellyfin-web-svelte
ENV JELLYFIN_WEB_DIR=/jellyfin/jellyfin-web-svelte
