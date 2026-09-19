// Mission 3: Colony Under Fire. John Stewart's first mission.
//
// Mirrow Colony is under attack. John goes in alone (he can call Hal for
// backup: B, twice, for a while each time):
//
//   rescue   three groups of colonists hide in their shelters. Reach a shelter
//            and its colonists follow John to the evacuation shuttles; each
//            rescue draws Red Lanterns in. Zilius Zox rains fire on anyone out
//            in the open: the warning rings show where it will land, and the
//            bubble shield (Shift) goes over the colonists when they're the
//            ones in danger.
//   launch   the last shuttle's engines need time to warm up, and Zox comes
//            down himself. Keep the shuttle in one piece until it lifts off.
//
// Lose: John goes down 3 times, two groups of colonists are lost, or the last
// shuttle is destroyed.

import { absorbWithShield, type Protectable } from '../constructs/system';
import { isStanding } from '../dummy';
import type { Enemy, Role } from '../enemies/enemies';
import type { RedStrike } from '../enemies/redConstructs';
import { colonist, drawColonist, drawField, drawGroupBubble, drawShelter, drawShuttle } from '../draw/colony';
import { drawShipShield } from '../draw/escort';
import type { Figure } from '../draw/lantern';
import type { Drawable, Game } from '../game';
import { CRATE_HP, seededRandom, type GameMap, type Obstacle } from '../map';
import { boxOverlap } from '../physics';
import type { Player } from '../player';
import { Backup } from './backup';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type ColonyPhase = 'rescue' | 'launch';

export const COLONY_LIVES = 3;
const INTRO_TIME = 3;
/** How close John has to get to a shelter for its colonists to come out. */
const PICKUP_RADIUS = 130;
/** How close to the shuttle a group has to get to board. */
const BOARD_RADIUS = 150;
const GROUP_SPEED = 175;
/** Colonists stop this far from John (so they don't crowd him). */
const FOLLOW_GAP = 90;
const GROUP_HP = 100;
/** Seconds between Zox's fire barrages while colonists are out in the open. */
const BARRAGE_EVERY = 3.4;
const FIRE_WARNING = 1.3;
const FIRE_RADIUS = 60;
/** Damage a fireball does to colonists it lands on (a group takes four unshielded). */
const FIRE_DAMAGE = 28;
/** Seconds for the last shuttle's engines to warm up. */
const LAUNCH_TIME = 50;
const SHUTTLE_HULL = 420;
/** Red Lanterns here are this much tougher and harder-hitting than the lab's. */
const TOUGHNESS = 3;
const MIGHT = 1.8;
/** Backup: Hal, twice, this many seconds each time. */
const BACKUP_USES = 2;
const BACKUP_TIME = 40;

const W = 3800;
const H = 2000;
const SPAWN = { x: 640, y: 1000 };
/** The evacuation shuttles, top to bottom; the middle one leaves last. */
const SHUTTLES = [
	{ x: 330, y: 700 },
	{ x: 330, y: 1300 },
	{ x: 300, y: 1000 }
];
const SHELTERS = [
	{ x: 1650, y: 620 },
	{ x: 2300, y: 1420 },
	{ x: 3080, y: 860 }
];

type Wave = [Role | 'zox', number, number][];
/** Who comes when each group of colonists steps out. */
const PICKUP_WAVES: Wave[] = [
	[
		['berserker', 320, -120],
		['gunner', 380, 140]
	],
	[
		['hunter', -300, -160],
		['berserker', 320, 120],
		['gunner', 420, -60]
	],
	[
		['berserker', 300, -160],
		['hunter', -320, 160],
		['gunner', 420, 60],
		['gunner', -420, -60]
	]
];
const LAUNCH_WAVE: Wave = [
	['zox', 520, 0],
	['berserker', 420, -260],
	['hunter', 480, 280],
	['gunner', 640, -120]
];

interface Group {
	shelter: { x: number; y: number };
	x: number;
	y: number;
	vx: number;
	vy: number;
	state: 'hiding' | 'following' | 'boarding' | 'saved' | 'lost';
	hp: number;
	/** Which shuttle they board. */
	shuttle: number;
	members: Figure[];
	flash: number;
	/** 0..1 walking up the ramp and fading in. */
	board: number;
	readonly prot: Protectable;
}

