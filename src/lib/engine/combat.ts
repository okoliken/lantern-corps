// Lanterns taking damage.
//
// Every hit on a Lantern goes through damagePlayer():
//  1. A bubble shield (or being inside a Fortress) soaks it up first.
//  2. Whatever gets through lowers health, knocks them back, makes them flinch,
//     and gives a moment of invulnerability so one attack can't hit twice.
//  3. At 0 health they're DOWNED: they can't move or use the ring, and after a
//     few seconds they get back up (at the battery, on test maps).

import { GUARD, STEEL } from './heroes';
import { absorbWithShield, type ConstructWorld } from './constructs/system';
import type { Player } from './player';

export const PLAYER_MAX_HEALTH = 150;
/** Seconds of invulnerability after taking a hit. */
export const HIT_INVULN = 0.5;
/** Out of the fight this long (no damage taken), health starts coming back... */
export const REGEN_DELAY = 5;
/** ...at this many points a second. */
export const REGEN_RATE = 3.5;
/** Seconds of invulnerability after getting back up. */
export const REVIVE_INVULN = 2;
/** Seconds spent downed before getting back up. */
export const DOWNED_TIME = 4;
/** How long the flinch pose lasts. */
export const HURT_TIME = 0.35;
/** How much further a Red Lantern's hit throws a Lantern. */
export const RAGE_KNOCKBACK = 1.45;
/** How much damage still gets through John's Power Armor. */
export const ARMOR_TAKES = 0.4;

/**
 * Deal damage to a Lantern. Returns how much actually got through
 * (0 if a shield took it, or they're invulnerable or already down).
 */
export function damagePlayer(
	w: ConstructWorld,
	p: Player,
	amount: number,
	fromX: number,
	fromY: number,
	knockback = 0,
	/** Goes straight through a bubble shield (Grodd's Psychic Blast). */
	pierce = false
): number {
	if (p.downed || p.invuln > 0 || amount <= 0) return 0;
	// Red Lantern hits throw you further
	if (w.rage > 1) knockback *= RAGE_KNOCKBACK;
	// No single hit takes more than the mission allows
	if (w.maxHit !== undefined) amount = Math.min(amount, w.maxHit);
	// Power Armor takes most of the blow
	if (p.armor) amount *= ARMOR_TAKES;
	if (p.hero?.id === 'superman') amount *= STEEL;
	// Hawkgirl's wings wrapped round her, Wonder Woman's bracelets up
	if (p.hero && p.hero.guard > 0) {
		amount *= GUARD.takes;
		knockback *= GUARD.takes;
	}

	const through = pierce ? amount : absorbWithShield(w, p, amount);
	if (through <= 0) return 0;

	p.health = Math.max(0, p.health - through);
	p.hurtTimer = HURT_TIME;
	p.sinceHurt = 0;
	p.invuln = HIT_INVULN;
	w.effects.push({ kind: 'number', x: p.x, y: p.y, age: 0, life: 0.9, value: Math.round(through), hurt: true });

	if (knockback > 0) {
		const dx = p.x - fromX;
		const dy = p.y - fromY;
		const len = Math.hypot(dx, dy) || 1;
		p.vx += (dx / len) * knockback;
		p.vy += (dy / len) * knockback;
	}

	if (p.health <= 0) knockDown(w, p);
	return through;
}

function knockDown(w: ConstructWorld, p: Player) {
	p.downed = true;
	p.downTimer = DOWNED_TIME;
	p.firing = false;
	p.charge = 0;
	p.beamLength = 0;
	p.dash = null;
	w.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 1.5, text: 'DOWN!', owner: p });
}

/**
 * Tick a Lantern's combat timers. Returns true on the tick they're ready to
 * get back up (the Game decides where).
 */
export function updatePlayerCombat(p: Player, dt: number): boolean {
	p.invuln = Math.max(0, p.invuln - dt);
	p.hurtTimer = Math.max(0, p.hurtTimer - dt);
	p.sinceHurt += dt;
	// A breather out of the fight: health slowly comes back
	if (!p.downed && p.sinceHurt >= REGEN_DELAY) p.health = Math.min(p.maxHealth, p.health + REGEN_RATE * dt);
	if (!p.downed) return false;
	p.downTimer = Math.max(0, p.downTimer - dt);
	return p.downTimer === 0;
}

/** Back on their feet at (x, y), full health, briefly invulnerable. */
export function revivePlayer(p: Player, x: number, y: number) {
	p.downed = false;
	p.health = p.maxHealth;
	p.invuln = REVIVE_INVULN;
	p.x = p.prevX = x;
	p.y = p.prevY = y;
	p.vx = p.vy = 0;
}
