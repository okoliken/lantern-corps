import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { hitDummyWithFx } from '../constructs/system';
import { DRAW_AT, MIRROR, SinestroFinale, buildFinaleSinestroMap } from './sinestroFinale';

function setup(me: 'hal' | 'john' = 'hal') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map: buildFinaleSinestroMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new SinestroFinale();
	game.director = mission;
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const clear = () => {
		for (const e of game.enemies) {
			if (e === mission.sinestro) continue;
			e.hp = 0;
			e.down = 1;
		}
	};
	const toSinestro = () => {
		run(3.1, safe);
		for (let i = 0; i < 2; i++) {
			clear();
			run(0.2, safe);
		}
		clear();
		run(0.2, safe);
	};
	return { game, mission, run, safe, clear, toSinestro };
}

describe('Season 2: Sinestro', () => {
	it('three of them go up: you, the other Lantern, and Kilowog', () => {
		const { game, mission, run, safe } = setup('john');
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'hal', 'kilowog']);
		run(3.1, safe);
		expect(mission.phase).toBe('citadel');
		expect(game.enemies.length).toBe(6);
	});

	it('the mirror: hits during it do not land, and come back at whoever threw them', () => {
		const { game, mission, run, safe, toSinestro } = setup();
		toSinestro();
		expect(mission.phase).toBe('sinestro');
		const s = mission.sinestro!;
		// His first mirror comes a little sooner than the rest
		run(MIRROR.every * 0.6 + MIRROR.tell + 0.5, safe);
		expect(mission.mirror).not.toBeNull();
		expect(s.mirror).toBe(MIRROR.share);
		const me = game.players[0];
		me.invuln = 0;
		const before = s.hp;
		const health = me.health;
		hitDummyWithFx(game.constructs, s, 40, 0, me.x, me.y, me);
		expect(s.hp).toBe(before);
		expect(me.health).toBeLessThan(health);
		expect(me.reflected).toBeGreaterThan(0);
	});

	it('at half health he draws on the lantern; the lenses keep him up until they are broken; then beat him', () => {
		const { mission, run, safe, toSinestro } = setup();
		toSinestro();
		const s = mission.sinestro!;
		s.hp = s.maxHp * DRAW_AT - 1;
		run(0.1, safe);
		expect(mission.phase).toBe('lantern');
		expect(mission.lenses.length).toBe(3);
		s.hp = 0;
		s.down = 1;
		run(0.2, safe);
		expect(s.hp).toBeGreaterThan(0);
		for (const l of mission.lenses) {
			l.hp = 0;
			l.down = 1;
		}
		run(0.2, safe);
		expect(mission.phase).toBe('final');
		s.hp = 0;
		s.down = 1;
		run(0.2, safe);
		expect(mission.state).toBe('won');
	});
});
