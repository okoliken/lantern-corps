// Season two, Act 1, mission 4: Undertow. John, with Aquaman.
//
// Meridian, a deep-sea platform, hauled something up from the trench last
// week: Atlantean. Black Manta came for it. His charges holed the hull below
// the waterline, and the sea is coming in.
//
//   flood  two breaches in the lower deck. John dams them: every construct
//          he puts into a breach builds the dam up (the girders show it), and
//          the water pressure works it loose again. Open breaches flood the
//          deck; a full deck spills into the one above. Aquaman goes into the
//          water for the crews and brings them up to the lifeboats; a crew
//          left in deep water drowns. Manta's divers come up over the rails.
//   manta  Manta comes up himself, blows a hole in the middle deck to flood
//          the lab, and fights. Beat him and he goes over the side. The last
//          crew still has to get out.
//
// Lose: two crews drown, or John goes down three times.

import { createDummy, isStanding, type Dummy } from '../dummy';
import { colonist, drawColonist, drawHitFlash } from '../draw/colony';
import { drawBreach, drawLab, drawLifeboats, drawRigPart, drawWater, type RigPart } from '../draw/rig';
import type { Figure } from '../draw/lantern';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import { boxOverlap } from '../physics';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type UndertowPhase = 'flood' | 'manta';
type Deck = 'lower' | 'mid';

const LIVES = 3;
const INTRO_TIME = 3;
const DIVER_TOUGHNESS = 3.4;
const DIVER_MIGHT = 6.2;
const MANTA = { health: 4.2, might: 6.4 };
/** Divers come up over the rails this often while there are crews to get out (fewer once Manta is here). */
const REINFORCE_EVERY = 19;
const MAX_DIVERS = 7;

/** A breach's dam: how much construct damage fills it, and how fast the sea pushes it back out (share per second). */
const DAM_HP = 260;
const DAM_LEAK = 1 / 26;
/** A dam this full holds (no water through); below it, it reopens for hitting. */
const DAM_HOLDS = 0.98;
const DAM_REOPENS = 0.85;
/** Water in, per open breach per second (a deck from dry to full); and the pumps draining it. */
const INFLOW = 1 / 60;
const PUMPS = 1 / 110;
/** A full lower deck spills upward this fast. */
const SPILL = 1 / 70;
/** Crews in water this deep start to drown, and how fast. */
const DROWN_DEPTH = 0.6;
const DROWN_RATE = 7;
const CREW_HP = 100;
const CREW_SPEED = 150;
const FOLLOW_GAP = 70;
/** How close Aquaman gets for a crew to grab hold, and how close the lifeboats count from. */
const PICKUP = 95;
const BOATS_RADIUS = 210;
/** Manta comes up when the lower crews are done, or after this long regardless. */
const MANTA_AFTER = 95;

const W = 2800;
const H = 2300;
/** The decks, top to bottom, and the bulkheads between them. */
export const DECKS: Record<Deck | 'upper', { y0: number; y1: number }> = {
	upper: { y0: 0, y1: 760 },
	mid: { y0: 760, y1: 1540 },
	lower: { y0: 1540, y1: H }
};
const BULKHEAD = 40;
/** The doorways through each bulkhead (centre x), and how wide. */
const DOORS = [700, 2100];
const DOOR_W = 240;
const SPAWN = { x: 1400, y: 1300 };
export const LIFEBOATS = { x: 1400, y: 230 };
export const LAB = { x: 1400, y: 1130 };
const BREACHES: { x: number; y: number; deck: Deck; from: 'south' | 'east' }[] = [
	{ x: 820, y: 2215, deck: 'lower', from: 'south' },
	{ x: 1980, y: 2215, deck: 'lower', from: 'south' },
	{ x: 2700, y: 1300, deck: 'mid', from: 'east' }
];
const CREWS: { x: number; y: number; deck: Deck }[] = [
	{ x: 520, y: 1880, deck: 'lower' },
	{ x: 2300, y: 1960, deck: 'lower' },
	{ x: 900, y: 1250, deck: 'mid' }
];

type Wave = [Role, number, number][];
const BOARDERS: Wave = [
	['gunner', 0, 0],
	['hunter', 140, -60],
	['berserker', -120, -80],
	['gunner', 260, 40]
];
const WITH_MANTA: Wave = [
	['hunter', -160, -120],
	['gunner', -200, 140],
	['berserker', -80, 0]
];
/** Where divers climb up over the rails. */
const RAILS = [
	{ x: 300, y: 2200 },
	{ x: 1400, y: 2220 },
	{ x: 2600, y: 2150 },
	{ x: 2700, y: 900 },
	{ x: 100, y: 1300 }
];
const MANTA_RISES = { x: 2600, y: 1150 };

