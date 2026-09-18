// One test group per behavior, plus selection, cooldowns, willpower and
// Hal/John traits. Each test builds a tiny world by hand.

import { describe, expect, it } from 'vitest';
import { BODY, DUMMY_HP, createDummy, updateDummy, type Dummy } from '../dummy';
import { IDLE, type Intent } from '../input';
import { LANTERNS, type LanternId } from '../lanterns';
import { CRATE_HP, type Obstacle } from '../map';
import { createPlayer, updatePlayer, type Player } from '../player';
import { updateSignature } from './signature';
import { MAX_WILLPOWER, RESTART_THRESHOLD } from '../willpower';
import { BUBBLE_SHIELD, RING_SHOT, RING_SHOT_BURST, RING_SHOT_GAP, CONSTRUCTS, LOADOUTS, constructLabel, MAX_MINES_PER_PLAYER, MAX_TRAPS_PER_PLAYER, MAX_TURRETS_PER_PLAYER, type ConstructDef, type ConstructId } from './defs';
import {
	absorbWithShield,
	costOf,
	createConstructWorld,
	shieldRecipient,
	updateAidStations,
	updateConstructWorld,
	updatePlayerConstructs,
	type ConstructWorld
} from './system';

const DT = 1 / 60;
const FIRE: Intent = { ...IDLE, construct: true, constructPressed: true };
const HOLD: Intent = { ...IDLE, construct: true };

/** A Lantern at (0, 0) aiming right, holding the given construct. */
function setup(id: LanternId, construct: ConstructId, dummies: Dummy[] = [], obstacles: Obstacle[] = []) {
	const p = createPlayer(0, LANTERNS[id], { read: () => IDLE }, 0, 0);
	p.selected = LOADOUTS[id].indexOf(construct);
	// Not in this Lantern's loadout (e.g. constructs kept for the Ring Forge): equip it in slot 1
	if (p.selected === -1) {
		p.loadout = [...p.loadout];
		p.loadout[0] = CONSTRUCTS[construct];
		p.selected = 0;
	}
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
		const { p, w } = setup('hal', 'shotgun');
		run(p, w, { ...IDLE, cycle: 1 }, DT);
		expect(p.selected).toBe(0);
	});

	it('Hal and John carry different loadouts', () => {
		expect(LOADOUTS.hal).not.toEqual(LOADOUTS.john);
		expect(LOADOUTS.hal[0]).toBe('beam');
		expect(LOADOUTS.hal).toHaveLength(10);
		expect(LOADOUTS.john).toHaveLength(10);
		expect(new Set(LOADOUTS.hal).size).toBe(10);
		expect(new Set(LOADOUTS.john).size).toBe(10);
	});
});

