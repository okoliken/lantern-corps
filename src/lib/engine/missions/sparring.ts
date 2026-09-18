// Sparring with Kilowog on Oa's training grounds: one on one, for real.
// He fights like a Lantern (axe, hammer, leaping slam, charge, cannon, all in
// Corps green), talks while he does it, and yields when you beat him.
// First one down loses; no lives, just "again?".

import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import type { Game } from '../game';
import type { GameMap } from '../map';

export type SparState = 'intro' | 'fighting' | 'won' | 'lost';

const INTRO_TIME = 2.5;
/** He hits harder than a Rage Grunt: he's the one who trained them all to take a punch. */
const KILOWOG_MIGHT = 1.5;

export class Sparring {
	state: SparState = 'intro';
	timer = INTRO_TIME;
	kilowog: Enemy | null = null;
	/** Seconds the fight took. */
	elapsed = 0;
	private said = new Set<string>();

	constructor(private readonly map: GameMap) {}

	/** 0..1 of Kilowog's health left. */
	get kilowogHealth(): number {
		const k = this.kilowog;
		return k ? Math.max(0, k.hp / k.maxHp) : 1;
	}

	update(game: Game, dt: number) {
		const p = game.players[0];
		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					const { x, y } = this.map.spawn;
					this.kilowog = game.spawnEnemy('kilowog', x + 340, y);
					this.kilowog.brain.might = KILOWOG_MIGHT;
					this.state = 'fighting';
					this.say(game, 'start', 'SHOW ME WHAT YOU GOT, POOZER!');
				}
				break;
			case 'fighting': {
				this.elapsed += dt;
				const k = this.kilowog!;
				if (this.kilowogHealth < 0.5) this.say(game, 'half', 'NOT BAD! NOW I GET SERIOUS!');
				if (p.health < p.maxHealth * 0.3) this.say(game, 'hurt', 'KEEP YOUR GUARD UP!');
				if (!isStanding(k)) {
					this.state = 'won';
					for (const pl of game.players) pl.victoryTimer = 0.4;
					this.say(game, 'won', 'ALRIGHT, ALRIGHT! YOU PASS!');
				} else if (p.downed) {
					this.state = 'lost';
					game.downedNotice = false;
					this.say(game, 'lost', 'GET UP, POOZER! AGAIN!');
				}
				break;
			}
		}
		// Lost: stay down (no getting back up at the Lantern)
		if (this.state === 'lost') for (const pl of game.players) if (pl.downed) pl.downTimer = Math.max(pl.downTimer, 1);
	}

	/** Kilowog shouts, once per moment. */
	private say(game: Game, id: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		const k = this.kilowog;
		const x = k?.x ?? this.map.spawn.x + 340;
		const y = k?.y ?? this.map.spawn.y;
		game.constructs.effects.push({ kind: 'callout', x, y: y - 170, age: 0, life: 2.4, text });
	}
}
