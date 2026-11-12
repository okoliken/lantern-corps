// Season three, Act 1, episode 2: The Gala. Hal, at Ferris Aircraft, Coast City.
//
// The fragment that came out of the yellow lantern found Hector Hammond, a
// scientist on the Ferris payroll. His mind won't stop growing, and now it
// can move things.
//
//   helicopter  At the gala, Hammond turns the show helicopter over the crowd.
//               Hal's new construct, the Race Track: build it under the
//               helicopter's shadow and it rides the track down in one piece.
//   hammond     He floats out of the hangar. He lifts the parked jets and
//               flings them, and he takes hold of whatever construct Hal is
//               holding: it's his for a few seconds, and he turns it on Hal.
//               Use a different one.
//   carol       Half beaten, he lifts Carol Ferris into the sky. Hit him to
//               break his concentration, then catch her as she falls (fly
//               under her, or build the track under her).
//
// Win: Hammond beaten. Something in the sky pulls him away.
// Lose: the helicopter comes down on the crowd, Carol hits the ground, or Hal
// goes down three times.

import { createEnemy, type Enemy } from '../enemies/enemies';
import { damagePlayer } from '../combat';
import { CONSTRUCTS } from '../constructs/defs';
import { raceTracks } from '../constructs/system';
import { addDread } from '../dread';
import { isStanding } from '../dummy';
import { drawEnemy } from '../draw/enemies';
import { RACE_LOOP } from '../draw/constructs';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

const LIVES = 3;
const INTRO_TIME = 3;
const W = 3600;
const H = 2200;
const ENTRY = { x: 1150, y: 1300 };
/** The hangar along the top, its doors in the middle; the gala's marquee and crowd below it. */
const HANGAR = { x: 1250, y: 70, w: 1100, h: 330 };
export const DOOR = { x: 1800, y: 470 };
export const CROWD = { x: 1800, y: 1180 };
const RUNWAY = { y: 1760, h: 220 };
/** The jets parked on the apron, either side of the hangar: what Hammond throws. */
const PARKED = [
	{ x: 700, y: 640 },
	{ x: 1000, y: 820 },
	{ x: 2600, y: 640 },
	{ x: 2900, y: 820 },
	{ x: 500, y: 1000 },
	{ x: 3100, y: 1000 },
	{ x: 900, y: 1560 },
	{ x: 2700, y: 1560 }
];

/** Seconds of the gala before the helicopter goes wrong. */
const GALA_TIME = 4;
/** The helicopter: where it starts, how high, how fast it comes down, and how low it must be for the track to catch it. */
export const HELI = { x: 2350, y: 950, alt: 1000, fall: 44, drift: 55, catchBelow: 760 };
/** Hammond: how tough, how hard he hits. */
const HAMMOND_HEALTH = 4.6;
const HAMMOND_MIGHT = 3.6;
/** A thrown jet: how often (calm / angry), how long he lifts it first, how fast it flies, the hit. */
export const THROW = { every: 8, angry: 5.5, lift: 1.1, speed: 1050, damage: 46, width: 90 };
/** Seizing a construct: how often (calm / angry), how long it's his, and the turned construct coming back at Hal. */
export const SEIZE = { every: 12, angry: 9, time: 6, speed: 330, life: 2.8, damage: 34 };
/** Carol: he lifts her this high; this much of his health in hits breaks his hold; after this long he lets go anyway. */
export const CAROL = { at: 0.5, alt: 620, rise: 110, breakHits: 0.08, patience: 18, gravity: 300, fastest: 250, catchRange: 160 };

/** Heights are drawn squashed this much, so a helicopter way up still fits on screen with Hal. */
const SKY_DRAW = 0.42;

export type GalaPhase = 'gala' | 'helicopter' | 'hammond' | 'carol';

interface Heli {
	x: number;
	y: number;
	alt: number;
	spin: number;
	/** 0 falling, then riding the track down (0..1), then 2 down safe. */
	saved: number;
	trackX: number;
	trackY: number;
	caughtX: number;
	trackR: number;
	/** How high it was when the track caught it. */
	caughtAt: number;
	/** Going round the loop: where its body is, and which way up. */
	ride: { x: number; y: number; tilt: number } | null;
}

interface Thrown {
	jet: number;
	x: number;
	y: number;
	alt: number;
	/** Lifting (seconds left), then flying along (vx, vy). */
	lift: number;
	vx: number;
	vy: number;
	travel: number;
	spin: number;
	hit: boolean;
}

interface Turned {
	name: string;
	x: number;
	y: number;
	life: number;
}

interface Carol {
	x: number;
	y: number;
	alt: number;
	/** 'held' up there, 'falling', 'safe' (caught), or 'down' (not caught). */
	state: 'crowd' | 'held' | 'falling' | 'safe' | 'down';
	vy: number;
	/** He let go of her himself (Hal never broke his hold). */
	dropped: boolean;
}

/** Ferris Aircraft at night: the hangar, the apron, the runway beyond. */
export function buildGalaMap(): GameMap {
	return {
		name: 'Coast City · Ferris Aircraft',
		environment: 'planet',
		ground: 'tarmac',
		width: W,
		height: H,
		spawn: ENTRY,
		battery: { x: ENTRY.x - 200, y: ENTRY.y + 40 },
		dummies: [],
		obstacles: [{ kind: 'building', x: HANGAR.x, y: HANGAR.y, w: HANGAR.w, h: HANGAR.h, height: 260, blocksFlying: true, seed: 0.37 }]
	};
}

