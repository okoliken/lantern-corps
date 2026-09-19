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
| Pick construct (10 slots) | 1–9, 0 | 1–5, then Z X C V B | 6–0, then - = [ ] \ |
| Bubble shield | Left Shift or L | Left Shift | Right Shift |
| Take off / land | Space | Space | Enter |
| Signature ability | R or middle click | R | P |
| Lock target | Tab | Tab | , |
| Pause, controls, options | Esc | Esc | Esc |

**Ring shot:** a free basic attack. Green bolts in a **double tap** ("pum-pum … pum-pum": two bolts
0.11s apart, then a short rest; a little under 4 a second, 10 damage each). A single tap always fires
both. They cost no willpower and work even when exhausted. Constructs are the special moves that cost
willpower.

**Four buttons are enough.** Left click shoots, right click makes a construct, Shift shields, R is the
signature. Everything else is optional.

**Smart ring** (on by default, Options; `constructs/smart.ts`): the construct button makes whatever the
moment needs, scored by what each construct DOES (its behavior), counting only what's ready and
affordable: sword/fist/hammer up close, shockwave or shotgun when crowded, rockets or pillars for a pack
further off, the sniper for something far away, wall/cage/mines when something is rushing you, an aid
station when you or a partner is badly hurt, an auto-turret when there are several enemies and none is
out. Holding the button keeps choosing (a held pick like the beam runs for a second, then it picks
again). The HUD shows what it would make next ("Right click ▸ Rocket Pod") and lights that slot. Number
keys still pick by hand.

**Smart shield** (Shift): the bubble goes on whoever is in the most danger right now: you, a partner in
reach (enemies winding up on them, red shots flying at them), or **something you're protecting**
(`ConstructWorld.protectables`, e.g. Tomar-Re's ship, whose danger is the asteroids on a collision
course). A locked ally (Tab) always wins. The HUD shows where it would go ("🛡 Tomar-Re's ship").

**Quick cast** (on by default, Options): a construct's key USES it straight away: tap for one-shot
constructs, hold for the beam, minigun and sniper charge. Scroll + construct button still works (and is
the only way with Quick cast off).

**What you see is what you hit:** shots and beams travel on the ground plane but are drawn at the ring's
height, so every target has a **hurtbox** matching its drawn body (`BODY` in `dummy.ts`): a shot hits
when its drawn position touches the drawn body. Aiming (mouse, aim assist, auto-target, AI partner,
homing missiles) goes for the middle of the body at the shot's height. Enemy shots work the same way
against the Lantern's drawn body (`hitsBody` / `bodyAim` in `player.ts`), so a Lantern flying high over a
planet isn't hit by bolts passing under their feet.

