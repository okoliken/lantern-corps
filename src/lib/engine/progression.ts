// Progression: XP, levels, and upgrades, kept separately for each Lantern.
//
// Deliberately simple:
//  - Defeating enemies earns XP. Enough XP = a level. Each level = 1 point.
//  - Points go into four upgrades, 5 ranks each, that change stats directly.
//  - Points can be refunded at Corps HQ, so there are no wrong choices.
//
// A Profile is plain data (saved in the browser). applyProgression() turns it
// into the numbers a Player actually uses.

import type { LanternDef, LanternId } from './lanterns';

export const MAX_LEVEL = 10;
export const MAX_RANK = 5;

/** XP for defeating a training dummy (and later, enemies of similar strength). */
export const XP_PER_DEFEAT = 25;

export type UpgradeId = 'willpower' | 'recovery' | 'power' | 'focus';

export interface UpgradeDef {
	id: UpgradeId;
	name: string;
	/** What one rank does, for the HQ screen. */
	perRank: string;
	description: string;
}

export const UPGRADES: UpgradeDef[] = [
	{ id: 'willpower', name: 'Willpower', perRank: '+10 max willpower', description: 'A bigger tank for your constructs.' },
	{ id: 'recovery', name: 'Recovery', perRank: '+15% recovery speed', description: 'Willpower comes back faster.' },
	{ id: 'power', name: 'Power', perRank: '+6% construct damage', description: 'Every construct hits harder.' },
	{ id: 'focus', name: 'Focus', perRank: '−5% cooldowns', description: 'Use constructs more often.' }
];

export interface Profile {
	xp: number;
	level: number;
	/** Unspent upgrade points. */
	points: number;
	ranks: Record<UpgradeId, number>;
}

export function newProfile(): Profile {
	return { xp: 0, level: 1, points: 0, ranks: { willpower: 0, recovery: 0, power: 0, focus: 0 } };
}

/** XP needed to go from `level` to the next one. Each level takes a bit longer. */
export function xpToNext(level: number): number {
	return 100 * level;
}

/**
 * Add XP, levelling up as many times as it pays for. Returns how many levels
 * were gained (0 most of the time). At max level, XP stops counting.
 */
export function addXp(profile: Profile, amount: number): number {
	if (profile.level >= MAX_LEVEL) return 0;
	profile.xp += amount;
	let gained = 0;
	while (profile.level < MAX_LEVEL && profile.xp >= xpToNext(profile.level)) {
		profile.xp -= xpToNext(profile.level);
		profile.level++;
		profile.points++;
		gained++;
	}
	if (profile.level >= MAX_LEVEL) profile.xp = 0;
	return gained;
}

export function canUpgrade(profile: Profile, id: UpgradeId): boolean {
	return profile.points > 0 && profile.ranks[id] < MAX_RANK;
}

export function upgrade(profile: Profile, id: UpgradeId): boolean {
	if (!canUpgrade(profile, id)) return false;
	profile.ranks[id]++;
	profile.points--;
	return true;
}

/** Take back every spent point. */
export function refund(profile: Profile) {
	for (const id of Object.keys(profile.ranks) as UpgradeId[]) {
		profile.points += profile.ranks[id];
		profile.ranks[id] = 0;
	}
}

/** The stat changes a profile gives. */
export interface ProgressionStats {
	maxWillpower: number;
	regenMultiplier: number;
	/** Multiplies the Lantern's own power trait. */
	powerMultiplier: number;
	/** Multiplies the Lantern's own cooldown trait (lower = faster). */
	cooldownMultiplier: number;
}

export function statsFor(profile: Profile): ProgressionStats {
	const r = profile.ranks;
	return {
		maxWillpower: 100 + 10 * r.willpower,
		regenMultiplier: 1 + 0.15 * r.recovery,
		powerMultiplier: 1 + 0.06 * r.power,
		cooldownMultiplier: 1 - 0.05 * r.focus
	};
}

/** The things applyProgression changes on a player. */
export interface Progressable {
	def: LanternDef;
	maxWillpower: number;
	willpower: number;
	regenMultiplier: number;
}

/**
 * Apply a profile to a player. The player gets its OWN copy of its character
 * definition with boosted traits, so every construct picks up the upgrades
 * without special cases, and the shared Hal/John definitions stay untouched.
 */
export function applyProgression(p: Progressable, base: LanternDef, profile: Profile) {
	const s = statsFor(profile);
	p.def = {
		...base,
		traits: {
			...base.traits,
			power: base.traits.power * s.powerMultiplier,
			cooldown: base.traits.cooldown * s.cooldownMultiplier
		}
	};
	p.maxWillpower = s.maxWillpower;
	p.willpower = Math.min(p.willpower, p.maxWillpower);
	p.regenMultiplier = s.regenMultiplier;
}

// ------------------------------------------------------------------- saving

export const PROFILES_KEY = 'lantern-corps:profiles';

export type Profiles = Record<LanternId, Profile>;

export function newProfiles(): Profiles {
	return { hal: newProfile(), john: newProfile() };
}

const whole = (n: unknown, min: number, max: number, fallback: number) =>
	typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : fallback;

/** Turn saved data (maybe old, maybe broken) into valid profiles. */
export function parseProfiles(raw: unknown): Profiles {
	const out = newProfiles();
	if (!raw || typeof raw !== 'object') return out;
	for (const id of ['hal', 'john'] as const) {
		const saved = (raw as Record<string, Partial<Profile> | undefined>)[id];
		if (!saved || typeof saved !== 'object') continue;
		const p = out[id];
		p.level = whole(saved.level, 1, MAX_LEVEL, 1);
		p.xp = typeof saved.xp === 'number' && saved.xp >= 0 ? Math.min(saved.xp, xpToNext(p.level)) : 0;
		p.points = whole(saved.points, 0, MAX_LEVEL, 0);
		for (const u of UPGRADES) p.ranks[u.id] = whole(saved.ranks?.[u.id], 0, MAX_RANK, 0);
		// Never more points + ranks than the level has earned
		const earned = p.level - 1;
		const spent = Object.values(p.ranks).reduce((a, b) => a + b, 0);
		if (spent + p.points > earned) {
			p.ranks = newProfile().ranks;
			p.points = earned;
		}
	}
	return out;
}