export class Gala implements MissionDirector {
	state: MissionState = 'intro';
	phase: GalaPhase = 'gala';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	failReason: 'crowd' | 'carol' | 'down' | null = null;
	readonly comms = new Comms();
	/** Long enough to see him pulled up into the sky. */
	readonly outroAfter = 7.5;
	readonly starHint = '★ done · ★ broke his hold on Carol before he let her go · ★ Hal never went down';
	hammond: Enemy | null = null;
	heli: Heli | null = null;
	carol: Carol = { x: CROWD.x + 60, y: CROWD.y + 30, alt: 0, state: 'crowd', vy: 0, dropped: false };
	thrown: Thrown[] = [];
	turned: Turned[] = [];
	jetsThrown = 0;
	seized = 0;
	/** The jets on the apron: still parked, or thrown and wrecked where they came down. */
	jets = PARKED.map((p, i) => ({ x: p.x, y: p.y, parked: true, wreck: false, spin: 0, dir: i % 2 ? -1 : 1 }));
	/** The track's slot in Hal's kit. */
	trackSlot = 8;
	private phaseTime = 0;
	private throwIn = THROW.every;
	private seizeIn = SEIZE.every;
	private held: { id: string; left: number } | null = null;
	/** How much of his hold on Carol is left (0..1), and his health when it started. */
	hold = 1;
	private holdHp = 0;
	private holdTime = 0;
	private angry = false;
	private wasDown = false;
	private said = new Set<string>();
	/** At the end: Hammond pulled up into the sky. */
	private taken: { x: number; y: number; art: Enemy } | null = null;
	/** Where Hal is (for the line a held jet will fly down). */
	private halAt = { x: ENTRY.x, y: ENTRY.y };

	// ------------------------------------------------------------ reporting

