import { describe, expect, it } from 'vitest';
import { AllyInput } from './ally';
import { createConstructWorld } from './constructs/system';
import { createEnemy } from './enemies/enemies';
import { Game } from './game';
import { IDLE } from './input';
import { LANTERNS } from './lanterns';
import type { GameMap } from './map';
import { createPlayer } from './player';

function setup(allyX = 0, partnerX = 400) {
	const w = createConstructWorld([], []);
	const players = [
		createPlayer(0, LANTERNS.hal, { read: () => IDLE }, partnerX, 0),
		createPlayer(1, LANTERNS.john, { read: () => IDLE }, allyX, 0)
	];
	const ally = new AllyInput({ players, dummies: w.dummies, constructs: w });
	ally.me = players[1];
	players[1].flying = true;
	return { w, partner: players[0], me: players[1], ally };
}

const arena = (): GameMap => ({
	name: 'arena',
	environment: 'space',
	width: 2400,
	height: 2400,
	spawn: { x: 1200, y: 1200 },
	battery: { x: 1200, y: 1090 },
	dummies: [],
	obstacles: []
});

describe('AI partner', () => {
	it('with nothing to fight, it heads over to its partner', () => {
		const { ally } = setup(0, 400);
		const intent = ally.read();
		expect(intent.moveX).toBeGreaterThan(0);
		expect(intent.shot).toBe(false);
	});

	it('two AI partners with nothing to fight stay put instead of chasing each other', () => {
		const w = createConstructWorld([], []);
		const players = [
			createPlayer(0, LANTERNS.hal, { read: () => IDLE }, 0, 0),
			createPlayer(1, LANTERNS.john, { read: () => IDLE }, 170, 0)
		];
		const brains = players.map((p) => {
			const ally = new AllyInput({ players, dummies: w.dummies, constructs: w });
			ally.me = p;
			return ally;
		});
		for (const b of brains) {
			const intent = b.read();
			expect(intent.moveX).toBe(0);
			expect(intent.moveY).toBe(0);
		}
	});

	it('shoots at a Red Lantern in range', () => {
		const { w, ally } = setup();
		w.dummies.push(createEnemy('rageGrunt', 250, 40));
		const intent = ally.read();
		expect(intent.shot).toBe(true);
		expect(intent.pointer!.x).toBe(250);
	});

	it('shields a hurt partner when an enemy is winding up on them', () => {
		const { w, partner, me, ally } = setup(0, 200);
		const e = createEnemy('rageGrunt', 240, 0);
		e.brain.target = partner;
		e.brain.state = 'windup';
		w.dummies.push(e);
		partner.health = 30;
		const intent = ally.read();
		expect(intent.shield).toBe(true);
		expect(me.lock).toEqual({ kind: 'ally', player: partner });
	});

	it('gets out of a Rage Slam circle', () => {
		const { w, ally } = setup(0, 0);
		w.dummies.push(createEnemy('rageGrunt', 300, 0));
		w.effects.push({ kind: 'slamMark', x: 30, y: 0, age: 0, life: 1, radius: 72 });
		const intent = ally.read();
		expect(intent.moveX).toBeLessThan(0);
	});

	it('does nothing while downed', () => {
		const { w, me, ally } = setup();
		w.dummies.push(createEnemy('rageGrunt', 250, 40));
		me.downed = true;
		expect(ally.read()).toEqual(IDLE);
	});

	it('in a showcase, both AI Lanterns use every construct in their loadout', () => {
		const game = new Game({ players: [{ lantern: 'hal', keys: 'solo', ai: true }, { lantern: 'john', keys: 'p2', ai: true }], map: arena() });
		game.setView({ width: 1400, height: 800 });
		game.godMode = true;
		game.showcase = true;
		// This is about knowing when to use each construct, not about budgeting willpower
		game.infiniteWillpower = true;
		const used = new Set<string>();
		// Ten constructs each: give them a minute and a half to get round them all
		for (let i = 0; i < 90 * 60; i++) {
			if (game.enemies.length < 3) game.spawnEnemy('rageGrunt', 1200 + Math.cos(i) * 300, 1200 + Math.sin(i) * 300, 'berserker');
			const before = game.players.map((p) => [...p.cooldowns]);
			game.update(1 / 60);
			game.players.forEach((p, k) =>
				p.loadout.forEach((def, j) => {
					if (p.cooldowns[j] > before[k][j] + 0.05 || (p.selected === j && p.firing)) used.add(`${p.def.id}:${def.id}`);
				})
			);
		}
		const all = game.players.flatMap((p) => p.loadout.map((def) => `${p.def.id}:${def.id}`));
		expect(all.filter((id) => !used.has(id))).toEqual([]);
	});

	it('in a real game, an AI John fights Red Lanterns and wins', () => {
		const game = new Game({ players: [{ lantern: 'john', keys: 'p2', ai: true }], map: arena() });
		game.setView({ width: 800, height: 600 });
		game.godMode = true;
		game.spawnEnemy('rageGrunt', 1450, 1200, 'berserker');
		game.spawnEnemy('rageGrunt', 1200, 1500, 'gunner');
		for (let i = 0; i < 60 * 40 && game.enemies.length > 0; i++) game.update(1 / 60);
		expect(game.enemies.length).toBe(0);
	});
});
