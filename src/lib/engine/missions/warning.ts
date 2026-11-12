// Season three, Act 1, episode 3: The Warning. John, home in Coast City.
//
// Whatever pulled Hammond up into the dark is still out there, and it feeds on
// fear. It has sent something ahead of it into Coast City: the Hunger, a beast
// made of the city's panic.
//
//   Frozen people   All over downtown, people stand rooted to the spot, too
//                   frightened to move. Stand by one and John's ring steadies
//                   them: they run for the subway shelter.
//   Its armour      The Hunger feeds on panic: the more people frozen, the
//                   less John's constructs hurt it. Get people out and it
//                   gets soft.
//   Feeding         It goes for the frozen people. Let it reach one long
//                   enough and it feeds: it heals and grows.
//   Its roar        Every so often it roars, and everyone running freezes
//                   again; and it sends Fear Hounds after the runners.
//
// Win: the Hunger beaten. Lose: it feeds four times, or John goes down three
// times.

import { addDread } from '../dread';
import { isStanding } from '../dummy';
import { drawLantern, HOVER_SPACE, type Figure, type LanternPose } from '../draw/lantern';
import { hungerFed } from '../draw/hunger';
import type { Enemy } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { buildCityMap } from './callToArms';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

const LIVES = 3;
const INTRO_TIME = 3;
const W = 3400;
const H = 2200;
/** The subway entrance everyone runs for. */
export const SHELTER = { x: 560, y: 1160 };
const ENTRY = { x: 820, y: 1200 };
const HUNGER_AT = { x: 2300, y: 1050 };
export const HUNGER_HEALTH = 4.6;
const HUNGER_MIGHT = 6.5;
/** Its armour: this much of every hit shrugged off for each person frozen, up to the most. */
export const ARMOR = { per: 0.075, most: 0.82 };
/** Steadying someone: how close John has to be, and how long it takes. */
export const STEADY = { range: 130, time: 0.8 };
const RUN_SPEED = 150;
/** It feeds on someone frozen it gets this close to for this long: heals this much of its health and grows. */
export const FEED = { range: 115, time: 1.9, heal: 0.12, every: 7 };
/** It roars every `every` seconds: runners this close freeze again. */
export const ROAR = { every: 12, range: 820, dread: 0.16 };
/** Fear Hounds after the runners. */
const HOUNDS = { every: 10, first: 7 };
export const FED_LIMIT = 4;

/** Where the frozen people are when John arrives: spread through downtown. */
const PEOPLE = [
	{ x: 1180, y: 900 },
	{ x: 1350, y: 1430 },
	{ x: 1620, y: 1100 },
	{ x: 1820, y: 760 },
	{ x: 1900, y: 1500 },
	{ x: 2120, y: 1250 },
	{ x: 2380, y: 820 },
	{ x: 2520, y: 1480 },
	{ x: 2700, y: 1080 },
	{ x: 2900, y: 760 },
	{ x: 2980, y: 1400 },
	{ x: 1500, y: 640 }
];

export type PersonState = 'frozen' | 'running' | 'safe' | 'fed';

export interface Person {
	x: number;
	y: number;
	state: PersonState;
	/** 0..1, John's ring steadying them. */
	steady: number;
	/** The Hunger feeding on them, 0..1. */
	fed: number;
	figure: Figure;
}

export function buildWarningMap(): GameMap {
	const map = buildCityMap({ name: 'Coast City · downtown', ground: 'nightStreet', seed: 2011, width: W, height: H, spawn: ENTRY, clear: SHELTER });
	// John's had his battery since Oa
	map.noBattery = false;
	map.battery = { x: ENTRY.x - 160, y: ENTRY.y + 120 };
	// Nothing parked on the shelter or where people are standing
	map.obstacles = map.obstacles.filter((o) => o.kind !== 'car' || !PEOPLE.some((p) => Math.abs(o.x + o.w / 2 - p.x) < 120 && Math.abs(o.y - p.y) < 90));
	return map;
}

