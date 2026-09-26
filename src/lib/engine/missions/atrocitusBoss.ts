// Act 3, the finale: Atrocitus.
//
// The Blood Altar is dark, but Atrocitus already has the Book of the Black,
// and he has called out every Lantern the Guardians can spare. It takes all
// of them. Hal and John (you choose), Razer and Arisia start the fight;
// Kilowog, Katma Tui and Boodikka arrive from Oa.
//
// He does not chase anybody. The altar is his, he holds the ground around it,
// and the Corps has to come to him.
//
//   oath      Atrocitus swore a Blood Oath: a ward that turns most of any one
//             Lantern's attack. It breaks when four or more Lanterns hit him
//             at once (within a couple of seconds): then, for a few seconds,
//             he feels all of it. The Corps' whole point
//   book      (60%) he opens the Book of the Black. It drains the will of any
//             Lantern near him, and every so often he reads a page: every ring
//             near him goes quiet (no constructs, no shields) for a moment.
//             Dex-Starr comes back for revenge, with more Red Lanterns
//   rage      (25%) the rage takes him: faster, stronger, and blood rains
//             down across the plain (a red ring first: get out of it)
//   speaks    (40%, and again at 12%) the Book speaks. Every ring on the plain
//             goes dark, nothing the Corps throws touches him, and he leaves
//             the altar to hunt whoever is nearest. You don't win this. You
//             live through it
//   fallen    he falls. Ganthet binds the Book
//
// Lose: your Lantern goes down 3 times.

import { damagePlayer } from '../combat';
import { hitDummyWithFx } from '../constructs/system';
import { drawBloodAltar } from '../draw/ysmault';
import { isStanding } from '../dummy';
import type { Enemy, EnemyKind, Role } from '../enemies/enemies';
import type { AbilityId } from '../enemies/redConstructs';
import type { Drawable, Game } from '../game';
import { heroFx } from '../heroes';
import type { CrewId } from '../lanterns';
import { seededRandom, type GameMap, type Obstacle } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type FinalePhase = 'oath' | 'book' | 'rage' | 'fallen';

const FINALE_LIVES = 3;
const INTRO_TIME = 3;
/** Three stars: done within this many seconds. */
const PAR_TIME = 480;
/** Atrocitus: health and might on top of his base; where the Book opens and where the rage takes him. */
const ATROCITUS_HEALTH = 20;
const ATROCITUS_MIGHT = 6.1;
export const BOOK_AT = 0.6;
export const RAGE_AT = 0.25;
const RAGE = { might: 1.2, speed: 1.2 };
/** The Blood Oath: what share of a hit gets through it, how many Lanterns it takes to break, in how long, and for how long it stays broken. */
export const WARD_TAKES = 0.1;
export const WARD_BREAKERS = 4;
const WARD_WINDOW = 2;
const WARD_DOWN = 6;
/** Once it's back, it holds this long whatever hits it. */
const WARD_HOLDS = 7;
/** The Book: how near it drains will and how fast; how often he reads a page, how far it reaches, how long rings stay quiet. */
const BOOK_DRAIN = { range: 460, rate: 9 };
export const PAGE = { every: 15, warn: 1.5, range: 520, silence: 4 };
/** The blood rain: how often a drop comes down, the warning, how big, what it does. */
const RAIN = { every: 1.3, warn: 1.4, radius: 120, damage: 30, knockback: 480 };
/** Who comes from Oa, and when (seconds into the fight). */
const REINFORCEMENTS: [CrewId, number][] = [
	['kilowog', 18],
	['katma', 19],
	['boodikka', 20]
];
/** Red Lanterns with him. */
const TOUGHNESS = 3.8;
const MIGHT = 4.2;
const DEX_HEALTH = 10;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 52;
/**
 * The Book speaks: at these shares of his health he shuts every ring on the
 * plain, stops feeling anything, and hunts. How long it lasts, and how much
 * faster it makes him.
 */
export const SPEAKS_AT = [0.4, 0.12];
export const SPEAKS = { time: 8, speed: 1.35 };
/**
 * He holds the altar. This is how far from it he will go, and how fast he
 * turns back at the edge of it (faster than he flies, so nobody leads him off).
 */
