# syntax=docker/dockerfile:1
# Jellyfin web client (Svelte). Targets:
#   docker build --target export -o out .   → static files in ./out (for any Jellyfin install)
#   docker build --target server -t jellyfin-svelte .   → official Jellyfin image serving this client
ARG NODE_VERSION=22
ARG JELLYFIN_IMAGE=jellyfin/jellyfin:latest

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
RUN npm install -g bun@1.4.4
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM scratch AS export
COPY --from=build /app/build /

FROM ${JELLYFIN_IMAGE} AS server
# Installed beside the stock client; unset JELLYFIN_WEB_DIR to switch back.
COPY --from=build /app/build /jellyfin/jellyfin-web-svelte
ENV JELLYFIN_WEB_DIR=/jellyfin/jellyfin-web-svelte