	get objective(): string {
		switch (this.phase) {
			case 'gala':
				return 'The Ferris Aircraft gala';
			case 'helicopter':
				return this.heli && this.heli.saved > 0 ? 'Set it down...' : `Catch the helicopter: build the RACE TRACK (key ${this.trackSlot + 1}) under its shadow`;
			case 'carol':
				if (this.carol.state === 'falling') return 'Catch Carol!';
				return 'Hammond has Carol: hit him to break his concentration';
			default:
				return this.state === 'won' ? 'Hammond is beaten' : 'Take down Hector Hammond';
		}
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const h = this.hammond;
		if (h) list.push({ label: 'Hammond', value: Math.max(0, h.hp) / h.maxHp, text: `${Math.round((Math.max(0, h.hp) / h.maxHp) * 100)}%` });
		if (this.phase === 'helicopter' && this.heli && this.heli.saved === 0) list.push({ label: 'Altitude', value: this.heli.alt / HELI.alt, text: `${Math.round(this.heli.alt)}`, low: this.heli.alt < HELI.catchBelow });
		if (this.phase === 'carol' && this.carol.state === 'held') {
			list.push({ label: 'His hold', value: this.hold, text: `${Math.round(this.hold * 100)}%` });
			list.push({ label: 'He lets go in', value: Math.max(0, 1 - this.holdTime / CAROL.patience), text: `${Math.ceil(Math.max(0, CAROL.patience - this.holdTime))}s`, low: CAROL.patience - this.holdTime < 5 });
		}
		return list;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		if (this.phase === 'helicopter' && this.heli?.saved === 0) return this.heli.alt < HELI.catchBelow ? `NOW! Race Track (key ${this.trackSlot + 1}) under the helicopter!` : 'The helicopter is coming down on the crowd!';
		if (this.carol.state === 'falling') return 'Carol is falling! Get under her!';
		if (this.thrown.some((t) => t.lift > 0)) return 'He is lifting a jet! Get out of its line!';
		if (this.held) return `He has your ${this.held.id === 'raceTrack' ? 'Race Track' : (CONSTRUCTS as Record<string, { name: string }>)[this.held.id]?.name ?? 'construct'}! Use a different one!`;
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (!this.carol.dropped ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return "Coast City's gala ends with a helicopter on a race track, a hangar full of wrecked jets, and Hector Hammond pulled up into the dark by something only he could hear.";
		if (this.failReason === 'crowd') return 'The helicopter came down on the crowd.';
		if (this.failReason === 'carol') return 'Carol hit the ground.';
		return 'Hal went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Jets thrown at Hal', value: `${this.jetsThrown}` },
			{ label: 'Constructs he took', value: `${this.seized}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
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
		this.phaseTime += dt;
		const hal = game.players[0];
		if (hal.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) return this.lose('down');
			this.comms.say('Carol', 'Hal! Get up!', true);
		}
		this.wasDown = hal.downed;
		this.halAt = { x: hal.x, y: hal.y };
		this.release(hal, dt);

		switch (this.phase) {
			case 'gala':
				if (this.phaseTime > GALA_TIME) this.startHelicopter(hal);
				break;
			case 'helicopter':
				this.updateHeli(game, dt);
				break;
			case 'hammond':
			case 'carol': {
				const h = this.hammond;
				if (h && !isStanding(h)) return this.win(game);
				if (this.phase === 'hammond' && h && h.hp <= h.maxHp * CAROL.at && this.carol.state === 'crowd') this.takeCarol(h);
				if (this.phase === 'carol') this.updateCarol(game, hal, dt);
				if (this.carol.state !== 'held' && this.carol.state !== 'falling') {
					this.throwIn -= dt;
					if (this.throwIn <= 0 && h) {
						this.throwIn = this.angry ? THROW.angry : THROW.every;
						this.throwJet(h, hal);
					}
				}
				this.seizeIn -= dt;
				if (this.seizeIn <= 0 && h) {
					this.seizeIn = this.angry ? SEIZE.angry : SEIZE.every;
					this.seize(game, h, hal);
				}
				break;
			}
		}
		this.updateHeliRest(dt);
		this.updateThrown(game, hal, dt);
		this.updateTurned(game, hal, dt);
	}

	private start(game: Game) {
		this.state = 'playing';
		this.phase = 'gala';
		this.phaseTime = 0;
		// The track in his kit for tonight, where the chaff usually is
		const hal = game.players[0];
		const slot = hal.loadout.findIndex((d) => d.id === 'raceTrack');
		this.trackSlot = slot;
		if (slot < 0) {
			const at = hal.loadout.findIndex((d) => d.id === 'chaff');
			this.trackSlot = at >= 0 ? at : hal.loadout.length - 1;
			hal.loadout[this.trackSlot] = CONSTRUCTS.raceTrack;
			hal.cooldowns[this.trackSlot] = 0;
		}
		this.comms.scene([
			['Hal', 'Everybody back, away from the hangar! Where did he go? He was right there...'],
			['Carol', 'Hal, look up. The display helicopter...']
		]);
	}

	private startHelicopter(hal: Player) {
		this.phase = 'helicopter';
		this.phaseTime = 0;
		this.heli = { x: HELI.x, y: HELI.y, alt: HELI.alt, spin: 0, saved: 0, trackX: 0, trackY: 0, caughtX: 0, trackR: 170, caughtAt: 0, ride: null };
		this.comms.scene([
			['Carol', "The display helicopter... it's turning. Something's wrong with it!"],
			['Hal', "It's coming down on the crowd. Okay. Okay. Something to catch it on..."],
			['Hal', `A race track. Build it under the shadow (key ${this.trackSlot + 1}), let it ride down.`]
		]);
		hal.selected = this.trackSlot;
	}

	private updateHeli(game: Game, dt: number) {
		const h = this.heli!;
		if (h.saved > 0) {
			// Riding the track: round the loop and down onto the apron
			// Down onto the start of the track, up the ramp, round the loop, and off the far end
			h.saved = Math.min(1, h.saved + dt / 3);
			const k = h.saved;
			const lr = h.trackR * RACE_LOOP;
			h.ride = null;
			const start = h.trackX - h.trackR * 0.9;
			h.y = h.trackY;
			if (k < 0.2) {
				const e = k / 0.2;
				h.x = h.caughtX + (start - h.caughtX) * e;
				h.alt = h.caughtAt * (1 - e) * (1 - e);
				h.spin = 0;
			} else if (k < 0.35) {
				h.x = start + (h.trackX - start) * ((k - 0.2) / 0.15);
				h.alt = 0;
			} else if (k < 0.75) {
				const a = ((k - 0.35) / 0.4) * Math.PI * 2;
				h.x = h.trackX + Math.sin(a) * lr;
				h.alt = (lr - Math.cos(a) * lr) / SKY_DRAW;
				// On the inside of the track, skids to the rail
				const r = lr - 30;
				h.ride = { x: h.trackX + Math.sin(a) * r, y: h.trackY - lr + Math.cos(a) * r, tilt: -a };
			} else {
				h.x = h.trackX + ((k - 0.75) / 0.25) * h.trackR * 1.15;
				h.alt = 0;
				h.spin = 0;
			}
			if (h.saved >= 1) {
				h.saved = 2;
				h.alt = 0;
				this.startHammond(game);
			}
			return;
		}
		h.alt -= HELI.fall * dt * (1 + this.phaseTime / 45);
		h.spin += dt * 3.2;
		const dx = CROWD.x - h.x;
		const dy = CROWD.y - h.y;
		const d = Math.hypot(dx, dy);
		if (d > 10) {
			h.x += (dx / d) * HELI.drift * dt;
			h.y += (dy / d) * HELI.drift * dt;
		}
		if (h.alt < HELI.catchBelow) {
			const track = raceTracks(game.constructs).find((t) => Math.hypot(t.x - h.x, (t.y - h.y) * 1.4) < t.radius * 1.05);
			if (track) {
				h.saved = 0.001;
				h.trackX = track.x;
				h.caughtX = h.x;
				h.trackY = track.y;
				h.trackR = track.radius;
				h.caughtAt = h.alt;
				// It stays up till the helicopter's off it
				for (const e of game.constructs.effects) if (e.kind === 'raceTrack' && e.x === track.x && e.y === track.y) e.life = Math.max(e.life, e.age + 3.4);
				this.phaseTime = 0;
				game.constructs.effects.push({ kind: 'callout', x: h.x, y: h.y - 80, age: 0, life: 1.4, text: 'CAUGHT!' });
				this.comms.say('Hal', 'Got it... round the loop... and down. Easy.', true);
				return;
			}
		}
		if (h.alt <= 0) {
			h.alt = 0;
			game.constructs.effects.push({ kind: 'burst', x: h.x, y: h.y - 30, age: 0, life: 0.9, radius: 260 } as never);
			this.lose('crowd');
		}
	}

	/** Once it's down safe, the rotor winds down. */
	private updateHeliRest(dt: number) {
		if (this.heli && this.heli.saved >= 2) this.heli.spin += dt * Math.max(0, 2 - this.elapsed * 0.01);
	}

	private startHammond(game: Game) {
		this.phase = 'hammond';
		this.phaseTime = 0;
		const h = game.spawnEnemy('hammond', DOOR.x, DOOR.y + 40);
		h.brain.grit = 1;
		h.brain.might = HAMMOND_MIGHT;
		h.brain.alert = 10;
		h.hp = h.maxHp = h.brain.lastHp = Math.round(h.maxHp * HAMMOND_HEALTH);
		this.hammond = h;
		this.throwIn = 4;
		this.seizeIn = 9;
		this.comms.scene([
			['Hammond', 'That was me, Hal. The helicopter. I only had to think about it.'],
			['Hammond', 'And I can hear you thinking. Green. All that green, and so afraid underneath it.'],
			['Hal', 'Okay. Nobody else gets hurt tonight, Hector.']
		]);
	}

	/** He lifts a parked jet, holds it up a moment, and flings it at where Hal is. */
	private throwJet(h: Enemy, hal: Player) {
		if (hal.downed) return;
		// The nearest jet to him still parked; out of those, the nearest wreck will do
		const near = (list: typeof this.jets) => list.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
		const jet = near(this.jets.filter((j) => j.parked)) ?? near(this.jets.filter((j) => j.wreck));
		if (!jet) return;
		jet.parked = false;
		jet.wreck = false;
		this.thrown.push({ jet: this.jets.indexOf(jet), x: jet.x, y: jet.y, alt: 0, lift: THROW.lift, vx: 0, vy: 0, travel: 0, spin: 0, hit: false });
		this.jetsThrown++;
		this.once('jet', 'Hammond', 'Ferris builds such beautiful planes. Catch.');
	}

	private updateThrown(game: Game, hal: Player, dt: number) {
		for (const t of [...this.thrown]) {
			t.spin += dt * (t.lift > 0 ? 1.5 : 7);
			if (t.lift > 0) {
				t.lift -= dt;
				t.alt = Math.min(220, t.alt + 260 * dt);
				if (t.lift <= 0) {
					// Aimed where Hal is now, and gone
					const dx = hal.x - t.x;
					const dy = hal.y - t.y;
					const d = Math.hypot(dx, dy) || 1;
					t.vx = (dx / d) * THROW.speed;
					t.vy = (dy / d) * THROW.speed;
				}
				continue;
			}
			t.x += t.vx * dt;
			t.y += t.vy * dt;
			t.travel += THROW.speed * dt;
			t.alt = Math.max(30, t.alt - 120 * dt);
			if (!t.hit && !hal.downed && Math.hypot(hal.x - t.x, hal.y - t.y) < THROW.width) {
				t.hit = true;
				damagePlayer(game.constructs, hal, THROW.damage, t.x - t.vx * 0.1, t.y - t.vy * 0.1, 620);
				addDread(hal, 0.05);
			}
			const out = t.x < 40 || t.x > W - 40 || t.y < 420 || t.y > H - 40;
			if (t.travel > 1700 || out) {
				this.thrown.splice(this.thrown.indexOf(t), 1);
				const x = Math.max(80, Math.min(W - 80, t.x));
				const y = Math.max(460, Math.min(H - 80, t.y));
				Object.assign(this.jets[t.jet], { x, y, wreck: true, spin: t.spin });
				game.constructs.effects.push({ kind: 'burst', x, y: y - 20, age: 0, life: 0.7, radius: 150 } as never);
			}
		}
	}

	/** He takes the construct in Hal's hand: Hal can't make it for a while, and it comes back at him in yellow. */
	private seize(game: Game, h: Enemy, hal: Player) {
		if (hal.downed || this.held || this.carol.state === 'falling') return;
		const def = hal.loadout[hal.selected];
		if (!def || hal.locked.has(def.id)) return;
		hal.locked.add(def.id);
		this.held = { id: def.id, left: SEIZE.time };
		this.seized++;
		hal.firing = false;
		hal.charge = 0;
		this.turned.push({ name: (def.short ?? def.name).toUpperCase(), x: h.x + h.dir * 40, y: h.y, life: SEIZE.life });
		game.constructs.effects.push({ kind: 'callout', x: hal.x, y: hal.y - 60, age: 0, life: 1.3, text: 'SEIZED', owner: hal, hurt: true });
		const lines = ['Your ring makes things out of thought, Hal. So do I, now.', 'That one is mine. Watch.', 'You built it. I am only borrowing it.'];
		this.comms.say('Hammond', lines[(this.seized - 1) % lines.length], true);
		if (this.seized === 1) this.comms.say('Hal', 'He took it right out of my head! Fine. Something else, then.');
	}

	/** It comes back: the end of his hold on it. */
	private release(hal: Player, dt: number) {
		if (!this.held) return;
		this.held.left -= dt;
		if (this.held.left > 0) return;
		hal.locked.delete(this.held.id);
		this.held = null;
	}

	/** The turned construct: a yellow copy of it, coming after Hal. */
	private updateTurned(game: Game, hal: Player, dt: number) {
		for (const t of [...this.turned]) {
			t.life -= dt;
			const dx = hal.x - t.x;
			const dy = hal.y - t.y;
			const d = Math.hypot(dx, dy) || 1;
			t.x += (dx / d) * SEIZE.speed * dt;
			t.y += (dy / d) * SEIZE.speed * dt;
			if (!hal.downed && d < 60) {
				damagePlayer(game.constructs, hal, SEIZE.damage, t.x, t.y, 420);
				game.constructs.effects.push({ kind: 'burst', x: t.x, y: t.y - 40, age: 0, life: 0.5, radius: 90 } as never);
				this.turned.splice(this.turned.indexOf(t), 1);
				continue;
			}
			if (t.life <= 0) {
				game.constructs.effects.push({ kind: 'fizzle', x: t.x, y: t.y - 40, age: 0, life: 0.4 });
				this.turned.splice(this.turned.indexOf(t), 1);
			}
		}
	}

	private takeCarol(h: Enemy) {
		this.phase = 'carol';
		this.phaseTime = 0;
		this.carol.state = 'held';
		this.hold = 1;
		this.holdHp = h.hp;
		this.holdTime = 0;
		this.thrown = this.thrown.filter((t) => t.lift <= 0);
		this.comms.scene([
			['Carol', "Hal! I can't-- I'm off the ground!"],
			['Hammond', 'She thinks about you, Hal. All the time. I can hear it. Let us see how high she goes.'],
			['Hal', 'Hit him. Break his concentration. Then catch her.']
		]);
	}

	private updateCarol(game: Game, hal: Player, dt: number) {
		const c = this.carol;
		const h = this.hammond;
		if (c.state === 'held' && h) {
			this.holdTime += dt;
			// Up she goes, toward him
			c.alt = Math.min(CAROL.alt, c.alt + CAROL.rise * dt);
			// Held off to one side of him, clear of him, so Hal can get under her
			const tx = Math.max(200, Math.min(W - 200, h.x - h.dir * 300));
			const ty = Math.max(600, Math.min(RUNWAY.y - 60, h.y + 160));
			c.x += (tx - c.x) * Math.min(1, dt * 0.8);
			c.y += (ty - c.y) * Math.min(1, dt * 0.8);
			// Every hit on him loosens his hold
			if (h.hp < this.holdHp) {
				this.hold -= (this.holdHp - h.hp) / (h.maxHp * CAROL.breakHits);
				this.holdHp = h.hp;
			}
			if (this.hold <= 0) {
				this.hold = 0;
				this.drop(false);
				this.comms.say('Hammond', 'ARGH-- get OUT of my head!', true);
				this.comms.say('Hal', 'Carol!');
			} else if (this.holdTime >= CAROL.patience) {
				this.drop(true);
				this.comms.say('Hammond', 'Too slow, Hal. Catch her, then.', true);
			}
			return;
		}
		if (c.state === 'falling') {
			c.vy = Math.min(CAROL.fastest, c.vy + CAROL.gravity * dt);
			c.alt -= c.vy * dt;
			const caught = (!hal.downed && Math.hypot(hal.x - c.x, hal.y - c.y) < CAROL.catchRange) || raceTracks(game.constructs).some((t) => Math.hypot(t.x - c.x, (t.y - c.y) * 1.4) < t.radius);
			if (caught) {
				c.state = 'safe';
				c.alt = 0;
				c.x = CROWD.x + 80;
				c.y = CROWD.y + 40;
				this.angry = true;
				this.phase = 'hammond';
				this.throwIn = 3;
				game.constructs.effects.push({ kind: 'callout', x: hal.x, y: hal.y - 70, age: 0, life: 1.3, text: 'CAUGHT HER' });
				this.comms.scene([
					['Carol', "I've got you-- I mean, you've got me. Go. Finish it."],
					['Hammond', 'You took her from me. You take EVERYTHING from me.']
				]);
				return;
			}
			if (c.alt <= 0) {
				c.alt = 0;
				c.state = 'down';
				this.lose('carol');
			}
		}
	}

	private drop(onPurpose: boolean) {
		this.carol.state = 'falling';
		this.carol.vy = 0;
		this.carol.dropped = onPurpose;
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		const hal = game.players[0];
		if (this.held) hal.locked.delete(this.held.id);
		this.held = null;
		this.turned.length = 0;
		this.thrown.length = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		// Something takes him: his own art, pulled up out of the fight
		const h = this.hammond;
		if (h) {
			const i = game.enemies.indexOf(h);
			if (i >= 0) game.enemies.splice(i, 1);
			this.taken = { x: h.x, y: h.y, art: createEnemy('hammond', h.x, h.y) };
			this.taken.art.dir = h.dir;
		}
		this.comms.scene([
			['Hammond', 'No... not yet... it is CALLING me. The big one. It is coming, Hal, and it is so HUNGRY--'],
			['Carol', 'Hal. What was that?'],
			['Hal', "I don't know. But I think it came out of that lantern on Oa."]
		]);
	}

	private lose(reason: 'crowd' | 'carol' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		if (this.taken) {
			const rise = Math.max(0, this.timer - 0.6);
			return [[this.taken.x, this.taken.y - 200 - Math.min(700, rise * rise * 70)]];
		}
		if (this.phase === 'helicopter' && this.heli && this.heli.saved < 2) return [[this.heli.x, this.heli.y], [this.heli.x, this.heli.y - this.heli.alt * SKY_DRAW]];
		if (this.carol.state === 'held' || this.carol.state === 'falling') return [[this.carol.x, this.carol.y], [this.carol.x, this.carol.y - this.carol.alt * SKY_DRAW]];
		return [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		if (this.phase === 'helicopter' && this.heli && this.heli.saved === 0) return { x: this.heli.x - 200, y: this.heli.y };
		if (this.carol.state === 'falling') return this.carol;
		if (this.hammond && isStanding(this.hammond)) return this.hammond;
		return null;
	}

	get goalFirst(): boolean {
		return (this.phase === 'helicopter' && this.heli?.saved === 0) || this.carol.state === 'falling';
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [
			{ baseY: -1e6, draw: () => drawApron(ctx, time) },
			{ baseY: CROWD.y - 120, draw: () => drawMarquee(ctx, CROWD.x, CROWD.y - 120, time) }
		];
		for (const j of this.jets) if (j.parked || j.wreck) list.push({ baseY: j.y, draw: () => drawJet(ctx, j.x, j.y, 0, j.wreck ? j.spin : 0, j.dir, j.wreck) });
		for (const t of this.thrown) {
			list.push({ baseY: t.y, draw: () => drawJet(ctx, t.x, t.y, t.alt, t.lift > 0 ? Math.sin(t.spin) * 0.2 : t.spin, t.vx < 0 ? -1 : 1, false, true) });
			// Where it's going: a line on the ground while he holds it up
			if (t.lift > 0) list.push({ baseY: -1e6 + 1, draw: () => drawThrowLine(ctx, t, this.halAt, time) });
		}
		for (const [i, g] of GUESTS.entries()) list.push({ baseY: CROWD.y + g.dy, draw: () => drawGuest(ctx, CROWD.x + g.dx, CROWD.y + g.dy, g, time, this.phase === 'helicopter' || this.phase === 'carol', i) });
		const c = this.carol;
		if (c.state !== 'down') list.push({ baseY: c.y, draw: () => drawCarol(ctx, c.x, c.y, c.alt * SKY_DRAW, time, c.state === 'held' || c.state === 'falling', c.state === 'held') });
		const h = this.heli;
		if (h) list.push({ baseY: h.y, draw: () => drawHelicopter(ctx, h.x, h.y, h.alt * SKY_DRAW, h.saved > 0 ? 0 : Math.sin(h.spin) * 0.5, time, h.saved === 0, h.ride) });
		for (const t of this.turned) list.push({ baseY: t.y, draw: () => drawTurned(ctx, t, time) });
		const tk = this.taken;
		if (tk) {
			const rise = Math.max(0, this.timer - 0.6);
			list.push({ baseY: tk.y, draw: () => drawTaken(ctx, tk, rise, time) });
		}
		return list;
	}
}

// ------------------------------------------------------------- the gala's people

export interface Guest {
	dx: number;
	dy: number;
	suit: string;
	skin: string;
	dress: boolean;
}

export const GUESTS: Guest[] = (() => {
	const out: Guest[] = [];
	const suits = ['#1b1c22', '#2a2230', '#5a1e2a', '#14324a', '#3a3a3a', '#6a4a1a'];
	const skins = ['#e0b08a', '#8d5a3a', '#c48e66', '#f1cfae', '#5e3b26'];
	for (let i = 0; i < 22; i++) {
		const a = i * 2.39996;
		const r = 70 + 26 * Math.sqrt(i) * 3;
		out.push({ dx: Math.cos(a) * r * 1.5, dy: 60 + Math.sin(a) * r * 0.55, suit: suits[i % suits.length], skin: skins[(i * 3) % skins.length], dress: i % 3 === 1 });
	}
	return out;
})();

export function drawGuest(ctx: CanvasRenderingContext2D, x: number, y: number, g: Guest, time: number, panic: boolean, i: number) {
	const bob = panic ? Math.abs(Math.sin(time * 9 + i)) * 4 : 0;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.translate(x, y - bob);
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 2;
	ctx.fillStyle = g.suit;
	if (g.dress) {
		ctx.beginPath();
		ctx.moveTo(-5, -40);
		ctx.lineTo(5, -40);
		ctx.lineTo(11, 0);
		ctx.lineTo(-11, 0);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	} else {
		ctx.fillRect(-6, -40, 12, 22);
		ctx.strokeRect(-6, -40, 12, 22);
		ctx.fillStyle = '#121216';
		ctx.fillRect(-5, -18, 4, 18);
		ctx.fillRect(1, -18, 4, 18);
	}
	// Arms up when it all goes wrong
	ctx.strokeStyle = g.skin;
	ctx.lineWidth = 3;
	ctx.beginPath();
	if (panic) {
		ctx.moveTo(-5, -36);
		ctx.lineTo(-10, -52);
		ctx.moveTo(5, -36);
		ctx.lineTo(10, -52);
	} else {
		ctx.moveTo(-6, -36);
		ctx.lineTo(-8, -22);
		ctx.moveTo(6, -36);
		ctx.lineTo(8, -22);
	}
	ctx.stroke();
	ctx.fillStyle = g.skin;
	ctx.beginPath();
	ctx.arc(0, -47, 6, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.restore();
}

/** Carol Ferris in her gala dress: on her feet, or held up in the air in his yellow grip. */
export function drawCarol(ctx: CanvasRenderingContext2D, x: number, y: number, alt: number, time: number, up: boolean, gripped: boolean) {
	ctx.save();
	// Her shadow, and a mark round it when she's up there (where to be when she falls)
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y, 14 + alt * 0.03, 5 + alt * 0.01, 0, 0, Math.PI * 2);
	ctx.fill();
	if (up) {
		ctx.strokeStyle = `rgba(120, 255, 160, ${0.5 + 0.3 * Math.sin(time * 8)})`;
		ctx.lineWidth = 3;
		ctx.setLineDash([10, 8]);
		ctx.beginPath();
		ctx.ellipse(x, y, CAROL.catchRange, CAROL.catchRange * 0.45, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
	}
	ctx.translate(x, y - alt);
	if (gripped) {
		ctx.globalCompositeOperation = 'lighter';
		const g = ctx.createRadialGradient(0, -30, 4, 0, -30, 60);
		g.addColorStop(0, 'rgba(255, 220, 90, 0.5)');
		g.addColorStop(1, 'rgba(255, 180, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(0, -30, 60, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalCompositeOperation = 'source-over';
	}
	const kick = up ? Math.sin(time * 7) * 0.35 : 0;
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 2.5;
	// Legs (kicking when she's up there)
	ctx.strokeStyle = '#e4b994';
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(-3, -14);
	ctx.lineTo(-4 + kick * 10, 0);
	ctx.moveTo(3, -14);
	ctx.lineTo(4 - kick * 10, 0);
	ctx.stroke();
	// The dress: deep red, to the knee
	ctx.fillStyle = '#a3172b';
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 2.5;
	ctx.beginPath();
	ctx.moveTo(-6, -46);
	ctx.lineTo(6, -46);
	ctx.lineTo(13, -12);
	ctx.lineTo(-13, -12);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Arms: reaching out when she's up there
	ctx.strokeStyle = '#e4b994';
	ctx.lineWidth = 3.5;
	ctx.beginPath();
	ctx.moveTo(-5, -42);
	ctx.lineTo(up ? -16 : -8, up ? -54 + kick * 6 : -28);
	ctx.moveTo(5, -42);
	ctx.lineTo(up ? 16 : 8, up ? -54 - kick * 6 : -28);
	ctx.stroke();
	// Head, dark hair down to the shoulders
	ctx.fillStyle = '#3a2216';
	ctx.beginPath();
	ctx.ellipse(0, -54, 9, 11, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#e4b994';
	ctx.beginPath();
	ctx.arc(1.5, -55, 6.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.restore();
}

// --------------------------------------------------------------- the airfield

function drawApron(ctx: CanvasRenderingContext2D, time: number) {
	ctx.save();
	// The runway along the bottom: dashes down the middle, lights along the edges
	ctx.fillStyle = '#16171a';
	ctx.fillRect(0, RUNWAY.y, W, RUNWAY.h);
	ctx.fillStyle = 'rgba(240, 240, 230, 0.7)';
	for (let x = 40; x < W; x += 180) ctx.fillRect(x, RUNWAY.y + RUNWAY.h / 2 - 4, 100, 8);
	for (let x = 30; x < W; x += 120) {
		const on = 0.5 + 0.5 * Math.sin(time * 3 - x * 0.01);
		ctx.fillStyle = `rgba(255, 220, 120, ${0.4 + 0.5 * on})`;
		ctx.beginPath();
		ctx.arc(x, RUNWAY.y + 8, 4, 0, Math.PI * 2);
		ctx.arc(x, RUNWAY.y + RUNWAY.h - 8, 4, 0, Math.PI * 2);
		ctx.fill();
	}
	// Yellow taxi lines out of the hangar
	ctx.strokeStyle = 'rgba(230, 190, 40, 0.45)';
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.moveTo(DOOR.x, DOOR.y);
	ctx.lineTo(DOOR.x, RUNWAY.y);
	ctx.moveTo(DOOR.x, DOOR.y + 120);
	ctx.quadraticCurveTo(DOOR.x - 600, DOOR.y + 160, 600, RUNWAY.y);
	ctx.moveTo(DOOR.x, DOOR.y + 120);
	ctx.quadraticCurveTo(DOOR.x + 600, DOOR.y + 160, W - 600, RUNWAY.y);
	ctx.stroke();
	// The hangar's open doors spilling light, and its name
	const g = ctx.createLinearGradient(0, DOOR.y - 80, 0, DOOR.y + 260);
	g.addColorStop(0, 'rgba(255, 236, 190, 0.35)');
	g.addColorStop(1, 'rgba(255, 236, 190, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.moveTo(DOOR.x - 220, DOOR.y - 70);
	ctx.lineTo(DOOR.x + 220, DOOR.y - 70);
	ctx.lineTo(DOOR.x + 380, DOOR.y + 260);
	ctx.lineTo(DOOR.x - 380, DOOR.y + 260);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

/** The gala's marquee: a white tent with strings of lights. */
export function drawMarquee(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.fillRect(x - 260, y - 6, 520, 20);
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 3;
	ctx.fillStyle = '#e9e4d8';
	ctx.beginPath();
	ctx.moveTo(x - 250, y);
	ctx.lineTo(x - 250, y - 90);
	ctx.lineTo(x, y - 170);
	ctx.lineTo(x + 250, y - 90);
	ctx.lineTo(x + 250, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#cfc8b8';
	ctx.fillRect(x - 250, y - 90, 500, 16);
	ctx.strokeRect(x - 250, y - 90, 500, 16);
	ctx.fillStyle = '#1b2440';
	ctx.font = 'bold 22px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('FERRIS AIRCRAFT', x, y - 40);
	for (let i = 0; i < 18; i++) {
		const lx = x - 240 + i * 28;
		const ly = y - 92 + Math.sin(i * 0.9) * 4;
		ctx.fillStyle = `rgba(255, 230, 150, ${0.5 + 0.5 * Math.sin(time * 4 + i)})`;
		ctx.beginPath();
		ctx.arc(lx, ly, 3, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

/** A Ferris jet, side-on: parked, held up in his grip, flying at you, or a wreck. */
export function drawJet(ctx: CanvasRenderingContext2D, x: number, y: number, alt: number, tilt: number, dir: number, wreck: boolean, held = false) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
	ctx.beginPath();
	ctx.ellipse(x, y, 70, 14, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.translate(x, y - 22 - alt);
	ctx.rotate(tilt);
	ctx.scale(dir, 1);
	if (held) {
		ctx.globalCompositeOperation = 'lighter';
		const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
		g.addColorStop(0, 'rgba(255, 220, 90, 0.45)');
		g.addColorStop(1, 'rgba(255, 180, 0, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(0, 0, 110, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalCompositeOperation = 'source-over';
	}
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 3;
	ctx.fillStyle = wreck ? '#3a3632' : '#c9ccd2';
	// Fuselage
	ctx.beginPath();
	ctx.moveTo(-70, -4);
	ctx.quadraticCurveTo(-40, -16, 40, -12);
	ctx.quadraticCurveTo(76, -8, 80, 2);
	ctx.quadraticCurveTo(60, 10, -66, 8);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Tail fin and wing
	ctx.beginPath();
	ctx.moveTo(-62, -4);
	ctx.lineTo(-74, -36);
	ctx.lineTo(-50, -34);
	ctx.lineTo(-36, -8);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = wreck ? '#2c2926' : '#a9adb5';
	ctx.beginPath();
	ctx.moveTo(-14, 2);
	ctx.lineTo(18, 2);
	ctx.lineTo(-6, 24);
	ctx.lineTo(-30, 24);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Canopy and the Ferris stripe
	ctx.fillStyle = wreck ? '#1a1a1a' : '#2c4e7a';
	ctx.beginPath();
	ctx.ellipse(46, -12, 16, 6, -0.1, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	if (!wreck) {
		ctx.fillStyle = '#b8282f';
		ctx.fillRect(-56, -3, 90, 4);
	} else {
		ctx.fillStyle = 'rgba(255, 140, 40, 0.6)';
		ctx.beginPath();
		ctx.arc(-10, -14, 8 + Math.random() * 3, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

/** Where a held jet will fly: a yellow line from it toward Hal, so you can step out of it. */
function drawThrowLine(ctx: CanvasRenderingContext2D, t: Thrown, at: { x: number; y: number }, time: number) {
	const dx = at.x - t.x;
	const dy = at.y - t.y;
	const d = Math.hypot(dx, dy) || 1;
	const ex = t.x + (dx / d) * 1700;
	const ey = t.y + (dy / d) * 1700;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = `rgba(255, 200, 40, ${0.16 + 0.12 * Math.sin(time * 14)})`;
	ctx.lineWidth = THROW.width * 2;
	ctx.beginPath();
	ctx.moveTo(t.x, t.y);
	ctx.lineTo(ex, ey);
	ctx.stroke();
	// Chevrons running down it, the way it'll fly
	ctx.strokeStyle = 'rgba(255, 220, 90, 0.7)';
	ctx.lineWidth = 5;
	const a = Math.atan2(dy, dx);
	for (let k = ((time * 600) % 160) + 80; k < 1700; k += 160) {
		const cx = t.x + Math.cos(a) * k;
		const cy = t.y + Math.sin(a) * k;
		ctx.beginPath();
		ctx.moveTo(cx - Math.cos(a - 0.6) * 26, cy - Math.sin(a - 0.6) * 26);
		ctx.lineTo(cx, cy);
		ctx.lineTo(cx - Math.cos(a + 0.6) * 26, cy - Math.sin(a + 0.6) * 26);
		ctx.stroke();
	}
	ctx.restore();
}

/** The show helicopter in Ferris colours, side-on: spinning down, its rotor whirling, smoke behind it. */
function drawHelicopter(ctx: CanvasRenderingContext2D, x: number, y: number, alt: number, tilt: number, time: number, falling: boolean, ride: { x: number; y: number; tilt: number } | null = null) {
	ctx.save();
	// Its shadow on the ground, growing as it comes down: where the track has to go
	const near = 1 - Math.min(1, alt / (HELI.alt * SKY_DRAW));
	ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + 0.25 * near})`;
	ctx.beginPath();
	ctx.ellipse(x, y, 50 + near * 40, 12 + near * 8, 0, 0, Math.PI * 2);
	ctx.fill();
	if (falling) {
		ctx.strokeStyle = `rgba(255, 90, 60, ${0.5 + 0.4 * Math.sin(time * 10)})`;
		ctx.lineWidth = 4;
		ctx.setLineDash([12, 10]);
		ctx.beginPath();
		ctx.ellipse(x, y, 150, 60, 0, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
		// Smoke trailing up behind it
		for (let i = 0; i < 6; i++) {
			const sx = x - 40 - i * 18 + Math.sin(time * 2 + i) * 6;
			const sy = y - alt - 30 - i * 26;
			ctx.fillStyle = `rgba(60, 60, 64, ${0.45 - i * 0.06})`;
			ctx.beginPath();
			ctx.arc(sx, sy, 14 + i * 5, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	if (ride) {
		ctx.translate(ride.x, ride.y);
		ctx.rotate(ride.tilt);
		ctx.scale(0.8, 0.8);
	} else {
		ctx.translate(x, y - 40 - alt);
		ctx.rotate(tilt);
	}
	ctx.strokeStyle = '#0a0806';
	ctx.lineWidth = 3;
	// Tail boom and rotor
	ctx.fillStyle = '#e9e9ee';
	ctx.fillRect(-100, -10, 70, 10);
	ctx.strokeRect(-100, -10, 70, 10);
	ctx.beginPath();
	ctx.arc(-100, -6, 12 + Math.sin(time * 40) * 2, 0, Math.PI * 2);
	ctx.stroke();
	// Body
	ctx.fillStyle = '#e9e9ee';
	ctx.beginPath();
	ctx.ellipse(0, 0, 44, 26, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#2c4e7a';
	ctx.beginPath();
	ctx.ellipse(18, -6, 20, 14, 0, -1.2, 1.2);
	ctx.fill();
	ctx.fillStyle = '#b8282f';
	ctx.fillRect(-40, 6, 70, 5);
	// Skids
	ctx.beginPath();
	ctx.moveTo(-30, 26);
	ctx.lineTo(-24, 36);
	ctx.moveTo(24, 26);
	ctx.lineTo(18, 36);
	ctx.moveTo(-40, 36);
	ctx.lineTo(36, 36);
	ctx.stroke();
	// Main rotor: a blur
	const blade = 96 * Math.abs(Math.cos(time * 30));
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.moveTo(-blade, -32);
	ctx.lineTo(blade, -32);
	ctx.moveTo(0, -26);
	ctx.lineTo(0, -32);
	ctx.stroke();
	ctx.restore();
}

/** One of Hal's own constructs, in Hammond's yellow, coming back at him. */
function drawTurned(ctx: CanvasRenderingContext2D, t: Turned, time: number) {
	ctx.save();
	const y = t.y - 60;
	ctx.globalCompositeOperation = 'lighter';
	const g = ctx.createRadialGradient(t.x, y, 4, t.x, y, 54);
	g.addColorStop(0, 'rgba(255, 240, 160, 0.8)');
	g.addColorStop(1, 'rgba(255, 190, 20, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(t.x, y, 54, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalCompositeOperation = 'source-over';
	ctx.strokeStyle = `rgba(255, 210, 50, ${0.8 + 0.2 * Math.sin(time * 20)})`;
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.arc(t.x, y, 26, 0, Math.PI * 2);
	ctx.stroke();
	ctx.fillStyle = '#2a1e00';
	ctx.font = 'bold 13px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText(t.name, t.x, y + 5);
	ctx.restore();
}

/** The end: a column of yellow light out of the sky, and Hammond pulled up it. */
function drawTaken(ctx: CanvasRenderingContext2D, tk: { x: number; y: number; art: Enemy }, rise: number, time: number) {
	const lift = rise * rise * 70;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	const a = Math.min(1, rise * 1.5 + 0.2);
	const g = ctx.createLinearGradient(tk.x - 90, 0, tk.x + 90, 0);
	g.addColorStop(0, 'rgba(255, 190, 30, 0)');
	g.addColorStop(0.5, `rgba(255, 220, 90, ${0.45 * a})`);
	g.addColorStop(1, 'rgba(255, 190, 30, 0)');
	ctx.fillStyle = g;
	ctx.fillRect(tk.x - 90, tk.y - 3000, 180, 3000);
	ctx.restore();
	if (lift < 2600) {
		tk.art.brain.state = 'act';
		drawEnemy(ctx, tk.art, tk.x, tk.y - lift, lift < 5, time, false);
	}
}
