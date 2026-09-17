import { describe, expect, it } from 'vitest';
import {
	BATTERY_MAX_CHARGE,
	BATTERY_RADIUS,
	MAX_WILLPOWER,
	RECOVER_DELAY,
	REGEN_AIR,
	REGEN_GROUND,
	RESTART_THRESHOLD,
	canSpend,
	spend,
	updateBattery,
	updateWillpower,
	type Battery,
	type WillpowerUser
} from './willpower';

const DT = 1 / 60;

const lantern = (willpower = MAX_WILLPOWER, flying = false): WillpowerUser => ({
	x: 0,
	y: 0,
	flying,
	willpower,
	exhausted: false,
	recoverDelay: 0,
	charging: false
});

function wait(p: WillpowerUser, seconds: number, batteries: Battery[] = []) {
	for (let i = 0; i < Math.round(seconds * 60); i++) updateWillpower(p, DT, batteries);
}

describe('spending willpower', () => {
	it('spend takes willpower away', () => {
		const p = lantern(50);
		spend(p, 20);
		expect(p.willpower).toBe(30);
	});

	it('you can only spend what you have', () => {
		expect(canSpend(lantern(10), 20)).toBe(false);
		expect(canSpend(lantern(30), 20)).toBe(true);
	});

	it('hitting 0 makes you exhausted, and nothing is affordable', () => {
		const p = lantern(5);
		spend(p, 10);
		expect(p.willpower).toBe(0);
		expect(p.exhausted).toBe(true);
		p.willpower = 50;
		expect(canSpend(p, 1)).toBe(false);
	});

	it('exhaustion lifts once you recover to the restart threshold', () => {
		const p = lantern(5);
		spend(p, 10);
		wait(p, RECOVER_DELAY + (RESTART_THRESHOLD - 1) / REGEN_GROUND);
		expect(p.exhausted).toBe(true);
		wait(p, 0.5);
		expect(p.exhausted).toBe(false);
	});
});

describe('recovery', () => {
	it('waits a moment after using a construct before recovering', () => {
		const p = lantern(50);
		spend(p, 10);
		wait(p, RECOVER_DELAY / 2);
		expect(p.willpower).toBe(40);
	});

	it('recovers faster on the ground than in the air', () => {
		const walker = lantern(50, false);
		const flyer = lantern(50, true);
		wait(walker, 1);
		wait(flyer, 1);
		expect(walker.willpower).toBeCloseTo(50 + REGEN_GROUND, 0);
		expect(flyer.willpower).toBeCloseTo(50 + REGEN_AIR, 0);
	});

	it('never goes above max', () => {
		const p = lantern(MAX_WILLPOWER - 1);
		wait(p, 5);
		expect(p.willpower).toBe(MAX_WILLPOWER);
	});
});

describe('Lantern battery', () => {
	const battery = (charge = BATTERY_MAX_CHARGE, x = 0): Battery => ({ x, y: 0, charge });

	it('refills you fast when you are close', () => {
		const p = lantern(20);
		wait(p, 1, [battery()]);
		expect(p.willpower).toBeGreaterThan(20 + REGEN_GROUND + 30);
		expect(p.charging).toBe(true);
	});

	it('refills even right after using a construct', () => {
		const p = lantern(20);
		spend(p, 5);
		wait(p, 0.2, [battery()]);
		expect(p.willpower).toBeGreaterThan(15);
	});

	it('does nothing when you are out of range', () => {
		const p = lantern(20);
		wait(p, 1, [battery(BATTERY_MAX_CHARGE, BATTERY_RADIUS + 50)]);
		expect(p.willpower).toBeCloseTo(20 + REGEN_GROUND, 0);
		expect(p.charging).toBe(false);
	});

	it('spends its own charge, and an empty battery gives nothing', () => {
		const p = lantern(20);
		const b = battery(10);
		wait(p, 1, [b]);
		expect(b.charge).toBe(0);
		const before = p.willpower;
		wait(p, 1, [b]);
		expect(p.willpower).toBeCloseTo(before + REGEN_GROUND, 0);
	});

	it('stops charging once you are full', () => {
		const p = lantern(MAX_WILLPOWER);
		const b = battery();
		wait(p, 1, [b]);
		expect(b.charge).toBe(BATTERY_MAX_CHARGE);
		expect(p.charging).toBe(false);
	});

	it('slowly recovers its own charge', () => {
		const b = battery(0);
		updateBattery(b, 1);
		expect(b.charge).toBeGreaterThan(0);
	});
});
