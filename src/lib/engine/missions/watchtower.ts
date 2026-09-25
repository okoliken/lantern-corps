// Season Two, Act One, Mission One: the Watchtower.
//
// Not a fight. The League runs John through their own drills, and their drills
// are not the Corps': nothing here is about beating anybody. The floor is a
// training deck above the Earth, and the four of them take a turn each.
//
//   laps     the Flash sets a pace round the deck. Keep up
//   catch    Superman drops loads off the gantry. Nothing reaches the floor
//   guard    Wonder Woman throws everything she has at a pod. Keep it whole
//   spar     Hawkgirl comes at John himself. Get a shield up in time
//
// Nobody can be hurt here, and nothing can be lost except the drill.

import { absorbWithShield, type Protectable } from '../constructs/system';
import { drawMarker, drawPracticeBolt, drawPracticeDrone, drawSupplyPod } from '../draw/training';
import type { Drawable, Game } from '../game';
import { heroFx } from '../heroes';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type Drill = 'laps' | 'catch' | 'guard' | 'spar' | 'done';
export const DRILLS: Drill[] = ['laps', 'catch', 'guard', 'spar'];

const INTRO_TIME = 4;
/** Seconds between drills, for whoever ran it to say something. */
const HANDOVER = 3.4;

/** Laps: markers round the deck, and how long the Flash gives him. */
const LAP_MARKERS = 6;
const LAP_RADIUS = 70;
const LAP_TIME = 26;

/** Catch: loads off the gantry, how long each takes to fall, how many. */
const LOADS = 8;
const LOAD_FALL = 3.2;
const LOAD_HP = 40;

/** Guard: how long the pod has to survive, and what she throws at it. */
const GUARD_TIME = 24;
const THROW_EVERY = 1.5;
const THROW_SPEED = 300;
const THROW_DAMAGE = 14;
const POD_HP = 100;

/** Spar: how many of Hawkgirl's passes he has to block. */
const PASSES = 6;
const PASS_EVERY = 2.6;
const PASS_WARN = 1;

const W = 2600;
const H = 1800;
const CENTRE = { x: W / 2, y: H / 2 };

/** The Watchtower's training deck: a wide floor, and no battery in orbit. */
export function buildWatchtowerMap(): GameMap {
	return {
		name: 'The Watchtower · training deck',
		environment: 'planet',
		ground: 'vault',
		width: W,
		height: H,
		spawn: { x: CENTRE.x, y: CENTRE.y + 320 },
		battery: { x: CENTRE.x, y: CENTRE.y },
		noBattery: true,
		dummies: [],
		obstacles: []
	};
}

interface Load {
	x: number;
	y: number;
	/** Seconds until it hits the floor. */
	fall: number;
	hp: number;
	caught: boolean;
	missed: boolean;
}

interface Shot {
	x: number;
	y: number;
	vx: number;
	vy: number;
}