export class Warning implements MissionDirector {
	state: MissionState = 'intro';
	timer = INTRO_TIME;
	lives = LIVES;
	downs = 0;
	elapsed = 0;
	failReason: 'fed' | 'down' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ it never fed · ★ John never went down';
	hunger: Enemy | null = null;
	readonly people: Person[] = PEOPLE.map((p, i) => ({ ...p, state: 'frozen' as PersonState, steady: 0, fed: 0, figure: citizen(i) }));
	timesFed = 0;
	/** How much it has grown (0..1). */
	growth = 0;
	roarIn = ROAR.every;
	roarAge = 9;
	private houndsIn = HOUNDS.first;
	private feedIn = 4;
	private angry = 0;
	private lastHp = 0;
	private wasDown = false;
	/** Where John was last tick (for picking the nearest frozen person). */
	private johnAt = { x: ENTRY.x, y: ENTRY.y };
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	get frozen(): number {
		return this.people.filter((p) => p.state === 'frozen').length;
	}

	get saved(): number {
		return this.people.filter((p) => p.state === 'safe').length;
	}

	get armor(): number {
		return Math.min(ARMOR.most, this.frozen * ARMOR.per);
	}

	get objective(): string {
		if (this.state === 'won') return 'The Hunger is gone';
		if (this.armor > 0.4) return 'Free the frozen people: stand by them, then they run for the subway';
		return 'Its armour is down: take the Hunger apart!';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		const h = this.hunger;
		if (h) list.push({ label: 'The Hunger', value: Math.max(0, h.hp) / h.maxHp, text: `${Math.round((Math.max(0, h.hp) / h.maxHp) * 100)}%` });
		list.push({ label: 'Its armour', value: this.armor / ARMOR.most, text: `${Math.round(this.armor * 100)}%`, low: this.armor > 0.5 });
		list.push({ label: 'Fed on', value: this.timesFed / FED_LIMIT, text: `${this.timesFed} / ${FED_LIMIT}`, low: this.timesFed >= FED_LIMIT - 1 });
		list.push({ label: 'Next roar', value: this.roarIn / ROAR.every, text: `${Math.ceil(this.roarIn)}s`, low: this.roarIn < 2.5 });
		return list;
	}

	tally(): string {
		return `Safe in the subway: ${this.saved} · still frozen: ${this.frozen}`;
	}

	warning(): string | null {
		if (this.state !== 'playing') return null;
		const feeding = this.people.find((p) => p.fed > 0 && p.state === 'frozen');
		if (feeding) return 'It is feeding on someone! Get it off them!';
		if (this.roarIn < 2) return 'It is about to roar! The runners will freeze!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.timesFed === 0 ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The Hunger came apart into smoke over downtown. Whatever sent it is still coming.';
		if (this.failReason === 'fed') return 'The Hunger fed on Coast City until nothing could hurt it.';
		return 'John went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'People got to safety', value: `${this.saved} / ${this.people.length}` },
			{ label: 'Times it fed', value: `${this.timesFed}` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		this.roarAge += dt;
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
			if (this.lives <= 0) return this.lose('down');
			this.comms.say('Hal', 'John! Get up, they need you!', true);
		}
		this.wasDown = john.downed;
		this.johnAt = { x: john.x, y: john.y };
		const h = this.hunger;
		if (!h) return;
		if (!isStanding(h)) return this.win(game);

		this.shrugOff(h);
		this.steady(john, dt);
		this.run(game, dt);
		this.hunt(h, dt);
		this.roar(game, h, dt);
		this.hounds(game, h, dt);
		hungerFed.set(h, this.growth);
	}

	private start(game: Game) {
		this.state = 'playing';
		const h = game.spawnEnemy('hunger', HUNGER_AT.x, HUNGER_AT.y);
		h.brain.grit = 1;
		h.brain.might = HUNGER_MIGHT;
		h.brain.alert = 10;
		h.hp = h.maxHp = h.brain.lastHp = Math.round(h.maxHp * HUNGER_HEALTH);
		this.hunger = h;
		this.lastHp = h.hp;
		this.comms.scene([
			['John', "Coast City. Everybody's just... standing there. They're too scared to move."],
			['Hal', 'It feeds on that, John. Get to them: stand by one and your ring will steady them. Send them down into the subway.'],
			['John', "And the big one's soaking it up. Every one of them frozen makes it harder to hurt. Got it."]
		]);
	}

