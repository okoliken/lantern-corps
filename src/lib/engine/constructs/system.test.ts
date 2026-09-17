// One test group per behavior, plus selection, cooldowns, willpower and
// Hal/John traits. Each test builds a tiny world by hand.

import { describe, expect, it } from 'vitest';
import { DUMMY_HP, createDummy, updateDummy, type Dummy } from '../dummy';
import { IDLE, type Intent } from '../input';
import { LANTERNS, type LanternId } from '../lanterns';
import { CRATE_HP, type Obstacle } from '../map';
import { createPlayer, type Player } from '../player';
import { MAX_WILLPOWER, RESTART_THRESHOLD } from '../willpower';
import { BUBBLE_SHIELD, CONSTRUCTS, LOADOUTS, MAX_TRAPS_PER_PLAYER, type ConstructId } from './defs';
import {
	absorbWithShield,
	costOf,
	createConstructWorld,
	shieldRecipient,
	updateConstructWorld,
	updatePlayerConstructs,
	type ConstructWorld
} from './system';

const DT = 1 / 60;
const FIRE: Intent = { ...IDLE, fire: true, firePressed: true };
const HOLD: Intent = { ...IDLE, fire: true };

/** A Lantern at (0, 0) aiming right, holding the given construct. */
function setup(id: LanternId, construct: ConstructId, dummies: Dummy[] = [], obstacles: Obstacle[] = []) {
	const p = createPlayer(0, LANTERNS[id], { read: () => IDLE }, 0, 0);
	p.selected = LOADOUTS[id].indexOf(construct);
	if (p.selected === -1) throw new Error(`${id} has no ${construct}`);
	const w = createConstructWorld(obstacles, dummies);
	return { p, w };
}

/** Run the world for a while with the same intent every tick. */
function run(p: Player, w: ConstructWorld, intent: Intent, seconds: number) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		updatePlayerConstructs(p, intent, DT, w);
		updateConstructWorld(w, DT);
		for (const d of w.dummies) updateDummy(d, DT, w.obstacles);
	}
}

/** One press, then let things play out. */
function press(p: Player, w: ConstructWorld, seconds = 1) {
	run(p, w, FIRE, DT);
	run(p, w, IDLE, seconds);
}

const crate = (x: number, y: number): Obstacle => ({
	kind: 'crate', x, y, w: 40, h: 28, height: 28, blocksFlying: false, seed: 0.5, hp: CRATE_HP, maxHp: CRATE_HP, movable: true
});

describe('choosing constructs', () => {
	it('slot keys pick a construct', () => {
		const { p, w } = setup('hal', 'beam');
		run(p, w, { ...IDLE, select: 3 }, DT);
		expect(p.loadout[p.selected].id).toBe('fist');
	});

	it('the cycle key moves to the next one and wraps around', () => {
		const { p, w } = setup('hal', 'chain');
		run(p, w, { ...IDLE, cycle: true }, DT);
		expect(p.selected).toBe(0);
	});

	it('Hal and John carry different loadouts', () => {
		expect(LOADOUTS.hal).not.toEqual(LOADOUTS.john);
		expect(LOADOUTS.hal[0]).toBe('beam');
		expect(LOADOUTS.john[0]).toBe('beam');
	});
});

describe('beam (hold)', () => {
	it('damages a dummy in front of it and drains willpower', () => {
		const d = createDummy(150, 0);
		const { p, w } = setup('john', 'beam', [d]);
		run(p, w, HOLD, 0.5);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		expect(p.willpower).toBeLessThan(MAX_WILLPOWER);
		expect(p.beamLength).toBeCloseTo(150 - 12, 0);
	});

	it(`won't start while exhausted`, () => {
		const { p, w } = setup('john', 'beam');
		p.willpower = RESTART_THRESHOLD - 1;
		run(p, w, HOLD, DT);
		expect(p.firing).toBe(false);
	});
});

describe('minigun (rapid, hold)', () => {
	it('fires a stream of bullets that hit a dummy', () => {
		const d = createDummy(200, 0);
		const { p, w } = setup('hal', 'minigun', [d]);
		run(p, w, HOLD, 0.5);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		expect(p.willpower).toBeLessThan(MAX_WILLPOWER);
	});

	it('stops shooting when you let go', () => {
		const { p, w } = setup('hal', 'minigun');
		run(p, w, HOLD, 0.2);
		run(p, w, IDLE, 1);
		expect(w.projectiles).toHaveLength(0);
		expect(p.firing).toBe(false);
	});
});

