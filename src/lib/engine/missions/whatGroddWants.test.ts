import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { buildCentralCityMap } from './callToArms';
import { AMP_HEAL, GRIP, WhatGroddWants } from './whatGroddWants';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'flash', keys: 'p2', ai: true },
			{ lantern: 'hawkgirl', keys: 'p2', ai: true }
		],
		map: buildCentralCityMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new WhatGroddWants();
	game.director = mission;
	const john = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (john.invuln = 1);
	const clearGorillas = () => {
		for (const e of game.enemies) {
			if (e.kind === 'grodd') continue;
			e.hp = 0;
			e.down = 1;
		}
		run(0.2, safe);
	};
	return { game, mission, john, run, safe, clearGorillas };
}

describe('Season 2: What Grodd Wants', () => {
	it('two street waves, then Grodd with three amplifiers', () => {
		const { mission, run, safe, clearGorillas } = setup();
		run(3.1, safe);
		clearGorillas();
		clearGorillas();
		expect(mission.phase).toBe('amplifiers');
		expect(mission.amps.length).toBe(3);
		expect(mission.grodd?.kind).toBe('grodd');
	});

	it('the amplifiers heal Grodd, and his Mind Grip locks constructs for a while', () => {
		const { mission, john, run, safe, clearGorillas } = setup();
		run(3.1, safe);
		clearGorillas();
		clearGorillas();
		const g = mission.grodd!;
		g.hp = g.maxHp * 0.5;
		g.stun = 99;
		const before = g.hp;
		run(1, safe);
		expect(g.hp).toBeGreaterThan(before + AMP_HEAL * 2);
		run(GRIP.every, safe);
		expect(john.locked.size).toBeGreaterThan(0);
		run(GRIP.time + 0.5, safe);
		// The first grip has let go (a second may have started)
		expect(mission.grips).toBeGreaterThanOrEqual(1);
	});

	it('break the amplifiers, beat Grodd, won; nothing stays locked', () => {
		const { mission, john, run, safe, clearGorillas } = setup();
		run(3.1, safe);
		clearGorillas();
		clearGorillas();
		for (const a of mission.amps) {
			a.hp = 0;
			a.down = 1;
		}
		run(0.2, safe);
		expect(mission.phase).toBe('grodd');
		const g = mission.grodd!;
		g.hp = 0;
		g.down = 1;
		run(0.2, safe);
		expect(mission.state).toBe('won');
		expect(john.locked.size).toBe(0);
	});
});
