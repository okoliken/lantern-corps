// Waves of enemies for the demo: a countdown, a pack arrives around the
// Lanterns, and when it's beaten the next, bigger one comes.

import type { Role } from './enemies/enemies';
import type { Game } from './game';
import { boxOverlap } from './physics';

/** Each wave's pack, by role. After the last, it keeps sending the last one. */
export const DEMO_WAVES: Role[][] = [
	['berserker', 'gunner'],
	['hunter', 'berserker', 'gunner'],
	['berserker', 'hunter', 'gunner', 'gunner'],
	['berserker', 'berserker', 'hunter', 'gunner']
];

/** Seconds between waves. */
export const WAVE_BREAK = 4;
/** How far from the Lanterns a pack arrives. */
const ARRIVE_DISTANCE = 460;

export type WaveState = 'countdown' | 'fighting';

export class Waves {
	/** The wave being fought, or about to start (1-based). */
	wave = 1;
	state: WaveState = 'countdown';
	/** Seconds left in the countdown. */
	timer = 3;
	/** Packs beaten so far. */
	cleared = 0;

	constructor(private waves: Role[][] = DEMO_WAVES) {}

	update(game: Game, dt: number) {
		if (this.state === 'countdown') {
			this.timer -= dt;
			if (this.timer <= 0) {
				this.spawn(game);
				this.state = 'fighting';
			}
			return;
		}
		// Wait until the last one has finished falling, not just its health bar
		const left = game.dummies.some((d) => d.kind !== 'dummy');
		if (!left) {
			this.cleared++;
			this.wave++;
			this.state = 'countdown';
			this.timer = WAVE_BREAK;
		}
	}

	get pack(): Role[] {
		return this.waves[Math.min(this.wave, this.waves.length) - 1];
	}

	/** Arrive spread around the Lanterns, out of anything that blocks flyers. */
	private spawn(game: Game) {
		const players = game.players;
		const cx = players.reduce((sum, p) => sum + p.x, 0) / players.length;
		const cy = players.reduce((sum, p) => sum + p.y, 0) / players.length;
		const roles = this.pack;
		const start = Math.random() * Math.PI * 2;
		const margin = 60;
		roles.forEach((role, i) => {
			let x = cx;
			let y = cy;
			for (let attempt = 0; attempt < 12; attempt++) {
				const angle = start + ((i + attempt * 0.37) * Math.PI * 2) / roles.length;
				x = Math.min(Math.max(cx + Math.cos(angle) * ARRIVE_DISTANCE, margin), game.map.width - margin);
				y = Math.min(Math.max(cy + Math.sin(angle) * ARRIVE_DISTANCE, margin), game.map.height - margin);
				if (!game.map.obstacles.some((o) => o.blocksFlying && boxOverlap(x, y, 20, 12, o))) break;
			}
			game.spawnEnemy('rageGrunt', x, y, role);
		});
	}
}