interface Shuttle {
	x: number;
	y: number;
	/** 0 on the pad, 0..1 lifting off. */
	launch: number;
	hull: number;
	flash: number;
	readonly prot: Protectable;
}

/** Mirrow: shuttles on the left, fields and homes across the middle, shelters out to the right. */
export function buildColonyMap(): GameMap {
	const rand = seededRandom(3030);
	const obstacles: Obstacle[] = [];
	// Homes and barns, off the straight lines between the shelters and the pad
	const homes: [number, number, number, number][] = [
		[1050, 260, 170, 110],
		[1350, 1600, 200, 120],
		[1900, 240, 160, 110],
		[2650, 1650, 190, 120],
		[2700, 300, 180, 120],
		[3350, 1400, 170, 120],
		[1150, 1250, 140, 100]
	];
	for (const [x, y, w, h] of homes) obstacles.push({ kind: 'building', x, y, w, h, height: 60 + rand() * 40, blocksFlying: false, seed: rand() });
	// The shelters themselves: solid domes
	for (const s of SHELTERS) obstacles.push({ kind: 'building', x: s.x - 60, y: s.y - 30, w: 120, h: 28, height: 0, blocksFlying: false, seed: 0.5, hidden: true });
	// Farm crates by the fields
	for (let i = 0; i < 14; i++) {
		const x = 900 + rand() * 2700;
		const y = 200 + rand() * 1600;
		const o: Obstacle = { kind: 'crate', x, y, w: 38, h: 27, height: 28, blocksFlying: false, seed: rand(), hp: CRATE_HP, maxHp: CRATE_HP, movable: true };
		const near = (p: { x: number; y: number }, r: number) => Math.hypot(x - p.x, y - p.y) < r;
		const blocked = obstacles.some((b) => x < b.x + b.w + 40 && x + 38 + 40 > b.x && y < b.y + b.h + 40 && y + 27 + 40 > b.y);
		if (!blocked && !SHELTERS.some((s) => near(s, 220)) && !near(SPAWN, 250)) obstacles.push(o);
	}
	return {
		name: 'Mirrow Colony',
		environment: 'planet',
		ground: 'meadow',
		width: W,
		height: H,
		spawn: SPAWN,
		battery: { x: 520, y: 880 },
		dummies: [],
		obstacles
	};
}

export class ColonyUnderFire implements MissionDirector {
	state: MissionState = 'intro';
	phase: ColonyPhase = 'rescue';
	timer = INTRO_TIME;
	lives = COLONY_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	failReason: 'lantern' | 'colonists' | 'shuttle' | null = null;
	/** Seconds left on the last shuttle's engines. */
	launchLeft = LAUNCH_TIME;
	readonly comms = new Comms();
	readonly backup = new Backup('hal', BACKUP_USES, BACKUP_TIME, this.comms, {
		arrive: ['Hal Jordan, reporting. Somebody order a hero?', 'Back again, John. Miss me?'],
		leave: ["Guardians are calling. You've got this, John!", "That's my time. Give 'em hell, Stewart."]
	});
	readonly groups: Group[];
	readonly shuttles: Shuttle[];
	readonly starHint = '★ done · ★ every colonist saved · ★ Zilius Zox beaten';
	private zox: Enemy | null = null;
	private wave: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private fire: RedStrike[] = [];
	private barrage = BARRAGE_EVERY;
	private wasDown = false;
	private fields: [number, number, number, number, number][] = [];
	private game: Game | null = null;
	private rand: () => number;

	constructor(seed = 11) {
		this.rand = seededRandom(seed);
		this.shuttles = SHUTTLES.map((s, i) => ({
			...s,
			launch: 0,
			hull: SHUTTLE_HULL,
			flash: 0,
			prot: { x: s.x, y: s.y, name: i === 2 ? 'The last shuttle' : 'Shuttle', radius: 62, lift: 26, threat: 0 }
		}));
		this.groups = SHELTERS.map((s, i) => ({
			shelter: s,
			x: s.x,
			y: s.y + 40,
			vx: 0,
			vy: 0,
			state: 'hiding' as const,
			hp: GROUP_HP,
			shuttle: i === 2 ? 2 : i,
			members: [0, 1, 2, 3].map((k) => colonist(i * 4 + k)),
			flash: 0,
			board: 0,
			prot: { x: s.x, y: s.y + 40, name: 'Colonists', radius: 58, lift: 30, threat: 0 }
		}));
		const rand = seededRandom(seed + 1);
		for (let i = 0; i < 9; i++) this.fields.push([900 + rand() * 2600, 150 + rand() * 1600, 180 + rand() * 160, 110 + rand() * 90, rand()]);
	}