	/** Its armour: part of every hit shrugged off, more the more people are frozen. */
	private shrugOff(h: Enemy) {
		if (h.hp < this.lastHp) {
			const lost = this.lastHp - h.hp;
			h.hp += lost * this.armor;
			h.brain.lastHp = h.hp;
			this.angry = 4;
			if (this.armor > 0.5) this.once('armour', 'John', "It's barely feeling it. All that fear is armour. Get the people out first!");
		}
		this.lastHp = h.hp;
	}

	/** John standing by someone frozen steadies them; steadied, they run. */
	private steady(john: Player, dt: number) {
		for (const p of this.people) {
			if (p.state !== 'frozen') continue;
			const near = !john.downed && Math.hypot(john.x - p.x, john.y - p.y) < STEADY.range;
			p.steady = near ? Math.min(1, p.steady + dt / STEADY.time) : Math.max(0, p.steady - dt * 0.5);
			if (p.steady >= 1) {
				p.state = 'running';
				p.steady = 0;
				p.fed = 0;
				this.once('first', 'John', 'Go! The subway, that way! Keep your head down!');
			}
		}
	}

	private run(game: Game, dt: number) {
		for (const p of this.people) {
			if (p.state !== 'running') continue;
			const dx = SHELTER.x - p.x;
			const dy = SHELTER.y - p.y;
			const d = Math.hypot(dx, dy);
			if (d < 40) {
				p.state = 'safe';
				if (this.saved === Math.ceil(this.people.length / 2)) this.comms.say('Hal', "Half of them are down there. It's slowing, John. Hit it now!", true);
				continue;
			}
			p.x += (dx / d) * RUN_SPEED * dt;
			p.y += (dy / d) * RUN_SPEED * dt;
			// A Fear Hound that catches up with a runner freezes them where they are
			for (const e of game.enemies) {
				if (e.kind !== 'fearHound' || !isStanding(e) || Math.hypot(e.x - p.x, e.y - p.y) > 60) continue;
				p.state = 'frozen';
				this.once('caught', 'John', 'A hound got one of them! They froze up again!');
				break;
			}
		}
	}

	/** It goes for whoever is frozen, unless John has its attention; close enough for long enough, it feeds. */
	private hunt(h: Enemy, dt: number) {
		this.angry = Math.max(0, this.angry - dt);
		this.feedIn -= dt;
		const prey = this.people
			.filter((p) => p.state === 'frozen')
			.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
		for (const p of this.people) if (p !== prey) p.fed = Math.max(0, p.fed - dt);
		if (!prey || (this.angry > 0 && this.feedIn > 0)) {
			h.brain.errand = null;
			return;
		}
		const d = Math.hypot(prey.x - h.x, prey.y - h.y);
		if (this.feedIn > 0 && d > FEED.range) {
			h.brain.errand = null;
			return;
		}
		if (d > FEED.range * 0.8) {
			h.brain.errand = { x: prey.x + (h.x < prey.x ? -70 : 70), y: prey.y + 10, speed: 240 };
			return;
		}
		h.brain.errand = null;
		prey.fed += dt / FEED.time;
		this.once('feed', 'Hal', "It's feeding on them, John! Knock it off before it finishes!");
		if (prey.fed >= 1) {
			prey.state = 'fed';
			prey.fed = 1;
			this.timesFed++;
			this.feedIn = FEED.every;
			this.growth = Math.min(1, this.growth + 0.25);
			h.hp = Math.min(h.maxHp, h.hp + h.maxHp * FEED.heal);
			h.brain.lastHp = this.lastHp = h.hp;
			h.brain.might = HUNGER_MIGHT * (1 + this.growth * 0.4);
			this.comms.say('John', this.timesFed >= FED_LIMIT - 1 ? 'It keeps getting BIGGER. One more and nothing will stop it!' : 'No! It fed on them... it’s bigger.', true);
			if (this.timesFed >= FED_LIMIT) this.lose('fed');
		}
	}

