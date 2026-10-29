// Season two, Act 3, mission 11: Two Lanterns. John and Hal, together at last
// (choose who you play; the other fights beside you).
//
// The Sinestro Corps comes for the Watchtower: Earth's heroes, and the one
// Green Lantern who lives on Earth.
//
//   boarding     three waves cut in through the glass along the deck.
//   lieutenants  then two of Sinestro's own: Arkillo, back from Graxos, and
//                Scarecrow, who has a yellow ring now. More keep cutting in
//                while either of them stands. Take both down.
//
// Side by side: while the two of you stand close, fear can't get a grip on
// either of you (your dread drains away). Split up and you're on your own.
//
// Lose: you go down 3 times.

import { addDread } from '../dread';
import { isStanding } from '../dummy';
import { drawEarthWindow } from '../draw/watchtower';
import type { Enemy, Role } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import type { Player } from '../player';
import { buildWatchtowerMap, CENTRE, WINDOW } from './watchtower';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type TwoLanternsPhase = 'boarding' | 'lieutenants';

const LIVES = 3;
const INTRO_TIME = 3;
const GRUNT_TOUGHNESS = 3.6;
const GRUNT_MIGHT = 5.4;
const ARKILLO = { health: 3.4, might: 5.2 };
const SCARECROW = { health: 6, might: 5.4 };
/** Side by side: this close, and dread drains this much faster for both. */
export const TOGETHER = { range: 340, relief: 0.18 };
/** The second star: side by side this share of the fight. */
const TOGETHER_STAR = 0.6;
/** While a lieutenant stands, more cut in this often. */
const REINFORCE_EVERY = 16;

/** Where they cut in: along the glass, just above the floor. */
const BREACHES = [WINDOW.x + 380, CENTRE.x, WINDOW.x + WINDOW.w - 380];
const BREACH_Y = 820;

type Wave = [Role | 'arkillo' | 'scarecrow', number, number][];
const WAVES: Wave[] = [
	[
		['hunter', 0, 0],
		['gunner', 1, 30],
		['berserker', 2, 0],
		['gunner', 0, 60],
		['berserker', 2, 60]
	],
	[
		['berserker', 0, 0],
		['hunter', 0, 60],
		['gunner', 1, 0],
		['gunner', 1, 60],
		['hunter', 2, 0],
		['berserker', 2, 60]
	],
	[
		['berserker', 0, 0],
		['berserker', 0, 60],
		['gunner', 1, 0],
		['hunter', 1, 60],
		['gunner', 1, 120],
		['hunter', 2, 0],
		['berserker', 2, 60]
	]
];
const REINFORCEMENTS: Wave[] = [
	[
		['berserker', 0, 0],
		['gunner', 2, 0]
	],
	[
		['hunter', 1, 0],
		['berserker', 1, 60]
	]
];
const LIEUTENANTS: Wave = [
	['arkillo', 0, 40],
	['scarecrow', 2, 40],
	['gunner', 1, 0]
];

export function buildTwoLanternsMap(): GameMap {
	return { ...buildWatchtowerMap(), name: 'The Watchtower' };
}

