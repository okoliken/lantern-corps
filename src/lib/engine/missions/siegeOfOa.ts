// Act 3, Mission 1: Siege of Oa.
//
// Atrocitus used the Manhunters to pull the Corps away, and now his fleet is
// over Oa with most of the Lanterns still scattered across the sectors. Hal,
// John and Kilowog hold the Central Battery: the light every ring in the Corps
// draws on. You choose Hal or John; the other and Kilowog fight beside you.
//
//   drop       drop pods of rage come down all round the battery. Every Red
//              Lantern that gets close starts drinking its light (a red line
//              to the battery): keep them off it
//   bombard    Red fighters make torpedo runs on the battery: shoot the
//              torpedoes down, or put a bubble on the battery (it's worth it)
//   corps      Zox and Skallox land, and the Lanterns you freed from the
//              prison moon come home: Arisia, Katma Tui and Boodikka join in
//   flagship   the flagship opens fire from orbit: strikes come down all over
//              the plaza (a red ring first: get out of it, or shield). Hold
//              until the Guardians can wake the battery
//   flare      the battery blazes out and throws the Reds off Oa
//   taken      in the light, nobody sees Dex-Starr until it's too late: he
//              carries a Guardian off into the dark
//
// Lose: the battery's light runs out, or your Lantern goes down 3 times.

