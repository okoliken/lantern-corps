// Red Lantern Ambush: one Lantern against a pack of five Red Lanterns.
//
// A short, complete fight to play (the first real "scene" before missions):
//   intro     a moment to get ready, "They're coming..."
//   fighting  five Red Lanterns fly in one after another from all around
//   won       every one of them is down: victory pose
//   lost      the Lantern went down more times than they had lives
//
// The Red Lanterns fight with everything they've got: squads (three attack,
// two wait in reserve), random construct kits, walls, shields and turrets.

import { isStanding } from './dummy';
import type { Enemy, Role } from './enemies/enemies';
import { randomKit } from './enemies/redConstructs';
import type { Game } from './game';
import { boxOverlap } from './physics';

export type SkirmishState = 'intro' | 'fighting' | 'won' | 'lost';

/** Two Brutes, a Stalker and two Spitters. */
export const AMBUSH_PACK: Role[] = ['berserker', 'hunter', 'gunner', 'berserker', 'gunner'];
export const AMBUSH_LIVES = 3;
/** Seconds of "get ready" before they arrive. */
const INTRO_TIME = 3;
/** They arrive one after another, this far apart. */
const ARRIVAL_GAP = 0.45;
/** How far from the Lantern they fly in from. */
const ARRIVE_DISTANCE = 520;
/** Health (and stagger resistance) and damage multipliers: a real fight, not a warm-up. */
const TOUGHNESS = 3;
const MIGHT = 1.25;

export class Skirmish {
	state: SkirmishState = 'intro';
	/** Seconds left of the intro countdown. */
	timer = INTRO_TIME;
	lives = AMBUSH_LIVES;
	elapsed = 0;
	/** The five, once they've arrived. */
	readonly pack: Enemy[] = [];
	private arrivals: { at: number; x: number; y: number; role: Role }[] = [];
	private wasDown: boolean[] = [];

	constructor(readonly roles: Role[] = AMBUSH_PACK) {}

	/** Red Lanterns still to beat (arrived and standing, or on their way). */
	get left(): number {
		if (this.state === 'intro') return this.total;
		return this.pack.filter(isStanding).length + this.arrivals.length;
	}

	get total(): number {
		return this.roles.length;
	}

	update(game: Game, dt: number) {
		this.elapsed += dt;

		// Arrivals on their way in
		this.arrivals = this.arrivals.filter((a) => {
			if (this.elapsed < a.at) return true;
			this.spawn(game, a.x, a.y, a.role);
			return false;
		});

		// Going down costs a life; the last one ends it (and they stay down)
		game.players.forEach((p, i) => {
			if (p.downed && !this.wasDown[i] && this.state === 'fighting') {
				this.lives--;
				if (this.lives <= 0) {
					this.state = 'lost';
					game.downedNotice = false; // no getting back up this time
				}
			}
			this.wasDown[i] = p.downed;
			if (this.state === 'lost' && p.downed) p.downTimer = Math.max(p.downTimer, 1);
		});

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) this.sendPack(game);
				break;
			case 'fighting':
				if (this.arrivals.length === 0 && this.pack.length === this.total && this.left === 0) this.win(game);
				break;
			case 'won':
				for (const p of game.players) p.victoryTimer = 0.4;
				break;
		}
	}

	private win(game: Game) {
		this.state = 'won';
		// Whatever they built burns out with them
		for (const d of game.enemies) {
			if (d.kind === 'rageTurret') {
				d.hp = 0;
				d.down = 0.5;
			}
		}
		const p = game.players[0];
		game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 2.5, text: 'VICTORY!', owner: p });
	}

	/** Spots all around the Lantern, clear of anything tall; they fly in one by one. */
	private sendPack(game: Game) {
		this.state = 'fighting';
		const p = game.players[0];
		const start = Math.random() * Math.PI * 2;
		const n = this.roles.length;
		this.roles.forEach((role, i) => {
			let x = p.x;
			let y = p.y;
			for (let attempt = 0; attempt < 12; attempt++) {
				const angle = start + ((i + attempt * 0.37) * Math.PI * 2) / n;
				x = Math.min(Math.max(p.x + Math.cos(angle) * ARRIVE_DISTANCE, 60), game.map.width - 60);
				y = Math.min(Math.max(p.y + Math.sin(angle) * ARRIVE_DISTANCE * 0.8, 80), game.map.height - 60);
				if (!game.map.obstacles.some((o) => boxOverlap(x, y, 24, 14, o))) break;
			}
			this.arrivals.push({ at: this.elapsed + i * ARRIVAL_GAP, x, y, role });
		});
		game.constructs.effects.push({ kind: 'callout', x: p.x, y: p.y - 60, age: 0, life: 2, text: 'RED LANTERNS!', hurt: true });
	}

	private spawn(game: Game, x: number, y: number, role: Role) {
		const e = game.spawnEnemy('rageGrunt', x, y, role);
		e.brain.kit = randomKit(role);
		e.brain.grit = TOUGHNESS;
		e.brain.might = MIGHT;
		e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * TOUGHNESS);
		// They know exactly where the Lantern is: this is an ambush
		e.brain.alert = 5;
		this.pack.push(e);
	}
}
