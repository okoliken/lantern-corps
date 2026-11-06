import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import { Exile, GATE, TETHER, buildExileMap } from './exile';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map: buildExileMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new Exile();
	game.director = mission;
	const hal = game.players[0];
	const kilowog = game.players[1];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	return { game, mission, hal, kilowog, run, safe };
}

describe('Season 2: The Exile', () => {
	it('close to the cell, Hal tows it, slowed; it trails behind at the end of the tether', () => {
		const { mission, hal, run, safe } = setup();
		run(3.1, safe);
		expect(mission.towing).toBe(true);
		expect(hal.burden).toBe(TETHER.burden);
		const from = mission.cell.x;
		run(3, () => {
			safe();
			hal.input = { read: () => ({ moveX: 1, moveY: 0, toggleFly: false, shot: false, construct: false, constructPressed: false, select: -1, cycle: 0, target: false, shield: false, signature: false, backup: false, pointer: null }) };
		});
		expect(mission.cell.x).toBeGreaterThan(from + 300);
		expect(Math.hypot(hal.x - mission.cell.x, hal.y - mission.cell.y)).toBeLessThan(TETHER.length + 40);
	});

	it('building a construct lets go of the tether; ring shots do not', () => {
		const { mission, hal, run, safe } = setup();
		run(3.1, safe);
		hal.firing = false;
		hal.shotTimer = 0.2;
		run(1 / 60, safe);
		expect(mission.towing).toBe(true);
		hal.actionTimer = 0.4;
		run(1 / 60, safe);
		expect(mission.towing).toBe(false);
		expect(hal.burden).toBe(1);
	});

	it('Weaponers ambush on the way; one hauls an untended cell for his tear; a Lantern coming close makes him let go', () => {
		const { game, mission, hal, kilowog, run, safe } = setup();
		run(3.1, safe);
		// Walk Hal (without the cell) past the first ambush
		mission.towing = false;
		hal.x = hal.prevX = 1000;
		hal.y = hal.prevY = 800;
		kilowog.x = kilowog.prevX = 1000;
		run(0.2, safe);
		expect(game.enemies.filter((e) => e.kind === 'weaponer').length).toBe(3);
		expect(mission.tears.length).toBe(1);
		// Put a Weaponer next to the abandoned cell, Lanterns well away
		const w = game.enemies.find((e) => e.kind === 'weaponer')!;
		const park = () => {
			safe();
			hal.x = hal.prevX = 300;
			hal.y = hal.prevY = 1400;
			kilowog.x = kilowog.prevX = 300;
			kilowog.y = kilowog.prevY = 1450;
		};
		w.x = w.prevX = mission.cell.x + 30;
		w.y = w.prevY = mission.cell.y;
		run(0.5, park);
		expect(mission.hauler).toBe(w);
		const before = mission.cell;
		const x0 = before.x;
		run(2, park);
		expect(Math.hypot(mission.cell.x - x0, mission.cell.y - 800)).toBeGreaterThan(80);
		// Hal comes close: he lets go
		hal.x = hal.prevX = mission.cell.x + 40;
		hal.y = hal.prevY = mission.cell.y;
		run(0.1, safe);
		expect(mission.hauler).toBe(null);
		expect(mission.hauls).toBe(1);
	});

	it('hauled into a tear, Sinestro is lost', () => {
		const { game, mission, hal, kilowog, run, safe } = setup();
		run(3.1, safe);
		mission.towing = false;
		hal.x = hal.prevX = 1000;
		run(0.2, safe);
		const t = mission.tears[0];
		const w = game.enemies.find((e) => e.kind === 'weaponer')!;
		mission.cell.x = t.x + 20;
		mission.cell.y = t.y + 30;
		w.x = w.prevX = t.x;
		w.y = w.prevY = t.y + 50;
		run(5, () => {
			safe();
			hal.x = hal.prevX = 300;
			hal.y = hal.prevY = 1400;
			kilowog.x = kilowog.prevX = 300;
			kilowog.y = kilowog.prevY = 1450;
		});
		expect(mission.pulled).toBe(1);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('taken');
	});

	it('at the gate it opens while the cell stays by it; then Sinestro walks through, and it is won', () => {
		const { game, mission, hal, run, safe } = setup();
		run(3.1, safe);
		hal.x = hal.prevX = GATE.x - 200;
		hal.y = hal.prevY = GATE.y + 120;
		mission.cell.x = GATE.x - 150;
		mission.cell.y = GATE.y + 140;
		run(0.2, safe);
		expect(mission.phase).toBe('gate');
		run(36, () => {
			safe();
			for (const e of game.enemies) if (isStanding(e)) e.stun = 1;
			mission.cell.x = GATE.x - 150;
			mission.cell.y = GATE.y + 140;
		});
		expect(mission.gate).toBe(1);
		expect(mission.phase).toBe('through');
		run(10, safe);
		expect(mission.state).toBe('won');
	});
});
