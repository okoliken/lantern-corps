import { describe, expect, it } from 'vitest';
import { createDummy, type Dummy } from './dummy';
import { IDLE } from './input';
import { LANTERNS } from './lanterns';
import { CRATE_HP, type Obstacle } from './map';
import { createPlayer, type Player } from './player';
import { CONSTRUCTS } from './constructs/defs';
import { AUTO_OBJECT_RANGE, LOCK_RANGE, autoReach, cycleLock, findAutoTarget, lockCandidates, updateTargeting, type TargetWorld } from './targeting';

/** A Lantern at (0, 0) facing right. */
const lantern = (x = 0, y = 0) => createPlayer(0, LANTERNS.hal, { read: () => IDLE }, x, y);

const crate = (cx: number, cy: number): Obstacle => ({
	kind: 'crate', x: cx - 20, y: cy - 14, w: 40, h: 28, height: 28, blocksFlying: false, seed: 0.5, hp: CRATE_HP
});

function world(players: Player[], dummies: Dummy[] = [], obstacles: Obstacle[] = []): TargetWorld {
	return { players, dummies, obstacles };
}

describe('auto target', () => {
	it('picks the nearest enemy in front of you', () => {
		const p = lantern();
		const near = createDummy(150, 20);
		const far = createDummy(300, 0);
		expect(findAutoTarget(p, world([p], [far, near]))).toEqual({ kind: 'enemy', dummy: near });
	});

	it('ignores enemies behind you', () => {
		const p = lantern();
		expect(findAutoTarget(p, world([p], [createDummy(-150, 0)]))).toBeNull();
	});

	it('prefers an enemy over a closer crate', () => {
		const p = lantern();
		const d = createDummy(300, 0);
		// Crate is closer but off to the side, so it doesn't block the view
		expect(findAutoTarget(p, world([p], [d], [crate(80, 60)]))?.kind).toBe('enemy');
	});

	it('falls back to a nearby breakable object when there are no enemies', () => {
		const p = lantern();
		const box = crate(100, 0);
		expect(findAutoTarget(p, world([p], [], [box]))).toEqual({ kind: 'object', obstacle: box });
	});

	it('does not grab objects from across the map', () => {
		const p = lantern();
		expect(findAutoTarget(p, world([p], [], [crate(AUTO_OBJECT_RANGE + 60, 0)]))).toBeNull();
	});

	it(`ignores enemies it can't see behind a building`, () => {
		const p = lantern();
		const building: Obstacle = { kind: 'building', x: 80, y: -60, w: 60, h: 120, height: 120, blocksFlying: false, seed: 0.1 };
		expect(findAutoTarget(p, world([p], [createDummy(250, 0)], [building]))).toBeNull();
	});

	it('only looks as far as the construct in hand can reach', () => {
		const p = lantern();
		const d = createDummy(250, 0);
		const w = world([p], [d]);
		expect(findAutoTarget(p, w, autoReach(CONSTRUCTS.sword))).toBeNull();
		expect(findAutoTarget(p, w, autoReach(CONSTRUCTS.cannon))).not.toBeNull();
	});

	it('points the ring at the target', () => {
		const p = lantern();
		const d = createDummy(100, 100);
		updateTargeting(p, false, world([p], [d]));
		expect(p.aimX).toBeCloseTo(Math.SQRT1_2);
		expect(p.aimY).toBeCloseTo(Math.SQRT1_2);
	});

	it('aims where you face when there is nothing to target', () => {
		const p = lantern();
		p.faceX = 0;
		p.faceY = -1;
		updateTargeting(p, false, world([p]));
		expect([p.aimX, p.aimY]).toEqual([0, -1]);
	});
});

describe('lock on', () => {
	it('cycles enemies, then allies, then objects, then unlocks', () => {
		const p = lantern();
		const partner = lantern(200, 0);
		const d = createDummy(100, 0);
		const box = crate(0, 150);
		const w = world([p, partner], [d], [box]);
		expect(lockCandidates(p, w).map((t) => t.kind)).toEqual(['enemy', 'ally', 'object']);

		cycleLock(p, w);
		expect(p.lock?.kind).toBe('enemy');
		cycleLock(p, w);
		expect(p.lock?.kind).toBe('ally');
		cycleLock(p, w);
		expect(p.lock?.kind).toBe('object');
		cycleLock(p, w);
		expect(p.lock).toBeNull();
	});

	it('can lock onto things behind you', () => {
		const p = lantern();
		const d = createDummy(-200, 0);
		updateTargeting(p, true, world([p], [d]));
		expect(p.attackTarget).toEqual({ kind: 'enemy', dummy: d });
		expect(p.aimX).toBeCloseTo(-1);
	});

	it('breaks when the target is destroyed', () => {
		const p = lantern();
		const d = createDummy(100, 0);
		const w = world([p], [d]);
		updateTargeting(p, true, w);
		d.down = 3; // knocked out
		updateTargeting(p, false, w);
		expect(p.lock).toBeNull();
	});

	it('breaks when you move far away', () => {
		const p = lantern();
		const d = createDummy(100, 0);
		const w = world([p], [d]);
		updateTargeting(p, true, w);
		p.x = -LOCK_RANGE * 2;
		updateTargeting(p, false, w);
		expect(p.lock).toBeNull();
	});

	it('locking an ally makes them the protect target, while attacks still auto-aim', () => {
		const p = lantern();
		const partner = lantern(-150, 0);
		const d = createDummy(150, 0);
		const w = world([p, partner], [d]);
		// First press locks the enemy, second press the ally
		updateTargeting(p, true, w);
		updateTargeting(p, true, w);
		expect(p.protectTarget).toEqual({ kind: 'ally', player: partner });
		expect(p.attackTarget).toEqual({ kind: 'enemy', dummy: d });
	});
});