**Facing:** Lanterns face the way they move. Attacking turns them toward the aim, and they keep facing
it for a moment (so steady fire doesn't flip them back and forth); moving away while doing so is a
slower backpedal with the legs stepping backwards. Standing still, they look at the crosshair. Turning
around is a quick spin, not an instant flip.

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

## Signature abilities
The **surge meter** (thin bar under willpower) fills from damage you deal (0.16 per point), constructs
used (+2) and allies shielded (+6). Signature damage doesn't refill it. Full = press **R**.
- **Hal: Jet Strike.** A construct fighter jet rockets along your aim for ~520px, flying over buildings
  (asteroids and walls stop it). It hits everything in its path once (60 × power) and breaks crates,
  then fires 6 homing missiles at enemies within 420px.
- **John: Fortress.** A dome (radius 120) where he stands for 9s × durability. Enemies are pushed out,
  anyone inside takes no damage, and 3 rim turrets shoot enemies within 380px.

## Progression
Kept simple (`src/lib/engine/progression.ts`, saved per Lantern in the browser):
- Defeating an enemy gives **+25 XP**. Level n → n+1 needs 100 × n XP. Max level 10.
- Each level gives **1 upgrade point**. Four upgrades, 5 ranks each, taking effect right away:
  **Willpower** (+10 max), **Recovery** (+15% regen), **Power** (+6% construct damage),
  **Focus** (−5% cooldowns). Health comes in M5 when Lanterns can be hurt.
- Points are spent at **Corps HQ** (`/hq`), from the menu, character select or pause menu.
  Refunds are free. Labs don't use progression.

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

- **Presets** go on hotkeys for fast combat. **Ten each** (user request 2026-09-18), different sets:
  - **Hal (test pilot: fast, aggressive, up close):** Beam, Minigun, Sword, Giant Fist, Chain,
    **Warhammer** (overhead smash that dazes), **Rocket Pod** (4 homing missiles), **Buzzsaw** (thrown,
    cuts out and back), **Afterburner** (dash through enemies, can't be hurt during it), **Shotgun** (7-pellet spread)
  - **John (Marine + architect: control, defense, engineering):** Beam, **Sniper Rifle** (hold to charge,
    release: piercing shot through a whole line), Energy Wall, **Auto-Turret** (max 2), **Pillar Drop**
    (warning circle, then damage + stun), **Cannon** (splash shell), **Cage** (trap; Snare Field in space),
    **Shockwave**, **Mines** (up to 4, blow up when an enemy comes close), **Aid Station** (heals Lanterns
    standing in it; Med Beacon in space)
- **Constructs work in every environment.** Anything that depends on standing on the ground has a
  **space form**: same key, same job, same numbers, only the look and name change
  (`space` on the construct definition):
  | Planet | Space |
  |---|---|
  | Energy Wall | Force Field (floating energy sheet between emitters) |
  | Auto-Turret (tripod) | Sentry Drone (hovering) |
  | Pillar Drop (pillars fall) | Vice Crush (two slabs slam together) |
  | Cage | Snare Field |
  | Aid Station | Med Beacon |
  | Fortress (dome on the ground) | Fortress (sphere, turrets become drones) |
  A test checks that every ground-bound construct in a loadout has a space form.
- **Kits v2 (2026-09-19, the user's lists):** every slot does damage, and each Lantern's style shows.
  **Hal** (flashy, willpower-first): Boxing Glove (fast spring punch), Ring Blast (beam), Fighter Jet
  (dash in a construct jet + 2 missiles), Giant Hammer, Buzzsaw, Locomotive (`ram`: charges out and
  hits everything in its path), Gatling, Anvil Drop (pillars behavior, anvil art; space form "Anvil
  Strike"), Energy Sword, Green Grenades (3 lobbed in a fan, each bursts where it lands).
  **John** (engineered, military): Precision Rifle, Assault Rifle, Marine Fireteam (`squad`: 3
  construct Marines that follow him and shoot, turrets with `follow`), Heavy Cannon, Power Armor
  (`armor`: 8s, takes 40% damage, ring shot becomes an arm cannon), Reinforced Fist, Wrecking Ball
  (`breaker`: shatters Red Lantern shields, double damage to breakables), Missile Pods, I-Beam Volley
  (`lances`: piercing girders), Industrial Cutter (`grind`, held: a spinning blade out front).
  John's power trait went 1.0 → 1.1. His wall/cage/turret/mines/aid left his loadout (still defined;
  Kilowog keeps wall and cage). Art in `draw/kits.ts`.
- **Close-range hits reach the whole body** (`footprintGap`/`footprintPoint` in `dummy.ts`): sword,
  fists, hammers, shockwave, pillars, mines, cages and dashes measure to the nearest part of the
  target's footprint (its full width; an asteroid's radius), not to its feet, so wide enemies are hit
  wherever the construct visibly reaches.
- **Smart ring is steady** (`smartChoice` in `smart.ts`, for players; AI partners keep
  `pickConstruct`): it sticks with its last pick while that's still at least 75% as good as the best,
  waits up to 0.45s for the best one to come off cooldown instead of reaching for the next one down,
  and a press waits up to 0.5s for it. Holding the button no longer cycles through the loadout.
- **Everyone shields, more often (2026-09-19, user: "gives the players what to expect").** Every
  Lantern-type enemy (Rage Grunts, Zox, Skallox, Bleez, and sparring Kilowog/Sinestro, whose shield
  is tinted Corps green) can raise a shield whatever its kit (`SHIELDERS` in `enemies.ts`): on itself
  or a nearby ally that's taking hits (any hit in the last 1.5s, hurt ones first), cooldown 6s,
  chance 0.9. Machines, ships and turrets can't. AI partners shield on a big attack 85% of the time
  (was 45%), on any attack once below 60% health, and whenever two enemies wind up on them at once;
  5s between their shields (was 12). AI Hal/John now pick constructs with `pickConstruct` like
  Kilowog (their hard-coded lists named the old constructs). Bots: sparring fights ~80s (was ~45s);
  Mission 4 still 3 stars guarding the ship, fighting-only can now lose the ship.
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

## Missions (`/missions`, `/mission/[id]`)
Mission data (title, place, briefing, objectives, who you play) lives in `src/lib/story/missions.ts`;
each mission's rules are a director in `src/lib/engine/missions/`. A director can add its own things to
draw (`drawables`) and things for the camera to keep in view (`cameraPoints`).

**Training** (`/training`, `missions/training.ts`, words in `story/training.ts`): Kilowog teaches one
thing at a time on Oa's training grounds (`GameMap.ground: 'oa'`), and each step only moves on once
the player has actually done it: walk to 3 markers, take off, land on a marker, knock down 2 targets
with ring shots, make 3 constructs (smart ring), shield yourself, shield a supply pod under fire from
practice drones (the smart shield picks the pod), recharge at the Lantern (passive regen is paused
for that step), use the signature. A coach panel shows Kilowog's line, the instruction with the
player's actual keys, and progress dots. God mode throughout. Finishing sets `settings.trained` (and
`seenControls`). Offered from the main menu, the top of the mission list, and on the Mission 1
briefing until done.

**Kilowog** is drawn with the Lantern skeleton plus `Figure.bulk` (2.3: torso and gut scale fully,
arms and legs partly, so he's mostly barrel chest) and `Look.bolovaxian` (`draw/corps.ts`).

**Sparring** (`/spar`, `missions/sparring.ts`): two on one with Kilowog and Sinestro on the training
grounds, like Hal's training in the 2011 movie. Sinestro steps in a moment after Kilowog. Both are
enemies of faction `'corps'` that lead their shots. Their own constructs (`enemies/corpsConstructs.ts`,
art in `draw/corpsConstructs.ts`) are real ring energy, and any Red Lantern art they borrow (charge,
roar, cage, beam) is recolored green (`Effect.green`, `inCorpsGreen`).
- **Kilowog** (1800 hp, might 0.9): Giant Hammer (huge hammer raised overhead, slammed ahead with a
  shockwave ring), Hammer Cyclone (spins two hammers while closing in), Hammer Toss (thrown, comes
  back), Hammer Drop (six hammers fall on marks around you), Giant Fist, charge, roar.
- **Sinestro**, the fiercer one (2200 hp, might 1.15, faster, agile, aggressive): Sword Lunge, Blade
  Volley (7 blades, led), Blade Storm (16 blades in every direction), Giant Fist, green cage and beam.
First one down loses; both must go down to win. They shout as it goes. Bots: fights last 30–70s and
are won a bit under half the time, usually with little health left; standing still loses in ~10s.

**Mission 1: Safe Passage** (Hal, space, the Durvan Belt; `missions/safePassage.ts`). Tomar-Re's
damaged cruiser crosses the belt left to right (~2½ minutes) while **100 asteroids** drift in, in 9
waves, most aimed at where the ship will be. Asteroids are drifting targets (`Dummy.drift`), so every
weapon works on them; they're heavy (little knockback), crack as they're hit, and break into debris.
Hitting the ship costs hull (small 6 / medium 13 / large 24 of 500); hitting Hal hurts him. The ship
is a protectable: Shift puts a bubble around it, rocks break on the bubble (and count as blasted).
The Lantern battery rides on the ship. 3 lives. Win = ship across; ★ made it, ★ hull ≥ 50%, ★ 70+
blasted. Bots: undefended the ship breaks at ~90s; ring shot only wins with 56–71% hull; ring shot +
smart ring + Shift wins with 81–93%.

**Ending (after a win):** a story scene (`scenes/oaLanding.ts`, lines in `story/scenes.ts`, played by
`StoryScene.svelte`): the ship sets down on a landing plaza on Oa below the Central Power Battery, Hal
lands beside it, Tomar-Re (a beaked, crested alien: `Look.avian`) climbs out, salutes and thanks him,
then warns him about a blood-red light and frontier outposts going silent (the sky turns red), setting
up the Red Lanterns. Click / Space to go on (lines also move on by themselves), Esc skips. Then the results.

**Mission 2: Silent Outpost** (Hal with Kilowog as AI partner, planet, Kel-Aris Station;
`missions/silentOutpost.ts`, art in `draw/outpost.ts`). Phases: search (walk to the gate) → ambush (3
Rage Grunts) → survivors (find 3 station crew by their blinking beacons; each rescue brings a wave;
a construct bubble carries them to the pad; the station's own Lantern battery comes back online) →
tower (reaching her body: her ring speaks and flies off to Earth) → hold (Skallox + 5 Grunts) → her
last recording names Sector 666. After the win, the story scene `scenes/johnChosen.ts`: Detroit at
night, the ring chooses John Stewart. Story scenes share `scenes/scene.ts` (`DialogueScene`). Grunts here are toughness 4, might 1.7. 3 lives (Hal only; Kilowog gets
back up at the battery). ★ done, ★ no lives lost, ★ under 5 minutes. Bots: the AI-Hal and a sloppy
"human" bot both win in ~100s of fighting; the sloppy one sometimes loses a life or ends near-dead.

**Colony Under Fire** (now Act 2 · First Patrol; John Stewart solo, planet, Mirrow Colony; `missions/colonyUnderFire.ts`,
art in `draw/colony.ts`). John's first mission. Three groups of 4 colonists hide in shelters; reaching
one brings them out to follow John (sliding around solids) to the evacuation shuttles, and draws a wave.
While colonists are out, Zilius Zox's fire barrage lands on them (red meteor strikes with warning
rings; aimed where they're walking); each colonist group is a protectable (threat 3 per incoming
fireball, so Shift shields them before John), 100 hp, 28 per unshielded hit. Then the last shuttle
needs 50s of engine warm-up while Zox and 3 Grunts attack and the fire targets the shuttle (420 hull).
Lose: John down 3 times, 2 groups lost, or the last shuttle destroyed. ★ done, ★ everyone saved,
★ Zox beaten. Bots: using Shift wins in ~2 min (2-3 stars) with or without backup; never shielding
loses the colonists.

**Mission 4: The Interceptor** (Hal + Kilowog AI partner, space, the Frontier; `missions/interceptor.ts`,
art in `draw/interceptor.ts`). Hal and Kilowog take the Corps' prototype ship against the Guardians'
orders (Sinestro radios in). The Interceptor flies itself (600 hull, a protectable; the battery rides
it). **Leg 1 (~90s):** it crosses to the ambush point while Red Lantern Fighters (and some Grunts) come
in waves; fighters within 1100px launch **rage torpedoes** at the ship every 3.2-4.6s (target kind
`rageTorpedo`: a drifting dummy like an asteroid, 18 hp so one ring-shot burst breaks it, 30 hull
damage; threat 1.2 each, 3s lookahead). **Reboot (50s):** Bleez ambushes it (power failure, -60 hull);
it sits dead while waves keep coming, and the ship's AI comes through in broken lines. **Leg 2 (~60s):**
Aya introduces herself and flies on to the jump point; her cannons hit the nearest Red Lantern or
torpedo in 900px (40 dmg every 0.9s) while the last waves attack. **Ending:** at the jump point Aya
clears any stragglers and calls the Lanterns back; their inputs are taken over and they fly to the
ship and board (`Player.boarded`: not drawn, pinned to the ship; downed Lanterns are revived first,
anyone not aboard after 8s is pulled in), the battery goes aboard, the engines spool up and it
streaks off (`drawWarpStreak`), then the win. Lose: ship destroyed or Hal down 3 times. ★ made the
jump, ★ hull at least 50%, ★ no lives lost. Bots (~3.5 min): fighting only ends at 30-65% hull; also
shooting torpedoes and shielding keeps 75-90%.

**Smart shield priority:** anything being protected (a ship, colonists) that's under threat comes
before a partner; the partner only gets the bubble when the protected thing is safe (Tab lock still
wins). Before, a brawling Kilowog next to the Interceptor always outscored it.

**Backup** (`missions/backup.ts`, action `backup`, default **B**): a mission can let a solo Lantern call
a partner (`Backup(who, uses, seconds)`): they fly in (`Game.addPartner`, AI) and leave when their
time's up (`Game.removePartner`). Mission 3: Hal, twice, 40s each. The panel tally shows the status.
Footprint-only obstacles (`Obstacle.hidden`) make mission-drawn props solid without drawing a block.

**Act 1 · Mission 4: Prison Moon** (Hal + Kilowog AI, planet, `ground: 'bloodMoon'`;
`missions/prisonMoon.ts`, art in `draw/prison.ts`). The Interceptor is parked on the landing field
(battery beside it). Three guarded **cells** (`ObstacleKind 'cell'`: hidden breakable obstacles,
420 hp, drawn by the mission as jagged red bars round the prisoner; auto-aim targets them, label
"Cell"). The first hit on a cell sets off the ALARM (2 Reds drop in); breaking one frees its Lantern
(`Game.addPartner`, at half health and 40% willpower) and brings a response wave. Prisoners are new
crew: **Arisia** (Graxos IV), **Boodikka** (Bellatrix), **Katma Tui** (Korugar), each with a kit
(`LOADOUTS`) and a signature reusing an existing move under their own name (Comet Dive, Bellatrix
Quake, Korugar Bastion). All free: Warden **Skallox** + 8 Reds; cleared, Katma Tui names Razer.
Reds TOUGHNESS 4, MIGHT 2.5. The HUD shows bars for the first two players only. ★ done, ★ no lives
lost, ★ under 6 min. Bot (autopilot, which now also breaks cells when idle): wins in 2-3.5 min,
Hal's health dips to about half in most runs.

**Act 1 · Mission 5: Razer** (the act's boss; Hal + Kilowog AI, planet, Razer's Fortress on the Prison
Moon; `missions/razerBoss.ts`, abilities `enemies/razer.ts`, art `drawRazer` in `draw/lieutenants.ts`).
Enemy kind `razer` (lieutenant, hp 2600 x 2.1, might 1.6). Guards (5 Reds) fight while he watches from
his dais (a drawn figure, not yet an enemy); cleared, he comes down (spawned). Kit grows by phase
(`KITS`): 1 Twin Rage Blades (lunge + 3 cuts), Crimson Chakram (two `saw` shots with `curve`, arcing
out and back), Rage Tether (`chain`), Rage Shield; 2 (below 60%) + Construct Shatter (radius 280: pops
bubbles, removes walls, turrets/Marines, domes, traps, aid stations, Power Armor), Rage Brand
(`Player.branded` 3s: no constructs or shield, ring shots still work; a bubble takes it instead;
sigil `drawBrand` over the head), Rage Plasma (`vomit`); 3 (below 30%) berserk (might and speed x1.25)
+ Blade Storm (`razerStorm`: pulls Lanterns in, cuts close, bursts spears) and Crimson Nova (`RedStrike
'nova'`, radius 250, 1.1s warning; shields absorb it). At 4% he's captured (removed from the fight,
drawn in a green `drawCage`), names Atrocitus, win. ★ captured ★ no lives lost ★ under 5 min.
Bots: win ~7/8, usually losing 1-2 lives; duel ~2.5-3.5 min.

**Red Lanterns are strong (user playtest, 2026-09-19: "enemies are enemies... their constructs are
way powerful... the boss should be trashing Kilowog").** Every Rage Grunt anywhere now gets a full
random kit of 6 constructs (`createEnemy` uses `randomKit(role)`; `KIT_PLAN` 5 fighting + 1 support):
the missions used to hand out the tiny role defaults (claws/chain/blast), so they looked like "blast
and shield". **Rage breaks willpower:** while a red construct hurts someone (`ConstructWorld.rage`,
set in `updateEnemies` / `updateRedConstructs`), bubble shields take `RAGE_VS_SHIELD` = 2x damage
(two Rage Blasts break Hal's bubble) and knockback is x`RAGE_KNOCKBACK` 1.45. Up to 3 attackers per
Lantern (`ATTACK_BUDGET`). Player regen 3.5/s after 5s (was 6/s after 4s). Mission MIGHT raised
(Outpost 3, Colony 1.8, Interceptor 1.8, Prison 3, Razer's guard 3). Rage Shield less spammy
(cooldown 11, chance 0.7, only when hurt > 20% and being hit). **Razer:** health x3.4, might 2.4,
poise 320, faster and more aggressive; harder-hitting moves with bigger knockback; kit 1 blades,
chakram, tether, mace, shield / 2 + shatter, brand, plasma, meteors / 3 + storm, nova, beam.
Bots: Mission 2 won, Kilowog down 2-4x; Prison Moon costs 1-2 lives; Razer beats the bot ~4/5 (it
gets him to 8-17% first).

**Theme green** (`src/lib/theme.ts`, 2026-09-19): one green for the whole game. `THEME_GREEN`
(#3dff6e) with shades mixed from it: `GREEN_LIGHT` (glows, highlights), `GREEN_DIM` (unlit/off
states, borders), `GREEN_CORE` (the white-hot centre of ring energy), `greenShade(t)`; with alpha:
`green(a)`, `greenLight(a)`, `greenCore(a)`. The canvas code uses these (no hand-typed greens), the
layout sets `--green`/`--green-dim` from them, and component CSS derives its glows with
`color-mix(in srgb, var(--green) N%, transparent)`. The **menus use the suit green** (user, 2026-09-19):
`SUIT_GREEN` #0F4F34 / `SUIT_GREEN_LIT` #1d7a50 / `SUIT_GREEN_DARK` (also in `theme.ts`, used by the
uniforms) as `--suit`, `--suit-lit`, `--suit-dark`: filled buttons are `--suit` with light text and a
`--suit-lit` edge, card/panel borders and tabs are `--suit-lit`, tints mix `--suit`. The bright `--green`
is only for glows and highlights: title text and glows, numbers and links, hover/focus borders.

**Acts** (`ACTS` in `story/missions.ts`, 2026-09-19): the mission list is grouped by act; each act
lists its missions in order (built ones by id, planned ones as title + teaser, shown locked).
`placeOf(id)` gives a mission's act and number within it (briefing: "Act 1 · ... / Mission 3:",
HUD: "1-3."). A test checks every built mission is in exactly one act.

**Recording footage (dev only):** `?zoom=2` on a mission page brings the camera closer
(`GameOptions.zoom`); `lc.autopilot()` in the console lets the computer play the first Lantern
(`engine/autopilot.ts`: fights like an AI partner, heads for `director.goal()` when nothing's near,
shields what the mission protects). The X demo was recorded frame by frame with Playwright driving
Chrome with a paused fake clock (`page.clock.pauseAt`, then `runFor(1000/60)` + a screenshot per
frame) and joined with ffmpeg; the clock must be paused, or real time leaks in and it plays fast.

**One mission page for all** (`routes/mission/[id]`, built by `$lib/missions.ts`): every director
implements `MissionDirector` (`missions/mission.ts`): objective line, meters, tally, warning, stars,
stats, and **comms** (radio chatter: `Comms.say`, urgent lines cut in, old ones drop; `Comms.scene` for
scripted conversations). `Director.goal()` puts an arrow at the screen edge toward the next objective.

**Crew Lanterns:** `CrewId` = the playable `LanternId`s (Hal, John: `PLAYABLE`) plus partners the story
brings (Kilowog). Kilowog has a hammer-first loadout, `bulk`/`figureScale`/`build` for his shape,
signature **Hammer Quake** (smash + knockback + stun around him), no progression. The AI partner lets
the smart ring pick his constructs and brawls up close.

**Lantern health:** 150, regenerates 6/s after 4s without taking damage; 0.5s invulnerable after a hit.
A downed Lantern lies still (no turning or aiming).

## Red Lantern Ambush (`/skirmish`)
The first playable scene, from the main menu: pick Hal or John and Coast City or space, then five
Red Lanterns (2 Brutes, a Stalker, 2 Spitters) fly in one after another. **Three lives**; beat all
five to win. Victory / defeat screens with Play again. Logic in `src/lib/engine/skirmish.ts`
(health ×3, damage ×1.25). With an AI playing, fights last 25–60s and end with Hal on ~15–35 health.

## Enemy AI
Every enemy thinks for itself (`src/lib/engine/enemies/`):
- **Personality**, rolled at spawn: aggression, caution, patience (roles and enemy kinds lean them).
- **Eyes and memory** (`tactics.ts`): only sees Lanterns in range with nothing solid in between; when
  it loses sight it goes to where it last saw them; getting shot puts it on alert; spotting a Lantern
  calls nearby allies (machines call much further).
- **Goals**, re-weighed every couple of seconds: hold range, approach, flank to your back, take cover
  behind rocks/buildings and peek out, wait for an opening, retreat (machines only), investigate.
- **Reflexes**: can sidestep incoming shots, depending on its agility and caution.
- **Line of fire**: won't shoot into a rock; goes round instead.
- **Attack director** (`director.ts`): attacks on a Lantern take turns. At most 2 coming at once (a big
  area attack counts as 2), a short random beat between them, and a smaller budget right after the
  Lantern has taken a lot of damage.
- **Ships** (`ships.ts`) fly like aircraft: always moving forward, limited turning, attacking in passes.
- **Squads** (`squad.ts`): a big pack doesn't all attack. An **assault squad** of 3 (5 against two
  Lanterns) fights; the rest wait in **reserve**, circling ~400px out. When an attacker falls, the best
  reserve moves up (a small roar shows it coming); every 8s a badly hurt attacker may be swapped for a
  fresh one (machines always, careful Red Lanterns only). Lieutenants, ships and turrets always fight and
  don't take a squad place. **All in:** when a Lantern drops below 30% health or runs out of willpower,
  everyone attacks for 4s.
