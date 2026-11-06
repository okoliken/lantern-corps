import { describe, expect, it } from 'vitest';
import { hitDummy, isStanding } from '../dummy';
import { Game } from '../game';
import { BLAZE, FireSeason, buildFireSeasonMap } from './fireSeason';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'jonn', keys: 'p2', ai: true }
		],
		map: buildFireSeasonMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new FireSeason();
	game.director = mission;
	const [john, jonn] = game.players;
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	return { game, mission, john, jonn, run, safe };
}

describe("Season 2: Fire Season", () => {
	it("John and J'onn; four groups trapped up the towers; Firefly overhead; the city already burning", () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'jonn']);
		run(3.1, safe);
		expect(mission.trapped.length).toBe(4);
		expect(mission.firefly?.kind).toBe('firefly');
		expect(mission.blazes.length).toBeGreaterThan(0);
	});

	it('fires grow, and constructs put them out', () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		const b = mission.blazes[0];
		const s0 = b.size;
		run(3, safe);
		expect(b.size).toBeGreaterThan(s0);
		hitDummy(b.dummy, BLAZE.hp, 0, b.dummy.x, b.dummy.y - 100);
		run(0.1, safe);
		expect(mission.blazes.includes(b)).toBe(false);
		expect(mission.put).toBe(1);
	});

	it("a big fire spreads", () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		const n = mission.blazes.length;
		for (const b of mission.blazes) {
			b.size = 1;
			b.dummy.hp = BLAZE.hp;
			b.spreadIn = 0;
		}
		run(0.2, safe);
		expect(mission.blazes.length).toBeGreaterThan(n);
	});

	it("J'onn freezes near fire: no powers, no moving, until it's out", () => {
		const { game, mission, jonn, run, safe } = setup();
		run(3.1, safe);
		mission.light(game, jonn.x + 80, jonn.y, 0.6);
		run(0.5, safe);
		expect(jonn.hero!.afraid).toBeGreaterThan(0);
		const at = { x: jonn.x, y: jonn.y };
		run(1, safe);
		expect(Math.hypot(jonn.x - at.x, jonn.y - at.y)).toBeLessThan(5);
		for (const b of mission.blazes) {
			b.dummy.hp = 0;
			b.dummy.down = 1;
		}
		run(1, safe);
		expect(jonn.hero!.afraid).toBe(0);
	});

	it("with the fires kept down, J'onn brings people out to the ambulance", () => {
		const { game, mission, run, safe } = setup();
		run(3.1, safe);
		const clear = () => {
			safe();
			for (const b of mission.blazes) {
				b.dummy.hp = 0;
				b.dummy.down = 1;
			}
			const f = mission.firefly;
			if (f && isStanding(f)) f.stun = 1;
		};
		for (let s = 0; s < 120 && mission.out === 0; s++) run(1, clear);
		expect(mission.out).toBeGreaterThan(0);
		expect(game.players[1].hero!.errand).not.toBe(null);
	});

	it('Firefly beaten and everyone out: won', () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		for (const t of mission.trapped) t.state = 'out';
		const f = mission.firefly!;
		f.hp = 0;
		f.down = 1;
		run(0.2, safe);
		expect(mission.state).toBe('won');
	});
});
