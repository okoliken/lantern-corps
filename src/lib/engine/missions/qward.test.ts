import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { COLLAPSE_TIME, PORTAL, QWARD_REGEN, QwardMission, buildQwardMap } from './qward';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map: buildQwardMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new QwardMission();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (hal.invuln = 1);
	const at = (x: number, y: number) => run(0.2, () => {
		hal.x = x;
		hal.y = y;
		safe();
	});
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		run(0.2, safe);
	};
	return { game, mission, hal, run, safe, at, clear };
}

/** Through both flats to the forge. */
function toForge(s: ReturnType<typeof setup>) {
	s.run(3.1, s.safe);
	for (const f of s.mission.flats) {
		s.at(f.x - 200, f.y);
		s.clear();
	}
}

describe('Season 2: Qward', () => {
	it('willpower comes back slowly in the anti-matter universe', () => {
		const { game, run, safe } = setup();
		const before = game.players[0].regenMultiplier;
		run(3.1, safe);
		expect(game.players[0].regenMultiplier).toBeCloseTo(before * QWARD_REGEN);
	});

	it('the flats, then the forge with four conduits; breaking them sets off the collapse and the ring flies', () => {
		const s = setup();
		toForge(s);
		expect(s.mission.phase).toBe('forge');
		expect(s.mission.conduits.length).toBe(4);
		for (const c of s.mission.conduits) {
			c.hp = 0;
			c.down = 1;
		}
		s.run(0.2, s.safe);
		expect(s.mission.phase).toBe('collapse');
		expect(s.mission.ring).not.toBeNull();
	});

	it('through the portal in time is a win; too late is a loss', () => {
		const win = setup();
		toForge(win);
		for (const c of win.mission.conduits) {
			c.hp = 0;
			c.down = 1;
		}
		win.run(0.2, win.safe);
		win.at(PORTAL.x, PORTAL.y);
		expect(win.mission.state).toBe('won');

		const late = setup();
		toForge(late);
		for (const c of late.mission.conduits) {
			c.hp = 0;
			c.down = 1;
		}
		late.run(0.2, late.safe);
		late.run(COLLAPSE_TIME + 1, () => {
			late.safe();
			late.hal.x = 3000;
			late.hal.y = 1000;
		});
		expect(late.mission.state).toBe('lost');
		expect(late.mission.failReason).toBe('portal');
	});
});
