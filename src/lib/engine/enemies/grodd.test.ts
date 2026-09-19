import { describe, expect, it } from 'vitest';
import { updatePlayerCombat } from '../combat';
import { createConstructWorld, updateConstructWorld, type ConstructWorld } from '../constructs/system';
import { updateDummy } from '../dummy';
import { IDLE } from '../input';
import { LANTERNS } from '../lanterns';
import { createPlayer, updatePlayer, type Player } from '../player';
import { createEnemy, updateEnemies, type Enemy } from './enemies';
import { GRIP, MIND_LOCK_TIME } from './grodd';
import type { AbilityId } from './redConstructs';

const DT = 1 / 60;

function arena(px = 200) {
	const p = createPlayer(0, LANTERNS.john, { read: () => IDLE }, px, 0);
	const grodd = createEnemy('grodd', 0, 0);
	const w = createConstructWorld([], [grodd]);
	w.players = [p];
	return { p, grodd, w };
}

function run(w: ConstructWorld, players: Player[], seconds: number) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		for (const p of players) {
			updatePlayerCombat(p, DT);
			updatePlayer(p, IDLE, DT);
		}
		updateEnemies(w, players, DT);
		updateConstructWorld(w, DT);
		for (const d of w.dummies) updateDummy(d, DT, w.obstacles, false);
	}
}

/** Skip to the end of the windup: the power happens next tick. */
function force(e: Enemy, id: AbilityId, t: Player) {
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const len = Math.hypot(dx, dy) || 1;
	e.brain.kit = [id];
	Object.assign(e.brain, { state: 'windup', ability: id, timer: 1e-6, target: t, aimX: dx / len, aimY: dy / len, sees: true });
}

describe("Grodd's powers", () => {
	it('Psychic Blast goes straight through a bubble shield', () => {
		const { p, grodd, w } = arena(200);
		w.shields.push({ owner: p, target: p, hp: 999, maxHp: 999, life: 10, maxLife: 10, ripple: 0 });
		force(grodd, 'mindBlast', p);
		run(w, [p], 0.5);
		expect(p.health).toBeLessThan(p.maxHealth);
		expect(w.shields[0]?.hp).toBe(999);
	});

	it("Mind Control gets into a Lantern's head: their moves go the wrong way", () => {
		const { p, grodd, w } = arena(300);
		force(grodd, 'mindLock', p);
		run(w, [p], 0.2);
		expect(p.confused).toBeGreaterThan(MIND_LOCK_TIME - 0.5);
	});

	it('a bubble shield takes the Mind Control instead, and breaks', () => {
		const { p, grodd, w } = arena(300);
		w.shields.push({ owner: p, target: p, hp: 999, maxHp: 999, life: 10, maxLife: 10, ripple: 0 });
		force(grodd, 'mindLock', p);
		run(w, [p], 0.2);
		expect(p.confused).toBe(0);
		expect(w.shields).toHaveLength(0);
	});

	it('Telekinetic Grip: lifts the Lantern (shield or not), carries them to him, and hurls them away', () => {
		const { p, grodd, w } = arena(450);
		w.shields.push({ owner: p, target: p, hp: 999, maxHp: 999, life: 10, maxLife: 10, ripple: 0 });
		force(grodd, 'tkGrip', p);
		run(w, [p], 0.1);
		expect(w.shields).toHaveLength(0);
		run(w, [p], GRIP.carry);
		// Carried in close to him, off the ground, and no constructs while he holds them
		expect(Math.hypot(p.x - grodd.x, p.y - grodd.y)).toBeLessThan(200);
		expect(p.altitude).toBeGreaterThan(0.5);
		expect(p.branded).toBeGreaterThan(0);
		run(w, [p], GRIP.hold + 0.4);
		expect(p.health).toBeLessThan(p.maxHealth);
		expect(Math.hypot(p.x - grodd.x, p.y - grodd.y)).toBeGreaterThan(200);
	});

	it('Telekinetic Throw: a car flies at the Lantern and bursts where it lands', () => {
		const { p, grodd, w } = arena(400);
		force(grodd, 'carThrow', p);
		run(w, [p], 0.1);
		expect(w.red.shots.some((s) => s.look === 'car')).toBe(true);
		run(w, [p], 1.2);
		expect(w.red.shots.some((s) => s.look === 'car')).toBe(false);
		expect(p.health).toBeLessThan(p.maxHealth);
	});
});
