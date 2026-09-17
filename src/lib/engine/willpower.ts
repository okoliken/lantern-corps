// Willpower: the one resource every construct runs on.
//
//  - Firing drains it.
//  - It trickles back on its own, faster standing on the ground than flying.
//  - A Lantern battery refills it fast, but the battery's own charge is
//    limited and only slowly comes back. That's the tension: you can't
//    just camp the battery forever in a big fight.
//  - Run dry and the beam cuts out. It won't restart until you've recovered
//    a little (RESTART_THRESHOLD), so it doesn't flicker on and off at 0.

export const MAX_WILLPOWER = 100;
/** Willpower per second while the beam is on. */
export const BEAM_COST = 22;
/** Need at least this much to START firing again after stopping. */
export const RESTART_THRESHOLD = 15;
/** Passive recovery per second (not while firing). */
export const REGEN_GROUND = 6;
export const REGEN_AIR = 2;

/** Battery: how close you need to be, and how fast it refills you. */
export const BATTERY_RADIUS = 90;
export const BATTERY_RATE = 45;
export const BATTERY_MAX_CHARGE = 400;
/** How fast a battery's own charge comes back, per second. */
export const BATTERY_REGEN = 4;

export interface Battery {
	x: number;
	y: number;
	charge: number;
}

/** The bits of a Player this module reads and writes. */
export interface WillpowerUser {
	x: number;
	y: number;
	flying: boolean;
	willpower: number;
	firing: boolean;
	charging: boolean;
}

export function inBatteryRange(p: { x: number; y: number }, b: Battery): boolean {
	return Math.hypot(p.x - b.x, p.y - b.y) <= BATTERY_RADIUS;
}

/**
 * One tick of willpower: decides whether the beam is on, drains or
 * regenerates, and draws from a nearby battery.
 */
export function updateWillpower(p: WillpowerUser, wantsFire: boolean, dt: number, batteries: Battery[] = []) {
	// ---- Is the beam on? ----
	if (p.firing) {
		if (!wantsFire || p.willpower <= 0) p.firing = false;
	} else if (wantsFire && p.willpower >= RESTART_THRESHOLD) {
		p.firing = true;
	}

	// ---- Drain or recover ----
	if (p.firing) {
		p.willpower = Math.max(0, p.willpower - BEAM_COST * dt);
	} else {
		p.willpower += (p.flying ? REGEN_AIR : REGEN_GROUND) * dt;
	}

	// ---- Battery ----
	p.charging = false;
	for (const b of batteries) {
		if (p.willpower >= MAX_WILLPOWER || b.charge <= 0 || !inBatteryRange(p, b)) continue;
		const give = Math.min(BATTERY_RATE * dt, MAX_WILLPOWER - p.willpower, b.charge);
		p.willpower += give;
		b.charge -= give;
		p.charging = true;
	}

	p.willpower = Math.min(p.willpower, MAX_WILLPOWER);
}

/** A battery slowly recovers its own charge. */
export function updateBattery(b: Battery, dt: number) {
	b.charge = Math.min(BATTERY_MAX_CHARGE, b.charge + BATTERY_REGEN * dt);
}