import { damagePlayer } from '../combat';
import { absorbWithShield, hitDummyWithFx, type Protectable } from '../constructs/system';
import { drawCentralBattery, drawDexStarr, drawDrain, drawDropPod, drawOrbitalStrike } from '../draw/siege';
import { isStanding, type Dummy } from '../dummy';
import { ENEMIES, type Enemy, type EnemyKind, type Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import { heroFx } from '../heroes';
import { IDLE } from '../input';
import type { CrewId } from '../lanterns';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type SiegePhase = 'drop' | 'bombard' | 'corps' | 'flagship' | 'flare' | 'taken';

export const SIEGE_LIVES = 3;
const INTRO_TIME = 3;
/** The battery's light, and how much each Red near it drinks per second. */
export const BATTERY_POWER = 1000;
export const DRAIN_RANGE = 300;
const DRAIN_RATE = 3.6;
/** With no Red Lantern on it, the Guardians feed the battery back up this much a second. */
const REFILL_RATE = 2;
/** Red Lanterns: health and hitting power on top of their base. */
const TOUGHNESS = 3.4;
const MIGHT = 3.6;
const LIEUTENANT_HEALTH = 5.5;
const LIEUTENANT_MIGHT = 3.3;
/** A drop pod: seconds falling, how hard it lands on anyone under it. */
const POD_FALL = 1.4;
const POD_LANDING = { radius: 90, damage: 16, knockback: 480 };
/** Roughly half of what drops heads straight for the battery, fighting as it goes. */
const SAPPER_SHARE = 0.45;
const SAPPER_PULL = 600;
/** Torpedoes at the battery. */
export const TORPEDO = { radius: 14, hp: 18, speed: 220, damage: 35, lanternDamage: 14, lift: 60 };
const TORPEDO_EVERY: [number, number] = [4, 6];
/** The flagship: seconds of it, how often a strike comes down, the warning, and what a strike does. */
export const FLAGSHIP_TIME = 60;
const STRIKE = { every: 1.6, warn: 1.5, radius: 130, damage: 30, knockback: 520, battery: 60 };
/** Pods keep coming while the flagship fires: one every so often, at most this many Reds up. */
const FLAGSHIP_POD_EVERY = 2.4;
const FLAGSHIP_CAP = 12;
/** The flare: how much it does to every Red on the plaza. */
const FLARE_DAMAGE = 9999;
/** Seconds of Dex-Starr's escape. */
const DEX_TIME = 6;
/** The most one hit can take off a Lantern. */
const MAX_HIT = 36;

const W = 3200;
const H = 2000;
export const BATTERY = { x: 1600, y: 1000 };
const ENTRY = { x: 1600, y: 1260 };

type Pod = [x: number, y: number, delay: number, kind?: EnemyKind, role?: Role];
/** Rings of pods round the battery (offsets from it). */
const around = (n: number, radius: number, start: number, gap: number, spin = 0): Pod[] =>
	Array.from({ length: n }, (_, i) => {
		const a = spin + (i / n) * Math.PI * 2;
		const roles: Role[] = ['berserker', 'hunter', 'gunner'];
		return [Math.cos(a) * radius, Math.sin(a) * radius * 0.7, start + i * gap, 'rageGrunt', roles[i % 3]] as Pod;
	});
const DROPS: Pod[][] = [around(6, 520, 0.5, 0.35, 0.3), around(8, 600, 0.3, 0.3, 1.1), around(10, 560, 0.2, 0.25, 2)];
const FIGHTERS: Pod[] = [
	[-1100, -600, 0, 'redFighter'],
	[1100, -600, 0.8, 'redFighter'],
	[-1150, 550, 1.6, 'redFighter'],
	[1150, 550, 2.4, 'redFighter'],
	[0, -900, 3.2, 'redFighter'],
	[0, 900, 4, 'redFighter']
];
const ESCORT: Pod[] = around(8, 480, 1, 0.45, 0.7);
/** While Zox and Skallox are up, a pod every so often; the Corps gets home this long after they land. */
const CORPS_POD_EVERY = 4.5;
const HOMECOMING_AFTER = 18;
/** Freed on the prison moon in Act 1: they come home. */
const HOMECOMING: [CrewId, number, number][] = [
	['arisia', -700, -300],
	['katma', 700, -300],
	['boodikka', 0, 520]
];

/** Oa: the great plaza round the Central Battery. */
export function buildOaPlazaMap(): GameMap {
	return {
		name: 'Oa · The Central Battery',
		environment: 'planet',
		ground: 'oa',
		width: W,
		height: H,
		spawn: ENTRY,
		// Your ring draws on the Central Battery itself: stand at its foot to recharge
		battery: { x: BATTERY.x, y: BATTERY.y + 30 },
		dummies: [],
		obstacles: []
	};
}

interface Strike {
	x: number;
	y: number;
	/** Seconds until it lands; below 0, how long since it did. */
	in: number;
}

export class SiegeOfOa implements MissionDirector {
	state: MissionState = 'intro';
	phase: SiegePhase = 'drop';
	timer = INTRO_TIME;
	lives = SIEGE_LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	torpedoesDowned = 0;
	/** The battery's light (0..BATTERY_POWER). */
	power = BATTERY_POWER;
	failReason: 'lantern' | 'battery' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ Oa held · ★ no lives lost · ★ the battery above half its light';
	/** The Central Battery, as something a bubble shield can go on. */
	readonly battery: Protectable = { x: BATTERY.x, y: BATTERY.y, name: 'Central Battery', radius: 120, lift: 140, threat: 0 };
	zox: Enemy | null = null;
	skallox: Enemy | null = null;
	/** Who came home from the prison moon. */
	readonly homecoming: Player[] = [];
	private reds: Enemy[] = [];
	private sappers = new WeakSet<Enemy>();
	private counted = new WeakSet<Enemy>();
	private pods: { x: number; y: number; in: number; kind: EnemyKind; role: Role }[] = [];
	private torpedoes = new Set<Dummy>();
	private burst = new WeakSet<Dummy>();
	private reloads = new WeakMap<Enemy, number>();
	private strikes: Strike[] = [];
	private strikeIn = 1;
	private podIn = 0;
	private wave = 0;
	/** Seconds the battery shakes after a hit. */
	private hit = 0;
	private flare = 0;
	/** Dex-Starr's escape: how far along (0..1). */
	private dex = 0;
	private draining: Enemy[] = [];
	private wasDown = false;
	private clock = 0;
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'drop':
				return 'Hold the Central Battery: keep the Red Lanterns off it';
			case 'bombard':
				return 'Torpedoes on the battery: shoot them down, or shield it';
			case 'corps':
				return 'Zox and Skallox: bring them down';
			case 'flagship':
				return `The flagship is firing: hold on (${Math.max(0, Math.ceil(FLAGSHIP_TIME - this.clock))}s)`;
			case 'flare':
				return 'The battery wakes';
			case 'taken':
				return 'Dex-Starr!';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [{ label: 'Battery', value: this.power / BATTERY_POWER, text: `${Math.round((this.power / BATTERY_POWER) * 100)}%`, low: this.power < BATTERY_POWER * 0.3 }];
		if (this.phase === 'flagship') list.push({ label: 'Hold', value: Math.min(1, this.clock / FLAGSHIP_TIME), text: `${Math.max(0, Math.ceil(FLAGSHIP_TIME - this.clock))}s` });
		for (const [label, e] of [
			['Zox', this.zox],
			['Skallox', this.skallox]
		] as const) {
			if (e && isStanding(e)) list.push({ label, value: e.hp / e.maxHp, text: '' });
		}
		return list;
	}

	warning(): string | null {
		if (this.draining.length >= 3) return 'RED LANTERNS ARE DRAINING THE BATTERY';
		if ([...this.torpedoes].filter(isStanding).length >= 2) return 'TORPEDOES INBOUND ON THE BATTERY';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.downs === 0 ? 1 : 0) + (this.power >= BATTERY_POWER / 2 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'Oa held, and the Red fleet is running. But Dex-Starr has a Guardian, and nobody saw which way he went.';
		if (this.failReason === 'battery') return 'The Central Battery went dark, and every ring in the Corps went with it.';
		return 'The last Lantern on the plaza went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Red Lanterns beaten', value: `${this.defeated}` },
			{ label: 'Torpedoes shot down', value: `${this.torpedoesDowned}` },
			{ label: 'Battery left', value: `${Math.round((this.power / BATTERY_POWER) * 100)}%` },
			{ label: 'Lives lost', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	goal(): { x: number; y: number } | null {
		// Whoever is drinking the battery comes first
		const drinker = this.draining[0];
		if (drinker) return drinker;
		const torpedo = [...this.torpedoes].find(isStanding);
		if (torpedo) return torpedo;
		return this.reds.find(isStanding) ?? null;
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		const cw = game.constructs;
		if (!cw.protectables.includes(this.battery)) cw.protectables.push(this.battery);
		this.hit = Math.max(0, this.hit - dt);
		this.countDefeats();
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					cw.maxHit = MAX_HIT;
					this.dropAll(DROPS[0]);
					this.comms.scene([
						['Kilowog', 'Here they come! Drop pods, all round the battery!'],
						['The Guardians', 'Lanterns: if a Red Lantern reaches the battery, it will drink the light from it. Keep them away.']
					]);
				}
				return;
			case 'won':
				this.timer += dt;
				this.dexStarr(game, dt);
				return;
			case 'lost':
				for (const p of game.players) if (p.downed && p.slot === 0) p.downTimer = Math.max(p.downTimer, 1);
				return;
		}

		this.elapsed += dt;
		this.clock += dt;
		this.countDowns(game);
		if (this.state !== 'playing') return;
		this.landPods(game, dt);
		this.pullSappers(dt);
		this.drain(game, dt);
		this.fireTorpedoes(game, dt);
		this.updateTorpedoes(game);
		this.battery.threat = this.threat();
		if (this.power <= 0 && this.phase !== 'flare' && this.phase !== 'taken') {
			this.power = 0;
			this.state = 'lost';
			this.failReason = 'battery';
			game.downedNotice = false;
			this.comms.clear();
			return;
		}
		const clear = () => this.pods.length === 0 && this.reds.every((e) => !isStanding(e));

		switch (this.phase) {
			case 'drop':
				if (clear()) {
					this.wave++;
					if (this.wave < DROPS.length) {
						this.dropAll(DROPS[this.wave]);
						this.comms.say(this.wave === 1 ? 'Kilowog' : 'The Guardians', this.wave === 1 ? 'Second wave! More of \'em this time!' : 'A third wave. Hold, Lanterns. Help is coming.');
					} else this.startBombard(game);
				}
				break;
			case 'bombard':
				if (clear()) this.startCorps(game);
				break;
			case 'corps':
				if (this.clock >= HOMECOMING_AFTER) this.once('home', () => this.homecome(game));
				if ((this.zox && isStanding(this.zox)) || (this.skallox && isStanding(this.skallox))) {
					this.podIn -= dt;
					if (this.podIn <= 0) {
						this.podIn = CORPS_POD_EVERY;
						const a = Math.random() * Math.PI * 2;
						this.dropAll([[Math.cos(a) * 560, Math.sin(a) * 400, 0, 'rageGrunt', 'berserker']]);
					}
				}
				if (clear() && this.said.has('home')) this.startFlagship();
				break;
			case 'flagship':
				this.flagship(game, dt);
				if (this.clock >= FLAGSHIP_TIME) this.startFlare(game);
				break;
			case 'flare':
				this.flare = Math.min(1, this.clock / 2.5);
				for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
				if (this.clock >= 3 && !this.comms.current) this.startTaken(game);
				break;
			case 'taken':
				this.dexStarr(game, dt);
				for (const p of game.players) p.invuln = Math.max(p.invuln, 1);
				if (!this.comms.current) this.win(game);
				break;
		}
	}

	// ------------------------------------------------------------ the drop

	private dropAll(pods: Pod[]) {
		for (const [dx, dy, delay, kind = 'rageGrunt', role = 'berserker'] of pods) this.pods.push({ x: BATTERY.x + dx, y: BATTERY.y + dy, in: delay + POD_FALL, kind, role });
	}

	/** A pod comes down: anyone under it is thrown clear, and a Red Lantern climbs out. */
	private landPods(game: Game, dt: number) {
		for (const pod of [...this.pods]) {
			pod.in -= dt;
			if (pod.in > 0) continue;
			this.pods.splice(this.pods.indexOf(pod), 1);
			game.constructs.effects.push({ kind: 'redImpact', x: pod.x, y: pod.y, age: 0, life: 0.5, radius: POD_LANDING.radius });
			for (const p of game.players) if (Math.hypot(p.x - pod.x, p.y - pod.y) < POD_LANDING.radius) damagePlayer(game.constructs, p, POD_LANDING.damage, pod.x, pod.y, POD_LANDING.knockback);
			this.spawn(game, pod.kind, pod.x, pod.y, pod.role);
		}
	}

	private spawn(game: Game, kind: EnemyKind, x: number, y: number, role: Role = 'berserker'): Enemy {
		const e = game.spawnEnemy(kind, x, y, role);
		const lieutenant = ENEMIES[kind].lieutenant;
		e.brain.grit = TOUGHNESS;
		e.brain.might = lieutenant ? LIEUTENANT_MIGHT : MIGHT;
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * (lieutenant ? LIEUTENANT_HEALTH : TOUGHNESS));
		e.brain.alert = 10;
		if (kind === 'redFighter') this.reloads.set(e, 2 + Math.random() * 2);
		else if (!lieutenant && Math.random() < SAPPER_SHARE) this.sappers.add(e);
		this.reds.push(e);
		return e;
	}

	/** Sappers drift in toward the battery whatever else they're doing. */
	private pullSappers(dt: number) {
		for (const e of this.reds) {
			if (!isStanding(e) || !this.sappers.has(e) || e.stun > 0) continue;
			const d = Math.hypot(BATTERY.x - e.x, BATTERY.y - e.y);
			if (d < DRAIN_RANGE * 0.6) continue;
			e.vx += ((BATTERY.x - e.x) / d) * SAPPER_PULL * dt;
			e.vy += ((BATTERY.y - e.y) / d) * SAPPER_PULL * dt;
		}
	}

	/** Every Red Lantern near the battery drinks its light. */
	private drain(game: Game, dt: number) {
		void game;
		this.draining = this.reds.filter((e) => isStanding(e) && e.kind !== 'redFighter' && Math.hypot(e.x - BATTERY.x, e.y - BATTERY.y) < DRAIN_RANGE);
		if (this.draining.length === 0) {
			this.power = Math.min(BATTERY_POWER, this.power + REFILL_RATE * dt);
			return;
		}
		this.power -= this.draining.length * DRAIN_RATE * dt;
		this.once('drain', () => this.comms.say('John', "They're drinking from the battery! Get them off it!", true));
	}

	// ------------------------------------------------------------ torpedoes

	private startBombard(game: Game) {
		this.phase = 'bombard';
		this.clock = 0;
		this.dropAll([...FIGHTERS, ...ESCORT]);
		void game;
		this.comms.scene([
			['The Guardians', 'Fighters. They will try to crack the battery open from the air.'],
			['Hal', "Torpedoes. I've done this dance before. Shoot 'em down, or bubble the battery!"]
		]);
	}

	private fireTorpedoes(game: Game, dt: number) {
		for (const e of this.reds) {
			if (!isStanding(e) || e.kind !== 'redFighter') continue;
			const left = (this.reloads.get(e) ?? 0) - dt;
			this.reloads.set(e, left);
			if (left > 0 || Math.hypot(e.x - BATTERY.x, e.y - BATTERY.y) > 1100) continue;
			this.reloads.set(e, TORPEDO_EVERY[0] + Math.random() * (TORPEDO_EVERY[1] - TORPEDO_EVERY[0]));
			this.launchTorpedo(game, e);
		}
	}

	private launchTorpedo(game: Game, from: Enemy) {
		const tx = BATTERY.x + (Math.random() - 0.5) * 60;
		const ty = BATTERY.y + (Math.random() - 0.5) * 30;
		const len = Math.hypot(tx - from.x, ty - from.y) || 1;
		const t: Dummy = {
			kind: 'rageTorpedo',
			x: from.x,
			y: from.y,
			prevX: from.x,
			prevY: from.y,
			vx: ((tx - from.x) / len) * TORPEDO.speed,
			vy: ((ty - from.y) / len) * TORPEDO.speed,
			hp: TORPEDO.hp,
			maxHp: TORPEDO.hp,
			homeX: from.x,
			homeY: from.y,
			caged: 0,
			flash: 0,
			stun: 0,
			down: 0,
			respawns: false,
			gone: false,
			dir: tx > from.x ? 1 : -1,
			drift: { radius: TORPEDO.radius, float: TORPEDO.lift, spin: 0, seed: Math.random() }
		};
		game.dummies.push(t);
		this.torpedoes.add(t);
	}

	private updateTorpedoes(game: Game) {
		for (const t of this.torpedoes) {
			if (!isStanding(t)) {
				if (!this.burst.has(t)) this.torpedoesDowned++;
				game.constructs.effects.push({ kind: 'redImpact', x: t.x, y: t.y, age: 0, life: 0.3, lift: TORPEDO.lift });
				t.gone = true;
				this.torpedoes.delete(t);
				continue;
			}
			if (Math.hypot(t.x - BATTERY.x, (t.y - BATTERY.y) * 1.6) < this.battery.radius * 0.6 + TORPEDO.radius) {
				this.hurtBattery(game, TORPEDO.damage);
				this.pop(t);
				continue;
			}
			for (const p of game.players) {
				if (p.downed || p.dash) continue;
				if (Math.abs(t.x - p.x) < TORPEDO.radius + 12 && Math.abs(t.y - p.y) < TORPEDO.radius + 12) {
					damagePlayer(game.constructs, p, TORPEDO.lanternDamage, t.x, t.y, 240);
					this.pop(t);
					break;
				}
			}
			if (!this.burst.has(t) && Math.hypot(t.x - BATTERY.x, t.y - BATTERY.y) > 1800) {
				t.gone = true;
				this.torpedoes.delete(t);
			}
		}
	}

	private pop(t: Dummy) {
		this.burst.add(t);
		t.hp = 0;
		t.down = 0.2;
	}

	/** A hit on the battery: a bubble on it takes the blow. */
	private hurtBattery(game: Game, amount: number) {
		const through = absorbWithShield(game.constructs, this.battery, amount);
		if (through <= 0) return;
		this.power = Math.max(0, this.power - through);
		this.hit = 0.4;
	}

	/** How much the battery needs a bubble: torpedoes closing on it, and strikes about to land on it. */
	private threat(): number {
		let threat = 0;
		for (const t of this.torpedoes) {
			if (!isStanding(t)) continue;
			const d = Math.hypot(t.x - BATTERY.x, t.y - BATTERY.y);
			if (d < 450) threat += 1.2 * (1 - d / 600);
		}
		for (const s of this.strikes) if (s.in > 0 && s.in < 1 && Math.hypot(s.x - BATTERY.x, s.y - BATTERY.y) < STRIKE.radius + 80) threat += 1.5;
		if (this.power < BATTERY_POWER * 0.35) threat *= 1.5;
		return threat;
	}

	// ------------------------------------------------------ the Corps comes home

	private startCorps(game: Game) {
		this.phase = 'corps';
		this.clock = 0;
		this.zox = this.spawn(game, 'zox', BATTERY.x - 560, BATTERY.y - 420);
		this.skallox = this.spawn(game, 'skallox', BATTERY.x + 560, BATTERY.y - 420);
		this.dropAll(around(6, 640, 1.5, 0.5, 0.4));
		this.podIn = CORPS_POD_EVERY;
		this.comms.scene([
			['Zox', 'ZOX IS HERE! ZOX WILL BREAK YOUR LITTLE LANTERN!'],
			['Skallox', 'Three Lanterns. Atrocitus said there would be more of you. I am disappointed.'],
			['Kilowog', "Big ones, both of 'em. Stay on the battery, don't get pulled away!"]
		]);
	}

	/** The Lanterns freed from the prison moon get home. */
	private homecome(game: Game) {
		for (const [who, dx, dy] of HOMECOMING) {
			const p = game.addPartner(who, BATTERY.x + dx, BATTERY.y + dy);
			this.homecoming.push(p);
			game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 2, text: p.def.name.toUpperCase(), owner: p });
			game.constructs.effects.push({ kind: 'snap', x: p.x, y: p.y - 60, age: 0, life: 0.7, radius: 80 });
		}
		this.comms.scene([
			['Arisia', 'Not today, Zox! Hal Jordan: you broke us out of that prison. We came home to return the favour.'],
			['Katma Tui', 'Every Lantern within a day of Oa is on the way. We were closest.'],
			['Boodikka', 'Point me at the big one.'],
			['Kilowog', "HA! Now it's a fight! Take the big fellas down!"]
		]);
	}

	// ------------------------------------------------------------ the flagship

	private startFlagship() {
		this.phase = 'flagship';
		this.clock = 0;
		this.strikeIn = 2;
		this.podIn = 3;
		this.comms.scene([
			['The Guardians', 'The flagship is firing on the plaza. We need time to wake the battery. Hold.'],
			['John', 'How much time?'],
			['The Guardians', 'One minute.'],
			['Hal', "Get out of the red circles, keep 'em off the battery, and don't die. Easy."]
		]);
	}

	private flagship(game: Game, dt: number) {
		// Strikes from orbit: on the battery, on the Lanterns, anywhere
		this.strikeIn -= dt;
		if (this.strikeIn <= 0) {
			this.strikeIn = STRIKE.every * (0.7 + Math.random() * 0.6);
			const up = game.players.filter((p) => !p.downed);
			const on = Math.random() < 0.5 || up.length === 0 ? BATTERY : up[Math.floor(Math.random() * up.length)];
			const x = on.x + (Math.random() - 0.5) * 120;
			const y = on.y + (Math.random() - 0.5) * 80;
			this.strikes.push({ x, y, in: STRIKE.warn });
			game.constructs.effects.push({ kind: 'slamMark', x, y, age: 0, life: STRIKE.warn, radius: STRIKE.radius });
		}
		for (const s of [...this.strikes]) {
			const before = s.in;
			s.in -= dt;
			if (before > 0 && s.in <= 0) {
				heroFx(game.constructs).push({ kind: 'boom', x: s.x, y: s.y, age: 0, life: 0.6, radius: STRIKE.radius });
				for (const p of game.players) if (Math.hypot(p.x - s.x, p.y - s.y) < STRIKE.radius) damagePlayer(game.constructs, p, STRIKE.damage, s.x, s.y, STRIKE.knockback);
				if (Math.hypot(s.x - BATTERY.x, s.y - BATTERY.y) < STRIKE.radius + 60) this.hurtBattery(game, STRIKE.battery);
			}
			if (s.in < -0.4) this.strikes.splice(this.strikes.indexOf(s), 1);
		}
		// And the pods keep coming
		this.podIn -= dt;
		if (this.podIn <= 0) {
			this.podIn = FLAGSHIP_POD_EVERY;
			if (this.reds.filter(isStanding).length + this.pods.length < FLAGSHIP_CAP) {
				const a = Math.random() * Math.PI * 2;
				const roles: Role[] = ['berserker', 'hunter', 'gunner'];
				this.dropAll([[Math.cos(a) * 560, Math.sin(a) * 400, 0, 'rageGrunt', roles[Math.floor(Math.random() * 3)]]]);
			}
		}
		if (this.clock >= FLAGSHIP_TIME - 12) this.once('twelve', () => this.comms.say('The Guardians', 'Almost. Hold.', true));
	}

	// ------------------------------------------------------------ the ending

	/** The battery blazes out over Oa: every Red Lantern on the plaza is thrown off it. */
	private startFlare(game: Game) {
		this.phase = 'flare';
		this.clock = 0;
		this.strikes = [];
		this.pods = [];
		for (const t of this.torpedoes) this.pop(t);
		this.power = Math.max(this.power, 1);
		for (const e of game.enemies) {
			if (!isStanding(e)) continue;
			hitDummyWithFx(game.constructs, e, FLARE_DAMAGE, 1200, BATTERY.x, BATTERY.y, null, 0);
		}
		game.constructs.effects.push({ kind: 'snap', x: BATTERY.x, y: BATTERY.y - 200, age: 0, life: 1.2, radius: 400 });
		this.comms.clear();
		// Everyone on the plaza says it with them
		const me = game.players[0].def.id === 'john' ? 'John' : 'Hal';
		const other = me === 'Hal' ? 'John' : 'Hal';
		this.comms.scene([
			['The Guardians', 'In brightest day...'],
			[me, 'In blackest night...'],
			[other, 'No evil shall escape our sight!'],
			['Kilowog', "Let those who worship evil's might... BEWARE OUR POWER!"]
		]);
	}

	private startTaken(game: Game) {
		this.phase = 'taken';
		this.clock = 0;
		this.dex = 0;
		for (const p of game.players) {
			if (p.slot !== 0) p.input = { read: () => ({ ...IDLE }) };
		}
		this.comms.scene([
			['Kilowog', "They're running! The whole fleet's breaking off! HA!"],
			['Dex-Starr', 'Dex-Starr is GOOD KITTY. Dex-Starr takes the shiny blue man to Atrocitus.'],
			['Hal', 'Was that... a cat? Was that a CAT with a Red ring? John, he has Ganthet!'],
			['John', 'The fleet was cover. Again. He came for a Guardian the whole time.'],
			['The Guardians', 'Ganthet knows the way into the Book of the Black. If Atrocitus reads it... Find him. Bring him back.'],
			['Hal', 'We will. Every Lantern who came home tonight: with us.']
		]);
	}

	/** Dex-Starr streaks out of the battery's light with Ganthet in a bubble of rage, and off into the dark. */
	private dexStarr(game: Game, dt: number) {
		void game;
		this.dex = Math.min(1, this.dex + dt / DEX_TIME);
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	private countDefeats() {
		for (const e of this.reds) {
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
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
			} else this.comms.say('Kilowog', "Up, poozer! Oa don't hold itself!");
		}
		this.wasDown = me.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		if (this.phase === 'taken') return [[BATTERY.x + this.dex * 420, BATTERY.y - 240 - this.dex * 260]];
		return [];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: BATTERY.y + 31, draw: () => drawCentralBattery(ctx, BATTERY.x, BATTERY.y, time, this.power / BATTERY_POWER, this.flare, this.hit) }];
		for (const e of this.draining) list.push({ baseY: BATTERY.y + 40, draw: () => drawDrain(ctx, e.x, e.y - 50, BATTERY.x, BATTERY.y - 140, time) });
		for (const pod of this.pods) {
			const k = 1 - pod.in / POD_FALL;
			if (k >= 0) list.push({ baseY: pod.y, draw: () => drawDropPod(ctx, pod.x, pod.y, k, time) });
		}
		for (const s of this.strikes) if (s.in <= 0) list.push({ baseY: s.y + 1, draw: () => drawOrbitalStrike(ctx, s.x, s.y, STRIKE.radius, Math.min(1, -s.in / 0.4)) });
		if (this.phase === 'taken' || (this.state === 'won' && this.dex < 1)) {
			const k = this.dex;
			// Out of the battery's glow, a loop round the plaza, and away up into the dark
			const x = BATTERY.x + Math.sin(k * Math.PI * 1.2) * 380 + k * 260;
			const y = BATTERY.y - 240 - k * 420 + Math.sin(k * 11) * 18;
			list.push({ baseY: H + 1000, draw: () => drawDexStarr(ctx, x, y, time, 1, true) });
		}
		return list;
	}
}
