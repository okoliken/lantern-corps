import { describe, expect, it } from 'vitest';
import { LANTERNS } from './lanterns';
import { IDLE } from './input';
import { createPlayer } from './player';
import {
	MAX_LEVEL,
	MAX_RANK,
	addXp,
	applyProgression,
	canUpgrade,
	newProfile,
	parseProfiles,
	refund,
	upgrade,
	xpToNext
} from './progression';

describe('levels', () => {
	it('XP fills up to a level, and each level gives a point', () => {
		const p = newProfile();
		expect(addXp(p, xpToNext(1) - 1)).toBe(0);
		expect(p.level).toBe(1);
		expect(addXp(p, 1)).toBe(1);
		expect(p.level).toBe(2);
		expect(p.points).toBe(1);
		expect(p.xp).toBe(0);
	});

	it('a big XP gain can give several levels at once, keeping the leftover', () => {
		const p = newProfile();
		const gained = addXp(p, xpToNext(1) + xpToNext(2) + 10);
		expect(gained).toBe(2);
		expect(p.level).toBe(3);
		expect(p.xp).toBe(10);
	});

	it(`stops at level ${MAX_LEVEL}`, () => {
		const p = newProfile();
		addXp(p, 1_000_000);
		expect(p.level).toBe(MAX_LEVEL);
		expect(p.points).toBe(MAX_LEVEL - 1);
		expect(addXp(p, 500)).toBe(0);
	});
});

describe('upgrades', () => {
	it('spend a point to rank up', () => {
		const p = newProfile();
		addXp(p, xpToNext(1));
		expect(upgrade(p, 'power')).toBe(true);
		expect(p.ranks.power).toBe(1);
		expect(p.points).toBe(0);
	});

	it(`can't upgrade without points or past rank ${MAX_RANK}`, () => {
		const p = newProfile();
		expect(canUpgrade(p, 'focus')).toBe(false);
		p.points = 10;
		p.ranks.focus = MAX_RANK;
		expect(canUpgrade(p, 'focus')).toBe(false);
	});

	it('refund gives every point back', () => {
		const p = newProfile();
		p.points = 3;
		upgrade(p, 'power');
		upgrade(p, 'willpower');
		refund(p);
		expect(p.points).toBe(3);
		expect(Object.values(p.ranks).every((r) => r === 0)).toBe(true);
	});
});

describe('applying to a player', () => {
	const setup = () => createPlayer(0, LANTERNS.hal, { read: () => IDLE }, 0, 0);

	it('Willpower and Recovery change the willpower numbers', () => {
		const player = setup();
		const p = newProfile();
		p.ranks.willpower = 2;
		p.ranks.recovery = 2;
		applyProgression(player, LANTERNS.hal, p);
		expect(player.maxWillpower).toBe(120);
		expect(player.regenMultiplier).toBeCloseTo(1.3);
	});

	it(`Power and Focus stack on top of the Lantern's own traits`, () => {
		const player = setup();
		const p = newProfile();
		p.ranks.power = 5;
		p.ranks.focus = 5;
		applyProgression(player, LANTERNS.hal, p);
		expect(player.def.traits.power).toBeCloseTo(LANTERNS.hal.traits.power * 1.3);
		expect(player.def.traits.cooldown).toBeCloseTo(LANTERNS.hal.traits.cooldown * 0.75);
	});

	it(`doesn't change the shared Hal definition`, () => {
		const player = setup();
		const p = newProfile();
		p.ranks.power = 5;
		applyProgression(player, LANTERNS.hal, p);
		expect(LANTERNS.hal.traits.power).toBe(1.2);
	});
});

describe('saved profiles', () => {
	it('survive round-tripping', () => {
		const saved = { hal: { xp: 40, level: 3, points: 1, ranks: { willpower: 1, recovery: 0, power: 0, focus: 0 } } };
		const parsed = parseProfiles(JSON.parse(JSON.stringify(saved)));
		expect(parsed.hal.level).toBe(3);
		expect(parsed.hal.ranks.willpower).toBe(1);
		expect(parsed.john.level).toBe(1);
	});

	it('fall back to a fresh start on garbage', () => {
		expect(parseProfiles('nope').hal.level).toBe(1);
		expect(parseProfiles({ hal: { level: 99, ranks: { power: 'lots' } } }).hal.level).toBe(1);
	});

	it(`don't allow more points and ranks than the level earned (tampered saves)`, () => {
		const parsed = parseProfiles({ hal: { xp: 0, level: 2, points: 5, ranks: { willpower: 5, recovery: 5, power: 5, focus: 5 } } });
		const total = parsed.hal.points + Object.values(parsed.hal.ranks).reduce((a, b) => a + b, 0);
		expect(total).toBe(1);
	});
});
