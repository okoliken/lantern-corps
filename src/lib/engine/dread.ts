// Dread: what fear does to a Lantern (season two). Willpower is overcoming
// fear, so the more afraid you are, the weaker your constructs come out.
//
// It builds up near things that feed on fear (Scarecrow, the Yellow
// Lanterns: anything drawn in the 'fear' tint) and fast when they hurt you;
// missions can add it too (fear gas). It drains away by itself, much faster
// behind your own bubble shield, and every hit you land knocks some off:
// willpower beating fear. It never stops you playing.

import type { ConstructWorld } from './constructs/system';
import { isStanding } from './dummy';
import { isEnemy, tintOf } from './enemies/enemies';
import type { Player } from './player';

export const DREAD = {
	/** Fear enemies this close wear on you. */
	aura: 460,
	/** Dread a second from each fear enemy in range. */
	auraRate: 0.03,
	/** Taking a hit with a fear enemy close by: dread per point of damage. */
	perDamage: 0.007,
	/** How close a fear enemy has to be for a hit to count as fear. */
	hitRange: 900,
	/** Draining by itself, and behind your own bubble shield. */
	decay: 0.035,
	shieldDecay: 0.2,
	/** Every point of damage you deal knocks this much off. */
	hitRelief: 0.0025,
	/** At full dread, constructs do this much less damage. */
	weakest: 0.45
};

/** How hard a Lantern's constructs hit, given their dread (1 = not afraid at all). */
export function dreadPower(p: Pick<Player, 'dread'>): number {
	return 1 - DREAD.weakest * p.dread;
}

export function addDread(p: Player, amount: number) {
	if (p.hero) return;
	p.dread = Math.min(1, Math.max(0, p.dread + amount));
}

/** Landing a hit pushes fear back. */
export function relieveDread(p: Player, damage: number) {
	p.dread = Math.max(0, p.dread - damage * DREAD.hitRelief);
}

/** One tick: fear enemies nearby and the hits they land build it; time and a shield drain it. */
export function updateDread(p: Player, dt: number, w: ConstructWorld) {
	if (p.hero) return;
	const hurt = Math.max(0, p.dreadHealth - p.health);
	p.dreadHealth = p.health;
	if (p.downed) {
		p.dread = Math.max(0, p.dread - DREAD.shieldDecay * dt);
		return;
	}
	let near = 0;
	let close = false;
	for (const d of w.dummies) {
		if (!isEnemy(d) || !isStanding(d) || tintOf(d) !== 'fear') continue;
		const dist = Math.hypot(d.x - p.x, d.y - p.y);
		if (dist < DREAD.aura) near++;
		if (dist < DREAD.hitRange) close = true;
	}
	let change = near * DREAD.auraRate * dt;
	if (close && hurt > 0) change += hurt * DREAD.perDamage;
	const shielded = w.shields.some((s) => s.target === p);
	// It only fades by itself away from them; a shield pushes it back anywhere
	change -= (shielded ? DREAD.shieldDecay : near > 0 ? 0 : DREAD.decay) * dt;
	p.dread = Math.min(1, Math.max(0, p.dread + change));
}
