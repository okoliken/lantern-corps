import { describe, expect, it } from 'vitest';
import {
	BATTERY_MAX_CHARGE,
	BATTERY_RADIUS,
	BEAM_COST,
	MAX_WILLPOWER,
	REGEN_AIR,
	REGEN_GROUND,
	RESTART_THRESHOLD,
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
	firing: false,
	charging: false
});

function hold(p: WillpowerUser, fire: boolean, seconds: number, batteries: Battery[] = []) {
	for (let i = 0; i < Math.round(seconds * 60); i++) updateWillpower(p, fire, DT, batteries);
}

describe('updateWillpower', () => {
	it('firing drains willpower', () => {
		const p = lantern();
		hold(p, true, 1);
		expect(p.firing).toBe(true);
		expect(p.willpower).toBeCloseTo(MAX_WILLPOWER - BEAM_COST, 0);
	});

	it('letting go stops the beam', () => {
		const p = lantern();
		hold(p, true, 0.5);
		hold(p, false, DT);
		expect(p.firing).toBe(false);
	});

	it('the beam cuts out when willpower runs dry', () => {
		const p = lantern(5);
		hold(p, true, 0.1);
		p.willpower = 0.1;
		hold(p, true, 0.1);
		expect(p.firing).toBe(false);
	});

	it(`can't start firing below the restart threshold`, () => {
		const p = lantern(RESTART_THRESHOLD - 1);
		updateWillpower(p, true, DT);
		expect(p.firing).toBe(false);
	});

	it('can keep firing below the threshold once already firing', () => {
		const p = lantern(RESTART_THRESHOLD + 1);
		hold(p, true, 0.5);
		expect(p.willpower).toBeLessThan(RESTART_THRESHOLD);
		expect(p.firing).toBe(true);
	});

	it('recovers faster on the ground than in the air', () => {
		const walker = lantern(50, false);
		const flyer = lantern(50, true);
		hold(walker, false, 1);
		hold(flyer, false, 1);
		expect(walker.willpower).toBeCloseTo(50 + REGEN_GROUND, 0);
		expect(flyer.willpower).toBeCloseTo(50 + REGEN_AIR, 0);
	});

	it('never goes above max', () => {
		const p = lantern(MAX_WILLPOWER - 1);
		hold(p, false, 5);
		expect(p.willpower).toBe(MAX_WILLPOWER);
	});
});

describe('Lantern battery', () => {
	const battery = (charge = BATTERY_MAX_CHARGE, x = 0): Battery => ({ x, y: 0, charge });

	it('refills you fast when you are close', () => {
		const p = lantern(20);
		const b = battery();
		hold(p, false, 1, [b]);
		expect(p.willpower).toBeGreaterThan(20 + REGEN_GROUND + 30);
		expect(p.charging).toBe(true);
	});

	it('does nothing when you are out of range', () => {
		const p = lantern(20);
		hold(p, false, 1, [battery(BATTERY_MAX_CHARGE, BATTERY_RADIUS + 50)]);
		expect(p.willpower).toBeCloseTo(20 + REGEN_GROUND, 0);
		expect(p.charging).toBe(false);
	});

	it('spends its own charge, and an empty battery gives nothing', () => {
		const p = lantern(20);
		const b = battery(10);
		hold(p, false, 1, [b]);
		expect(b.charge).toBe(0);
		const before = p.willpower;
		hold(p, false, 1, [b]);
		expect(p.willpower).toBeCloseTo(before + REGEN_GROUND, 0);
	});

	it('stops charging once you are full', () => {
		const p = lantern(MAX_WILLPOWER);
		const b = battery();
		hold(p, false, 1, [b]);
		expect(b.charge).toBe(BATTERY_MAX_CHARGE);
		expect(p.charging).toBe(false);
	});

	it('slowly recovers its own charge', () => {
		const b = battery(0);
		updateBattery(b, 1);
		expect(b.charge).toBeGreaterThan(0);
	});
});
