import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { OUTPOST_LIVES, SilentOutpost, buildOutpostMap } from './silentOutpost';

function setup() {
	const map = buildOutpostMap();
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new SilentOutpost();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const moveHal = (x: number, y: number) => {
		hal.x = x;
		hal.y = y;
		game.players[1].x = x - 60;
		game.players[1].y = y;
	};
	/** Knock out every Red Lantern standing. */
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		run(0.1);
	};
	return { game, mission, hal, run, moveHal, clear };
}

describe('Mission 2: Silent Outpost', () => {
	it('Kilowog fights beside Hal', () => {
		const { game } = setup();
		expect(game.players[1].def.id).toBe('kilowog');
	});

	it('plays out: search, ambush, rescue the crew, the ring leaves, hold the tower, the message, win', () => {
		const { game, mission, hal, run, moveHal, clear } = setup();
		const safe = () => (hal.invuln = 1);
		run(3.1);
		expect(mission.state).toBe('playing');
		expect(mission.phase).toBe('search');

		moveHal(1250, 900);
		run(0.1, safe);
		expect(mission.phase).toBe('ambush');
		expect(game.enemies.length).toBeGreaterThan(0);
		clear();
		expect(mission.phase).toBe('survivors');
		// The station's own Lantern comes back on
		expect(game.batteries.length).toBe(2);

		for (const s of mission.survivors) {
			moveHal(s.x + 30, s.y);
			run(0.1, safe);
			clear();
		}
		expect(mission.found).toBe(3);
		run(0.1, safe);
		expect(mission.phase).toBe('tower');

		moveHal(3200, 940);
		run(0.1, safe);
		expect(mission.phase).toBe('ring');
		run(25, safe);
		expect(mission.phase).toBe('hold');
		clear();
		expect(mission.phase).toBe('message');
		run(32, safe);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBeGreaterThanOrEqual(2);
		expect(mission.defeated).toBeGreaterThanOrEqual(10);
	});

	it(`Hal going down ${OUTPOST_LIVES} times loses; Kilowog going down doesn't`, () => {
		const { game, mission, hal, run } = setup();
		run(3.1);
		const kilowog = game.players[1];
		kilowog.health = 0;
		kilowog.downed = true;
		kilowog.downTimer = 0.5;
		run(1);
		expect(mission.lives).toBe(OUTPOST_LIVES);
		for (let i = 0; i < OUTPOST_LIVES; i++) {
			hal.health = 0;
			hal.downed = true;
			hal.downTimer = 0.1;
			run(4);
		}
		expect(mission.state).toBe('lost');
	});
});
