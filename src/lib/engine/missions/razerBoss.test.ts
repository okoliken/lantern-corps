import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { CAPTURE_AT, PHASE_2, PHASE_3, RazerBoss, buildRazerMap } from './razerBoss';

function setup() {
	const map = buildRazerMap();
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true }
		],
		map
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new RazerBoss();
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
			e.hp = 0;
			e.down = 1;
		}
		run(0.1, safe);
	};
	/** Past the guards: Razer comes down and fights. */
	const toDuel = () => {
		run(3.1);
		clear();
		run(3, safe);
	};
	return { game, mission, run, safe, clear, toDuel };
}

describe('Act 1, Mission 5: Razer', () => {
	it('Razer watches from his dais while his guard fights', () => {
		const { game, mission, run } = setup();
		run(3.1);
		expect(mission.phase).toBe('guards');
		expect(game.enemies.length).toBe(5);
		expect(game.enemies.some((e) => e.kind === 'razer')).toBe(false);
	});

	it('with his guard beaten, Razer comes down to fight', () => {
		const { game, mission, toDuel } = setup();
		toDuel();
		expect(mission.phase).toBe('duel');
		const razer = game.enemies.find((e) => e.kind === 'razer')!;
		expect(razer).toBeTruthy();
		expect(razer.brain.kit).toEqual(['twinBlades', 'rageGrab', 'chakram', 'chain', 'mace', 'rendVolley', 'redShield']);
	});

	it('he gets more dangerous as he gets hurt: new constructs, then berserk', () => {
		const { mission, run, safe, toDuel } = setup();
		toDuel();
		const razer = mission.razer!;
		razer.hp = razer.maxHp * (PHASE_2 - 0.01);
		run(0.1, safe);
		expect(mission.stage).toBe(2);
		expect(razer.brain.kit).toContain('shatter');
		expect(razer.brain.kit).toContain('brand');
		const might = razer.brain.might;
		razer.hp = razer.maxHp * (PHASE_3 - 0.01);
		run(0.1, safe);
		expect(mission.stage).toBe(3);
		expect(razer.brain.kit).toContain('crimsonNova');
		expect(razer.brain.kit).toContain('razerStorm');
		expect(razer.brain.might).toBeGreaterThan(might);
	});

	it('beaten, he is caught instead of killed, names Atrocitus, and that wins', () => {
		const { game, mission, run, safe, toDuel } = setup();
		toDuel();
		const razer = mission.razer!;
		razer.hp = razer.maxHp * (CAPTURE_AT - 0.01);
		run(0.1, safe);
		expect(mission.phase).toBe('captured');
		expect(game.dummies).not.toContain(razer);
		expect(mission.line?.who).toBe('Razer');
		run(60, safe);
		expect(mission.state).toBe('won');
		expect(mission.resultText).toContain('Atrocitus');
	});
});

describe('Razer fights with intent', () => {
	it('turns on the other Lantern every few seconds instead of sticking with one', () => {
		const { game, mission, run, safe, toDuel } = setup();
		toDuel();
		const seen = new Set<unknown>();
		run(20, () => {
			safe();
			for (const p of game.players) p.health = p.maxHealth;
			if (mission.razer?.brain.target) seen.add(mission.razer.brain.target);
		});
		expect(seen.size).toBe(2);
	});
});