	/** Its roar: runners near it freeze again, and fear on John. */
	private roar(game: Game, h: Enemy, dt: number) {
		this.roarIn -= dt;
		if (this.roarIn > 0) return;
		this.roarIn = ROAR.every;
		this.roarAge = 0;
		let froze = 0;
		for (const p of this.people) {
			if (p.state === 'running' && Math.hypot(p.x - h.x, p.y - h.y) < ROAR.range) {
				p.state = 'frozen';
				froze++;
			}
		}
		const john = game.players[0];
		if (!john.downed && Math.hypot(john.x - h.x, john.y - h.y) < ROAR.range) addDread(john, ROAR.dread);
		game.constructs.effects.push({ kind: 'shockwave', x: h.x, y: h.y - 60, age: 0, life: 0.9, radius: ROAR.range } as never);
		if (froze) this.comms.say('John', froze > 1 ? `The roar froze ${froze} of them again!` : 'The roar froze one of them again!', true);
		else this.once('roar', 'Hal', 'When it roars, anyone running near it locks up. Get them out of its range first.');
	}

	/** Fear Hounds out of its smoke, after the runners. */
	private hounds(game: Game, h: Enemy, dt: number) {
		this.houndsIn -= dt;
		if (this.houndsIn > 0) return;
		this.houndsIn = HOUNDS.every;
		const n = this.elapsed > 60 ? 4 : 3;
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2 + this.elapsed;
			const e = game.spawnEnemy('fearHound', h.x + Math.cos(a) * 90, h.y + Math.sin(a) * 50, 'berserker');
			e.brain.might = 4.2;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * 2.4);
			const runner = this.people.find((p) => p.state === 'running');
			if (runner) e.brain.errand = { x: runner.x, y: runner.y, speed: 300 };
		}
		this.once('hounds', 'John', 'It’s sending hounds after the runners! Cover them!');
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) p.victoryTimer = 0.4;
		for (const e of game.enemies) if (e.kind === 'fearHound' && isStanding(e)) e.hp = 0;
		this.comms.scene([
			['John', 'It’s breaking up... like smoke. Hal, it said something before it went. "He is coming."'],
			['Hal', 'Sinestro was right. It’s waking up. John, hold Coast City. I’m going back to the Battery.']
		]);
	}

	private lose(reason: 'fed' | 'down') {
		if (this.state !== 'playing') return;
		this.state = 'lost';
		this.failReason = reason;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const h = this.hunger;
		const feeding = this.people.find((p) => p.fed > 0.15 && p.state === 'frozen');
		if (feeding) return [[feeding.x, feeding.y]];
		return h && isStanding(h) ? [[h.x, h.y - 80]] : [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const feeding = this.people.find((p) => p.fed > 0.1 && p.state === 'frozen');
		if (feeding) return feeding;
		if (this.armor > 0.3) {
			const john = this.johnAt;
			return this.people.filter((p) => p.state === 'frozen').sort((a, b) => Math.hypot(a.x - john.x, a.y - john.y) - Math.hypot(b.x - john.x, b.y - john.y))[0] ?? this.hunger;
		}
		return this.hunger && isStanding(this.hunger) ? this.hunger : null;
	}

	get goalFirst(): boolean {
		return this.state === 'playing' && (this.armor > 0.3 || this.people.some((p) => p.fed > 0.1 && p.state === 'frozen'));
	}


	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [{ baseY: SHELTER.y - 60, draw: () => drawShelter(ctx, SHELTER.x, SHELTER.y, time) }];
		for (const [i, p] of this.people.entries()) if (p.state !== 'safe') list.push({ baseY: p.y, draw: () => drawPerson(ctx, p, i, time) });
		const h = this.hunger;
		if (h && isStanding(h) && this.armor > 0.05) list.push({ baseY: h.y - 1, draw: () => drawArmour(ctx, h.x, h.y, this.armor, time, this.growth) });
		if (this.roarAge < 0.9 && h) list.push({ baseY: 1e6, draw: () => drawRoar(ctx, h.x, h.y, this.roarAge) });
		return list;
	}
}