export const HOLD = 700;
const TURN_BACK = 260;
/** How much harder the Lantern you play pulls him than the rest of the Corps. */
const LEAD_PULL = 260;
/** What he fights with. The Corps crowds him, so he answers crowds. */
const KIT: AbilityId[] = ['claws', 'slam', 'vomit', 'meteors', 'beam', 'charge', 'skulls', 'roar', 'chain', 'cage'];

const W = 3000;
const H = 2000;
export const ALTAR = { x: 1500, y: 900 };
const ENTRY = { x: 1500, y: 1700 };

type Wave = [EnemyKind, number, number, Role?][];
const GUARD: Wave = [
	['rageGrunt', -420, -120, 'berserker'],
	['rageGrunt', 420, -120, 'berserker'],
	['rageGrunt', -300, 260, 'gunner'],
	['rageGrunt', 300, 260, 'hunter']
];
const BOOK_WAVE: Wave = [
	['dexStarr', 0, -380],
	['rageGrunt', -520, 0, 'berserker'],
	['rageGrunt', 520, 0, 'berserker'],
	['rageGrunt', -380, 380, 'hunter'],
	['rageGrunt', 380, 380, 'gunner']
];

/** The dark altar on Ysmault: the plain round it, black crags. */
export function buildFinaleMap(): GameMap {
	const rand = seededRandom(7777);
	const obstacles: Obstacle[] = [];
	for (let i = 0; i < 40 && obstacles.length < 12; i++) {
		const size = 50 + rand() * 60;
		const x = 200 + rand() * (W - 400);
		const y = 200 + rand() * (H - 400);
		if (Math.hypot(x - ALTAR.x, y - ALTAR.y) < 600 || Math.hypot(x - ENTRY.x, y - ENTRY.y) < 260) continue;
		obstacles.push({ kind: 'rock', x: x - size / 2, y: y - size / 3, w: size, h: size * 0.65, height: size * 1.1, blocksFlying: false, seed: rand() });
	}
	return {
		name: 'Ysmault · The Dark Altar',
		environment: 'planet',
		ground: 'bloodMoon',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 240, y: ENTRY.y - 40 },
		dummies: [],
		obstacles
	};
}

