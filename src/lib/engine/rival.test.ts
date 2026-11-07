import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { Autopilot } from './autopilot';
import { buildSparringMap, opponentById, Sparring } from './missions/sparring';

function spar(id: string, as: 'hal' | 'john' = 'hal') {
	const opponent = opponentById(id)!;
	const map = buildSparringMap(opponent);
	const game = new Game({ players: [{ lantern: as, keys: 'solo' }], map });
	game.setView({ width: 1400, height: 800 });
	const kind = id === 'mirror' ? (as === 'hal' ? 'sparJohn' : 'sparHal') : opponent.kind!;
	const sparring = new Sparring(opponent, map, kind);
	game.director = sparring;
	const me = game.players[0];
	me.input = new Autopilot(game, me);
	return { game, sparring, me };
}

describe('Lanterns on the other side fight with their whole kit', () => {
	it('Kilowog uses his own constructs, and they hurt you', () => {
		const { game, me } = spar('kilowog');
		const used = new Set<string>();
		let prev: number[] = [];
		let hurt = 0;
		for (let i = 0; i < 60 * 40; i++) {
			const before = me.health;
			game.update(1 / 60);
			hurt += Math.max(0, before - me.health);
			me.health = me.maxHealth;
			const k = game.rivalLanterns[0];
			if (!k) continue;
			expect(k.def.id).toBe('kilowog');
			k.cooldowns.forEach((c, s) => c > (prev[s] ?? 0) + 0.05 && used.add(k.loadout[s].id));
			prev = [...k.cooldowns];
		}
		expect(used.size).toBeGreaterThanOrEqual(6);
		expect(hurt).toBeGreaterThan(0);
	});

	it('Hal, against John, flies his own jets', () => {
		const { game, me } = spar('mirror', 'john');
		const used = new Set<string>();
		let prev: number[] = [];
		for (let i = 0; i < 60 * 40; i++) {
			game.update(1 / 60);
			me.health = me.maxHealth;
			const h = game.rivalLanterns[0];
			if (!h) continue;
			h.cooldowns.forEach((c, s) => c > (prev[s] ?? 0) + 0.05 && used.add(h.loadout[s].id));
			prev = [...h.cooldowns];
		}
		expect(used).toContain('strafingRun');
		expect(used).toContain('wingman');
	});

	it("a bubble shield keeps the rival's hits off you", () => {
		const { game, me } = spar('kilowog');
		let hurt = 0;
		for (let i = 0; i < 60 * 20; i++) {
			game.constructs.shields = game.constructs.shields.filter((s) => s.target !== me);
			game.constructs.shields.push({ owner: me, target: me, hp: 1e9, maxHp: 1e9, life: 10, maxLife: 10, ripple: 0 });
			const before = me.health;
			game.update(1 / 60);
			hurt += Math.max(0, before - me.health);
		}
		expect(hurt).toBe(0);
	});
});
