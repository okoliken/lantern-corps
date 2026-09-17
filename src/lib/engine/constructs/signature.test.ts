import { describe, expect, it } from 'vitest';
import { DUMMY_HP, createDummy, updateDummy, type Dummy } from '../dummy';
import { IDLE, type Intent } from '../input';
import { LANTERNS, type LanternId } from '../lanterns';
import { CRATE_HP, type Obstacle } from '../map';
import { createPlayer, updatePlayer, type Player } from '../player';
import { FORTRESS, JET, SIGNATURES, updateSignature, updateSignatureWorld } from './signature';
import {
	SURGE_MAX,
	absorbWithShield,
	createConstructWorld,
	updateConstructWorld,
	updatePlayerConstructs,
	type ConstructWorld
} from './system';

const DT = 1 / 60;
const PRESS: Intent = { ...IDLE, signature: true };

function setup(id: LanternId, dummies: Dummy[] = [], obstacles: Obstacle[] = []) {
	const p = createPlayer(0, LANTERNS[id], { read: () => IDLE }, 0, 0);
	const w = createConstructWorld(obstacles, dummies);
	return { p, w };
}

/** Run the same order the Game uses. */
function run(p: Player, w: ConstructWorld, intent: Intent, seconds: number) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		updatePlayer(p, intent, DT, { solids: w.obstacles, alwaysFlying: false });
		updatePlayerConstructs(p, intent, DT, w);
		updateSignature(p, intent, DT, w);
		updateConstructWorld(w, DT);
		updateSignatureWorld(w, DT);
		for (const d of w.dummies) updateDummy(d, DT, w.obstacles);
	}
}

describe('surge meter', () => {
	it('fills from damage dealt', () => {
		const d = createDummy(150, 0);
		const { p, w } = setup('hal', [d]);
		run(p, w, { ...IDLE, shot: true }, 2);
		expect(p.surge).toBeGreaterThan(0);
	});

	it('fills a little from using constructs', () => {
		const { p, w } = setup('john');
		p.selected = 2; // Energy Wall, placed in open space
		run(p, w, { ...IDLE, construct: true, constructPressed: true }, DT);
		expect(p.surge).toBeGreaterThan(0);
	});

	it('the ability does nothing until the meter is full', () => {
		const { p, w } = setup('john');
		p.surge = SURGE_MAX - 1;
		run(p, w, PRESS, DT);
		expect(w.fortresses).toHaveLength(0);
		expect(p.surge).toBe(SURGE_MAX - 1);
	});

	it('using it empties the meter', () => {
		const { p, w } = setup('john');
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		expect(p.surge).toBe(0);
	});

	it('each Lantern has their own signature', () => {
		expect(SIGNATURES.hal.id).toBe('jetStrike');
		expect(SIGNATURES.john.id).toBe('fortress');
	});
});

describe('Hal: Jet Strike', () => {
	it('rockets Hal along his aim, ignoring movement input', () => {
		const { p, w } = setup('hal');
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, { ...IDLE, moveX: -1 }, JET.duration * 0.5);
		expect(p.x).toBeGreaterThan(150);
		expect(p.dash).not.toBeNull();
	});

	it('flies over low buildings', () => {
		const building: Obstacle = { kind: 'building', x: 100, y: -100, w: 80, h: 200, height: 120, blocksFlying: false, seed: 0 };
		const { p, w } = setup('hal', [], [building]);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, JET.duration);
		expect(p.x).toBeGreaterThan(180);
	});

	it('is stopped early by something tall (an asteroid or energy wall)', () => {
		const rock: Obstacle = { kind: 'asteroid', x: 100, y: -100, w: 80, h: 200, height: 60, blocksFlying: true, seed: 0 };
		const { p, w } = setup('hal', [], [rock]);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, JET.duration);
		expect(p.x).toBeLessThanOrEqual(100);
		expect(p.dash).toBeNull();
	});

	it('hits every enemy along the path exactly once', () => {
		const a = createDummy(120, 5);
		const b = createDummy(260, -5);
		const { p, w } = setup('hal', [a, b]);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, 0.12);
		const hpA = a.hp;
		expect(hpA).toBeLessThan(DUMMY_HP);
		run(p, w, IDLE, 0.25);
		expect(b.hp).toBeLessThan(DUMMY_HP);
		// a was only hit by the dash once (missiles come after the run ends)
		expect(DUMMY_HP - hpA).toBeCloseTo(JET.damage * LANTERNS.hal.traits.power, 0);
	});

	it('breaks crates it flies through', () => {
		const crate: Obstacle = { kind: 'crate', x: 150, y: -14, w: 40, h: 28, height: 28, blocksFlying: false, seed: 0, hp: CRATE_HP };
		const obstacles = [crate];
		const { p, w } = setup('hal', [], obstacles);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, JET.duration);
		expect(obstacles).not.toContain(crate);
	});

	it('fires homing missiles at nearby enemies when the run ends', () => {
		const target = createDummy(600, 250);
		const { p, w } = setup('hal', [target]);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, JET.duration + 0.05);
		expect(w.projectiles.filter((pr) => pr.kind === 'missile').length).toBe(JET.missiles);
		run(p, w, IDLE, 2);
		expect(target.hp).toBeLessThan(DUMMY_HP);
	});

	it('its damage does not refill the meter', () => {
		const d = createDummy(150, 0);
		const { p, w } = setup('hal', [d]);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, 3);
		expect(p.surge).toBe(0);
	});
});

describe('John: Fortress', () => {
	it('raises a dome where John stands', () => {
		const { p, w } = setup('john');
		p.x = 50;
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		expect(w.fortresses).toHaveLength(1);
		expect(w.fortresses[0].x).toBe(50);
	});

	it('pushes enemies out of the dome', () => {
		const d = createDummy(30, 0);
		const { p, w } = setup('john', [d]);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, 0.3);
		expect(Math.hypot(d.x, d.y)).toBeGreaterThanOrEqual(FORTRESS.radius - 1);
	});

	it('turrets shoot enemies in range', () => {
		const d = createDummy(300, 0);
		const { p, w } = setup('john', [d]);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, 2);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it('anyone inside takes no damage; outside, damage gets through', () => {
		const { p, w } = setup('john');
		const partner = createPlayer(1, LANTERNS.hal, { read: () => IDLE }, 60, 0);
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		expect(absorbWithShield(w, partner, 50)).toBe(0);
		partner.x = 500;
		expect(absorbWithShield(w, partner, 50)).toBe(50);
	});

	it('fades after its duration', () => {
		const { p, w } = setup('john');
		p.surge = SURGE_MAX;
		run(p, w, PRESS, DT);
		run(p, w, IDLE, FORTRESS.duration * LANTERNS.john.traits.durability + 0.2);
		expect(w.fortresses).toHaveLength(0);
	});
});
