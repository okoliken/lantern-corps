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
**On the phone itself (the mobile edition):** open the game on a phone or tablet and every fight gets
on-screen touch controls: a floating move stick on the left, a floating aim stick on the right (the
ring also aims itself), □ ✕ ○ △ face buttons, ◀ ▶ ◎ ★ above them, Backup and Pause at the bottom, and
the hotbar (top left) tapped to use a construct. Hold the phone sideways. Add it to the home screen
(Share, then Add to Home Screen) and it opens fullscreen and sideways like an app. The pause menu's
Options tab switches touch controls on for any screen, or off; `?touch=1` in the address forces them on
a laptop for testing.

**As a controller for the computer:** `/pad` is a PS-style touch controller for a phone: pair it from
the game's pause menu (**Phone pad** tab) by scanning the QR code. Phone and computer need to be on
the same network (`npm run dev:pad`), or use the published game, where a small Cloudflare service
passes the messages along.

## Publishing (Cloudflare)
One Cloudflare Worker serves both: the built game (`build/`, static files) and the phone pad's relay
(`/ws` and `/rooms`, a Durable Object in `worker/`). Settings live in `wrangler.jsonc`.

```sh
npm run build     # → build/
npm run deploy    # build, then deploy the Worker
npm run preview   # run exactly what Cloudflare runs, locally (wrangler dev)
```

Connected to this repo, Cloudflare builds and deploys on every push to `main`:
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
