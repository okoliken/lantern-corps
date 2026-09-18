// Waves of enemies for the demo: a countdown, a pack arrives around the
// Lanterns, and when it's beaten the next, bigger one comes.

import { ENEMIES, ROLES, type EnemyKind, type Role } from './enemies/enemies';
import { randomKit } from './enemies/redConstructs';
import type { Game } from './game';
import { boxOverlap } from './physics';

/** One member of a wave: a Rage Grunt role, or another kind of enemy. */
export type WaveMember = Role | Exclude<EnemyKind, 'rageGrunt'>;

/** Each wave's pack. After the last, it keeps sending the last one. */
export const DEMO_WAVES: WaveMember[][] = [
	['berserker', 'gunner'],
	['hunter', 'berserker', 'manhunterDrone'],
	['berserker', 'gunner', 'redFighter', 'manhunterDrone'],
	['berserker', 'hunter', 'gunner', 'manhunterDrone', 'redFighter']
];

export const isRole = (m: WaveMember): m is Role => m in ROLES;

/** What to call a wave member in the demo's overlay. */
export function memberName(m: WaveMember): string {
	return isRole(m) ? ROLES[m].name : ENEMIES[m].name;
}

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

	/** Health and stagger-resistance multiplier (the demo makes them tougher so fights last). */
	toughness = 1;
	/** Seconds between waves. */
	breakTime = WAVE_BREAK;

	constructor(private waves: WaveMember[][] = DEMO_WAVES) {}

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
			this.timer = this.breakTime;
		}
	}

	get pack(): WaveMember[] {
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
			const e = isRole(role) ? game.spawnEnemy('rageGrunt', x, y, role) : game.spawnEnemy(role, x, y);
			e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * this.toughness);
			e.brain.grit = this.toughness;
			if (isRole(role)) e.brain.kit = randomKit(role);
		});
	}
}