describe('one-shot constructs', () => {
	it('fire once per press, not every tick the key is held', () => {
		const d = createDummy(60, 0);
		const { p, w } = setup('hal', 'sword', [d]);
		run(p, w, FIRE, DT);
		const afterOne = d.hp;
		run(p, w, HOLD, 1); // key still down, but no new press
		expect(d.hp).toBe(afterOne);
	});

	it('respect cooldowns', () => {
		const d = createDummy(60, 0);
		const { p, w } = setup('hal', 'sword', [d]);
		run(p, w, FIRE, DT);
		const afterOne = d.hp;
		run(p, w, FIRE, DT); // pressed again immediately
		expect(d.hp).toBe(afterOne);
	});

	it(`don't work without enough willpower`, () => {
		const d = createDummy(60, 0);
		const { p, w } = setup('hal', 'fist', [d]);
		p.willpower = CONSTRUCTS.fist.cost - 1;
		press(p, w);
		expect(d.hp).toBe(DUMMY_HP);
	});
});

describe('cannon (heavy)', () => {
	it('explodes and hurts everything in the splash', () => {
		const a = createDummy(200, 0);
		const b = createDummy(200, 40);
		const { p, w } = setup('john', 'cannon', [a, b]);
		press(p, w);
		expect(a.hp).toBeLessThan(DUMMY_HP);
		expect(b.hp).toBeLessThan(DUMMY_HP);
	});

	it('knocks targets back', () => {
		const d = createDummy(200, 0);
		const { p, w } = setup('john', 'cannon', [d]);
		press(p, w);
		expect(d.x).toBeGreaterThan(200);
	});
});

describe('sword (slash)', () => {
	it('hits things in front, not behind', () => {
		const front = createDummy(50, 0);
		const behind = createDummy(-50, 0);
		const { p, w } = setup('hal', 'sword', [front, behind]);
		press(p, w, 0.1);
		expect(front.hp).toBeLessThan(DUMMY_HP);
		expect(behind.hp).toBe(DUMMY_HP);
	});

	it('breaks crates', () => {
		const box = crate(20, -14);
		const obstacles = [box];
		const { p, w } = setup('hal', 'sword', [], obstacles);
		for (let i = 0; i < 6; i++) press(p, w, 0.35);
		expect(obstacles).not.toContain(box);
	});
});

