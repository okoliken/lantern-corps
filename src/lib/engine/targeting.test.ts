import { describe, expect, it } from 'vitest';
import { BODY, aimPoint, createDummy, type Dummy } from './dummy';
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

	it("points the ring at the middle of the target's body, as drawn at the ring's height", () => {
		const p = lantern();
		p.ringLift = 50;
		const d = createDummy(100, 40);
		updateTargeting(p, false, world([p], [d]));
		const [ax, ay] = aimPoint(d, 50);
		const len = Math.hypot(ax, ay);
		expect(p.aimX).toBeCloseTo(ax / len);
		expect(p.aimY).toBeCloseTo(ay / len);
		// A shot along that line, drawn 50px up, passes through the drawn body
		expect(ay - 50).toBeLessThan(d.y);
		expect(ay - 50).toBeGreaterThan(d.y - BODY.dummy.height);
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
		expect(p.aimX).toBeLessThan(-0.95);
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

describe('mouse aim', () => {
	it('shoots straight at the crosshair when nothing is near it', () => {
		const p = lantern();
		updateTargeting(p, false, world([p]), 460, { pointer: { x: 0, y: -100 } });
		expect(p.aimX).toBeCloseTo(0);
		expect(p.aimY).toBeCloseTo(-1);
	});

	it('does NOT get pulled onto an enemy off to the side', () => {
		const p = lantern();
		const d = createDummy(150, 110); // about 36 degrees below the crosshair line
		updateTargeting(p, false, world([p], [d]), 460, { pointer: { x: 300, y: 0 } });
		expect(p.attackTarget).toBeNull();
		expect(p.aimX).toBeCloseTo(1);
		expect(p.aimY).toBeCloseTo(0);
	});

	it('aim assist snaps onto an enemy right along the crosshair line', () => {
		const p = lantern();
		const d = createDummy(200, 15);
		updateTargeting(p, false, world([p], [d]), 460, { pointer: { x: 300, y: 0 } });
		expect(p.attackTarget).toEqual({ kind: 'enemy', dummy: d });
	});

	it('aim assist can be turned off', () => {
		const p = lantern();
		const d = createDummy(200, 15);
		updateTargeting(p, false, world([p], [d]), 460, { pointer: { x: 300, y: 0 }, aimAssist: false });
		expect(p.attackTarget).toBeNull();
	});

	it('standing still, the Lantern turns to face the crosshair', () => {
		const p = lantern();
		updateTargeting(p, false, world([p]), 460, { pointer: { x: -100, y: 0 } });
		expect(p.dir).toBe(-1);
	});

	it('walking away from the crosshair, the Lantern faces the way it walks (not backwards)', () => {
		const p = lantern();
		p.vx = 250; // walking right
		updateTargeting(p, false, world([p]), 460, { pointer: { x: -100, y: 0 } });
		expect(p.dir).toBe(1);
	});

	it('attacking turns the Lantern toward the aim, and it keeps facing it for a moment', () => {
		const p = lantern();
		p.vx = 250;
		p.shotTimer = 0.2;
		updateTargeting(p, false, world([p]), 460, { pointer: { x: -100, y: 0 } });
		expect(p.dir).toBe(-1);
		expect(p.aimHold).toBeGreaterThan(0);
	});
});

describe('the John bug: keyboard aim pulled onto a hidden target', () => {
	it('an enemy standing behind a building (under its roof on screen) is not auto-targeted', () => {
		const p = lantern();
		// Building footprint to the right and a bit below; its roof is drawn 120px higher
		const building: Obstacle = { kind: 'building', x: 100, y: 40, w: 150, h: 100, height: 120, blocksFlying: false, seed: 0.1 };
		const hidden = createDummy(190, 20); // above the footprint, under the drawn roof
		expect(findAutoTarget(p, world([p], [hidden], [building]))).toBeNull();
	});

	it('keyboard auto-target only looks in a narrow cone ahead', () => {
		const p = lantern();
		const offToSide = createDummy(150, 150); // ~45 degrees off (its body ~38 degrees)
		expect(findAutoTarget(p, world([p], [offToSide]))).toBeNull();
	});
});