export class AtrocitusBoss implements MissionDirector {
	state: MissionState = 'intro';
	phase: FinalePhase = 'oath';
	timer = INTRO_TIME;
	lives = FINALE_LIVES;
	elapsed = 0;
	downs = 0;
	/** Times the Corps broke his Blood Oath. */
	wardBreaks = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ Atrocitus defeated · ★ no lives lost · ★ under 8 minutes';
	atrocitus: Enemy | null = null;
	dex: Enemy | null = null;
	/** Seconds left with his Blood Oath broken (0 = the ward is up). */
	wardDown = 0;
	/** Seconds left of the Book speaking (0 = it is shut). */
	speaking = 0;
	/** How many times it has spoken. */
	private spoken = 0;
	/** Who has hit him lately, and when. */
	private hitters = new Map<Player, number>();
	private held = 0;
	/** Seconds the restored ward can't be broken. */
	private wardHolds = 0;
	private reds: Enemy[] = [];
	private arrived = new Set<CrewId>();
	private pageIn = PAGE.every;
	private reading = 0;
	private rainIn = RAIN.every;
	private drops: { x: number; y: number; in: number }[] = [];
	private wasDown = false;
	private clock = 0;
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.speaking > 0) return 'Your rings are dark and he cannot be hurt. Stay alive until the Book shuts.';
		switch (this.phase) {
			case 'oath':
				return this.wardDown > 0 ? 'His Blood Oath is broken: everything on him, now!' : 'Break his Blood Oath: four Lanterns or more, all hitting him at once';
			case 'book':
				return this.wardDown > 0 ? 'The ward is down: hit him!' : 'The Book of the Black is open: hit him together, and keep your distance from it';
			case 'rage':
				return 'The rage has him: finish it, and stay out of the blood rain';
			case 'fallen':
				return 'Atrocitus has fallen';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const a = this.atrocitus;
		if (!a || !isStanding(a)) return [];
		const list: MissionMeter[] = [{ label: 'Atrocitus', value: a.hp / a.maxHp, text: '' }];
		if (this.speaking > 0) {
			list.push({ label: 'The Book', value: this.speaking / SPEAKS.time, text: 'Speaking', low: true });
			return list;
		}
		list.push({ label: 'Blood Oath', value: this.wardDown > 0 ? this.wardDown / WARD_DOWN : 1, text: this.wardDown > 0 ? 'Broken' : 'Warded', low: this.wardDown > 0 });
		return list;
	}

	warning(): string | null {
		if (this.speaking > 0) return 'THE BOOK IS SPEAKING: YOUR RING IS DARK — RUN';
		if (this.reading > 0) return 'HE IS READING FROM THE BOOK: GET AWAY FROM HIM';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.elapsed <= PAR_TIME ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Atrocitus has fallen, and the Book of the Black is bound again. It took every Lantern there was.';
		return 'Your Lantern went down one time too many, and the Book of the Black stayed open.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Blood Oath broken', value: `${this.wardBreaks} times` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	goal(): { x: number; y: number } | null {
		return this.atrocitus && isStanding(this.atrocitus) ? this.atrocitus : null;
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) this.begin(game);
				return;
			case 'won':
				this.timer += dt;
				return;
			case 'lost':
				for (const p of game.players) if (p.downed && p.slot === 0) p.downTimer = Math.max(p.downTimer, 1);
				return;
		}

		this.elapsed += dt;
		this.clock += dt;
		this.countDowns(game);
		if (this.state !== 'playing') return;
		if (this.phase === 'fallen') {
			for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
			if (!this.comms.current) this.win(game);
			return;
		}
		this.reinforce(game);
		const a = this.atrocitus!;
		if (!isStanding(a)) {
			this.fall(game, a);
			return;
		}
		this.hold(game, a, dt);
		this.oath(game, a, dt);
		const hp = a.hp / a.maxHp;
		if (this.speaking > 0) this.speak(game, a, dt);
		else if (this.spoken < SPEAKS_AT.length && hp <= SPEAKS_AT[this.spoken]) this.openMouth(game, a);
		if (this.phase === 'oath' && hp <= BOOK_AT) this.openBook(game, a);
		if (this.phase === 'book' && hp <= RAGE_AT) this.enrage(game, a);
		if (this.phase === 'book' || this.phase === 'rage') this.book(game, a, dt);
		if (this.phase === 'rage') this.rain(game, dt);
		this.chatter(game, a);
	}

	private begin(game: Game) {
		this.state = 'playing';
		game.constructs.maxHit = MAX_HIT;
		const a = game.spawnEnemy('atrocitus', ALTAR.x, ALTAR.y - 60);
		a.hp = a.maxHp = a.brain.lastHp = Math.round(a.maxHp * ATROCITUS_HEALTH);
		a.brain.might = ATROCITUS_MIGHT;
		a.brain.grit = TOUGHNESS;
		a.brain.alert = 10;
		a.brain.kit = [...KIT];
		// The mission says who he is after, not the pack's usual rules (see hold)
		a.brain.directed = true;
		this.atrocitus = a;
		this.held = a.hp;
		this.spawnWave(game, GUARD);
		this.comms.scene([
			['Atrocitus', 'Four Lanterns. The Guardians send four Lanterns to face the Book of the Black.'],
			['Razer', 'Four is enough to start.'],
			['John', 'His ward turns anything one of us throws. Four of us on him at once, and it breaks.'],
			['Hal', 'Then we hit him together. On me, everybody!']
		]);
	}

	/** Kilowog, Katma Tui and Boodikka arrive from Oa. */
	private reinforce(game: Game) {
		for (const [who, at] of REINFORCEMENTS) {
			if (this.arrived.has(who) || this.clock < at) continue;
			this.arrived.add(who);
			const me = game.players[0];
			const p = game.addPartner(who, me.x + (Math.random() - 0.5) * 500, me.y - 260);
			game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 2, text: p.def.name.toUpperCase(), owner: p });
			game.constructs.effects.push({ kind: 'snap', x: p.x, y: p.y - 60, age: 0, life: 0.7, radius: 80 });
			if (who === 'kilowog') {
				this.comms.scene([
					['Kilowog', "Did somebody call for every Lantern the Guardians could spare? Here's three!"],
					['Katma Tui', 'The rest of the Corps holds Oa. We are what they could send.'],
					['Boodikka', 'Point me at the big one. Again.']
				]);
			}
		}
	}

	/**
	 * He holds the altar.
	 *
	 * Left to the usual rules he picks whichever of the seven Lanterns is
	 * nearest and goes to them, and since they scatter he ends up chasing one
	 * across the plain, off the edge of the screen, with the fight strung out
	 * behind him. He is the Red Lanterns' master standing on his own altar: he
	 * does not run anybody down. So he takes whoever comes to the altar (the
	 * Lantern you play hardest of all), and he turns back at the edge of his
	 * ground.
	 */
	private hold(game: Game, a: Enemy, dt: number) {
		const b = a.brain;
		const up = game.players.filter((p) => !p.downed && !p.hero);
		if (up.length > 0) {
			// Hunting, he takes whoever is nearest HIM. Holding, whoever comes
			// to the altar, with the Lantern you play counted nearer than they are.
			const hunting = this.speaking > 0;
			const from = hunting ? a : ALTAR;
			const fromAltar = (p: { x: number; y: number }) => Math.hypot(p.x - from.x, p.y - from.y);
			let want = up[0];
			let best = Infinity;
			for (const p of up) {
				const score = fromAltar(p) - (!hunting && p.slot === 0 ? LEAD_PULL : 0);
				if (score < best) {
					best = score;
					want = p;
				}
			}
			if (b.target !== want) {
				b.target = want;
				b.engaged = false;
				b.focusTime = 0;
			}
			b.directed = true;
		}
		// The edge of his ground: he turns back faster than he flies out. The
		// one time he leaves it is when the Book has him hunting.
		if (this.speaking > 0) return;
		const dx = a.x - ALTAR.x;
		const dy = a.y - ALTAR.y;
		const out = Math.hypot(dx, dy);
		if (out > HOLD) {
			const back = Math.min(out - HOLD, TURN_BACK * dt);
			a.x -= (dx / out) * back;
			a.y -= (dy / out) * back;
			a.prevX = a.x;
			a.prevY = a.y;
		}
	}

	/**
	 * The Blood Oath: most of any hit is turned, unless enough Lanterns have
	 * hit him in the last couple of seconds, which breaks it for a while.
	 */
	private oath(game: Game, a: Enemy, dt: number) {
		// Who just hit him (the grudge is whoever hurt him last)
		const b = a.brain;
		if (b.grudge && b.grudgeAgo < dt * 1.5) this.hitters.set(b.grudge, this.elapsed);
		for (const [p, at] of this.hitters) if (this.elapsed - at > WARD_WINDOW || p.downed) this.hitters.delete(p);
		// While the Book speaks nothing touches him at all, oath or no oath
		if (this.speaking > 0) {
			const held = this.held - a.hp;
			if (held > 0) a.hp = a.brain.lastHp = this.held;
		}
		if (this.wardDown > 0) {
			this.wardDown = Math.max(0, this.wardDown - dt);
			if (this.wardDown === 0) {
				game.constructs.effects.push({ kind: 'callout', x: a.x, y: a.y - 260, age: 0, life: 1.4, text: 'BLOOD OATH RESTORED', hurt: true });
				this.hitters.clear();
				this.wardHolds = WARD_HOLDS;
			}
		} else {
			// Turned: only a share of what he just took gets through
			const lost = this.held - a.hp;
			if (lost > 0) a.hp = a.brain.lastHp = this.held - lost * WARD_TAKES;
			this.wardHolds = Math.max(0, this.wardHolds - dt);
			if (this.wardHolds === 0 && this.speaking === 0 && this.hitters.size >= WARD_BREAKERS) {
				this.wardDown = WARD_DOWN;
				this.wardBreaks++;
				game.constructs.effects.push({ kind: 'callout', x: a.x, y: a.y - 260, age: 0, life: 1.8, text: 'BLOOD OATH BROKEN' });
				heroFx(game.constructs).push({ kind: 'boom', x: a.x, y: a.y, age: 0, life: 0.6, radius: 160 });
				this.once('firstBreak', () => this.comms.say('Kilowog', "That's it! Together! Now pour it on!", true));
			}
		}
		this.held = a.hp;
	}

	/**
	 * The Book speaks. Every green ring on the plain goes dark (they still
	 * shoot; they build nothing), the bubbles already up burst, nothing the
	 * Corps throws reaches him, and he comes off the altar after whoever is
	 * nearest. There is no way to win these eight seconds. You live through
	 * them. Razer's ring is red, and the Book has no hold on it.
	 */
	private openMouth(game: Game, a: Enemy) {
		this.speaking = SPEAKS.time;
		this.spoken++;
		a.brain.speedMul *= SPEAKS.speed;
		a.brain.rage = 1;
		// Every bubble on the plain bursts
		for (const sh of [...game.constructs.shields]) {
			game.constructs.effects.push({ kind: 'fizzle', x: sh.target.x, y: sh.target.y - 30, age: 0, life: 0.6 });
			game.constructs.shields.splice(game.constructs.shields.indexOf(sh), 1);
		}
		game.constructs.effects.push({ kind: 'callout', x: a.x, y: a.y - 280, age: 0, life: 2.4, text: 'THE BOOK OF THE BLACK SPEAKS', hurt: true });
		game.constructs.effects.push({ kind: 'pulse', x: a.x, y: a.y, age: 0, life: 0.9, radius: 900 });
		this.comms.clear();
		this.comms.scene(
			this.spoken === 1
				? [
						['Atrocitus', 'You want the Book to speak? Then hear it.'],
						['Kilowog', 'My ring — I got nothin\'! NOTHIN\'!'],
						['John', "Then we don't fight him. RUN. Everybody, RUN!"]
					]
				: [
						['Atrocitus', 'AGAIN. Let it speak again.'],
						['Katma Tui', 'Scatter! Do not let him have two of us at once!']
					]
		);
	}

	/** While it speaks: rings stay dark, and he hunts. */
	private speak(game: Game, a: Enemy, dt: number) {
		this.speaking = Math.max(0, this.speaking - dt);
		for (const p of game.players) {
			if (p.hero) continue;
			p.branded = Math.max(p.branded, this.speaking);
		}
		a.brain.rage = 1;
		if (this.speaking > 0) return;
		// It shuts
		a.brain.speedMul /= SPEAKS.speed;
		game.constructs.effects.push({ kind: 'callout', x: a.x, y: a.y - 260, age: 0, life: 1.8, text: 'THE BOOK SHUTS' });
		for (const p of game.players) p.branded = 0;
		this.once(`shut${this.spoken}`, () => this.comms.say('Hal', 'Rings are back. On him — all of us, NOW!', true));
	}

	private openBook(game: Game, a: Enemy) {
		this.phase = 'book';
		this.pageIn = 5;
		this.spawnWave(game, BOOK_WAVE);
		this.dex = this.reds.find((e) => e.kind === 'dexStarr') ?? null;
		if (this.dex) {
			this.dex.hp = this.dex.maxHp = this.dex.brain.lastHp = Math.round((this.dex.maxHp / TOUGHNESS) * DEX_HEALTH);
		}
		a.brain.rage = 0.6;
		this.comms.scene([
			['Atrocitus', 'Enough. Let the Book speak.'],
			['Dex-Starr', 'Dex-Starr is BACK! Dex-Starr told you! Bad Lanterns, BAD!'],
			['Razer', 'The Book drinks will. Do not stand near him when he reads!']
		]);
	}

	/** The Book drains will near him, and every so often he reads a page that quiets every ring nearby. */
	private book(game: Game, a: Enemy, dt: number) {
		for (const p of game.players) {
			if (p.downed || p.hero) continue;
			if (Math.hypot(p.x - a.x, p.y - a.y) < BOOK_DRAIN.range) p.willpower = Math.max(0, p.willpower - BOOK_DRAIN.rate * dt);
		}
		this.pageIn -= dt;
		if (this.reading === 0 && this.pageIn <= PAGE.warn) {
			this.reading = 0.01;
			game.constructs.effects.push({ kind: 'slamMark', x: a.x, y: a.y, age: 0, life: PAGE.warn, radius: PAGE.range });
		}
		if (this.reading > 0) this.reading = Math.min(1, 1 - this.pageIn / PAGE.warn);
		a.brain.rage = Math.max(a.brain.rage, this.reading);
		if (this.pageIn > 0) return;
		this.pageIn = PAGE.every;
		this.reading = 0;
		game.constructs.effects.push({ kind: 'pulse', x: a.x, y: a.y, age: 0, life: 0.5, radius: PAGE.range });
		for (const p of game.players) {
			if (p.downed || p.hero || Math.hypot(p.x - a.x, p.y - a.y) > PAGE.range) continue;
			p.branded = Math.max(p.branded, PAGE.silence);
		}
		this.once('page', () => this.comms.say('Arisia', 'My ring! It will not build anything!', true));
	}

	private enrage(game: Game, a: Enemy) {
		this.phase = 'rage';
		a.brain.might *= RAGE.might;
		a.brain.speedMul *= RAGE.speed;
		a.brain.rage = 1;
		game.constructs.effects.push({ kind: 'callout', x: a.x, y: a.y - 260, age: 0, life: 2.2, text: 'THE RAGE TAKES HIM', hurt: true });
		this.comms.scene([
			['Atrocitus', 'TEN THOUSAND YEARS! TEN THOUSAND YEARS OF RAGE, AND YOU THINK YOU CAN END IT?'],
			['John', "Blood's coming down all over! Watch the red rings!"]
		]);
	}

	/** The blood rain: drops come down all over the plain, each with a ring first. */
	private rain(game: Game, dt: number) {
		this.rainIn -= dt;
		if (this.rainIn <= 0) {
			this.rainIn = RAIN.every * (0.7 + Math.random() * 0.6);
			const up = game.players.filter((p) => !p.downed);
			const on = up.length > 0 && Math.random() < 0.6 ? up[Math.floor(Math.random() * up.length)] : { x: 300 + Math.random() * (W - 600), y: 300 + Math.random() * (H - 600) };
			const x = on.x + (Math.random() - 0.5) * 120;
			const y = on.y + (Math.random() - 0.5) * 80;
			this.drops.push({ x, y, in: RAIN.warn });
			game.constructs.effects.push({ kind: 'slamMark', x, y, age: 0, life: RAIN.warn, radius: RAIN.radius });
		}
		for (const d of [...this.drops]) {
			d.in -= dt;
			if (d.in > 0) continue;
			this.drops.splice(this.drops.indexOf(d), 1);
			game.constructs.effects.push({ kind: 'redImpact', x: d.x, y: d.y, age: 0, life: 0.5, radius: RAIN.radius });
			for (const p of game.players) if (Math.hypot(p.x - d.x, p.y - d.y) < RAIN.radius) damagePlayer(game.constructs, p, RAIN.damage, d.x, d.y, RAIN.knockback);
		}
	}

	/** He falls. Every Red Lantern with him drops, and Ganthet binds the Book. */
	private fall(game: Game, a: Enemy) {
		this.phase = 'fallen';
		this.clock = 0;
		this.drops = [];
		this.reading = 0;
		this.speaking = 0;
		for (const e of game.enemies) {
			if (!isStanding(e)) continue;
			hitDummyWithFx(game.constructs, e, e.hp + 1, 500, a.x, a.y, null, 0);
		}
		for (const p of game.players) p.branded = 0;
		game.constructs.effects.push({ kind: 'callout', x: a.x, y: a.y - 200, age: 0, life: 2.8, text: 'ATROCITUS HAS FALLEN' });
		for (let k = 0; k < 4; k++) heroFx(game.constructs).push({ kind: 'boom', x: a.x + (k % 2 ? 50 : -50), y: a.y - k * 10, age: -k * 0.2, life: 0.8, radius: 140 + k * 30 });
		this.comms.clear();
		this.comms.scene([
			['Atrocitus', 'Rage... does not end, Lanterns. It only... waits.'],
			['Razer', 'Then let it wait. Down here, in the dark, with you.'],
			['Ganthet', 'The Book. Give it to me.'],
			['Ganthet', 'It is bound. It will not open again while there is a Corps to guard it.'],
			['John', "Ten thousand years. The Guardians' machines made him."],
			['Hal', "And the Guardians' Corps stopped him. Took all of us, though."],
			['Kilowog', "Every last poozer. Come on. Let's go home."]
		]);
	}

	private spawnWave(game: Game, wave: Wave) {
		for (const [kind, dx, dy, role] of wave) {
			const e = game.spawnEnemy(kind, ALTAR.x + dx, ALTAR.y + dy, role ?? 'berserker');
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
			e.brain.alert = 10;
			this.reds.push(e);
		}
	}

	private chatter(game: Game, a: Enemy) {
		void game;
		if (this.clock > 12 && this.wardBreaks === 0) this.once('hint', () => this.comms.say('John', 'One at a time does nothing! All of us on him at once!', true));
		if (a.hp / a.maxHp < 0.45) this.once('razer', () => this.comms.say('Razer', 'For my world, Atrocitus. For every world in this sector.'));
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	private countDowns(game: Game) {
		const me = game.players[0];
		if (me.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) {
				this.state = 'lost';
				this.failReason = 'lantern';
				game.downedNotice = false;
				this.comms.clear();
			} else this.comms.say('Kilowog', 'On your feet, poozer! Not now! Not here!');
		}
		this.wasDown = me.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	// -------------------------------------------------------------- drawing

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: ALTAR.y + 80, draw: () => drawBloodAltar(ctx, ALTAR.x, ALTAR.y + 140, 200, time, 0) }];
		const a = this.atrocitus;
		if (a && isStanding(a) && this.wardDown === 0) list.push({ baseY: a.y + 2, draw: () => drawBloodOath(ctx, a.x, a.y, time, this.hitters.size) });
		return list;
	}
}