// ------------------------------------------------------------- the people

const SKINS = ['#e0b08a', '#8d5a3a', '#c48e66', '#f1cfae', '#5e3b26', '#a9714b'];
const HAIRS = ['#1a1410', '#4a2a18', '#7a5a3a', '#c9a35a', '#2a1a10'];
const TOPS: [string, string][] = [
	['#3a5a8a', '#5a7aaa'],
	['#8a2a2a', '#aa4a4a'],
	['#2a6a4a', '#4a8a6a'],
	['#c8a43a', '#e0c060'],
	['#4a4a52', '#6a6a72'],
	['#6a3a7a', '#8a5a9a']
];

/** Someone downtown at night: a jacket or a dress, everyday clothes. */
function citizen(i: number): Figure {
	const [top, topLit] = TOPS[i % TOPS.length];
	const woman = i % 3 === 1;
	return {
		id: `citizen${i}`,
		look: { skin: SKINS[(i * 5) % SKINS.length], hair: HAIRS[(i * 3) % HAIRS.length], hairStyle: woman ? (i % 2 ? 'long' : 'bob') : i % 2 ? 'cropped' : 'swept', mask: false },
		bulk: woman ? 0.86 : 0.95 + (i % 3) * 0.05,
		outfit: { top, topLit, trousers: woman ? top : ['#22262e', '#3a3226', '#1a1a1e'][i % 3], boots: '#14100c', dress: woman && i % 2 === 0 ? top : undefined }
	};
}

function personPose(dir: 1 | -1): LanternPose {
	return { dir, walkPhase: 0, altitude: 0, hoverHeight: HOVER_SPACE, lean: 0, glow: false, shadow: true, firing: false, aimX: dir, aimY: 0 };
}

