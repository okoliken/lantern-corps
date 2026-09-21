import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import { THE_SIGNAL } from '../../story/scenes';
import { TheSignal } from '../scenes/theSignal';
import { REBUILD_TIME, SIGNAL_TIME, SPIRE, Sleepers, buildDetroitMap } from './sleepers';

function setup() {
	const game = new Game({ players: [{ lantern: 'john', keys: 'solo' }], map: buildDetroitMap() });
	game.setView({ width: 1400, height: 800 });
	const mission = new Sleepers();
	game.director = mission;
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const run = (seconds: number, each: () => void = safe) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	/** Break every Manhunter standing, and smash every core. */
	const sweep = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		for (const d of game.dummies) if (d.kind === 'manhunterCore') d.down = 1;
	};
	/** Keep sweeping until `done`. */
	const until = (done: () => boolean, limit = 120) => {
		for (let t = 0; t < limit && !done(); t += 0.5) {
			sweep();
			run(0.5);
		}
		expect(done()).toBe(true);
	};
	const ids = () => game.players.map((p) => p.def.id);
	return { game, mission, run, safe, sweep, until, ids };
}

describe('Act 2, Mission 5: Sleepers', () => {
	it('John starts alone, and Manhunters come up through the street', () => {
		const { game, mission, run, ids } = setup();
		run(3.1);
		expect(ids()).toEqual(['john']);
		expect(mission.phase).toBe('wake');
		run(2);
		expect(game.enemies.filter((e) => e.kind === 'manhunter').length).toBe(2);
	});

	it('the Flash gets there first', () => {
		const { run, ids } = setup();
		run(3.1 + 9.5);
		expect(ids()).toEqual(['john', 'flash']);
	});

	it('a broken Manhunter rebuilds round its core unless the core is smashed', () => {
		const { game, mission, run } = setup();
		run(5.5);
		const before = game.enemies.length;
		const m = game.enemies[0];
		m.hp = 0;
		m.down = 1;
		run(0.2);
		expect(mission.cores.length).toBe(1);
		run(REBUILD_TIME + 0.5);
		expect(mission.cores.length).toBe(0);
		expect(mission.rebuilds).toBe(1);
		expect(game.enemies.filter(isStanding).length).toBeGreaterThanOrEqual(before);
	});

	it('the League arrives one at a time: Hawkgirl, then Superman on top of them, then Wonder Woman at the spire', () => {
		const { mission, until, ids } = setup();
		until(() => ids().includes('hawkgirl'));
		expect(ids()).not.toContain('superman');
		until(() => ids().includes('superman'));
		expect(mission.phase).toBe('league');
		until(() => mission.phase === 'spire');
		until(() => ids().includes('wonderwoman'));
		expect(ids()).toEqual(['john', 'flash', 'hawkgirl', 'superman', 'wonderwoman']);
	});

	it('the spire rises, sends its signal, pulses, and falls: then every Manhunter drops and the League makes its offer', () => {
		const { game, mission, run, until } = setup();
		until(() => mission.phase === 'spire');
		until(() => mission.spire !== null);
		const spire = mission.spire!;
		expect(Math.hypot(spire.x - SPIRE.x, spire.y - SPIRE.y)).toBeLessThan(1);
		const before = mission.signal;
		run(5);
		expect(mission.signal).toBeGreaterThan(before);
		expect(game.enemies.length).toBeGreaterThan(0);
		// The pulse throws John back if he's standing next to it
		const john = game.players[0];
		let hurt = false;
		run(14, () => {
			john.x = SPIRE.x - 150;
			john.y = SPIRE.y;
			if (john.health < john.maxHealth) hurt = true;
			john.health = Math.max(john.health, 50);
		});
		expect(hurt).toBe(true);
		spire.hp = 0;
		spire.down = 1;
		run(0.2);
		expect(mission.phase).toBe('silence');
		expect(game.enemies.filter(isStanding).length).toBe(0);
		expect(mission.cores.length).toBe(0);
		run(4);
		expect(mission.phase).toBe('offer');
		run(90);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(3);
	});

	it('the signal getting out whole costs a star, but the spire can still be torn down', () => {
		const { mission, run, until } = setup();
		until(() => mission.spire !== null);
		mission.signal = 1 - 1 / SIGNAL_TIME;
		run(1.5);
		expect(mission.sent).toBe(true);
		mission.spire!.hp = 0;
		mission.spire!.down = 1;
		run(100);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(2);
	});

	it('John going down three times loses it', () => {
		const { game, mission, run } = setup();
		run(3.1);
		const john = game.players[0];
		for (let i = 0; i < 3; i++) {
			john.health = 0;
			john.downed = true;
			john.downTimer = 0.3;
			run(0.1, () => {});
			john.downed = false;
			john.health = 100;
			run(0.1);
		}
		expect(mission.state).toBe('lost');
	});

	it('opens with the signal scene', () => {
		const scene = new TheSignal(THE_SIGNAL);
		expect(THE_SIGNAL.some((l) => l.who === 'jonn')).toBe(true);
		expect(scene.done).toBe(false);
	});
});