- **Red Lantern constructs:** they're Lanterns too, so they build like Green Lanterns, in rage-red:
  weapons (Rage Axe, Blood Mace, Rage Cannon, plus claws, scythe, saws, spears, meteors, beams...) and
  **support** constructs: **Rage Wall** (blocks green shots and beams, lets red shots through),
  **Rage Shield** (bubble on a hurt ally), **Rage Turret** (a static enemy that shoots, burns out after 14s).
  Every grunt's random kit has 4 fighting constructs + 1 support. Support isn't an attack, so it needs
  no turn from the director, and **reserves use it from the back**.

Lab: `/lab/enemies` with "Show AI states" shows each enemy's goal, what it sees, and its personality.

## Story & enemies
See **[STORY.md](STORY.md)**: "Red Frontier". Following the comics and animated series, Red Lanterns
(led by Atrocitus) are the main enemy and Manhunters the second threat. It has the full bestiary,
acts, missions and character arcs. Red Lanterns are creatures, not humans (Rage Beast, Rage Stalker,
Rage Maw), plus Red Lantern fighter ships and the show's lieutenants Zilius Zox, Skallox and Bleez.
Next: Act 1 boss → Manhunter Sentry/Adapter/Prime → Dex-Starr → Atrocitus.

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
- [x] **M4** Construct system: beam + 8 behavior types, Hal/John loadouts on keys 1–5 (now 1–0, ten each), traits, training dummies, constructs lab
- [x] **M4.5** Feedback pass: tuning (cheaper, longer-lasting), targeting + lock-on, bubble shield, construct art pass
- [ ] **M5** First enemies (Red Lanterns, per STORY.md): Lantern health + damage, Rage Grunt → Plasma Spitter → Rage Brute
  - [x] Stage 1: Lantern health, downed/revive. Rage Grunts in three roles, each with red constructs:
        Berserker (Rage Claws, Rage Slam, Rage Roar), Hunter (Barbed Chain, Rage Claws), Gunner (Rage Blast, Rage Saw).
        Pack AI: own reaction times, targets split between Lanterns, spots around the target, max 2 in melee,
        ranged pacing, stagger on burst damage. Walls block red shots, Fortress keeps them out, roars shred shields/turrets.
  - [x] AI partner (an InputSource that plays Hal or John) and the co-op lab (/lab/demo): waves of enemies
  - [x] 15 red constructs (claws, Blood Scythe, Rage Roar, Rage Charge, Rage Slam, Barbed Chain, Napalm Vomit, Blood Spikes,
        Rage Prison, Rage Blast, Rage Saw, Blood Spears, Rage Meteors, Rage Beam, Skull Seekers); every enemy gets a random
        4-construct kit shaped by its role; `might` damage multiplier
  - [x] ~~/trailer~~ self-playing trailer, removed 2026-09-18 with the demo's watch/recording/showcase modes (in git history if needed)
  - [x] Feel & pacing pass (2026-09-18): face the way you move, turn to shoot, backpedal, smooth turns; double-tap ring
        shot; slower, more readable red attacks
  - [x] Enemy brains: personalities, sight + memory, goals (flank, cover, wait, retreat...), dodging, attack director
  - [x] Machines: Manhunter Drone (flying robot, lasers), Red Lantern Fighter (ship, strafing/bombing runs)
  - [x] Red Lanterns as creatures: Rage Beast / Rage Stalker / Rage Maw
  - [x] Lieutenants from the show: Zilius Zox, Skallox (transforms), Bleez (Blood Dive); co-op lab waves 5-7
  - [x] Squad tactics (assault + reserve, rotation, all-in); co-op lab wave 8 is a pack of 7
  - [x] Ten constructs per Lantern (Hal: Warhammer, Rocket Pod, Buzzsaw, Afterburner, Shotgun; John: Cannon,
        Cage, Shockwave, Mines, Aid Station); 10-slot HUD and bindings
  - [x] Red Lantern constructs: Rage Wall, Rage Shield, Rage Turret, Rage Axe, Blood Mace, Rage Cannon
  - [x] Red Lanterns redrawn as humanoid aliens on the Lantern skeleton (build proportions per role, random
        heads/skins/tails/spines, four-armed Stalkers); `/skirmish` Red Lantern Ambush scene (5 vs 1, 3 lives)
- [x] **M6** First mission: "Safe Passage" (escort through an asteroid storm): briefing, objective HUD, win/lose, stars, retry

**Phase 1.5: Characters** (before enemies, by request)
- [x] **C1** Controls & accessibility: mouse aim, free ring shot, remappable bindings, pause menu, options, first-time card
- [x] **C2** Art & animation: skeleton (animation.ts), detailed Hal/John, idle/walk/take-off/fly/shoot/cast/hurt/downed/victory, /lab/animation
- [x] **C3** Signature abilities: surge meter; Hal "Jet Strike", John "Fortress" (constructs/signature.ts)
- [x] **C4** Stats & progression: XP, levels (max 10), 4 upgrades, Corps HQ (/hq), per-character save (progression.ts)
- [ ] **C5** Story & personality: bios, intro cards, combat lines, co-op banter

**Phase 2: Couch co-op**
- [ ] **M7** Player 2 joins (keyboard/gamepad), shared camera, revive a downed partner

**Phase 3: Ring Forge**
- [ ] **M8** Forge screen, saved custom constructs, equip slots

**Phase 4: Campaign**: "Red Frontier" (see STORY.md): 3 acts, 13 missions, sector map

**Phase 5: Online multiplayer**: server, sync, lobby / join code