function drawPerson(ctx: CanvasRenderingContext2D, p: Person, i: number, time: number) {
	const pose = personPose(p.state === 'running' ? (SHELTER.x < p.x ? -1 : 1) : i % 2 ? 1 : -1);
	if (p.state === 'fed') {
		pose.downed = true;
		drawLantern(ctx, { ...p.figure, look: { ...p.figure.look, skin: '#9a9a96' } }, p.x, p.y, pose, time, 0.95);
		return;
	}
	if (p.state === 'running') {
		pose.walkPhase = time * 12 + i;
		pose.lean = 0.15;
		drawLantern(ctx, p.figure, p.x, p.y, pose, time, 0.95);
		return;
	}
	// Frozen: shaking, arms up over the head, fear wisping off them
	pose.hurt = 0.75 + 0.1 * Math.sin(time * 23 + i);
	const shake = Math.sin(time * 40 + i * 3) * 1.5;
	ctx.save();
	// The ring round them John has to stand in, filling as he steadies them
	ctx.strokeStyle = `rgba(255, 210, 70, ${0.35 + 0.15 * Math.sin(time * 4 + i)})`;
	ctx.lineWidth = 2;
	ctx.setLineDash([8, 7]);
	ctx.beginPath();
	ctx.ellipse(p.x, p.y, STEADY.range * 0.8, STEADY.range * 0.34, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	if (p.steady > 0) {
		ctx.strokeStyle = 'rgba(90, 255, 140, 0.9)';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.ellipse(p.x, p.y, STEADY.range * 0.8, STEADY.range * 0.34, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.steady);
		ctx.stroke();
	}
	ctx.restore();
	drawLantern(ctx, p.figure, p.x + shake, p.y, pose, time, 0.95);
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	for (let k = 0; k < 3; k++) {
		const t = (time * 0.8 + k / 3 + i * 0.13) % 1;
		ctx.fillStyle = `rgba(255, 200, 60, ${0.35 * (1 - t)})`;
		ctx.beginPath();
		ctx.arc(p.x + Math.sin(t * 6 + k) * 10, p.y - 120 - t * 50, 5 + t * 8, 0, Math.PI * 2);
		ctx.fill();
	}
	// Being fed on: drawn up out of them in a yellow stream
	if (p.fed > 0) {
		ctx.strokeStyle = `rgba(255, 220, 90, ${0.4 + 0.5 * p.fed})`;
		ctx.lineWidth = 4 + p.fed * 8;
		ctx.beginPath();
		ctx.moveTo(p.x, p.y - 80);
		ctx.quadraticCurveTo(p.x, p.y - 160, p.x + Math.sin(time * 5) * 30, p.y - 200);
		ctx.stroke();
	}
	ctx.restore();
}

/** The Coast City Transit stairs down, under a green light John put up so everyone can find it. */
function drawShelter(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
	ctx.save();
	// The stairwell
	ctx.fillStyle = '#0c0d10';
	ctx.fillRect(x - 70, y - 40, 140, 70);
	ctx.strokeStyle = '#3a3e46';
	ctx.lineWidth = 3;
	for (let i = 0; i < 5; i++) {
		ctx.beginPath();
		ctx.moveTo(x - 62, y - 30 + i * 13);
		ctx.lineTo(x + 62, y - 30 + i * 13);
		ctx.stroke();
	}
	// Railings
	ctx.strokeStyle = '#8a8f98';
	ctx.lineWidth = 4;
	ctx.strokeRect(x - 74, y - 44, 148, 78);
	// The sign
	ctx.fillStyle = '#1f3a6a';
	ctx.fillRect(x - 80, y - 130, 160, 34);
	ctx.strokeStyle = '#0a0a0c';
	ctx.lineWidth = 2;
	ctx.strokeRect(x - 80, y - 130, 160, 34);
	ctx.fillStyle = '#f2efe6';
	ctx.font = 'bold 15px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('COAST CITY TRANSIT', x, y - 108);
	ctx.fillStyle = '#5a5e66';
	ctx.fillRect(x - 76, y - 96, 6, 54);
	ctx.fillRect(x + 70, y - 96, 6, 54);
	// John's beacon over it
	ctx.globalCompositeOperation = 'lighter';
	const g = ctx.createLinearGradient(x, y - 420, x, y);
	g.addColorStop(0, 'rgba(60, 255, 120, 0)');
	g.addColorStop(1, `rgba(60, 255, 120, ${0.3 + 0.08 * Math.sin(time * 3)})`);
	ctx.fillStyle = g;
	ctx.fillRect(x - 40, y - 420, 80, 420);
	ctx.restore();
}

/** Its armour of other people's fear: a yellow shell, thicker the more people are frozen. */
function drawArmour(ctx: CanvasRenderingContext2D, x: number, y: number, armor: number, time: number, growth: number) {
	const s = 1 + growth * 0.35;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	const r = 150 * s;
	const cy = y - 90 * s;
	const g = ctx.createRadialGradient(x, cy, r * 0.5, x, cy, r);
	g.addColorStop(0, 'rgba(255, 200, 40, 0)');
	g.addColorStop(0.8, `rgba(255, 200, 40, ${0.25 * armor})`);
	g.addColorStop(1, 'rgba(255, 200, 40, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.ellipse(x, cy, r, r * 0.85, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = `rgba(255, 225, 120, ${0.3 + 0.5 * armor})`;
	ctx.lineWidth = 2 + armor * 4;
	ctx.setLineDash([20 + 30 * armor, 14]);
	ctx.lineDashOffset = time * 30;
	ctx.beginPath();
	ctx.ellipse(x, cy, r * 0.92, r * 0.78, 0, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

function drawRoar(ctx: CanvasRenderingContext2D, x: number, y: number, age: number) {
	const k = age / 0.9;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.strokeStyle = `rgba(255, 210, 70, ${0.7 * (1 - k)})`;
	for (let i = 0; i < 3; i++) {
		ctx.lineWidth = 6 * (1 - k);
		ctx.beginPath();
		ctx.ellipse(x, y - 60, ROAR.range * (k * 0.9 + i * 0.05), ROAR.range * 0.42 * (k * 0.9 + i * 0.05), 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}
