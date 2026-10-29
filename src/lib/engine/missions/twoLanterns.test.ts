import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { TOGETHER, TwoLanterns, buildTwoLanternsMap } from './twoLanterns';

function setup(me: 'john' | 'hal' = 'john') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true }
		],
		map: buildTwoLanternsMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new TwoLanterns();
	game.director = mission;
	const [a, b] = game.players;
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		a.invuln = 1;
		b.invuln = 1;
	};
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
	};
	return { game, mission, a, b, run, safe, clear };
}

describe('Season 2: Two Lanterns', () => {
	it('either Lantern can lead; the first wave cuts in through the glass', () => {
		const { game, mission, run, safe } = setup('hal');
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'john']);
		run(3.1, safe);
		expect(mission.wave).toBe(1);
		expect(game.enemies.length).toBe(5);
		expect(game.enemies.every((e) => e.kind === 'fearGrunt')).toBe(true);
	});

	it('side by side, dread drains; apart, it does not', () => {
		const { mission, a, b, run, safe } = setup();
		run(3.1, safe);
		a.dread = b.dread = 0.8;
		run(1, () => {
			safe();
			a.x = 600;
			b.x = 600 + TOGETHER.range + 300;
			// Out of the grunts' reach
			a.y = b.y = 1450;
		});
		const apart = a.dread;
		run(1, () => {
			safe();
			a.x = 600;
			b.x = 700;
			a.y = b.y = 1450;
		});
		expect(a.dread).toBeLessThan(apart - 0.12);
		expect(mission.together).toBeGreaterThan(0.9);
	});

	it('three waves, then Arkillo and Scarecrow; both down and it is won', () => {
		const { mission, run, safe, clear } = setup();
		run(3.1, safe);
		for (let i = 0; i < 3; i++) {
			clear();
			run(0.2, safe);
		}
		expect(mission.phase).toBe('lieutenants');
		expect(mission.arkillo?.kind).toBe('arkillo');
		expect(mission.scarecrow?.kind).toBe('scarecrow');
		clear();
		run(0.2, safe);
		expect(mission.state).toBe('won');
	});
});