export class TwoLanterns implements MissionDirector {
	state: MissionState = 'intro';
	phase: TwoLanternsPhase = 'boarding';
	timer = INTRO_TIME;
	lives = LIVES;
	elapsed = 0;
	downs = 0;
	defeated = 0;
	wave = 0;
	/** Seconds the two of them fought side by side. */
	together = 0;
	failReason: 'lantern' | null = null;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ side by side most of the fight · ★ you never went down';
	arkillo: Enemy | null = null;
	scarecrow: Enemy | null = null;
	/** Where the glass has been cut, for drawing: breach index and seconds since. */
	readonly cuts: { at: number; age: number }[] = [];
	private all: Enemy[] = [];
	private counted = new WeakSet<Enemy>();
	private reinforce = REINFORCE_EVERY;
	private reinforcements = 0;
	private wasDown = false;
	private said = new Set<string>();
	private gameRef: Game | null = null;

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.phase === 'boarding') return `Hold the deck (wave ${this.wave} / ${WAVES.length})`;
		return 'Take down Arkillo and Scarecrow';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		for (const [label, e] of [['Arkillo', this.arkillo], ['Scarecrow', this.scarecrow]] as const) {
			if (e && isStanding(e)) list.push({ label, value: e.hp / e.maxHp, text: `${Math.round((e.hp / e.maxHp) * 100)}%` });
		}
		if (this.elapsed > 0) list.push({ label: 'Together', value: this.togetherShare, text: `${Math.round(this.togetherShare * 100)}%` });
		return list;
	}

	get togetherShare(): number {
		return this.elapsed > 0 ? this.together / this.elapsed : 0;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing') return null;
		const [me, partner] = game.players;
		if (me.dread > 0.6 && !this.isTogether(me, partner)) return 'Fear is taking hold! Get back beside your partner!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.togetherShare >= TOGETHER_STAR ? 1 : 0) + (this.downs === 0 ? 1 : 0);
	}

	get resultText(): string {
		if (this.state === 'won') return 'The Watchtower held. Two Lanterns, one ring each, and the first time fear could not get between them.';
		return 'You went down one time too many.';
	}

	stats(): MissionStat[] {
		const t = Math.round(this.elapsed);
		return [
			{ label: 'Sinestro Corps beaten', value: `${this.defeated}` },
			{ label: 'Side by side', value: `${Math.round(this.togetherShare * 100)}%` },
			{ label: 'Times down', value: `${this.downs}` },
			{ label: 'Time', value: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.gameRef = game;
		this.comms.update(dt);
		this.countDefeats();
		for (const c of this.cuts) c.age += dt;

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					this.nextWave(game);
					const john = game.players[0].def.id === 'john';
					this.comms.scene([
						['Hal', 'Nice place, Stewart. Shame about the visitors.'],
						['John', "They came through the glass. The League's on the lower decks; this one is ours."],
						[john ? 'Hal' : 'John', 'Stay close. Whatever they throw at us, it gets a lot smaller with two rings on it.']
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
		this.countDowns(game);
		if (this.state !== 'playing') return;
		this.updateTogether(game, dt);

		switch (this.phase) {
			case 'boarding':
				if (this.all.every((e) => !isStanding(e))) {
					if (this.wave < WAVES.length) {
						this.nextWave(game);
						this.comms.say(this.wave === 2 ? 'John' : 'Hal', this.wave === 2 ? 'More of them, through the glass!' : 'Here comes the rest of them!', true);
					} else this.startLieutenants(game);
				}
				break;
			case 'lieutenants': {
				this.reinforce -= dt;
				if (this.reinforce <= 0) {
					this.reinforce = REINFORCE_EVERY;
					this.spawn(game, REINFORCEMENTS[this.reinforcements++ % REINFORCEMENTS.length]);
				}
				const down = [this.arkillo, this.scarecrow].filter((e) => e && !isStanding(e)).length;
				if (down === 2) this.win(game);
				else if (down === 1) this.once('one', 'John', 'One down! Stay on the other!');
				break;
			}
		}
	}

	private isTogether(a: Player, b: Player | undefined): boolean {
		return !!b && !a.downed && !b.downed && Math.hypot(a.x - b.x, a.y - b.y) < TOGETHER.range;
	}

	/** Side by side, fear can't get a grip on either of them. */
	private updateTogether(game: Game, dt: number) {
		const [me, partner] = game.players;
		if (!this.isTogether(me, partner)) return;
		this.together += dt;
		addDread(me, -TOGETHER.relief * dt);
		addDread(partner, -TOGETHER.relief * dt);
		if (this.elapsed > 8) this.once('together', 'Hal', 'Feel that? Two rings, side by side. The fear just slides off.');
	}

	private nextWave(game: Game) {
		this.spawn(game, WAVES[this.wave++]);
	}

	private startLieutenants(game: Game) {
		this.phase = 'lieutenants';
		const spawned = this.spawn(game, LIEUTENANTS);
		this.arkillo = spawned.find((e) => e.kind === 'arkillo') ?? null;
		this.scarecrow = spawned.find((e) => e.kind === 'scarecrow') ?? null;
		this.comms.scene([
			['Scarecrow', 'Hello again, Lantern. Look what came to find me in Arkham. A ring that runs on fear. Imagine my delight.'],
			['Arkillo', 'Jordan. Kilowog is not here to save you this time.'],
			['John', "Crane with a yellow ring. That's the worst idea anyone's had all year."]
		]);
	}

	private spawn(game: Game, wave: Wave): Enemy[] {
		const out = wave.map(([role, at, dy]) => {
			this.cuts.push({ at, age: 0 });
			const x = BREACHES[at] + (Math.random() - 0.5) * 80;
			const y = BREACH_Y + dy;
			const named = role === 'arkillo' || role === 'scarecrow';
			const e = named ? game.spawnEnemy(role, x, y) : game.spawnEnemy('fearGrunt', x, y, role);
			const stats = role === 'arkillo' ? ARKILLO : role === 'scarecrow' ? SCARECROW : null;
			e.brain.grit = stats ? 1 : GRUNT_TOUGHNESS;
			e.brain.might = stats ? stats.might : GRUNT_MIGHT;
			e.brain.alert = 10;
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * (stats ? stats.health : GRUNT_TOUGHNESS));
			return e;
		});
		this.all.push(...out);
		return out;
	}

	private countDefeats() {
		for (const e of this.all) {
			if (e === this.arkillo || e === this.scarecrow) continue;
			if (!isStanding(e) && !this.counted.has(e)) {
				this.counted.add(e);
				this.defeated++;
			}
		}
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	private countDowns(game: Game) {
		const me = game.players[0];
		if (me.downed && !this.wasDown) {
			this.lives--;
			this.downs++;
			if (this.lives <= 0) this.lose(game);
			else this.comms.say(me.def.id === 'john' ? 'Hal' : 'John', 'Get up! I need you beside me!', true);
		}
		this.wasDown = me.downed;
	}

	private win(game: Game) {
		this.state = 'won';
		this.timer = 0;
		for (const p of game.players) {
			p.victoryTimer = 0.4;
			p.dread = 0;
		}
		this.comms.scene([
			['John', 'Crane went out the way he came in. Arkillo too.'],
			['Hal', 'They knew exactly where to hit. Sinestro is telling them where we are.'],
			['John', 'Then we stop waiting for him. We go to Korugar.']
		]);
	}

	private lose(game: Game) {
		this.state = 'lost';
		this.failReason = 'lantern';
		game.downedNotice = false;
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		return [];
	}

	goal(): { x: number; y: number } | null {
		if (this.state !== 'playing') return null;
		const me = this.gameRef?.players[0];
		const standing = this.all.filter(isStanding);
		if (!me || standing.length === 0) return null;
		return standing.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
	}

	drawables(ctx: CanvasRenderingContext2D, _alpha: number, time: number): Drawable[] {
		const list: Drawable[] = [];
		list.push({
			baseY: -1e9,
			draw: () => {
				drawEarthWindow(ctx, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, time);
				for (const [i, x] of BREACHES.entries()) {
					const cut = this.cuts.filter((c) => c.at === i);
					if (cut.length) drawBreach(ctx, x, WINDOW.y + WINDOW.h - 170, Math.min(...cut.map((c) => c.age)));
				}
			}
		});
		const [me, partner] = this.gameRef?.players ?? [];
		if (me && this.state === 'playing' && this.isTogether(me, partner)) {
			list.push({ baseY: -1e6 + 2, draw: () => drawTether(ctx, me.x, me.y, partner.x, partner.y, time) });
		}
		return list;
	}
}

// ------------------------------------------------------------- drawing helpers

/** A hole cut in the glass: a ragged star, glowing yellow while it's fresh. */
function drawBreach(ctx: CanvasRenderingContext2D, x: number, y: number, age: number) {
	ctx.save();
	const hot = Math.max(0, 1 - age / 3);
	ctx.fillStyle = '#05060c';
	ctx.strokeStyle = hot > 0 ? `rgba(255, 216, 74, ${0.4 + 0.6 * hot})` : '#9fb3c8';
	ctx.shadowColor = '#ffd23a';
	ctx.shadowBlur = 20 * hot;
	ctx.lineWidth = 4;
	ctx.beginPath();
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * Math.PI * 2;
		const r = i % 2 ? 46 : 80 + Math.sin(i * 3.1 + x) * 14;
		ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Cracks running out across the pane
	ctx.shadowBlur = 0;
	ctx.strokeStyle = 'rgba(200, 220, 240, 0.5)';
	ctx.lineWidth = 2;
	for (let i = 0; i < 7; i++) {
		const a = i * 0.9 + x * 0.01;
		ctx.beginPath();
		ctx.moveTo(x + Math.cos(a) * 80, y + Math.sin(a) * 64);
		ctx.lineTo(x + Math.cos(a + 0.2) * 150, y + Math.sin(a + 0.2) * 120);
		ctx.stroke();
	}
	ctx.restore();
}

/** Side by side: a band of green light on the floor joining the two Lanterns. */
function drawTether(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) {
	ctx.save();
	ctx.strokeStyle = `rgba(61, 255, 110, ${0.35 + 0.15 * Math.sin(time * 4)})`;
	ctx.shadowColor = '#3dff6e';
	ctx.shadowBlur = 14;
	ctx.lineWidth = 5;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.restore();
}
