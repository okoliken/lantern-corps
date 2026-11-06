import { describe, expect, it } from 'vitest';
import { hitDummy } from '../dummy';
import { Game } from '../game';
import { DECKS, LIFEBOATS, Undertow, buildUndertowMap } from './undertow';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'aquaman', keys: 'p2', ai: true }
		],
		map: buildUndertowMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new Undertow();
	game.director = mission;
	const john = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	return { game, mission, john, run, safe };
}

describe('Season 2: Undertow', () => {
	it("John and Aquaman (on foot); two breaches in the lower deck, Manta's divers coming aboard", () => {
		const { game, mission, run, safe } = setup();
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'aquaman']);
		run(3.1, safe);
		expect(mission.breaches.length).toBe(2);
		expect(mission.breaches.every((b) => b.deck === 'lower' && b.open)).toBe(true);
		expect(game.enemies.filter((e) => e.kind === 'mantaDiver').length).toBe(4);
		expect(game.players[1].flying).toBe(false);
	});

	it('open breaches flood the lower deck; dammed ones hold the water back', () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		run(10, safe);
		const rising = mission.flood.lower;
		expect(rising).toBeGreaterThan(0.2);
		// Fill both dams and keep them full: the pumps win
		run(10, () => {
			safe();
			for (const b of mission.breaches) if (b.dummy.down === 0) hitDummy(b.dummy, 400, 0, b.dummy.x, b.dummy.y - 100);
		});
		expect(mission.breaches.every((b) => !b.open)).toBe(true);
		expect(mission.flood.lower).toBeLessThan(rising);
	});

	it("hits build a dam, and the sea pushes it back out until it gives", () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		const b = mission.breaches[0];
		hitDummy(b.dummy, 130, 0, b.dummy.x, b.dummy.y - 100);
		run(0.1, safe);
		expect(b.dam).toBeGreaterThan(0.45);
		expect(b.dummy.x).toBe(b.dummy.homeX);
		// Held: no longer something to shoot
		hitDummy(b.dummy, 200, 0, b.dummy.x, b.dummy.y - 100);
		run(0.1, safe);
		expect(b.open).toBe(false);
		expect(b.dummy.down).toBeGreaterThan(0);
		// Left alone it gives way again
		run(8, safe);
		expect(b.open).toBe(true);
		expect(b.dummy.down).toBe(0);
	});

	it('Aquaman goes down for a crew and brings them up through the doorways to the boats', () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		// Keep the water out so this is only about the route
		const dry = () => {
			safe();
			for (const b of mission.breaches) b.dam = 1;
		};
		let out = 0;
		for (let s = 0; s < 120 && out === 0; s++) {
			run(1, dry);
			out = mission.out;
		}
		expect(out).toBeGreaterThan(0);
		const c = mission.crews.find((k) => k.state === 'out')!;
		expect(Math.hypot(c.x - LIFEBOATS.x, c.y - LIFEBOATS.y)).toBeLessThan(260);
	});

	it('a crew left in deep water drowns; two lost is the end', () => {
		const { mission, run, safe } = setup();
		run(3.1, safe);
		mission.flood.lower = 1;
		run(30, () => {
			safe();
			mission.flood.lower = 1;
		});
		expect(mission.crews.filter((c) => c.deck === 'lower' && c.state !== 'out').every((c) => c.state === 'lost')).toBe(true);
		if (mission.lost >= 2) expect(mission.state).toBe('lost');
	});

	it('Manta comes up and holes the lab deck; beat him and get the crews out to win', () => {
		const { game, mission, run, safe } = setup();
		run(3.1, safe);
		for (const c of mission.crews) if (c.deck === 'lower') c.state = 'out';
		run(0.2, safe);
		expect(mission.phase).toBe('manta');
		expect(mission.manta?.kind).toBe('blackManta');
		expect(mission.breaches.some((b) => b.deck === 'mid')).toBe(true);
		run(5, safe);
		expect(mission.flood.mid).toBeGreaterThan(0);
		const m = mission.manta!;
		m.hp = 0;
		m.down = 1;
		run(0.2, safe);
		expect(mission.mantaGone).toBe(true);
		expect(game.enemies.includes(m)).toBe(false);
		expect(mission.state).toBe('playing');
		for (const c of mission.crews) if (c.state !== 'lost') c.state = 'out';
		run(0.2, safe);
		expect(mission.state).toBe('won');
	});

	it('the decks are laid out top to bottom', () => {
		expect(DECKS.upper.y1).toBe(DECKS.mid.y0);
		expect(DECKS.mid.y1).toBe(DECKS.lower.y0);
	});
});
