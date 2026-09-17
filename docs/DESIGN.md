# Lantern Corps — Design

A top-down canvas game where you play as a Green Lantern of Sector 2814. The ring
builds constructs, willpower powers them, and the Lantern battery recharges them.

## Modes
- **Single player:** choose **Hal Jordan** or **John Stewart**.
- **Co-op:** a second player joins as the other Lantern. Couch co-op comes first, online later.

## The two Lanterns
| | Hal Jordan | John Stewart |
|---|---|---|
| Style | Improviser, aggressive | Marine / architect, controlled |
| Constructs | Build faster, hit harder, break sooner | Sturdier; structures (walls, turrets) cost less |
| Role in co-op | Damage, pressure | Defense, area control |

## View
Same as project-7: the **world is seen from above** (move up/down/left/right freely), but
**characters are drawn side-on**, standing upright, facing left or right, legs animating, with a
ground shadow. Positions are the characters' feet, and lower on screen is drawn in front.

## Environments
Every mission is either **space** or **planet**:
- **Space:** Lanterns are always flying. They hover, lean into the direction of travel with the ring
  arm forward, and have the green aura and a glowing ring. There's no ground, so no shadow.
- **Planet:** Lanterns walk with a ground shadow and **no glow**; the ring is just a small light.
  Take-off and landing (below) apply here.

Rules live in `src/lib/engine/environment.ts`. Test either with `/play?as=hal&env=planet` or the
toggle in `/lab/movement`.

## Movement: ground and air
The Lanterns have two states, not a full height system.
- **Ground:** blocked by walls and buildings, can interact and rescue, recharges willpower faster.
- **Air:** faster, passes over obstacles, can be hit by flying enemies. Shown by the body lifting above its ground shadow.

## Willpower
One resource powers every construct. Bigger or stronger constructs cost more.
The **Lantern battery** recharges the ring, so players have to choose their moments.

## Constructs
Every construct, whether preset or custom, uses one of 8 **behavior types**:

| Type | Examples |
|---|---|
| Rapid ranged | AK-47, minigun, nail gun |
| Heavy ranged | bazooka, cannon, bow |
| Light melee | knife, sword, whip |
| Heavy melee | hammer, giant fist, bat |
| Barrier | shield, wall, dome |
| Grab | chain, hand, lasso |
| Trap | cage, net, bear trap |
| Area | bomb, shockwave, wrecking ball |

- **Presets** go on hotkeys for fast combat. Hal and John have different sets.
- **Ring Forge** (between missions): design a custom construct by giving it a name, a shape and a
  behavior type, and spending a **budget** on size, power and willpower cost. Equip it to a slot.
  It's freeform in *look*, bounded in *behavior*, so everything stays balanced.
- *Later idea:* type any word and an AI (called from a SvelteKit server route) picks the behavior type.

## Enemies (planned)
Manhunters (swarm), Yellow Lanterns / Sinestro Corps (fear constructs that crack green
constructs faster), Red Lanterns (rage plasma, close range), Sinestro (rival boss),
Parallax (final boss).

## Tech
- **SvelteKit** (Svelte 5 runes) + TypeScript + HTML Canvas 2D. Vitest for tests.
- `src/lib/engine/`: plain TypeScript game engine with **no Svelte imports**.
- `src/routes/`: `/` menu, `/play` the game, `/forge` Ring Forge (later), `/lab/*` dev-only test pages.
- `/lab` returns 404 in production builds (see `src/hooks.server.ts`).

### Rules from day one
1. The engine never imports Svelte.
2. Players are always an array, even in single player.
3. Input sources are separate from players (keyboard, gamepad, and later the network).
4. Fixed-timestep simulation (60 ticks/s), with rendering separate from ticks.
5. Constructs are data definitions, and presets and Forge constructs share one system.
6. Art is drawn in code (glowing green shapes) until there's a reason for sprites.

## Milestones
**Phase 0: Foundations**
- [x] **M0** SvelteKit setup, routes (`/`, `/play`, `/lab`), responsive canvas, fixed-timestep loop, lab guard, tests

**Phase 1: Single-player core**
- [x] **M1** Character select (Hal/John), top-down movement, input sources
- [ ] **M2** Test map with obstacles, fly/land states, following camera
- [ ] **M3** Willpower + Lantern battery, first construct (beam)
- [ ] **M4** Construct system: 8 behavior types, Hal and John preset sets on hotkeys
- [ ] **M5** Manhunter enemies: AI, health, damage, death
- [ ] **M6** First mission: objective, win/lose, HUD, restart

**Phase 2: Couch co-op**
- [ ] **M7** Player 2 joins (keyboard/gamepad), shared camera, revive a downed partner

**Phase 3: Ring Forge**
- [ ] **M8** Forge screen, saved custom constructs, equip slots

**Phase 4: Campaign**: Sector 2814 map, Yellow/Red Lanterns, Sinestro, Parallax

**Phase 5: Online multiplayer**: server, sync, lobby / join code