/** The Blood Oath: a sphere of rage-red spikes round him; it cracks as more Lanterns hit him. */
function drawBloodOath(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, hitters: number) {
	const cy = y - 120;
	const r = 120;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.strokeStyle = `rgba(255, 40, 40, ${0.35 + 0.15 * Math.sin(time * 4)})`;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(x, cy, r, r * 1.05, 0, 0, Math.PI * 2);
	ctx.stroke();
	// Spikes round it
	ctx.fillStyle = 'rgba(255, 50, 40, 0.35)';
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2 + time * 0.3;
		const bx = x + Math.cos(a) * r;
		const by = cy + Math.sin(a) * r * 1.05;
		ctx.beginPath();
		ctx.moveTo(bx + Math.cos(a + 1.57) * 6, by + Math.sin(a + 1.57) * 6);
		ctx.lineTo(bx + Math.cos(a) * 18, by + Math.sin(a) * 18);
		ctx.lineTo(bx - Math.cos(a + 1.57) * 6, by - Math.sin(a + 1.57) * 6);
		ctx.closePath();
		ctx.fill();
	}
	// Cracks, one per Lantern hitting him now
	ctx.strokeStyle = 'rgba(255, 230, 220, 0.85)';
	ctx.lineWidth = 2;
	for (let i = 0; i < Math.min(hitters, 3); i++) {
		const a = i * 2.1 + 0.6;
		ctx.beginPath();
		ctx.moveTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
		ctx.lineTo(x + Math.cos(a + 0.2) * r * 0.6, cy + Math.sin(a + 0.2) * r * 0.6);
		ctx.lineTo(x + Math.cos(a - 0.1) * r * 0.3, cy + Math.sin(a - 0.1) * r * 0.3);
		ctx.stroke();
	}
	ctx.restore();
}
