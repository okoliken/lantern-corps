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

## Controls
Everything can be remapped in the pause menu (**Esc → Controls**), including mouse buttons and the
scroll wheel. Settings are saved in the browser.

| Action | Single player | Co-op P1 | Co-op P2 |
|---|---|---|---|
| Move | WASD or arrows | WASD | Arrows |
| Aim | Mouse | Mouse | Auto-target |
| Ring shot (free) | Left click or J | Left click or F | . |
| Use construct | Right click or K | Right click or G | / |
| Previous / next construct | Scroll, or Q / E | Scroll, or Q / E | ; / ' |
| Pick construct | 1–5 | 1–5 | 6–0 |
| Bubble shield | Left Shift or L | Left Shift | Right Shift |
| Take off / land | Space | Space | Enter |
| Lock target | Tab | Tab | , |
| Pause, controls, options | Esc | Esc | Esc |

**Ring shot:** a free basic attack. Quick green bolts (about 5 a second, 9 damage) that cost no
willpower and work even when exhausted. Constructs are the special moves that cost willpower.

**Accessibility options:** aim assist on/off, toggle ring shot (tap to start and stop instead of
holding), damage numbers on/off, reduce flashing. A first-time "How to play" card shows the current
bindings.

## Targeting (context awareness)
The ring works out what you mean to hit or protect (`src/lib/engine/targeting.ts`):
- **Mouse aim:** shots go where the crosshair points. Aim assist nudges them onto an enemy only if
  it's within 10° of that line.
- **Keyboard aim:** attacks aim at the nearest enemy in a 30° cone ahead that you can **see** and
  **reach** with the construct in hand; otherwise straight where you face. "See" uses each
  obstacle's whole on-screen silhouette, so enemies hidden under a roof aren't picked.
- **Lock on (Tab):** cycles enemies, then allies, then objects, then back to no lock. Locks break
  when the target is destroyed or you move far away. A locked target gets a rotating reticle.
- **Protect:** lock an ally and your **bubble shield** goes on them; attacks keep auto-targeting enemies.

## Bubble shield
Every Lantern has it, on its own key (E). It shields you, or a locked ally within 450px. It absorbs
damage until broken or expired (12s × durability, 120 hp × durability), costs 12 willpower, and casting
again refreshes it.

## Obstacles
Obstacles have a **footprint** on the ground (used for collision) and a visual **height**.
- Walking: every obstacle blocks you. You slide along walls.
- Flying: you pass over buildings, rocks and crates. **Asteroids block flyers too.**
- You can't land on top of an obstacle.

## Environments
Every mission is either **space** or **planet**:
- **Space:** Lanterns are always flying. They hover, lean into the direction of travel with the ring
  arm forward, and have the green aura and a glowing ring. There's no ground, so no shadow.
- **Planet:** Lanterns walk with a ground shadow and **no glow**; the ring is just a small light.
  Take-off and landing (below) apply here, and **a Lantern flying over a planet glows too**, with
  a smaller shadow on the ground below.

**Glow rule:** glow whenever flying (space or planet), never while walking.

Rules live in `src/lib/engine/environment.ts`. Test either with `/play?as=hal&env=planet` or the
toggle in `/lab/movement`.

## Movement: ground and air
The Lanterns have two states, not a full height system.
- **Ground:** blocked by walls and buildings, can interact and rescue, recharges willpower faster.
- **Air:** faster, passes over obstacles, can be hit by flying enemies. Shown by the body lifting above its ground shadow.

## Willpower
One resource (0–100) powers every construct. Numbers live in `src/lib/engine/willpower.ts`.
- Constructs cost willpower per use (the beam per second). Hit 0 and you're **exhausted**: nothing works
  until you're back to 15.
- Passive recovery starts 0.6s after your last construct: 6/s on the ground, 2/s flying.
- **Lantern battery:** stand within 90px to refill at 45/s. The battery holds 400 charge and
  only recovers 4/s, so you can't camp it through a long fight.

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

- **Presets** go on hotkeys for fast combat. Hal and John have different sets:
  - **Hal:** Beam, Minigun (rapid), Sword (slash), Giant Fist (smash), Chain (grab)
  - **John:** Beam, Cannon (heavy), Energy Wall (barrier), Cage (trap), Shockwave (area)
- The **beam** is the ring's basic hold-to-fire construct, on top of the 8 types. Beam and rapid are
  held; everything else fires once per press, with a cooldown.
- **Traits** (in `lanterns.ts`): Hal ×1.2 power, ×0.85 cooldowns, ×0.75 durability. John ×1.4
  durability and ×0.7 cost on structures (walls, cages).
- Definitions live in `src/lib/engine/constructs/defs.ts`; behaviors in `constructs/system.ts`.
- **Training dummies** (test maps only) take damage, knockback, chains and cages. They respawn after
  breaking. Try everything in `/lab/constructs`.
- **Ring Forge** (between missions): design a custom construct by giving it a name, a shape and a
  behavior type, and spending a **budget** on size, power and willpower cost. Equip it to a slot.
  It's freeform in *look*, bounded in *behavior*, so everything stays balanced.
- *Later idea:* type any word and an AI (called from a SvelteKit server route) picks the behavior type.

## Story & enemies
See **[STORY.md](STORY.md)**: "Red Frontier". Following the comics and animated series, Red Lanterns
(led by Atrocitus) are the main enemy and Manhunters the second threat. It has the full bestiary,
acts, missions and character arcs. Enemy build order: Rage Grunt → Plasma Spitter → Rage Brute →
Skarr Vell → Manhunters → Dex-Starr → Atrocitus.

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
- [x] **M2** Test maps (planet city + asteroid field), collisions, take-off/landing, following camera with zoom
- [x] **M3** Willpower + Lantern battery, first construct (beam), breakable crates, HUD
- [x] **M4** Construct system: beam + 8 behavior types, Hal/John loadouts on keys 1–5, traits, training dummies, constructs lab
- [x] **M4.5** Feedback pass: tuning (cheaper, longer-lasting), targeting + lock-on, bubble shield, construct art pass
- [ ] **M5** First enemies (Red Lanterns, per STORY.md): Lantern health + damage, Rage Grunt → Plasma Spitter → Rage Brute
- [ ] **M6** First mission: objective, win/lose, HUD, restart

**Phase 1.5: Characters** (before enemies, by request)
- [x] **C1** Controls & accessibility: mouse aim, free ring shot, remappable bindings, pause menu, options, first-time card
- [x] **C2** Art & animation: skeleton (animation.ts), detailed Hal/John, idle/walk/take-off/fly/shoot/cast/hurt/downed/victory, /lab/animation
- [ ] **C3** Signature abilities: super meter; Hal "Jet Strike", John "Fortress"
- [ ] **C4** Stats & progression: XP, levels, upgrades, unlocks, Corps HQ screen, per-character save
- [ ] **C5** Story & personality: bios, intro cards, combat lines, co-op banter

**Phase 2: Couch co-op**
- [ ] **M7** Player 2 joins (keyboard/gamepad), shared camera, revive a downed partner

**Phase 3: Ring Forge**
- [ ] **M8** Forge screen, saved custom constructs, equip slots

**Phase 4: Campaign**: "Red Frontier" (see STORY.md): 3 acts, 13 missions, sector map

**Phase 5: Online multiplayer**: server, sync, lobby / join code