describe('beam (hold)', () => {
	it('damages a dummy in front of it and drains willpower', () => {
		const d = createDummy(150, 0);
		const { p, w } = setup('john', 'beam', [d]);
		run(p, w, HOLD, 0.5);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		expect(p.willpower).toBeLessThan(MAX_WILLPOWER);
		expect(p.beamLength).toBeCloseTo(150 - BODY.dummy.halfWidth, 0);
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

describe('ring shot (free)', () => {
	const SHOT: Intent = { ...IDLE, shot: true };

	it('fires bolts that damage a dummy', () => {
		const d = createDummy(200, 0);
		const { p, w } = setup('hal', 'beam', [d]);
		run(p, w, SHOT, 1);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it('costs no willpower at all', () => {
		const { p, w } = setup('hal', 'beam');
		run(p, w, SHOT, 2);
		expect(p.willpower).toBe(MAX_WILLPOWER);
	});

	it('still works when exhausted', () => {
		const { p, w } = setup('hal', 'beam');
		p.willpower = 0;
		p.exhausted = true;
		run(p, w, SHOT, DT);
		expect(w.projectiles.some((pr) => pr.kind === 'bolt')).toBe(true);
	});

	it('fires double taps: two bolts close together, then a rest (under four a second)', () => {
		const { p, w } = setup('john', 'beam');
		const firedAt: number[] = [];
		for (let i = 0; i < 60; i++) {
			const before = w.projectiles.length;
			updatePlayerConstructs(p, SHOT, DT, w);
			if (w.projectiles.length > before) firedAt.push(i * DT);
		}
		expect(firedAt.length).toBeGreaterThanOrEqual(3);
		expect(firedAt.length).toBeLessThanOrEqual(4);
		expect(firedAt[1] - firedAt[0]).toBeCloseTo(RING_SHOT_GAP, 1);
		expect(firedAt[2] - firedAt[1]).toBeGreaterThan(RING_SHOT.cooldown - DT);
	});

	it('a single tap still fires the whole double tap', () => {
		const { p, w } = setup('john', 'beam');
		updatePlayerConstructs(p, SHOT, DT, w);
		for (let i = 0; i < 30; i++) updatePlayerConstructs(p, IDLE, DT, w);
		expect(w.projectiles.filter((pr) => pr.kind === 'bolt').length).toBe(RING_SHOT_BURST);
	});

	it('goes straight along the aim', () => {
		const { p, w } = setup('john', 'beam');
		p.aimX = 1;
		p.aimY = 0;
		run(p, w, SHOT, DT);
		const bolt = w.projectiles[0];
		expect(bolt.vy).toBe(0);
		expect(bolt.vx).toBeGreaterThan(0);
	});

	it('scroll wheel goes to the previous construct too', () => {
		const { p, w } = setup('hal', 'beam');
		run(p, w, { ...IDLE, cycle: -1 }, DT);
		expect(p.loadout[p.selected].id).toBe('shotgun');
	});
});

describe('everything comes out of the ring', () => {
	it('shots start at the ring and keep the height they left it at', () => {
		const { p, w } = setup('hal', 'beam');
		p.ringDX = 22;
		p.ringLift = 45;
		run(p, w, { ...IDLE, shot: true }, DT);
		const bolt = w.projectiles[0];
		// It has already flown one tick, so check where that tick started: the ring (+4px along the aim)
		expect(bolt.prevX).toBeCloseTo(26);
		expect(bolt.lift).toBe(45);
		// The shooter lands: the bolt stays level
		p.ringLift = 10;
		run(p, w, IDLE, 0.1);
		expect(w.projectiles[0].lift).toBe(45);
	});

	it('the beam is cast from the ring, not the feet', () => {
		const d = createDummy(100, 0);
		const { p, w } = setup('john', 'beam', [d]);
		p.ringDX = 20;
		run(p, w, HOLD, DT);
		// The body's near edge is at 100 - its half width; measured from the ring at x=20
		expect(p.beamLength).toBeCloseTo(100 - BODY.dummy.halfWidth - 20, 0);
	});
});

describe('John: Sniper Rifle', () => {
	const release = (p: Player, w: ConstructWorld) => run(p, w, IDLE, DT);

	it('charges while held and fires on release', () => {
		const d = createDummy(300, 0);
		const { p, w } = setup('john', 'sniper', [d]);
		run(p, w, HOLD, 0.5);
		expect(p.charge).toBeGreaterThan(0.4);
		expect(d.hp).toBe(DUMMY_HP);
		release(p, w);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		expect(p.charge).toBe(0);
	});

	it('pierces every enemy in the line', () => {
		const line = [createDummy(150, 0), createDummy(300, 0), createDummy(450, 0)];
		const { p, w } = setup('john', 'sniper', line);
		run(p, w, HOLD, 1);
		release(p, w);
		for (const d of line) expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it('a full charge hits much harder than a quick tap', () => {
		const tapTarget = createDummy(200, 0);
		const fullTarget = createDummy(200, 0);
		const tap = setup('john', 'sniper', [tapTarget]);
		const full = setup('john', 'sniper', [fullTarget]);
		run(tap.p, tap.w, HOLD, DT);
		release(tap.p, tap.w);
		run(full.p, full.w, HOLD, 1);
		release(full.p, full.w);
		expect(DUMMY_HP - fullTarget.hp).toBeGreaterThan((DUMMY_HP - tapTarget.hp) * 2.5);
	});

	it('stops at a building', () => {
		const building: Obstacle = { kind: 'building', x: 100, y: -50, w: 60, h: 100, height: 100, blocksFlying: false, seed: 0 };
		const behind = createDummy(300, 0);
		const { p, w } = setup('john', 'sniper', [behind], [building]);
		run(p, w, HOLD, 1);
		release(p, w);
		expect(behind.hp).toBe(DUMMY_HP);
	});

	it('costs willpower once, on release', () => {
		const { p, w } = setup('john', 'sniper');
		run(p, w, HOLD, 1);
		expect(p.willpower).toBe(MAX_WILLPOWER);
		release(p, w);
		expect(p.willpower).toBeLessThan(MAX_WILLPOWER);
	});
});

describe('John: Auto-Turret', () => {
	it('builds a turret that shoots enemies on its own', () => {
		const d = createDummy(300, 0);
		const { p, w } = setup('john', 'turret', [d]);
		press(p, w, 2);
		expect(w.turrets).toHaveLength(1);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it(`keeps at most ${MAX_TURRETS_PER_PLAYER} turrets out, replacing the oldest`, () => {
		const { p, w } = setup('john', 'turret');
		for (let i = 0; i < MAX_TURRETS_PER_PLAYER + 1; i++) press(p, w, 1.6);
		expect(w.turrets).toHaveLength(MAX_TURRETS_PER_PLAYER);
	});

	it('runs out after its duration', () => {
		const { p, w } = setup('john', 'turret');
		press(p, w, CONSTRUCTS.turret.duration * LANTERNS.john.traits.durability + 0.5);
		expect(w.turrets).toHaveLength(0);
	});

	it(`can't be built inside a building, and doesn't charge you`, () => {
		const building: Obstacle = { kind: 'building', x: 20, y: -50, w: 100, h: 100, height: 100, blocksFlying: false, seed: 0 };
		const { p, w } = setup('john', 'turret', [], [building]);
		press(p, w, 0.1);
		expect(w.turrets).toHaveLength(0);
		expect(p.willpower).toBe(MAX_WILLPOWER);
	});

	it('counts as a structure, so John builds it cheaper', () => {
		const hal = createPlayer(0, LANTERNS.hal, { read: () => IDLE }, 0, 0);
		const john = createPlayer(0, LANTERNS.john, { read: () => IDLE }, 0, 0);
		expect(costOf(john, CONSTRUCTS.turret)).toBeLessThan(costOf(hal, CONSTRUCTS.turret));
	});
});

describe('John: Pillar Drop', () => {
	it('warns first, then slams down: damage only after the warning', () => {
		const d = createDummy(150, 0);
		const { p, w } = setup('john', 'pillars', [d]);
		p.attackTarget = { kind: 'enemy', dummy: d };
		run(p, w, FIRE, DT);
		run(p, w, IDLE, 0.2);
		expect(d.hp).toBe(DUMMY_HP);
		run(p, w, IDLE, 0.6);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it('stuns everything in the area', () => {
		const a = createDummy(150, 0);
		const b = createDummy(170, 30);
		const { p, w } = setup('john', 'pillars', [a, b]);
		p.attackTarget = { kind: 'enemy', dummy: a };
		press(p, w, 0.7);
		expect(a.stun).toBeGreaterThan(0);
		expect(b.stun).toBeGreaterThan(0);
	});

	it('lands where the mouse points, up to its range', () => {
		const { p, w } = setup('john', 'pillars');
		p.aimReach = 5000;
		run(p, w, FIRE, DT);
		const s = w.pillarStrikes[0];
		expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(CONSTRUCTS.pillars.range + 1e-6);
	});
});

describe('constructs adapt to space', () => {
	it('ground-based constructs take a space form (same job, different name and look)', () => {
		expect(constructLabel(CONSTRUCTS.wall, false).name).toBe('Energy Wall');
		expect(constructLabel(CONSTRUCTS.wall, true).name).toBe('Force Field');
		expect(constructLabel(CONSTRUCTS.turret, true).name).toBe('Sentry Drone');
		expect(constructLabel(CONSTRUCTS.pillars, true).name).toBe('Vice Crush');
	});

	it('constructs that already work anywhere keep their name in space', () => {
		expect(constructLabel(CONSTRUCTS.sniper, true).name).toBe('Sniper Rifle');
		expect(constructLabel(CONSTRUCTS.fist, true).name).toBe('Giant Fist');
	});

	it('every construct in a loadout either works anywhere or has a space form', () => {
		// Behaviors that depend on standing on the ground need a space form
		const groundBound = new Set(['barrier', 'turret', 'pillars', 'trap']);
		for (const id of [...LOADOUTS.hal, ...LOADOUTS.john]) {
			const def: ConstructDef = CONSTRUCTS[id];
			if (groundBound.has(def.behavior)) expect(def.space, `${id} needs a space form`).toBeDefined();
		}
	});

	it('a Sentry Drone fires from higher up than a ground turret', () => {
		const planet = setup('john', 'turret', [createDummy(300, 0)]);
		const space = setup('john', 'turret', [createDummy(300, 0)]);
		space.w.space = true;
		press(planet.p, planet.w, 1);
		press(space.p, space.w, 1);
		const planetBolt = planet.w.projectiles.find((pr) => pr.kind === 'bolt');
		const spaceBolt = space.w.projectiles.find((pr) => pr.kind === 'bolt');
		expect(spaceBolt!.lift).toBeGreaterThan(planetBolt!.lift);
	});
});

describe("Hal's new constructs", () => {
	it('Warhammer comes down after a windup, hurts and dazes what it lands on', () => {
		const d = createDummy(80, 0);
		const { p, w } = setup('hal', 'hammer', [d]);
		run(p, w, FIRE, DT);
		expect(d.hp).toBe(DUMMY_HP);
		run(p, w, IDLE, 0.5);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		expect(d.stun).toBeGreaterThan(0);
	});

	it('Rocket Pod fires a fan of missiles that home in on enemies ahead', () => {
		const a = createDummy(300, -80);
		const b = createDummy(320, 90);
		const { p, w } = setup('hal', 'rockets', [a, b]);
		run(p, w, FIRE, DT);
		expect(w.projectiles.filter((pr) => pr.kind === 'missile')).toHaveLength(CONSTRUCTS.rockets.count);
		run(p, w, IDLE, 1.5);
		expect(a.hp).toBeLessThan(DUMMY_HP);
		expect(b.hp).toBeLessThan(DUMMY_HP);
	});

	it('Buzzsaw cuts on the way out and again on the way back, then returns to Hal', () => {
		const d = createDummy(150, 0);
		d.respawns = false;
		const { p, w } = setup('hal', 'buzzsaw', [d]);
		run(p, w, FIRE, DT);
		let cuts = 0;
		let last = d.hp;
		for (let i = 0; i < 180; i++) {
			d.x = 150;
			d.y = 0;
			d.vx = d.vy = 0;
			run(p, w, IDLE, DT);
			if (d.hp < last) cuts++;
			last = d.hp;
		}
		expect(cuts).toBe(2);
		expect(w.projectiles.some((pr) => pr.kind === 'saw')).toBe(false);
	});

	it('Afterburner flies Hal straight through an enemy, hitting it, and he can’t be hurt while it lasts', () => {
		const d = createDummy(120, 0);
		const { p, w } = setup('hal', 'afterburner', [d]);
		run(p, w, FIRE, DT);
		expect(p.dash?.kind).toBe('burn');
		expect(p.invuln).toBeGreaterThan(0);
		for (let i = 0; i < 30; i++) {
			updatePlayer(p, IDLE, DT);
			updateSignature(p, IDLE, DT, w);
			updateConstructWorld(w, DT);
		}
		expect(p.x).toBeGreaterThan(200);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		expect(p.dash).toBeNull();
	});

	it('Shotgun blasts a spread of pellets', () => {
		const { p, w } = setup('hal', 'shotgun');
		run(p, w, FIRE, DT);
		const pellets = w.projectiles.filter((pr) => pr.kind === 'bullet');
		expect(pellets).toHaveLength(CONSTRUCTS.shotgun.count);
		const angles = pellets.map((pr) => Math.atan2(pr.vy, pr.vx));
		expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(0.4);
	});
});

describe("John's new constructs", () => {
	it('a Mine waits, then blows up when an enemy comes close', () => {
		const d = createDummy(400, 0);
		const { p, w } = setup('john', 'mines', [d]);
		press(p, w, 0.5);
		expect(w.traps.filter((t) => t.kind === 'mine')).toHaveLength(1);
		expect(d.hp).toBe(DUMMY_HP);
		d.x = CONSTRUCTS.mines.range + 10;
		run(p, w, IDLE, 0.1);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		expect(w.traps).toHaveLength(0);
	});

	it('Aid Station heals Lanterns standing in it, not ones outside', () => {
		const { p, w } = setup('john', 'aid');
		const far = createPlayer(1, LANTERNS.hal, { read: () => IDLE }, 900, 0);
		p.health = 40;
		far.health = 40;
		press(p, w, DT);
		for (let i = 0; i < 120; i++) updateAidStations(w, [p, far], DT);
		expect(p.health).toBeGreaterThan(50);
		expect(far.health).toBe(40);
	});

	it('mines and cages count separately', () => {
		const { p, w } = setup('john', 'mines');
		for (let i = 0; i < 6; i++) {
			p.aimY = i * 0.3;
			p.aimX = 1;
			press(p, w, 1);
		}
		expect(w.traps.filter((t) => t.kind === 'mine')).toHaveLength(MAX_MINES_PER_PLAYER);
	});
});

describe('what you see is what you hit', () => {
	/** A Lantern flying over a planet: their ring (and shots) are drawn high above the ground. */
	function highFlyer(lift: number, dummies: Dummy[]) {
		const { p, w } = setup('hal', 'beam', dummies);
		p.ringLift = lift;
		return { p, w };
	}
	const fireAt = (p: Player, w: ConstructWorld, gx: number, gy: number) => {
		const len = Math.hypot(gx - p.x, gy - p.y);
		p.aimX = (gx - p.x) / len;
		p.aimY = (gy - p.y) / len;
		run(p, w, { ...IDLE, shot: true }, DT);
		run(p, w, IDLE, 0.6);
	};

	it("a shot drawn through the enemy's chest or head hits, even from a Lantern flying high above", () => {
		for (const part of [0.2, 0.5, 0.85]) {
			const d = createDummy(300, 0);
			const lift = 129;
			const { p, w } = highFlyer(lift, [d]);
			// The crosshair on that part of the drawn body: the shot's ground point is that far down, plus the lift
			fireAt(p, w, 300, d.y - BODY.dummy.height * part + lift);
			expect(d.hp, `part ${part}`).toBeLessThan(DUMMY_HP);
		}
	});

	it("a shot drawn clearly over the enemy's head misses", () => {
		const d = createDummy(300, 0);
		const lift = 129;
		const { p, w } = highFlyer(lift, [d]);
		fireAt(p, w, 300, d.y - BODY.dummy.height - 40 + lift);
		expect(d.hp).toBe(DUMMY_HP);
	});

	it('the beam stops at the drawn body, wherever along it you aim', () => {
		const d = createDummy(250, 0);
		const { p, w } = highFlyer(60, [d]);
		p.aimX = 1;
		p.aimY = 0;
		p.y = d.y - 40 + 60; // the beam is drawn across the enemy's middle
		run(p, w, HOLD, 0.3);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});
});
