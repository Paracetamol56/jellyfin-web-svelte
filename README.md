# Jellyfin web client (Svelte)

A redesigned web client for Jellyfin, built with Svelte 5, SvelteKit (static SPA), Tailwind CSS 4 and shadcn-style components on bits-ui. It talks to any Jellyfin server through `@jellyfin/sdk`.

Screens follow the "Jellyfin redesign" design canvas: Home, Movie / Show / Album detail, the Music library (grid, list, A–Z), and Now Playing in desktop, mobile and TV (10-foot) layouts, plus a full-screen video player.

## Develop

```sh
bun install
bun dev            # http://localhost:5173, then sign in with your server's address
```

If your server restricts cross-origin requests (Dashboard → Networking → "CORS hosts"), let the dev server proxy it instead: put `VITE_JELLYFIN_URL=https://your-server` in `.env.local` (see `.env.example`) and restart. The login page then defaults to the proxy.

## Test

| Command | What it runs |
| --- | --- |
| `bun run lint` | `svelte-check` type-check, warnings fail |
| `bun run test` | Vitest unit tests (formatting, device profile) |
| `bun run test:e2e` | Playwright against the production build with a **mocked Jellyfin API** (no server needed): sign-in, browsing, library tabs/sort/A–Z, search, album + video playback, progress reporting, accessibility (axe, light + dark) |
| `bun run test:visual` | Screenshot comparison of the 7 design screens (baselines in `e2e/__screenshots__`; refresh with `--update-snapshots`) |
| `bun run test:live` | Read-only smoke test against a real server, configured in `.env.test.local` (`JELLYFIN_URL`, `JELLYFIN_TEST_USER`, `JELLYFIN_TEST_PASSWORD`) |

Set `PW_CHROME=/usr/bin/chromium` to use a system Chromium instead of `playwright install`.

## Deploy

The build is a folder of static files with hash routing, so it works under any path or base URL.

**Any existing Jellyfin server** — build, then point the server at the folder:

```sh
bun run build                                 # → build/
jellyfin --webdir /path/to/client/build      # or JELLYFIN_WEB_DIR=/path/to/client/build
# from this repo: dotnet run --project Jellyfin.Server -- --webdir client/build
```

**Docker (existing container)** — mount the build over the web directory: `-v ./build:/jellyfin/jellyfin-web:ro`, or export it without Node installed: `docker build --target export -o build .` (needs BuildKit/buildx; with the legacy builder: `docker build --target build -t jf-client . && docker cp $(docker create jf-client):/app/build ./build`)

**Docker (new stack)** — Jellyfin with this client built in:

```sh
MEDIA_DIR=/path/to/media docker compose up --build    # http://localhost:8096
```

CI (`.github/workflows/ci-client.yml`) runs the checks above and attaches `jellyfin-web-svelte.tar.gz`.

## Notes

- Device profile: `src/lib/player/profile.ts` probes what the browser can decode and offers HLS transcoding (played via hls.js) for the rest.
- Icons: `static/favicon.svg` is the source (the Jellyfin mark). `node scripts/make-icons.mjs` re-renders the PNG sizes and the iOS home-screen icon; `favicon.ico` wraps the 32px PNG.
- Per-device settings (theme, TV layout, "don't report playback") live in Settings.
- Not yet covered compared to the stock client: the admin dashboard, Live TV / DVR, SyncPlay, Chromecast, plugin pages, subtitle download/management, books and photos viewers. Admins should keep the stock client available for server administration.