export class Watchtower implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	lives = 3;
	drill: Drill = 'laps';
	/** Progress through the drill in hand, and what it needs. */
	count = 0;
	need = LAP_MARKERS;
	/** Drills finished without dropping anything. */
	clean = 0;
	elapsed = 0;
	/** Seconds left on the clock of a timed drill. */
	clock = LAP_TIME;
	private handover = 0;
	private markers: { x: number; y: number }[] = [];
	private loads: Load[] = [];
	private nextLoad = 0;
	private shots: Shot[] = [];
	private shotIn = THROW_EVERY;
	private passIn = PASS_EVERY;
	private passWarn = 0;
	private blocked = 0;
	private missedTotal = 0;
	private podFlash = 0;
	private started = false;
	private readonly said = new Set<string>();
	private readonly comms = new Comms();
	readonly crew: Player[] = [];
	private readonly stations = new Map<Player, { x: number; y: number }>();
	readonly pod: Protectable = { x: CENTRE.x + 520, y: CENTRE.y, name: 'Drill pod', radius: 70, lift: 40, threat: 0 };

	readonly starHint = '★ every drill finished · ★ nothing dropped · ★ inside the Flash’s time';

	get objective(): string {
		switch (this.drill) {
			case 'laps':
				return `Round the deck: ${this.count} / ${this.need} markers`;
			case 'catch':
				return `Nothing reaches the floor: ${this.count} / ${this.need}`;
			case 'guard':
				return `Keep the pod whole: ${Math.max(0, Math.ceil(this.clock))}s`;
			case 'spar':
				return `Shield before she lands it: ${this.count} / ${this.need}`;
			case 'done':
				return 'Drills finished';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [
			{ label: 'Drill', value: this.need ? this.count / this.need : 1, text: `${this.count} / ${this.need}` }
		];
		if (this.drill === 'laps' || this.drill === 'guard') {
			list.push({
				label: this.drill === 'laps' ? 'Pace' : 'Time',
				value: this.clock / (this.drill === 'laps' ? LAP_TIME : GUARD_TIME),
				text: `${Math.max(0, Math.ceil(this.clock))}s`,
				low: this.clock < 6
			});
		}
		if (this.drill === 'guard') {
			list.push({ label: 'Pod', value: this.pod.threat >= 0 ? this.podHealth / POD_HP : 1, text: `${Math.round((this.podHealth / POD_HP) * 100)}%`, low: this.podHealth < POD_HP * 0.35 });
		}
		return list;
	}

	private podHealth = POD_HP;

	warning(): string | null {
		if (this.drill === 'catch' && this.loads.some((l) => !l.caught && !l.missed && l.fall < 1)) return 'CATCH IT';
		if (this.drill === 'spar' && this.passWarn > 0) return 'SHIELD UP';
		if (this.drill === 'guard' && this.podHealth < POD_HP * 0.35) return 'THE POD IS COMING APART';
		return null;
	}

	get stars(): number {
		return 1 + (this.missedTotal === 0 ? 1 : 0) + (this.clean >= DRILLS.length ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'lost') return 'The drill ran out. They will run it again: nobody on this deck is going anywhere.';
		if (this.missedTotal === 0) return 'Four drills, nothing dropped. The League has seen enough.';
		return 'Four drills finished, a few things dropped. Good enough for a first day.';
	}

	stats(): MissionStat[] {
		return [
			{ label: 'Drills', value: `${Math.min(this.clean, DRILLS.length)} / ${DRILLS.length} clean` },
			{ label: 'Dropped', value: `${this.missedTotal}` },
			{ label: 'Time', value: `${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, '0')}` }
		];
	}

	tally(): string {
		return `Blocked ${this.blocked} · dropped ${this.missedTotal}`;
	}

	update(game: Game, dt: number) {
		this.comms.update(dt);
		// Nothing here can hurt anybody
		for (const p of game.players) p.invuln = Math.max(p.invuln, 0.5);
		// And nobody drifts: they are running a class, not following him round
		for (const p of this.crew) {
			const spot = this.stations.get(p);
			if (!p || !spot || p.downed) continue;
			const k = Math.min(1, dt * 2.4);
			p.x += (spot.x - p.x) * k;
			p.y += (spot.y - p.y) * k;
		}

		if (this.state === 'intro') {
			if (!this.started) this.begin(game);
			this.timer -= dt;
			if (this.timer <= 0) {
				this.state = 'playing';
				this.startDrill(game, 'laps');
			}
			return;
		}
		if (this.state !== 'playing') {
			this.timer += dt;
			return;
		}
		this.elapsed += dt;

		if (this.handover > 0) {
			this.handover -= dt;
			if (this.handover <= 0) {
				const next = DRILLS[DRILLS.indexOf(this.drill) + 1];
				if (next) this.startDrill(game, next);
				else this.finish();
			}
			return;
		}

		switch (this.drill) {
			case 'laps':
				this.laps(game, dt);
				break;
			case 'catch':
				this.catching(game, dt);
				break;
			case 'guard':
				this.guarding(game, dt);
				break;
			case 'spar':
				this.sparring(game, dt);
				break;
		}
	}

	/** The League turns up, each in their own place on the deck. */
	private begin(game: Game) {
		this.started = true;
		const spots: [Parameters<Game['addPartner']>[0], number, number][] = [
			['flash', -420, -260],
			['superman', 420, -260],
			['wonderwoman', 420, 260],
			['hawkgirl', -420, 260]
		];
		for (const [who, dx, dy] of spots) {
			const p = game.addPartner(who, CENTRE.x + dx, CENTRE.y + dy);
			this.crew.push(p);
			this.stations.set(p, { x: CENTRE.x + dx, y: CENTRE.y + dy });
		}
		this.comms.scene([
			['Superman', 'John. Welcome up. You have fought a war out there, so we are not going to insult you with target practice.'],
			['Wonder Woman', 'We are going to find out what you do when the thing in front of you is not an enemy.'],
			['The Flash', 'Starting with whether you can keep up. Which, no offence, nobody can.']
		]);
	}

	private startDrill(game: Game, drill: Drill) {
		this.drill = drill;
		this.count = 0;
		this.loads = [];
		this.shots = [];
		this.podHealth = POD_HP;
		this.pod.threat = 0;
		switch (drill) {
			case 'laps': {
				this.need = LAP_MARKERS;
				this.clock = LAP_TIME;
				this.markers = [];
				for (let i = 0; i < LAP_MARKERS; i++) {
					const a = (i / LAP_MARKERS) * Math.PI * 2 - Math.PI / 2;
					this.markers.push({ x: CENTRE.x + Math.cos(a) * 820, y: CENTRE.y + Math.sin(a) * 560 });
				}
				this.comms.say('The Flash', 'Six markers, in order, before I finish my coffee. Go.', true);
				break;
			}
			case 'catch': {
				this.need = LOADS;
				this.nextLoad = 0.6;
				this.comms.scene([
					['Superman', 'Gantry loads. They come off in ones and twos, and the deck below is where people would be standing.'],
					['Superman', 'I do not care how you stop them. I care that they stop.']
				]);
				break;
			}
			case 'guard': {
				this.need = 1;
				this.clock = GUARD_TIME;
				this.pod.x = CENTRE.x + 520;
				this.pod.y = CENTRE.y;
				this.shotIn = THROW_EVERY;
				if (!game.constructs.protectables.includes(this.pod)) game.constructs.protectables.push(this.pod);
				this.comms.scene([
					['Wonder Woman', 'That pod is a family in a car. I am what is coming at them.'],
					['Wonder Woman', 'You do not have to stop me. You have to stop what I throw.']
				]);
				break;
			}
			case 'spar': {
				this.need = PASSES;
				this.passIn = PASS_EVERY;
				this.passWarn = 0;
				this.comms.say('Hawkgirl', 'My turn. I am not throwing anything. I am coming at you, and you will not see it every time.', true);
				break;
			}
			case 'done':
				break;
		}
	}

	private done(game: Game, clean: boolean, lines: [string, string][]) {
		void game;
		if (clean) this.clean += 1;
		this.handover = HANDOVER;
		this.comms.scene(lines);
	}

	// ------------------------------------------------------------------ drills

	private laps(game: Game, dt: number) {
		this.clock -= dt;
		const target = this.markers[this.count];
		if (target) {
			for (const p of game.players) {
				if (p.slot !== 0 || p.downed) continue;
				if (Math.hypot(p.x - target.x, p.y - target.y) < LAP_RADIUS) {
					this.count += 1;
					heroFx(game.constructs).push({ kind: 'zip', x: target.x, y: target.y, x2: target.x, y2: target.y - 90, age: 0, life: 0.3 });
					if (this.count === 3) this.once('half', () => this.comms.say('The Flash', 'Halfway. I have lapped you twice, but who is counting.'));
				}
			}
		}
		if (this.count >= this.need) {
			this.done(game, this.clock > 0, [
				['The Flash', this.clock > 0 ? 'Inside the time. Nobody does that on a first run.' : 'Slow. Everyone is slow. Do not take it personally.'],
				['Superman', 'My turn.']
			]);
		} else if (this.clock <= 0) {
			this.missedTotal += 1;
			this.done(game, false, [
				['The Flash', 'Time. That is fine, the point was the turns, not the speed.'],
				['Superman', 'My turn.']
			]);
		}
	}

	private catching(game: Game, dt: number) {
		this.nextLoad -= dt;
		if (this.nextLoad <= 0 && this.loads.length + this.count < this.need) {
			this.nextLoad = 1.5 + Math.random() * 0.9;
			this.loads.push({
				x: CENTRE.x + (Math.random() - 0.5) * 1200,
				y: CENTRE.y + (Math.random() - 0.5) * 700,
				fall: LOAD_FALL,
				hp: LOAD_HP,
				caught: false,
				missed: false
			});
		}
		for (const load of this.loads) {
			if (load.caught || load.missed) continue;
			load.fall -= dt;
			// Anything that damages it counts as catching it: a wall under it,
			// a blast, a fist. The League does not care how
			const hit = game.constructs.effects.some(
				(e) => e.kind === 'number' && Math.hypot(e.x - load.x, e.y - load.y) < 90 && e.age < 0.1
			);
			if (hit) load.hp -= 20;
			if (load.hp <= 0) {
				load.caught = true;
				this.count += 1;
				heroFx(game.constructs).push({ kind: 'boom', x: load.x, y: load.y, age: 0, life: 0.4, radius: 70 });
			} else if (load.fall <= 0) {
				load.missed = true;
				this.count += 1;
				this.missedTotal += 1;
				game.constructs.effects.push({ kind: 'burst', x: load.x, y: load.y, age: 0, life: 0.7 });
				this.once('dropped', () => this.comms.say('Superman', 'That one was a person. Again.', true));
			}
		}
		this.loads = this.loads.filter((l) => !l.caught && !l.missed);
		if (this.count >= this.need) {
			const clean = this.missedTotal === 0;
			this.done(game, clean, [
				['Superman', clean ? 'Not one of them touched the floor. Good.' : 'Most of them. Most is not the number we work to up here.'],
				['Wonder Woman', 'Mine now.']
			]);
		}
	}

	private guarding(game: Game, dt: number) {
		this.clock -= dt;
		this.podFlash = Math.max(0, this.podFlash - dt);
		this.pod.threat = this.podHealth < POD_HP * 0.5 ? 1.5 : 0.5;
		this.shotIn -= dt;
		if (this.shotIn <= 0) {
			this.shotIn = THROW_EVERY * (0.8 + Math.random() * 0.5);
			const diana = this.crew.find((p) => p.def.id === 'wonderwoman');
			const from = diana ?? { x: CENTRE.x - 700, y: CENTRE.y };
			const dx = this.pod.x - from.x;
			const dy = this.pod.y - from.y;
			const len = Math.hypot(dx, dy) || 1;
			this.shots.push({ x: from.x, y: from.y, vx: (dx / len) * THROW_SPEED, vy: (dy / len) * THROW_SPEED });
		}
		for (const shot of [...this.shots]) {
			shot.x += shot.vx * dt;
			shot.y += shot.vy * dt;
			// A construct in the way stops it: that is the whole drill
			const stopped = game.constructs.effects.some(
				(e) => e.kind === 'number' && Math.hypot(e.x - shot.x, e.y - shot.y) < 70 && e.age < 0.1
			);
			const home = Math.hypot(shot.x - this.pod.x, shot.y - this.pod.y) < this.pod.radius;
			if (stopped || home) {
				if (home) {
					const through = absorbWithShield(game.constructs, this.pod, THROW_DAMAGE);
					this.podHealth -= through;
					this.podFlash = 0.3;
				} else {
					this.blocked += 1;
				}
				this.shots.splice(this.shots.indexOf(shot), 1);
			}
			if (shot.x < 0 || shot.x > W || shot.y < 0 || shot.y > H) this.shots.splice(this.shots.indexOf(shot), 1);
		}
		if (this.podHealth <= 0) {
			this.podHealth = 0;
			this.count = 1;
			this.missedTotal += 1;
			this.done(game, false, [
				['Wonder Woman', 'They are gone. Do you see how fast that was?'],
				['Hawkgirl', 'My turn, and I am the one you have to watch.']
			]);
		} else if (this.clock <= 0) {
			this.count = 1;
			const clean = this.podHealth >= POD_HP;
			if (!clean) this.missedTotal += 1;
			this.done(game, clean, [
				['Wonder Woman', clean ? 'Nothing got through. Not one thing.' : 'They lived. That is the whole of it.'],
				['Hawkgirl', 'My turn, and I am the one you have to watch.']
			]);
		}
	}

	private sparring(game: Game, dt: number) {
		if (this.passWarn > 0) {
			this.passWarn -= dt;
			if (this.passWarn <= 0) {
				// She lands it: shielded, it is nothing. Unshielded, it counts
				const me = game.players[0];
				const through = absorbWithShield(game.constructs, me, 30);
				if (through <= 0) {
					this.blocked += 1;
					heroFx(game.constructs).push({ kind: 'mace', x: me.x, y: me.y, age: 0, life: 0.4, radius: 80 });
				} else {
					this.missedTotal += 1;
					game.constructs.effects.push({ kind: 'burst', x: me.x, y: me.y - 30, age: 0, life: 0.6 });
					this.once('hit', () => this.comms.say('Hawkgirl', 'Felt that one. Shield goes up before I arrive, not after.', true));
				}
				this.count += 1;
			}
		} else {
			this.passIn -= dt;
			if (this.passIn <= 0) {
				this.passIn = PASS_EVERY * (0.85 + Math.random() * 0.4);
				this.passWarn = PASS_WARN;
				const me = game.players[0];
				const hawk = this.crew.find((p) => p.def.id === 'hawkgirl');
				if (hawk) heroFx(game.constructs).push({ kind: 'zip', x: hawk.x, y: hawk.y, x2: me.x, y2: me.y, age: 0, life: 0.5 });
			}
		}
		if (this.count >= this.need) {
			const clean = this.blocked >= this.need;
			this.done(game, clean, [
				['Hawkgirl', clean ? 'Every one. You have done this before.' : 'Most of them. Up here, most is a funeral.'],
				['Superman', 'That is the course.']
			]);
		}
	}

	private finish() {
		this.drill = 'done';
		this.state = 'won';
		this.timer = 0;
		this.comms.scene([
			['Superman', 'You did not ask us once what the enemy was. That is why we called you.'],
			['Wonder Woman', 'The ring is yours and the sector is yours. This is ours, and we would like you in it.'],
			['Superman', 'Take the comm. Use it when you want to, not when you are told to.']
		]);
	}

	private once(key: string, run: () => void) {
		if (this.said.has(key)) return;
		this.said.add(key);
		run();
	}

	// ---------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		if (this.drill === 'laps') {
			const target = this.markers[this.count];
			return target ? [[target.x, target.y]] : [];
		}
		if (this.drill === 'guard') return [[this.pod.x, this.pod.y]];
		return this.loads.map((l) => [l.x, l.y] as [number, number]);
	}

	drawables(ctx: CanvasRenderingContext2D, time: number): Drawable[] {
		const list: Drawable[] = [];
		if (this.drill === 'laps') {
			this.markers.forEach((m, i) => {
				if (i < this.count) return;
				list.push({
					baseY: m.y,
					draw: () => {
						ctx.save();
						if (i > this.count) ctx.globalAlpha = 0.3;
						drawMarker(ctx, m.x, m.y, LAP_RADIUS, time);
						ctx.restore();
					}
				});
			});
		}
		for (const load of this.loads) {
			if (load.caught || load.missed) continue;
			list.push({
				baseY: load.y,
				draw: () => {
					const lift = Math.max(0, load.fall / LOAD_FALL) * 260;
					ctx.save();
					ctx.globalAlpha = 0.28;
					drawMarker(ctx, load.x, load.y, 46, time);
					ctx.restore();
					drawSupplyPod(ctx, load.x, load.y - lift, load.hp < LOAD_HP, time);
				}
			});
		}
		if (this.drill === 'guard') {
			list.push({
				baseY: this.pod.y,
				draw: () => {
					drawSupplyPod(ctx, this.pod.x, this.pod.y, this.podFlash > 0, time);
				}
			});
			for (const shot of this.shots) {
				list.push({ baseY: shot.y + 1, draw: () => drawPracticeBolt(ctx, shot.x, shot.y, 40) });
			}
		}
		if (this.drill === 'spar' && this.passWarn > 0) {
			list.push({ baseY: 0, draw: () => drawPracticeDrone(ctx, CENTRE.x, CENTRE.y - 420, time) });
		}
		return list;
	}
}
