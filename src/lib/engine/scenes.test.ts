import { describe, expect, it } from 'vitest';
import { isEnemy } from './enemies/enemies';
import { ABILITIES, randomKit } from './enemies/redConstructs';
import { Game } from './game';
import type { GameMap } from './map';
import { SceneDirector, type SceneSpec } from './scenes';

const arena = (): GameMap => ({
	name: 'arena',
	environment: 'space',
	width: 2400,
	height: 2400,
	spawn: { x: 1200, y: 1200 },
	battery: { x: 1200, y: 1090 },
	dummies: [],
	obstacles: []
});

const spec: SceneSpec = {
	title: 'Test',
	subtitle: '',
	environment: 'space',
	lanterns: ['hal', 'john'],
	waves: [2, 2],
	toughness: 1,
	might: 1.3,
	tempo: 2,
	intro: 1,
	maxTime: 90,
	heroFloor: 0.2,
	heroRegen: 0
};

describe('random kits', () => {
	it('gives four different constructs', () => {
		for (let i = 0; i < 50; i++) {
			const kit = randomKit('hunter');
			expect(kit).toHaveLength(4);
			expect(new Set(kit).size).toBe(4);
		}
	});

	it('suits the role: gunners lean long-range, berserkers close', () => {
		for (let i = 0; i < 50; i++) {
			expect(randomKit('gunner').filter((id) => ABILITIES[id].band === 'long').length).toBeGreaterThanOrEqual(2);
			expect(randomKit('berserker').filter((id) => ABILITIES[id].band === 'close').length).toBeGreaterThanOrEqual(2);
		}
	});
});

describe('scenes', () => {
	function play(s: SceneSpec, seconds: number) {
		const game = new Game({ players: s.lanterns.map((lantern, i) => ({ lantern, keys: i === 0 ? 'solo' : 'p2', ai: true })), map: arena() });
		game.setView({ width: 1280, height: 720 });
		const director = new SceneDirector(s);
		game.director = director;
		const seen = new Set<unknown>();
		for (let i = 0; i < seconds * 60 && !director.done; i++) {
			game.update(1 / 60);
			for (const d of game.dummies) seen.add(d);
		}
		return { game, director, seen };
	}

	it('waits for its intro, sends every pack with random kits and might, and wraps up with a win', () => {
		const { director, seen } = play(spec, 90);
		const enemies = [...seen].filter((d) => isEnemy(d as never)) as ReturnType<Game['spawnEnemy']>[];
		expect(enemies).toHaveLength(4);
		for (const e of enemies) {
			expect(e.brain.kit).toHaveLength(4);
			expect(e.brain.might).toBe(1.3);
		}
		expect(director.done).toBe(true);
	});

	it('heroes take hits but never drop below the floor', () => {
		const { game } = play({ ...spec, waves: [5], toughness: 3, might: 3 }, 25);
		for (const p of game.players) {
			expect(p.downed).toBe(false);
			expect(p.health).toBeGreaterThanOrEqual(p.maxHealth * spec.heroFloor - 1e-9);
		}
	});
});
