// Scenes: short scripted fights, played back to back like a trailer.
//
// Each scene sets the stage (planet or space, which Lanterns, how many Red
// Lanterns and how strong), shows its title while the Lanterns get ready,
// sends in the packs, and holds a short victory beat at the end. The page
// playing them builds a new Game for each scene and moves on when `done`.

import { ROLE_LIST } from './enemies/enemies';
import { randomKit } from './enemies/redConstructs';
import type { EnvironmentKind } from './environment';
import type { Game } from './game';
import type { LanternId } from './lanterns';
import { boxOverlap } from './physics';

export interface SceneSpec {
	title: string;
	subtitle: string;
	environment: EnvironmentKind;
	/** All AI-controlled. */
	lanterns: LanternId[];
	/** Pack sizes, one after another. */
	waves: number[];
	/** Red Lantern health (and stagger resistance) multiplier. */
	toughness: number;
	/** Red Lantern damage multiplier. */
	might: number;
	/** How eagerly Red Lanterns use constructs (1 normal; see ConstructWorld.redTempo). */
	tempo: number;
	/** Seconds the title shows before the first pack arrives. */
	intro: number;
	/** The scene wraps up after this long even if the fight isn't over. */
	maxTime: number;
	/** Fraction of health the heroes can't drop below (they take hits, but stay up for the camera). */
	heroFloor: number;
	/** Health per second the heroes win back while not being hit. */
	heroRegen: number;
}

export const TRAILER: SceneSpec[] = [
	{
		title: 'Coast City',
		subtitle: 'Hal Jordan vs. five Red Lanterns',
		environment: 'planet',
		lanterns: ['hal'],
		waves: [5],
		toughness: 4.5,
		might: 1.2,
		tempo: 2.3,
		// Long enough for the game's title card, then the scene's
		intro: 5,
		maxTime: 55,
		heroFloor: 0.15,
		heroRegen: 4
	},
	{
		title: 'Sector 2814',
		subtitle: 'Hal Jordan & John Stewart',
		environment: 'space',
		lanterns: ['hal', 'john'],
		waves: [4, 5],
		toughness: 5,
		might: 1.2,
		tempo: 2.3,
		intro: 3,
		maxTime: 65,
		heroFloor: 0.15,
		heroRegen: 4
	}
];

/** Seconds between packs, and of the victory beat at the end. */
const WAVE_BREAK = 1.5;
const OUTRO = 3;
/** Pack members arrive one after another, this far apart. */
const ARRIVAL_GAP = 0.3;
const ARRIVE_DISTANCE = 430;

export type ScenePhase = 'intro' | 'fighting' | 'break' | 'outro';

export class SceneDirector {
	phase: ScenePhase = 'intro';
	elapsed = 0;
	wave = 0;
	done = false;
	/** Seconds left in the current intro, break or outro. */
	timer: number;
	private arrivals: { at: number; x: number; y: number }[] = [];

	constructor(readonly spec: SceneSpec) {
		this.timer = spec.intro;
	}

	update(game: Game, dt: number) {
		this.elapsed += dt;
		for (const p of game.players) {
			p.minHealth = p.maxHealth * this.spec.heroFloor;
			if (p.invuln === 0 && !p.downed) p.health = Math.min(p.maxHealth, p.health + this.spec.heroRegen * dt);
		}
		game.constructs.redTempo = this.spec.tempo;

		// Pack members still on their way in
		this.arrivals = this.arrivals.filter((a) => {
			if (this.elapsed < a.at) return true;
			this.spawnOne(game, a.x, a.y);
			return false;
		});

		if (this.phase !== 'outro' && this.elapsed >= this.spec.maxTime) this.startOutro();

		switch (this.phase) {
			case 'intro':
			case 'break':
				this.timer -= dt;
				if (this.timer <= 0) this.sendPack(game);
				break;
			case 'fighting': {
				const left = this.arrivals.length > 0 || game.dummies.some((d) => d.kind !== 'dummy');
				if (left) break;
				this.wave++;
				if (this.wave < this.spec.waves.length) {
					this.phase = 'break';
					this.timer = WAVE_BREAK;
				} else {
					this.startOutro();
				}
				break;
			}
			case 'outro':
				for (const p of game.players) p.victoryTimer = 0.4;
				this.timer -= dt;
				if (this.timer <= 0) this.done = true;
				break;
		}
	}

	private startOutro() {
		this.phase = 'outro';
		this.timer = OUTRO;
	}

	/** Pick spots around the Lanterns (clear of anything tall), and bring the pack in one by one. */
	private sendPack(game: Game) {
		this.phase = 'fighting';
		const size = this.spec.waves[this.wave];
		const players = game.players;
		const cx = players.reduce((sum, p) => sum + p.x, 0) / players.length;
		const cy = players.reduce((sum, p) => sum + p.y, 0) / players.length;
		const start = Math.random() * Math.PI * 2;
		for (let i = 0; i < size; i++) {
			let x = cx;
			let y = cy;
			for (let attempt = 0; attempt < 12; attempt++) {
				const angle = start + ((i + attempt * 0.37) * Math.PI * 2) / size;
				x = Math.min(Math.max(cx + Math.cos(angle) * ARRIVE_DISTANCE, 60), game.map.width - 60);
				y = Math.min(Math.max(cy + Math.sin(angle) * ARRIVE_DISTANCE, 60), game.map.height - 60);
				if (!game.map.obstacles.some((o) => o.blocksFlying && boxOverlap(x, y, 20, 12, o))) break;
			}
			this.arrivals.push({ at: this.elapsed + i * ARRIVAL_GAP, x, y });
		}
	}

	private spawnOne(game: Game, x: number, y: number) {
		const role = ROLE_LIST[Math.floor(Math.random() * ROLE_LIST.length)];
		const e = game.spawnEnemy('rageGrunt', x, y, role);
		const b = e.brain;
		b.kit = randomKit(role);
		b.might = this.spec.might;
		b.grit = this.spec.toughness;
		e.hp = e.maxHp = b.lastHp = Math.round(e.maxHp * this.spec.toughness);
	}
}
