// Willpower: the one resource every construct runs on.
//
//  - Using a construct spends it (once per use, or per second for the beam).
//  - It trickles back on its own shortly after you stop using constructs,
//    faster standing on the ground than flying.
//  - A Lantern battery refills it fast, but the battery's own charge is
//    limited and only slowly comes back. You can't camp it forever.
//  - Run dry and you're EXHAUSTED: nothing works until you've recovered to
//    RESTART_THRESHOLD, so constructs don't flicker on and off at 0.

export const MAX_WILLPOWER = 100;
/** Exhausted Lanterns need this much back before any construct works again. */
export const RESTART_THRESHOLD = 15;
/** Seconds after using a construct before passive recovery kicks in. */
export const RECOVER_DELAY = 0.6;
/** Passive recovery per second. */
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
	/** Ran dry; locked out until back to RESTART_THRESHOLD. */
	exhausted: boolean;
	/** Seconds until passive recovery starts. */
	recoverDelay: number;
	charging: boolean;
}

/** Can this Lantern afford `cost` right now? */
export function canSpend(p: WillpowerUser, cost: number): boolean {
	return !p.exhausted && p.willpower >= cost;
}

/** Spend willpower. Hitting 0 makes the Lantern exhausted. */
export function spend(p: WillpowerUser, cost: number) {
	p.willpower = Math.max(0, p.willpower - cost);
	p.recoverDelay = RECOVER_DELAY;
	if (p.willpower <= 0) p.exhausted = true;
}

export function inBatteryRange(p: { x: number; y: number }, b: Battery): boolean {
	return Math.hypot(p.x - b.x, p.y - b.y) <= BATTERY_RADIUS;
}

/** One tick of recovery: passive regen, batteries, and clearing exhaustion. */
export function updateWillpower(p: WillpowerUser, dt: number, batteries: Battery[] = []) {
	p.recoverDelay = Math.max(0, p.recoverDelay - dt);
	if (p.recoverDelay === 0) {
		p.willpower += (p.flying ? REGEN_AIR : REGEN_GROUND) * dt;
	}

	p.charging = false;
	for (const b of batteries) {
		if (p.willpower >= MAX_WILLPOWER || b.charge <= 0 || !inBatteryRange(p, b)) continue;
		const give = Math.min(BATTERY_RATE * dt, MAX_WILLPOWER - p.willpower, b.charge);
		p.willpower += give;
		b.charge -= give;
		p.charging = true;
	}

	p.willpower = Math.min(p.willpower, MAX_WILLPOWER);
	if (p.exhausted && p.willpower >= RESTART_THRESHOLD) p.exhausted = false;
}

/** A battery slowly recovers its own charge. */
export function updateBattery(b: Battery, dt: number) {
	b.charge = Math.min(BATTERY_MAX_CHARGE, b.charge + BATTERY_REGEN * dt);
}
