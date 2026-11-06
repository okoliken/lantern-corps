import { describe, expect, it } from 'vitest';
import { hitDummy, isStanding } from '../dummy';
import { Game } from '../game';
import { Breakout, ESCAPE_LIMIT, GATE, SUBDUE, buildBreakoutMap } from './breakout';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map: buildBreakoutMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new Breakout();
	game.director = mission;
	const [hal, kilowog] = game.players;
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

describe('Season 2: Breakout', () => {
	it('Hal and Kilowog; Lyssa reading up on the gallery, out of the fight; the first three cells open and their prisoners come out as themselves', () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'kilowog']);
		run(3.1, safe);
		expect(mission.lyssa).toBe(null);
		expect(game.enemies.some((e) => e.kind === 'lyssaDrak')).toBe(false);
		run(2, safe);
		expect(mission.prisoners.length).toBe(3);
		expect(new Set(mission.prisoners.map((p) => p.e.kind))).toEqual(new Set(['manhunter', 'rageGrunt', 'thunderer']));
	});

	it("a prisoner can't be killed: beaten down he's subdued, and a hit sends him sliding", () => {
		const { mission, run, safe } = setup();
		run(5.1, safe);
		const p = mission.prisoners[0];
		// Out on the open floor of the block
		p.e.x = p.e.prevX = 1500;
		p.e.y = p.e.prevY = 1000;
		hitDummy(p.e, p.e.maxHp * 2, 0, p.e.x, p.e.y);
		run(0.1, safe);
		expect(p.e.gone).toBe(false);
		expect(isStanding(p.e)).toBe(true);
		expect(p.subdued).toBeGreaterThan(0);
		const x0 = p.e.x;
		hitDummy(p.e, 1, 500, p.e.x - 100, p.e.y);
		run(0.5, safe);
		expect(p.e.x - x0).toBeGreaterThan(60);
	});

	it('knocked into an open cell, the door shuts on him', () => {
		const { mission, run, safe } = setup();
		run(5.1, safe);
		const p = mission.prisoners[0];
		p.e.x = p.e.prevX = 1500;
		p.e.y = p.e.prevY = 1200;
		hitDummy(p.e, p.e.maxHp * 2, 0, p.e.x, p.e.y);
		run(0.05, safe);
		const cell = mission.cells.find((c) => !c.shut && !c.inmate)!;
		p.e.x = p.e.prevX = cell.x + 100;
		p.e.y = p.e.prevY = 200;
		run(0.05, safe);
		expect(mission.returned).toBe(1);
		expect(cell.shut).toBe(true);
		expect(cell.inmate).toBe(p.e.kind);
		expect(mission.prisoners.includes(p)).toBe(false);
	});

	it('an open door draws in a subdued prisoner near it', () => {
		const { mission, run, safe } = setup();
		run(5.1, safe);
		const p = mission.prisoners[0];
		const cell = mission.cells.find((c) => !c.shut && !c.inmate)!;
		p.e.x = p.e.prevX = cell.x + 100;
		p.e.y = p.e.prevY = 480;
		hitDummy(p.e, p.e.maxHp * 2, 0, p.e.x, p.e.y + 1);
		run(3, safe);
		expect(mission.returned).toBe(1);
	});

	it('subdued for only so long: then he shakes it off', () => {
		const { mission, run, safe } = setup();
		run(5.1, safe);
		const p = mission.prisoners[0];
		p.e.x = p.e.prevX = 1500;
		p.e.y = p.e.prevY = 1300;
		hitDummy(p.e, p.e.maxHp * 2, 0, p.e.x, p.e.y);
		run(SUBDUE.time + 0.5, safe);
		expect(p.subdued).toBeLessThanOrEqual(0);
		expect(p.e.hp).toBeGreaterThanOrEqual(p.e.maxHp * SUBDUE.recover - 1);
	});

	it(`left alone they run for the gate; ${ESCAPE_LIMIT} out loses it`, () => {
		const { game, mission, hal, kilowog, run, safe } = setup();
		run(5.1, safe);
		const away = () => {
			safe();
			for (const l of [hal, kilowog]) {
				l.x = l.prevX = 100;
				l.y = l.prevY = 1500;
			}
		};
		for (const p of mission.prisoners) {
			p.e.x = p.e.prevX = GATE.x;
			p.e.y = p.e.prevY = GATE.y - 150;
		}
		run(2, away);
		// At the gate they have to force the lock first
		expect(mission.escaped).toBe(0);
		run(7, away);
		expect(mission.escaped).toBeGreaterThanOrEqual(ESCAPE_LIMIT);
		expect(mission.state).toBe('lost');
		expect(game.enemies.filter((e) => e.kind !== 'lyssaDrak' && isStanding(e)).length).toBe(0);
	});

	it('every prisoner back and Lyssa beaten: won', () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		// Fast-forward through the openings, locking each prisoner up as he comes out
		for (let s = 0; s < 200 && mission.phase === 'reading'; s++) {
			run(1, safe);
			for (const p of [...mission.prisoners]) {
				hitDummy(p.e, p.e.maxHp * 2, 0, p.e.x, p.e.y);
				run(0.05, safe);
				const cell = mission.cells.find((c) => !c.shut && !c.inmate);
				if (!cell) continue;
				p.e.x = p.e.prevX = cell.x + 100;
				p.e.y = p.e.prevY = 200;
				run(0.05, safe);
			}
		}
		expect(mission.phase).toBe('lyssa');
		expect(mission.lyssa?.kind).toBe('lyssaDrak');
		for (let s = 0; s < 10; s++) {
			run(2, safe);
			for (const p of [...mission.prisoners]) {
				hitDummy(p.e, p.e.maxHp * 2, 0, p.e.x, p.e.y);
				run(0.05, safe);
				const cell = mission.cells.find((c) => !c.shut && !c.inmate);
				if (!cell) continue;
				p.e.x = p.e.prevX = cell.x + 100;
				p.e.y = p.e.prevY = 200;
				run(0.05, safe);
			}
		}
		const l = mission.lyssa!;
		l.hp = 0;
		l.down = 1;
		run(0.2, safe);
		expect(mission.prisoners.length).toBe(0);
		expect(mission.state).toBe('won');
	});
});
