// Sparring on Oa's training grounds, like Hal's first days in the movie:
// Kilowog and Sinestro at once, for real. Kilowog brawls with hammers;
// Sinestro is faster, stronger and colder, all blades and precision.
// They talk while they fight, and yield when beaten. First one down loses.

import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import type { Game } from '../game';
import type { GameMap } from '../map';

export type SparState = 'intro' | 'fighting' | 'won' | 'lost';
export type Sparrer = 'kilowog' | 'sinestro';

const INTRO_TIME = 2.5;
/** Sinestro steps in a moment after Kilowog. */
const SINESTRO_DELAY = 1.2;
/** How hard they hit (1 = a Rage Grunt). Sinestro is the fiercer of the two. */
const MIGHT: Record<Sparrer, number> = { kilowog: 0.9, sinestro: 1.15 };

export class Sparring {
	state: SparState = 'intro';
	timer = INTRO_TIME;
	readonly foes: Partial<Record<Sparrer, Enemy>> = {};
	/** Seconds the fight took. */
	elapsed = 0;
	private said = new Set<string>();

	constructor(private readonly map: GameMap) {}

	/** 0..1 of a sparring partner's health left. */
	health(who: Sparrer): number {
		const e = this.foes[who];
		return e ? Math.max(0, e.hp / e.maxHp) : 1;
	}

	update(game: Game, dt: number) {
		const p = game.players[0];
		const { x, y } = this.map.spawn;
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.spawn(game, 'kilowog', x + 340, y);
					this.state = 'fighting';
					this.say(game, 'kilowog', 'start', 'SHOW ME WHAT YOU GOT, POOZER!');
				}
				break;
			case 'fighting': {
				this.elapsed += dt;
				if (!this.foes.sinestro && this.elapsed >= SINESTRO_DELAY) {
					this.spawn(game, 'sinestro', x - 340, y + 40);
					this.say(game, 'sinestro', 'start', 'LET US SEE IF THE RING CHOSE WELL.');
				}
				if (this.health('kilowog') < 0.5) this.say(game, 'kilowog', 'half', 'NOT BAD! NOW I GET SERIOUS!');
				if (this.health('sinestro') < 0.5) this.say(game, 'sinestro', 'half', 'ENOUGH GAMES.');
				if (p.health < p.maxHealth * 0.3) this.say(game, 'sinestro', 'hurt', 'FEAR IS WHAT MAKES YOU FALL, HUMAN.');
				const k = this.foes.kilowog;
				const s = this.foes.sinestro;
				if (k && !isStanding(k)) this.say(game, 'kilowog', 'down', 'OOF! ALRIGHT, YOU PASS!');
				if (s && !isStanding(s)) this.say(game, 'sinestro', 'down', '...IMPRESSIVE.');
				if (k && s && !isStanding(k) && !isStanding(s)) {
					this.state = 'won';
					for (const pl of game.players) pl.victoryTimer = 0.4;
				} else if (p.downed) {
					this.state = 'lost';
					game.downedNotice = false;
					this.say(game, 'kilowog', 'lost', 'GET UP, POOZER! AGAIN!');
				}
				break;
			}
		}
		// Lost: stay down (no getting back up at the Lantern)
		if (this.state === 'lost') for (const pl of game.players) if (pl.downed) pl.downTimer = Math.max(pl.downTimer, 1);
	}

	private spawn(game: Game, who: Sparrer, x: number, y: number) {
		const e = game.spawnEnemy(who, x, y);
		e.brain.might = MIGHT[who];
		this.foes[who] = e;
	}

	/** A shout from one of them, once per moment. */
	private say(game: Game, who: Sparrer, id: string, text: string) {
		const key = `${who}:${id}`;
		if (this.said.has(key)) return;
		this.said.add(key);
		const e = this.foes[who];
		const x = e?.x ?? this.map.spawn.x;
		const y = e?.y ?? this.map.spawn.y;
		game.constructs.effects.push({ kind: 'callout', x, y: y - (who === 'kilowog' ? 175 : 140), age: 0, life: 2.4, text });
	}
}