export interface Breach {
	dummy: Dummy;
	deck: Deck;
	from: 'south' | 'east';
	/** 0 open .. 1 dammed. */
	dam: number;
	open: boolean;
	lastHp: number;
}

interface Crew {
	deck: Deck;
	x: number;
	y: number;
	vx: number;
	vy: number;
	state: 'trapped' | 'following' | 'out' | 'lost';
	hp: number;
	flash: number;
	members: Figure[];
}

/** What each solid thing on the rig is (they're footprints; the mission draws them). */
const PARTS = new WeakMap<Obstacle, RigPart>();

/** The platform: three decks of grating, bulkheads with doorways, the lab, gear lashed down. */
export function buildUndertowMap(): GameMap {
	const rand = seededRandom(1941);
	const obstacles: Obstacle[] = [];
	const wall = (x: number, y: number, w: number, h: number, height = 60, part: RigPart = 'bulkhead') => {
		const o: Obstacle = { kind: 'building', x, y, w, h, height, blocksFlying: false, seed: rand(), hidden: true };
		PARTS.set(o, part);
		obstacles.push(o);
	};
	// Bulkheads, with their doorways left open
	for (const y of [DECKS.mid.y0, DECKS.lower.y0]) {
		let x = 0;
		for (const door of DOORS) {
			wall(x, y - BULKHEAD / 2, door - DOOR_W / 2 - x, BULKHEAD, 70);
			x = door + DOOR_W / 2;
		}
		wall(x, y - BULKHEAD / 2, W - x, BULKHEAD, 70);
	}
	// Gear on the decks: pipe racks, pump housings, tanks; kept off the crews, the doors and the breaches
	const gear: [number, number, number, number, RigPart][] = [
		[300, 380, 220, 90, 'rack'],
		[2250, 420, 240, 90, 'tank'],
		[1700, 880, 150, 150, 'pump'],
		[480, 960, 180, 90, 'rack'],
		[1100, 1780, 220, 100, 'tank'],
		[1600, 2000, 200, 90, 'rack'],
		[2500, 1700, 120, 160, 'pump']
	];
	for (const [x, y, w, h, part] of gear) wall(x, y, w, h, 55 + rand() * 30, part);
	// The lab: a container the trench find is kept in (drawn by the mission)
	obstacles.push({ kind: 'building', x: LAB.x - 130, y: LAB.y - 70, w: 260, h: 100, height: 80, blocksFlying: false, seed: 0, hidden: true });
	return {
		name: 'Meridian platform',
		environment: 'planet',
		ground: 'rig',
		width: W,
		height: H,
		spawn: SPAWN,
		battery: { x: 1000, y: 520 },
		dummies: [],
		obstacles
	};
}

export class Undertow implements MissionDirector {
	state: MissionState = 'intro';
	phase: UndertowPhase = 'flood';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	/** 0 dry .. 1 full, each deck. */
	flood: Record<Deck, number> = { lower: 0, mid: 0 };
	peakFlood = 0;
	failReason: 'crews' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ no crew lost · ★ the lab never flooded past half';
	readonly breaches: Breach[] = [];
	readonly crews: Crew[];
	manta: Enemy | null = null;
	mantaGone = false;
	private divers: Enemy[] = [];
	private reinforce = REINFORCE_EVERY;
	private rescuing: Crew | null = null;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	constructor() {
		this.crews = CREWS.map((c, i) => ({
			deck: c.deck,
			x: c.x,
			y: c.y,
			vx: 0,
			vy: 0,
			state: 'trapped' as const,
			hp: CREW_HP,
			flash: 0,
			members: [0, 1, 2].map((k) => colonist(80 + i * 5 + k))
		}));
	}

	// ------------------------------------------------------------ reporting

	get out(): number {
		return this.crews.filter((c) => c.state === 'out').length;
	}

	get lost(): number {
		return this.crews.filter((c) => c.state === 'lost').length;
	}

