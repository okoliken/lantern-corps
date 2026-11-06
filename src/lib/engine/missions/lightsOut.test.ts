import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import { LightsOut, RING_LIGHT, buildLightsOutMap } from './lightsOut';

function setup() {
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map: buildLightsOutMap() });
	game.setView({ width: 1400, height: 800 });
	const mission = new LightsOut();
	game.director = mission;
	const hal = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (hal.invuln = 1);
	return { game, mission, hal, run, safe };
}

describe('Season 2: Lights Out', () => {
	it('Hal alone; Thunderers come out of the dark; it is dark and the Battery is already failing', () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['hal']);
		run(3.1, safe);
		expect(mission.wave).toBe(1);
		expect(game.enemies.filter((e) => e.kind === 'thunderer').length).toBe(3);
		expect(mission.power).toBeLessThan(1);
		expect(mission.darkness).toBeGreaterThan(0.6);
	});

	it("Hal's light reaches as far as his will, and shrinks with a Thunderer near him", () => {
		const { game, mission, hal, run, safe } = setup();
		run(3.1, safe);
		for (const e of game.enemies) e.x = e.prevX = hal.x + 2000;
		hal.willpower = hal.maxWillpower;
		const full = mission.ringLight(game);
		hal.willpower = hal.maxWillpower * 0.2;
		expect(mission.ringLight(game)).toBeLessThan(full);
		hal.willpower = hal.maxWillpower;
		const t = game.enemies[0];
		t.x = t.prevX = hal.x + 100;
		t.y = t.prevY = hal.y;
		expect(mission.ringLight(game)).toBeCloseTo(full * (1 - RING_LIGHT.eaten));
	});

	it('a sapper plants a charge at the Battery; left alone it goes off and dims it; broken, it does not', () => {
		const { game, mission, hal, run, safe } = setup();
		run(3.1, safe);
		const keepAway = () => {
			safe();
			hal.x = hal.prevX = 200;
			hal.y = hal.prevY = 200;
			for (const e of game.enemies) if (!mission.charges.length) e.brain.alert = 0;
		};
		run(30, keepAway);
		expect(mission.charges.length + mission.chargesBlown).toBeGreaterThan(0);
		const before = mission.power;
		run(25, keepAway);
		expect(mission.chargesBlown).toBeGreaterThan(0);
		expect(mission.power).toBeLessThan(before + 0.001);
	});

	it('break the charges and clear four waves, and the Battery is relit', () => {
		const { game, mission, run, safe } = setup();
		run(3.1, safe);
		for (let i = 0; i < 4; i++) {
			for (const e of game.enemies) if (isStanding(e)) {
				e.hp = 0;
				e.down = 1;
			}
			for (const c of mission.charges) {
				c.dummy.hp = 0;
				c.dummy.down = 1;
			}
			run(0.3, safe);
		}
		run(0.3, safe);
		expect(mission.state).toBe('won');
		run(4, safe);
		expect(mission.darkness).toBe(0);
	});

	it('the Battery going out loses it', () => {
		const { mission, hal, run, safe } = setup();
		run(3.1, safe);
		mission.power = 0.05;
		run(60, () => {
			safe();
			hal.x = hal.prevX = 200;
			hal.y = hal.prevY = 200;
		});
		expect(mission.chargesBlown).toBeGreaterThan(0);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('battery');
	});
});