describe('giant fist (smash)', () => {
	it('lands after a short wind-up, not instantly', () => {
		const d = createDummy(70, 0);
		const { p, w } = setup('hal', 'fist', [d]);
		run(p, w, FIRE, DT);
		expect(d.hp).toBe(DUMMY_HP);
		run(p, w, IDLE, 0.3);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it('sends things flying', () => {
		const d = createDummy(70, 0);
		const { p, w } = setup('hal', 'fist', [d]);
		press(p, w, 0.6);
		expect(d.x).toBeGreaterThan(150);
	});
});

describe('energy wall (barrier)', () => {
	it('puts a solid, flyer-blocking wall in front of you', () => {
		const { p, w } = setup('john', 'wall');
		press(p, w, 0.1);
		const wall = w.obstacles.find((o) => o.kind === 'wall');
		expect(wall).toBeDefined();
		expect(wall!.blocksFlying).toBe(true);
		expect(wall!.x).toBeGreaterThan(0);
	});

	it('fades away after its duration', () => {
		const { p, w } = setup('john', 'wall');
		press(p, w, CONSTRUCTS.wall.duration * LANTERNS.john.traits.durability + 0.5);
		expect(w.obstacles.some((o) => o.kind === 'wall')).toBe(false);
	});

	it(`won't build on top of a dummy, and doesn't charge you`, () => {
		const d = createDummy(70, 0);
		const { p, w } = setup('john', 'wall', [d]);
		press(p, w, 0.1);
		expect(w.obstacles).toHaveLength(0);
		expect(p.willpower).toBe(MAX_WILLPOWER);
	});
});

describe('chain (grab)', () => {
	it('pulls a dummy toward you', () => {
		const d = createDummy(250, 0);
		const { p, w } = setup('hal', 'chain', [d]);
		press(p, w, 0.8);
		expect(d.x).toBeLessThan(150);
	});

	it('drags a crate toward you', () => {
		const box = crate(230, -14);
		const { p, w } = setup('hal', 'chain', [], [box]);
		press(p, w, 0.8);
		expect(box.x).toBeLessThan(200);
	});
});

describe('cage (trap)', () => {
	it('catches a dummy that walks into it and holds it still', () => {
		const d = createDummy(300, 0);
		const { p, w } = setup('john', 'cage', [d]);
		press(p, w, 0.1);
		expect(w.traps).toHaveLength(1);
		// Shove the dummy hard enough to slide into the trap at x=100
		d.vx = -1600;
		run(p, w, IDLE, 0.5);
		expect(d.caged).toBeGreaterThan(0);
		expect(w.traps).toHaveLength(0);
		const x = d.x;
		d.vx = 500;
		run(p, w, IDLE, 0.3);
		expect(d.x).toBe(x);
	});

	it(`only keeps ${MAX_TRAPS_PER_PLAYER} traps out at once`, () => {
		const { p, w } = setup('john', 'cage');
		for (let i = 0; i < MAX_TRAPS_PER_PLAYER + 2; i++) press(p, w, 2);
		expect(w.traps).toHaveLength(MAX_TRAPS_PER_PLAYER);
	});
});

describe('shockwave (area)', () => {
	it('hits everything around you, in every direction', () => {
		const dummies = [createDummy(100, 0), createDummy(-100, 0), createDummy(0, 100)];
		const { p, w } = setup('john', 'shockwave', dummies);
		press(p, w, 0.3);
		for (const d of dummies) expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it('misses things outside its radius', () => {
		const far = createDummy(400, 0);
		const { p, w } = setup('john', 'shockwave', [far]);
		press(p, w, 0.3);
		expect(far.hp).toBe(DUMMY_HP);
	});
});

describe('Hal vs John traits', () => {
	it('Hal hits harder', () => {
		const halTarget = createDummy(150, 0);
		const johnTarget = createDummy(150, 0);
		const hal = setup('hal', 'beam', [halTarget]);
		const john = setup('john', 'beam', [johnTarget]);
		run(hal.p, hal.w, HOLD, 0.5);
		run(john.p, john.w, HOLD, 0.5);
		expect(halTarget.hp).toBeLessThan(johnTarget.hp);
	});

	it('John builds walls for less willpower', () => {
		const hal = createPlayer(0, LANTERNS.hal, { read: () => IDLE }, 0, 0);
		const john = createPlayer(0, LANTERNS.john, { read: () => IDLE }, 0, 0);
		expect(costOf(john, CONSTRUCTS.wall)).toBeLessThan(costOf(hal, CONSTRUCTS.wall));
	});

	it(`John's cages hold longer`, () => {
		expect(LANTERNS.john.traits.durability).toBeGreaterThan(LANTERNS.hal.traits.durability);
	});
});

describe('bubble shield', () => {
	const SHIELD: Intent = { ...IDLE, shield: true };

	it('goes on yourself when no ally is locked', () => {
		const { p, w } = setup('hal', 'beam');
		run(p, w, SHIELD, DT);
		expect(w.shields).toHaveLength(1);
		expect(w.shields[0].target).toBe(p);
		expect(p.willpower).toBeLessThan(MAX_WILLPOWER);
	});

	it('goes on a locked ally in reach', () => {
		const { p, w } = setup('john', 'beam');
		const partner = createPlayer(1, LANTERNS.hal, { read: () => IDLE }, 150, 0);
		p.protectTarget = { kind: 'ally', player: partner };
		run(p, w, SHIELD, DT);
		expect(w.shields[0].target).toBe(partner);
	});

	it('falls back to yourself if the ally is too far away', () => {
		const { p, w } = setup('john', 'beam');
		const partner = createPlayer(1, LANTERNS.hal, { read: () => IDLE }, BUBBLE_SHIELD.range + 100, 0);
		p.protectTarget = { kind: 'ally', player: partner };
		expect(shieldRecipient(p)).toBe(p);
	});

	it('absorbs damage until it breaks, then lets the rest through', () => {
		const { p, w } = setup('hal', 'beam');
		run(p, w, SHIELD, DT);
		const hp = w.shields[0].hp;
		expect(absorbWithShield(w, p, 10)).toBe(0);
		expect(absorbWithShield(w, p, hp)).toBe(10);
		expect(w.shields).toHaveLength(0);
	});

	it('with no shield, all damage gets through', () => {
		const { p, w } = setup('hal', 'beam');
		expect(absorbWithShield(w, p, 25)).toBe(25);
	});

	it('casting again refreshes the bubble instead of stacking', () => {
		const { p, w } = setup('hal', 'beam');
		run(p, w, SHIELD, DT);
		absorbWithShield(w, p, 30);
		run(p, w, IDLE, 1.5);
		run(p, w, SHIELD, DT);
		expect(w.shields).toHaveLength(1);
		expect(w.shields[0].hp).toBe(w.shields[0].maxHp);
	});

	it('pops when it runs out of time', () => {
		const { p, w } = setup('john', 'beam');
		run(p, w, SHIELD, DT);
		run(p, w, IDLE, BUBBLE_SHIELD.duration! * LANTERNS.john.traits.durability + 0.5);
		expect(w.shields).toHaveLength(0);
	});
});
