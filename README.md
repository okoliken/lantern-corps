# Lantern Corps

Top-down Green Lantern canvas game with SvelteKit, Svelte 5 and TypeScript. Play as Hal Jordan or
John Stewart, solo or in co-op.

See [docs/DESIGN.md](docs/DESIGN.md) for the design and milestone plan.

## Scripts
```sh
npm run dev      # dev server: game at /play, test labs at /lab
npm run dev:pad  # the same, reachable from your phone on the same Wi-Fi (the phone pad)
npm test         # engine unit tests (Vitest)
npm run check    # type check
npm run build    # production build (/lab returns 404)
npm run preview  # serve the production build locally
```

## Playing on your phone
`/pad` is a PS-style touch controller for a phone: pair it from the game's pause menu (**Phone pad**
tab) by scanning the QR code. Phone and computer need to be on the same network (`npm run dev:pad`),
or use the published game, where a small Cloudflare service passes the messages along.

## Publishing (Cloudflare)
The game is a static site; the phone pad needs a relay that stays online.

```sh
npm run build                       # → build/ (what Cloudflare Pages serves)
npm run pad:deploy                  # → the pad relay (pad-relay-worker/), a Cloudflare Worker
```

**Cloudflare Pages** (connected to this repo, so every push to `main` deploys):
- Build command: `npm run build`
- Output directory: `build`
- Variable: `VITE_PAD_RELAY` = the pad relay Worker's address (e.g. `https://lantern-corps-pad.<account>.workers.dev`)