	// ------------------------------------------------------------ reporting

	get saved(): number {
		return this.groups.filter((g) => g.state === 'saved' || g.state === 'boarding').length;
	}

	get lost(): number {
		return this.groups.filter((g) => g.state === 'lost').length;
	}

	get objective(): string {
		if (this.phase === 'rescue') return `Get the colonists to the shuttles (${this.saved} / ${this.groups.length} groups)`;
		return `Protect the last shuttle until it launches`;
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase === 'launch') {
			const s = this.shuttles[2];
			const left = Math.ceil(this.launchLeft);
			list.push({ label: 'Launch', value: 1 - this.launchLeft / LAUNCH_TIME, text: `0:${String(left).padStart(2, '0')}`, marker: '▲' });
			list.push({ label: 'Hull', value: s.hull / SHUTTLE_HULL, text: `${Math.round((s.hull / SHUTTLE_HULL) * 100)}%`, low: s.hull < SHUTTLE_HULL * 0.3 });
		}
		for (const g of this.groups) {
			if (g.state !== 'following') continue;
			list.push({ label: 'Crowd', value: g.hp / GROUP_HP, text: `${Math.round(g.hp)}%`, low: g.hp < 40 });
		}
		const reds = this.wave.filter(isStanding).length;
		if (reds > 0) list.push({ label: 'Reds', value: reds / Math.max(1, this.wave.length), text: `${reds} left` });
		return list;
	}

	tally(): string {
		return this.state === 'playing' ? this.backup.status('B') : '';
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		const john = game.players[0];
		// Fire about to land on colonists with no bubble over them
		const unshielded = (prot: Protectable) => !game.constructs.shields.some((s) => s.target === prot);
		if (this.groups.some((g) => g.state === 'following' && g.prot.threat > 0 && unshielded(g.prot))) return 'Fire incoming! Shift to shield the colonists!';
		if (this.phase === 'launch' && this.shuttles[2].prot.threat > 0 && unshielded(this.shuttles[2].prot)) return 'Fire on the shuttle! Shift to shield it!';
		if (this.groups.some((g) => g.state === 'following' && Math.hypot(g.x - john.x, g.y - john.y) > 520)) return "The colonists can't keep up!";
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.lost === 0 ? 1 : 0) + (this.zox && !isStanding(this.zox) ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The last shuttle clears the atmosphere. Mirrow is empty, but everyone on it is alive. Not bad for a first day.';
		if (this.failReason === 'colonists') return 'Too many colonists were lost to the fire.';
		if (this.failReason === 'shuttle') return 'The last shuttle was destroyed on the pad.';
		return 'John went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Colonists saved', value: `${this.saved * 4} / ${this.groups.length * 4}` },
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Backup called', value: `${BACKUP_USES - this.backup.usesLeft} of ${BACKUP_USES}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	callBackup(game: Game, caller: Player) {
		if (this.state === 'playing') this.backup.call(game, caller);
	}

	update(game: Game, dt: number) {
		this.game = game;
		// The colonists and the last shuttle are things the bubble shield can go on
		const protectables = game.constructs.protectables;
		if (!protectables.includes(this.shuttles[2].prot)) protectables.push(...this.groups.map((g) => g.prot), this.shuttles[2].prot);
		for (const s of this.shuttles) {
			s.prot.x = s.x;
			s.prot.y = s.y;
			s.flash = Math.max(0, s.flash - dt);
			if (s.launch > 0 && s.launch < 1) s.launch = Math.min(1, s.launch + dt / 3);
		}
		for (const g of this.groups) g.flash = Math.max(0, g.flash - dt);
		this.comms.update(dt);
		this.countDefeats();

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.comms.scene([
						['Ring', 'Mirrow Colony is under attack. Evacuate the colonists to the shuttles.'],
						['John', 'First day on the job. No pressure.'],
						['Hal', "I'm tied up on the other side of the sector, John. Yell if you need me. (Press B.)"]
					]);
				}
				return;
			case 'won':
				this.timer += dt;
				return;
			case 'lost':
				for (const p of game.players) if (p.downed && p.slot === 0) p.downTimer = Math.max(p.downTimer, 1);
				return;
		}

		this.elapsed += dt;
		this.backup.update(game, dt);
		this.countDowns(game);
		if (this.state !== 'playing') return;
		const john = game.players[0];

		this.updateGroups(game, john, dt);
		this.updateFire(game, dt);
		if (this.state !== 'playing') return;

		switch (this.phase) {
			case 'rescue':
				if (this.groups.every((g) => g.state === 'saved' || g.state === 'lost')) this.startLaunch(game);
				break;
			case 'launch': {
				this.launchLeft -= dt;
				if (this.zox && !isStanding(this.zox)) this.saySoon('zoxDown', 'Zilius Zox', 'Ow! OW! This is NOT over, Lantern!');
				if (this.launchLeft <= 0) {
					this.shuttles[2].launch = 0.001;
					this.win(game);
				}
				break;
			}
		}
	}

	private updateGroups(game: Game, john: Player, dt: number) {
		for (const g of this.groups) {
			g.prot.x = g.x;
			g.prot.y = g.y;
			switch (g.state) {
				case 'hiding':
					if (!john.downed && Math.hypot(john.x - g.shelter.x, john.y - (g.shelter.y + 40)) < PICKUP_RADIUS) this.pickUp(game, g);
					break;
				case 'following': {
					const shuttle = this.shuttles[g.shuttle];
					if (Math.hypot(g.x - shuttle.x, g.y - shuttle.y) < BOARD_RADIUS) {
						g.state = 'boarding';
						g.board = 0;
						const left = this.groups.filter((o) => o.state === 'hiding').length;
						this.comms.say('John', left > 0 ? `That's ${this.saved} group${this.saved === 1 ? '' : 's'} aboard. Going back for the rest.` : "That's everybody out of the shelters.");
						break;
					}
					// Walk after John, keeping a little distance, sliding around anything solid
					const dx = john.x - g.x;
					const dy = john.y - g.y;
					const d = Math.hypot(dx, dy) || 1;
					const want = d > FOLLOW_GAP ? GROUP_SPEED : 0;
					g.vx = (dx / d) * want;
					g.vy = (dy / d) * want;
					this.moveGroup(game, g, dt);
					break;
				}
				case 'boarding': {
					// Up the ramp; the shuttle lifts off (the last one waits for its engines)
					const shuttle = this.shuttles[g.shuttle];
					g.x += (shuttle.x - g.x) * Math.min(1, dt * 3);
					g.y += (shuttle.y - g.y) * Math.min(1, dt * 3);
					g.board = Math.min(1, g.board + dt / 1.2);
					if (g.board >= 1) {
						g.state = 'saved';
						if (g.shuttle !== 2) shuttle.launch = 0.001;
					}
					break;
				}
			}
		}
	}

	private moveGroup(game: Game, g: Group, dt: number) {
		const blocked = (x: number, y: number) => game.map.obstacles.some((o) => o.kind !== 'wall' && boxOverlap(x, y, 30, 12, o));
		const nx = g.x + g.vx * dt;
		const ny = g.y + g.vy * dt;
		if (!blocked(nx, ny)) {
			g.x = nx;
			g.y = ny;
		} else if (!blocked(nx, g.y)) g.x = nx;
		else if (!blocked(g.x, ny)) g.y = ny;
		g.x = Math.max(40, Math.min(W - 40, g.x));
		g.y = Math.max(80, Math.min(H - 40, g.y));
	}

	private pickUp(game: Game, g: Group) {
		g.state = 'following';
		const n = this.groups.filter((o) => o.state !== 'hiding').length;
		const lines = [
			["Colonist", 'A Green Lantern! Everyone out, stay close to him!'],
			['Colonist', "They burned the east fields! We've been hiding for hours!"],
			['Colonist', "Is it true there's a shuttle? Please, my kids are with us!"]
		] as [string, string][];
		this.comms.scene([lines[n - 1] ?? lines[0], ...(n === 1 ? [['John', 'Stay behind me. Straight to the shuttles, move!'] as [string, string]] : [])]);
		this.spawnWave(game, PICKUP_WAVES[n - 1] ?? [], g.shelter.x, g.shelter.y);
	}

	/** Zox's fire: every few seconds, fireballs at whoever's out in the open. */
	private updateFire(game: Game, dt: number) {
		const w = game.constructs;
		const targets: { x: number; y: number; vx: number; vy: number }[] = [
			...this.groups.filter((g) => g.state === 'following'),
			...(this.phase === 'launch' && this.shuttles[2].launch === 0 ? [{ ...this.shuttles[2], vx: 0, vy: 0 }] : [])
		];
		if (targets.length > 0) {
			this.barrage -= dt;
			if (this.barrage <= 0) {
				this.barrage = BARRAGE_EVERY * (this.phase === 'launch' ? 0.8 : 1);
				for (const t of targets) {
					// One aimed where they're headed, one close by
					this.drop(game, t.x + t.vx * FIRE_WARNING, t.y + t.vy * FIRE_WARNING);
					const spread = this.phase === 'launch' ? 420 : 200;
					this.drop(game, t.x + (this.rand() - 0.5) * spread, t.y + (this.rand() - 0.5) * spread * 0.7);
				}
				this.saySoon('fire', 'Zilius Zox', 'HAHA! Dance for me, little farmers!');
			}
		}
		// What landed this tick (the strike is gone from the world once it hits)
		for (const s of [...this.fire]) {
			if (w.red.strikes.includes(s)) continue;
			this.fire.splice(this.fire.indexOf(s), 1);
			for (const g of this.groups) {
				if (g.state !== 'following' || Math.hypot(g.x - s.x, g.y - s.y) > s.radius + 30) continue;
				const through = absorbWithShield(w, g.prot, FIRE_DAMAGE);
				if (through <= 0) continue;
				g.hp -= through;
				g.flash = 0.3;
				if (g.hp <= 0) this.loseGroup(game, g);
			}
			const last = this.shuttles[2];
			if (this.phase === 'launch' && Math.hypot(last.x - s.x, last.y - s.y) <= s.radius + 50) {
				const through = absorbWithShield(w, last.prot, FIRE_DAMAGE);
				last.hull -= through;
				if (through > 0) last.flash = 0.25;
				if (last.hull <= 0) this.lose(game, 'shuttle');
			}
		}
		// Danger for the smart shield: fire about to land on them. The people John
		// is protecting come first, even with Red Lanterns swinging at him.
		const threatTo = (x: number, y: number, pad: number) =>
			this.fire.filter((s) => w.red.strikes.includes(s) && Math.hypot(x - s.x, y - s.y) <= s.radius + pad).length * 3;
		for (const g of this.groups) g.prot.threat = g.state === 'following' ? threatTo(g.x, g.y, 40) : 0;
		for (const s of this.shuttles) s.prot.threat = this.phase === 'launch' && s === this.shuttles[2] ? threatTo(s.x, s.y, 60) : 0;
	}

	private drop(game: Game, x: number, y: number) {
		const strike: RedStrike = {
			kind: 'meteor',
			x: Math.max(60, Math.min(W - 60, x)),
			y: Math.max(100, Math.min(H - 60, y)),
			radius: FIRE_RADIUS,
			delay: FIRE_WARNING,
			warning: FIRE_WARNING,
			damage: 14,
			knockback: 280
		};
		game.constructs.red.strikes.push(strike);
		this.fire.push(strike);
	}

	private loseGroup(game: Game, g: Group) {
		g.state = 'lost';
		this.comms.say('John', "No! ...I couldn't get to them in time.", true);
		if (this.lost >= 2) this.lose(game, 'colonists');
	}

	private startLaunch(game: Game) {
		this.phase = 'launch';
		this.launchLeft = LAUNCH_TIME;
		this.comms.scene([
			['Shuttle pilot', "Last shuttle's engines are cold! I need fifty seconds!"],
			['Zilius Zox', 'Leaving so soon? But the party is just getting started! HAHAHA!'],
			['John', "Then I'll give you your fifty seconds."]
		]);
		const s = this.shuttles[2];
		this.spawnWave(game, LAUNCH_WAVE, s.x, s.y);
		this.zox = this.wave.find((e) => e.kind === 'zox') ?? null;
	}

	private spawnWave(game: Game, wave: Wave, x: number, y: number) {
		const spawned = wave.map(([role, dx, dy]) => {
			const ex = Math.max(80, Math.min(W - 80, x + dx));
			const ey = Math.max(120, Math.min(H - 80, y + dy));
			const e = role === 'zox' ? game.spawnEnemy('zox', ex, ey) : game.spawnEnemy('rageGrunt', ex, ey, role);
			e.brain.grit = TOUGHNESS;
			e.brain.might = MIGHT;
			const tough = role === 'zox' ? 1.4 : TOUGHNESS;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * tough);
			return e;
		});
		this.wave = this.wave.every((e) => !isStanding(e)) ? spawned : [...this.wave, ...spawned];
	}

	private countDefeats() {
		for (const e of this.wave) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	private said = new Set<string>();
	private saySoon(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text);
	}

	private countDowns(game: Game) {
		const john = game.players[0];
		if (john.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game, 'lantern');
			else this.comms.say('John', "I'm not done yet...", true);
		}
		this.wasDown = john.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		this.comms.say('John', "Last shuttle's clear. Mirrow's safe.", true);
	}

	private lose(game: Game, reason: 'lantern' | 'colonists' | 'shuttle') {
		this.state = 'lost';
		this.failReason = reason;
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		// Keep colonists following John in view
		return this.groups.filter((g) => g.state === 'following').map((g): [number, number] => [g.x, g.y - 30]);
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.groups.some((g) => g.state === 'following')) {
			const g = this.groups.find((o) => o.state === 'following')!;
			return this.shuttles[g.shuttle];
		}
		if (this.phase === 'launch') return this.shuttles[2];
		const next = this.groups.find((g) => g.state === 'hiding');
		return next ? { x: next.shelter.x, y: next.shelter.y + 40 } : null;
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		const w = this.game?.constructs;
		list.push({ baseY: -1e6, draw: () => this.fields.forEach(([x, y, fw, fh, seed]) => drawField(ctx, x, y, fw, fh, seed)) });
		for (const s of this.groups) {
			const sh = s.shelter;
			list.push({ baseY: sh.y, draw: () => drawShelter(ctx, sh.x, sh.y, s.state !== 'hiding', time) });
		}
		this.shuttles.forEach((s) => {
			const shield = w?.shields.find((x) => x.target === s.prot);
			list.push({
				baseY: s.y,
				draw: () => {
					drawShuttle(ctx, s.x, s.y, s.launch, s.flash > 0, time);
					if (shield && s.launch === 0) drawShipShield(ctx, shield, s.x, s.y - s.prot.lift, s.prot.radius, time);
				}
			});
		});
		const offsets = [
			[-26, -10],
			[10, -20],
			[-8, 14],
			[26, 6]
		];
		for (const g of this.groups) {
			if (g.state === 'hiding' || g.state === 'saved' || g.state === 'lost') continue;
			const walking = g.state === 'boarding' || Math.hypot(g.vx, g.vy) > 5;
			const dir: 1 | -1 = g.vx < -1 ? -1 : 1;
			g.members.forEach((fig, i) => {
				const [ox, oy] = offsets[i];
				const x = g.x + ox;
				const y = g.y + oy;
				list.push({
					baseY: y,
					draw: () => {
						ctx.save();
						ctx.globalAlpha = 1 - g.board;
						if (g.flash > 0) ctx.filter = 'brightness(1.8) sepia(1) hue-rotate(-30deg)';
						drawColonist(ctx, fig, x, y, dir, walking, time + i * 0.37);
						ctx.restore();
					}
				});
			});
			const shield = w?.shields.find((x) => x.target === g.prot);
			if (shield && g.state === 'following') list.push({ baseY: g.y + 30, draw: () => drawGroupBubble(ctx, g.x, g.y, 62, shield.hp / shield.maxHp, time) });
		}
		return list;
	}
}