	get objective(): string {
		const open = this.breaches.filter((b) => b.open).length;
		const dam = open > 0 ? `Dam the breaches with your constructs (${open} open)` : 'The breaches are holding';
		if (this.phase === 'manta' && this.manta && isStanding(this.manta)) return `Stop Black Manta. ${dam}`;
		return `${dam}. Crews out: ${this.out} / ${this.crews.length}`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Lower deck', value: this.flood.lower, text: `${Math.round(this.flood.lower * 100)}%`, low: this.flood.lower > 0.6 }];
		if (this.phase === 'manta' || this.flood.mid > 0) list.push({ label: 'Lab deck', value: this.flood.mid, text: `${Math.round(this.flood.mid * 100)}%`, low: this.flood.mid > 0.5 });
		for (const c of this.crews) if (c.state === 'trapped' || c.state === 'following') if (c.hp < CREW_HP) list.push({ label: 'Crew', value: c.hp / CREW_HP, text: `${Math.round(c.hp)}%`, low: c.hp < 40 });
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.crews.some((c) => (c.state === 'trapped' || c.state === 'following') && c.hp < 45)) return 'A crew is drowning! Dam the breach!';
		if (this.breaches.some((b) => b.open && b.dam < 0.2 && this.flood[b.deck] > 0.5)) return 'The sea is pouring in! Fire into the breach!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.lost === 0 ? 1 : 0) + (this.peakFlood <= 0.5 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Meridian rides low in the water, but it rides. Every boat is full, and the trench find is still in its case.';
		if (this.failReason === 'crews') return 'Two crews went under with the decks.';
		return 'John went down one time too many, and the sea took the rig.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Crew out', value: `${this.out * 3} / ${this.crews.length * 3}` },
			{ label: 'Lab deck flooded', value: `${Math.round(this.flood.mid * 100)}%` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		for (const c of this.crews) c.flash = Math.max(0, c.flash - dt);
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) this.start(game);
				return;
			case 'won':
				this.timer += dt;
				return;
			case 'lost':
				return;
		}
		this.elapsed += dt;
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose('down');
		}
		this.wasDown = john.downed;

		this.updateBreaches(dt);
		this.updateWater(dt);
		this.updateCrews(game, dt);
		this.sendAquaman(game);
		this.updateDivers(game, dt);
		if (this.state !== 'playing') return;

		const lowerDone = this.crews.filter((c) => c.deck === 'lower').every((c) => c.state === 'out' || c.state === 'lost');
		if (this.phase === 'flood' && (lowerDone || this.elapsed > MANTA_AFTER)) this.startManta(game);
		if (this.phase === 'manta') this.updateManta();
		if (this.lost >= 2) this.lose('crews');
		const crewsDone = this.crews.every((c) => c.state === 'out' || c.state === 'lost');
		if (this.mantaGone && crewsDone) this.win(game);
	}

	private start(game: Game) {
		this.state = 'playing';
		for (const b of BREACHES.slice(0, 2)) this.openBreach(game, b);
		this.spawn(game, BOARDERS, 1400, 2050);
		this.comms.scene([
			['Aquaman', "Two holes below the waterline. I'll go in after the crews. Keep the sea out of my way."],
			['John', 'How do I hold back an ocean?'],
			['Aquaman', 'One wall at a time. Put everything you build into those holes.']
		]);
	}

	private openBreach(game: Game, b: (typeof BREACHES)[number]) {
		const d = createDummy(b.x, b.y);
		d.kind = 'seaBreach';
		// It soaks up hits forever; what they build is counted as the dam (updateBreaches)
		d.hp = d.maxHp = 1e6;
		game.dummies.push(d);
		this.breaches.push({ dummy: d, deck: b.deck, from: b.from, dam: 0, open: true, lastHp: d.hp });
	}

	/** Hits on a breach build its dam; the sea pushes the dam back out; a full one holds and can't be hit. */
	private updateBreaches(dt: number) {
		for (const b of this.breaches) {
			const d = b.dummy;
			// The hole doesn't move, whatever hits it
			d.x = d.prevX = d.homeX;
			d.y = d.prevY = d.homeY;
			d.vx = d.vy = 0;
			if (isStanding(d)) {
				const built = b.lastHp - d.hp;
				if (built > 0) b.dam = Math.min(1, b.dam + built / DAM_HP);
				d.hp = d.maxHp;
			}
			b.lastHp = d.hp;
			b.dam = Math.max(0, b.dam - DAM_LEAK * dt);
			if (b.open && b.dam >= DAM_HOLDS) {
				b.open = false;
				d.down = 1e9;
				this.once(`held${this.breaches.indexOf(b)}`, 'John', b.deck === 'mid' ? "Lab deck's sealed. For now." : "That one's holding. For now.");
			} else if (!b.open && b.dam < DAM_REOPENS) {
				b.open = true;
				d.down = 0;
				this.once(`reopen${this.breaches.indexOf(b)}`, 'Aquaman', "Your wall's giving, Lantern! The sea doesn't stop pushing.");
			}
		}
	}

	private updateWater(dt: number) {
		for (const deck of ['lower', 'mid'] as const) {
			const pouring = this.breaches.filter((b) => b.deck === deck && b.open).reduce((s, b) => s + (1 - b.dam), 0);
			let rise = pouring * INFLOW;
			if (deck === 'mid' && this.flood.lower >= 1) rise += SPILL;
			this.flood[deck] = Math.max(0, Math.min(1, this.flood[deck] + (rise - PUMPS) * dt));
		}
		this.peakFlood = Math.max(this.peakFlood, this.flood.mid);
		if (this.flood.lower > 0.5) this.once('lowerHalf', 'Aquaman', "Lower deck's half under! Get those holes shut!");
		if (this.flood.lower >= 1) this.once('lowerFull', 'John', "Lower deck's gone. It's coming up the stairs!");
	}

	private deckAt(y: number): Deck | 'upper' {
		return y >= DECKS.lower.y0 ? 'lower' : y >= DECKS.mid.y0 ? 'mid' : 'upper';
	}

	depthAt(y: number): number {
		const deck = this.deckAt(y);
		return deck === 'upper' ? 0 : this.flood[deck];
	}

	private updateCrews(game: Game, dt: number) {
		const aqua = game.players.find((p) => p.hero?.id === 'aquaman');
		for (const c of this.crews) {
			if (c.state === 'out' || c.state === 'lost') continue;
			c.deck = this.deckAt(c.y) === 'upper' ? c.deck : (this.deckAt(c.y) as Deck);
			const depth = this.depthAt(c.y);
			if (depth > DROWN_DEPTH) {
				c.hp -= DROWN_RATE * ((depth - DROWN_DEPTH) / (1 - DROWN_DEPTH) + 0.3) * dt;
				if (c.hp <= 0) {
					c.state = 'lost';
					c.hp = 0;
					this.comms.say('Aquaman', 'I lost them. The water took them before I could reach them.', true);
					continue;
				}
			}
			if (c.state === 'trapped') {
				if (aqua && !aqua.downed && Math.hypot(aqua.x - c.x, aqua.y - c.y) < PICKUP) {
					c.state = 'following';
					this.comms.say('Crew', ['We thought nobody was coming!', 'Get us out of here!', "The lab's flooding, go, go!"][this.crews.indexOf(c)]);
				}
				continue;
			}
			// Following Aquaman up to the boats, slower the deeper the water
			if (Math.hypot(c.x - LIFEBOATS.x, c.y - LIFEBOATS.y) < BOATS_RADIUS) {
				c.state = 'out';
				this.comms.say('Aquaman', this.crews.some((o) => o.state === 'trapped') ? "They're in the boats. Going back down." : "That's the last of them.");
				continue;
			}
			const lead = aqua && !aqua.downed ? aqua : null;
			// After him, through the same doorways
			const { x: tx, y: ty } = lead ? this.routeTo(c.x, c.y, lead.x, lead.y) : c;
			const dx = tx - c.x;
			const dy = ty - c.y;
			const d = Math.hypot(dx, dy) || 1;
			const speed = d > FOLLOW_GAP ? CREW_SPEED * (1 - 0.5 * depth) : 0;
			c.vx = (dx / d) * speed;
			c.vy = (dy / d) * speed;
			this.moveCrew(game, c, dt);
		}
	}

	private moveCrew(game: Game, c: Crew, dt: number) {
		const blocked = (x: number, y: number) => game.map.obstacles.some((o) => boxOverlap(x, y, 24, 10, o));
		const nx = c.x + c.vx * dt;
		const ny = c.y + c.vy * dt;
		if (!blocked(nx, ny)) {
			c.x = nx;
			c.y = ny;
		} else if (!blocked(nx, c.y)) c.x = nx;
		else if (!blocked(c.x, ny)) c.y = ny;
	}

	/** Aquaman goes into the water for whoever's in the most trouble, then leads them up through the doorways. */
	private sendAquaman(game: Game) {
		const aqua = game.players.find((p) => p.hero?.id === 'aquaman');
		if (!aqua?.hero) return;
		const following = this.crews.find((c) => c.state === 'following');
		if (following) {
			// Leading them up, and waiting when they fall behind
			const far = Math.hypot(following.x - aqua.x, following.y - aqua.y) > 260;
			aqua.hero.errand = far ? { x: following.x, y: following.y } : this.routeUp(aqua.x, aqua.y);
			this.rescuing = following;
			return;
		}
		const waiting = this.crews.filter((c) => c.state === 'trapped');
		if (waiting.length === 0) {
			// Nobody left in the water: into the fight, through the doors if it's on another deck
			this.rescuing = null;
			const john = game.players[0];
			const foe = this.manta && isStanding(this.manta) ? this.manta : john;
			aqua.hero.errand = this.deckIndex(foe.y) !== this.deckIndex(aqua.y) ? this.routeTo(aqua.x, aqua.y, foe.x, foe.y) : null;
			return;
		}
		// The crew in the deepest water first (the one he's on, if still trapped)
		if (!this.rescuing || this.rescuing.state !== 'trapped') this.rescuing = waiting.sort((a, b) => this.depthAt(b.y) - this.depthAt(a.y) || b.y - a.y)[0];
		const c = this.rescuing;
		aqua.hero.errand = this.routeTo(aqua.x, aqua.y, c.x, c.y);
	}

	/** The next point on the way from (x, y) up to the lifeboats: the nearest doorway in the bulkhead above, then the boats. */
	private routeUp(x: number, y: number): { x: number; y: number } {
		return this.routeTo(x, y, LIFEBOATS.x, LIFEBOATS.y);
	}

	/** Through the doorways between decks: head for the nearest door in the next bulkhead between here and there. */
	private routeTo(x: number, y: number, tx: number, ty: number): { x: number; y: number } {
		const here = this.deckIndex(y);
		const there = this.deckIndex(ty);
		if (here === there) return { x: tx, y: ty };
		// The bulkhead to cross next
		const by = there < here ? [DECKS.mid.y0, DECKS.lower.y0][here - 1] : [DECKS.mid.y0, DECKS.lower.y0][here];
		const door = DOORS.reduce((a, b) => (Math.abs(b - x) + Math.abs(b - tx) < Math.abs(a - x) + Math.abs(a - tx) ? b : a));
		// Line up with the door first, then go through it
		if (Math.abs(x - door) > 40) return { x: door, y: by + (there < here ? 90 : -90) };
		return { x: door, y: by + (there < here ? -120 : 120) };
	}

	private deckIndex(y: number): number {
		return y >= DECKS.lower.y0 ? 2 : y >= DECKS.mid.y0 ? 1 : 0;
	}

	private updateDivers(game: Game, dt: number) {
		this.divers = this.divers.filter(isStanding);
		const crewsLeft = this.crews.some((c) => c.state === 'trapped' || c.state === 'following');
		if (!crewsLeft) return;
		this.reinforce -= dt;
		if (this.reinforce > 0 || this.divers.length >= MAX_DIVERS) return;
		this.reinforce = REINFORCE_EVERY * (this.phase === 'manta' ? 1.4 : 1);
		const john = game.players[0];
		const rail = RAILS.slice().sort((a, b) => Math.hypot(a.x - john.x, a.y - john.y) - Math.hypot(b.x - john.x, b.y - john.y))[1];
		this.spawn(game, BOARDERS.slice(0, 3), rail.x, rail.y);
		this.once('more', 'Aquaman', 'More of his divers, coming up over the rail!');
	}

	private spawn(game: Game, wave: Wave, x: number, y: number) {
		for (const [role, dx, dy] of wave) {
			const e = game.spawnEnemy('mantaDiver', Math.max(80, Math.min(W - 80, x + dx)), Math.max(80, Math.min(H - 80, y + dy)), role);
			e.brain.grit = DIVER_TOUGHNESS;
			e.brain.might = DIVER_MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * DIVER_TOUGHNESS);
			this.divers.push(e);
		}
	}

	private startManta(game: Game) {
		this.phase = 'manta';
		const m = game.spawnEnemy('blackManta', MANTA_RISES.x, MANTA_RISES.y);
		m.brain.grit = 1;
		m.brain.might = MANTA.might;
		m.brain.alert = 10;
		m.hp = m.maxHp = m.brain.lastHp = Math.round(m.maxHp * MANTA.health);
		this.manta = m;
		this.spawn(game, WITH_MANTA, MANTA_RISES.x, MANTA_RISES.y);
		this.openBreach(game, BREACHES[2]);
		this.comms.scene([
			['Black Manta', 'King of the Seven Seas, and his new pet Lantern. The trench find is mine, Arthur.'],
			['Aquaman', "He's holed the lab deck! John, the water's in with the last crew!"],
			['John', "Then I shut it, and then I shut him."]
		]);
	}

	private updateManta() {
		const m = this.manta;
		if (!m || this.mantaGone) return;
		if (m.hp < m.maxHp * 0.5) this.once('mantaHalf', 'Black Manta', 'You fight like a sailor, Lantern. Sailors drown.');
		if (!isStanding(m)) {
			this.mantaGone = true;
			// Over the side: he doesn't stay down, he goes back to the sea
			m.gone = true;
			this.comms.say('Black Manta', 'This is not over, Arthur. The sea is patient. So am I.', true);
			this.once('mantaGone', 'Aquaman', "He's gone over the side. Let him go. We have people to finish getting out.");
		}
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		game.players[0].victoryTimer = 0.4;
		this.comms.scene([
			['Aquaman', 'You held the sea back long enough. Most men from the surface would not have tried.'],
			['John', 'I build things for a living. Turns out walls are walls.'],
			['Aquaman', 'Come to Atlantis some day, Green Lantern. We could use a builder.']
		]);
	}

	private lose(reason: 'crews' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		// Frame the breach John is working, when he's near one
		const john = this.gameRef?.players[0];
		if (!john) return [];
		const near = this.breaches.find((b) => b.open && Math.hypot(b.dummy.x - john.x, b.dummy.y - john.y) < 520);
		return near ? [[near.dummy.x, near.dummy.y]] : [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		// The open breach letting in the most water, unless Manta needs stopping
		const open = this.breaches.filter((b) => b.open).sort((a, b) => a.dam - b.dam);
		if (open.length > 0 && (this.flood[open[0].deck] > 0.3 || !this.manta || !isStanding(this.manta))) return open[0].dummy;
		if (this.manta && isStanding(this.manta)) return this.manta;
		return open[0]?.dummy ?? null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		list.push({ baseY: -1e6, draw: () => drawLifeboats(ctx, LIFEBOATS.x, 60, time) });
		list.push({ baseY: LAB.y + 30, draw: () => drawLab(ctx, LAB.x, LAB.y + 30, this.flood.mid, time) });
		for (const o of this.gameRef?.map.obstacles ?? []) {
			const part = PARTS.get(o);
			if (part) list.push({ baseY: o.y + o.h, draw: () => drawRigPart(ctx, part, o.x, o.y, o.w, o.h, o.height, time) });
		}
		// Water over each deck, under everyone standing in it
		for (const deck of ['lower', 'mid'] as const) {
			const f = this.flood[deck];
			if (f <= 0.01) continue;
			const { y0, y1 } = DECKS[deck];
			list.push({ baseY: -1e5, draw: () => drawWater(ctx, 0, y0 + BULKHEAD / 2, W, y1 - y0 - BULKHEAD / 2, f, time) });
		}
		for (const b of this.breaches) list.push({ baseY: b.dummy.y + 40, draw: () => drawBreach(ctx, b.dummy.x, b.dummy.y, b.from, b.dam, b.open, b.dummy.flash > 0, time) });
		const offsets = [
			[-20, -8],
			[12, -16],
			[2, 12]
		];
		for (const c of this.crews) {
			if (c.state === 'out' || c.state === 'lost') continue;
			const walking = Math.hypot(c.vx, c.vy) > 5;
			const dir: 1 | -1 = c.vx < -1 ? -1 : 1;
			const sink = Math.min(1, this.depthAt(c.y)) * 26;
			c.members.forEach((fig, i) => {
				const [ox, oy] = offsets[i];
				list.push({
					baseY: c.y + oy,
					draw: () => {
						ctx.save();
						// Waist deep, chest deep: the water hides their legs
						ctx.beginPath();
						ctx.rect(c.x + ox - 40, c.y + oy - 200, 80, 200 - sink);
						ctx.clip();
						drawColonist(ctx, fig, c.x + ox, c.y + oy, dir, walking, time + i * 0.41);
						ctx.restore();
					}
				});
			});
			if (c.flash > 0) list.push({ baseY: c.y + 20, draw: () => drawHitFlash(ctx, c.x, c.y, c.flash / 0.3) });
		}
		return list;
	}
}
