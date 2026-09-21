import { describe, expect, it } from 'vitest';
import { damagePlayer, updatePlayerCombat } from './combat';
import { createConstructWorld, type ConstructWorld } from './constructs/system';
import { createDummy, updateDummy, type Dummy } from './dummy';
import { createEnemy, type Enemy } from './enemies/enemies';
import { BRACELETS, FROST, GUARD, HAYMAKER, LASSO, NTH_VS_CORE, MACE, STEEL, TORNADO, heroMoving, updateHero } from './heroes';
import { IDLE } from './input';
import { LANTERNS, type HeroId } from './lanterns';
import { createPlayer, updatePlayer, type Player } from './player';

const DT = 1 / 60;

function arena(id: HeroId, foes: Dummy[]) {
	const p = createPlayer(1, LANTERNS[id], { read: () => IDLE }, 0, 0);
	if (id !== 'flash') {
		p.flying = true;
		p.altitude = 1;
	}
	const w = createConstructWorld([], foes);
	w.players = [p];
	return { p, w };
}

function run(p: Player, w: ConstructWorld, seconds: number, each?: () => void) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		updatePlayerCombat(p, DT);
		if (!heroMoving(p)) updatePlayer(p, IDLE, DT);
		updateHero(p, DT, w, []);
		for (const d of w.dummies) updateDummy(d, DT, [], false);
		each?.();
	}
}

/** An enemy that just stands there (no brain ticking) with lots of health. */
function foe(x: number, y: number): Enemy {
	const e = createEnemy('gorillaBrute', x, y);
	e.hp = e.maxHp = 5000;
	return e;
}

describe('the Flash', () => {
	it('Blitz: runs in, lands a flurry of punches, and runs back out', () => {
		const e = foe(300, 0);
		const { p, w } = arena('flash', [e]);
		p.hero!.target = e;
		p.hero!.cooldowns.lightning = 99;
		let closest = Infinity;
		let outAfter = 0;
		run(p, w, 0.8, () => {
			const d = Math.hypot(p.x - e.x, p.y - e.y);
			closest = Math.min(closest, d);
			if (closest < 60) outAfter = Math.max(outAfter, d);
		});
		expect(closest).toBeLessThan(60);
		expect(e.hp).toBeLessThan(e.maxHp - 15);
		expect(outAfter).toBeGreaterThan(90);
	});

	it('Tornado: drags a crowd in, holds them helpless, and tears apart shots flying into it', () => {
		const crowd = [foe(200, -120), foe(260, 120), foe(120, 60)];
		const { p, w } = arena('flash', crowd);
		p.hero!.target = crowd[0];
		p.hero!.cooldowns.tornado = 0;
		run(p, w, 0.1);
		expect(p.hero!.move?.power).toBe('tornado');
		const mid = { x: p.hero!.move!.x, y: p.hero!.move!.y };
		const spread = () => crowd.reduce((s, e) => s + Math.hypot(e.x - mid.x, e.y - mid.y), 0);
		const before = spread();
		const shooter = createEnemy('gorillaGunner', 900, 0);
		w.red.shots.push({ kind: 'bolt', owner: shooter, x: mid.x + 60, y: mid.y, prevX: mid.x + 60, prevY: mid.y, vx: -100, vy: 0, life: 2, speed: 100, damage: 10, knockback: 0, ignore: [], hit: [], travelled: 0, out: 400, returning: false });
		run(p, w, 1);
		expect(spread()).toBeLessThan(before);
		expect(crowd.some((e) => e.stun > 0)).toBe(true);
		expect(w.red.shots).toHaveLength(0);
		expect(p.invuln).toBeGreaterThan(0);
		run(p, w, TORNADO.time);
		expect(p.hero!.move?.power).not.toBe('tornado');
	});

	it("with Grodd in his head he can't use his powers", () => {
		const e = foe(300, 0);
		const { p, w } = arena('flash', [e]);
		p.hero!.target = e;
		p.confused = 2;
		run(p, w, 0.5, () => (p.confused = 2));
		expect(e.hp).toBe(e.maxHp);
	});
});

describe('Hawkgirl', () => {
	it("the Nth metal mace smashes through an enemy's energy shield", () => {
		const e = foe(50, 0);
		e.ward = { hp: 999, maxHp: 999, life: 10 };
		const { p, w } = arena('hawkgirl', [e]);
		p.hero!.target = e;
		p.hero!.cooldowns.dive = p.hero!.cooldowns.rush = p.hero!.cooldowns.thunder = 99;
		run(p, w, 0.4);
		expect(e.ward).toBeUndefined();
		expect(e.hp).toBeLessThan(e.maxHp);
	});

	it('Dive: climbs out of reach, then comes straight down with a shockwave', () => {
		const e = foe(320, 0);
		const near = foe(360, 40);
		const { p, w } = arena('hawkgirl', [e, near]);
		p.hero!.target = e;
		p.hero!.cooldowns.dive = 0;
		let highest = 0;
		run(p, w, 1, () => (highest = Math.max(highest, p.hero!.rise)));
		expect(highest).toBeGreaterThan(100);
		expect(e.hp).toBeLessThan(e.maxHp);
		expect(near.hp).toBeLessThan(near.maxHp);
		expect(e.stun + near.stun).toBeGreaterThan(0);
	});

	it('Wing Guard: wings wrapped round her take most of a hit', () => {
		const { p, w } = arena('hawkgirl', []);
		damagePlayer(w, p, 40, 100, 0);
		const open = p.maxHealth - p.health;
		p.health = p.maxHealth;
		p.invuln = 0;
		p.hero!.guard = GUARD.time;
		damagePlayer(w, p, 40, 100, 0);
		expect(p.maxHealth - p.health).toBeCloseTo(open * GUARD.takes);
	});

	it("the mace does far more to a Manhunter's core than anyone else's hits", () => {
		const core = createDummy(50, 0);
		core.kind = 'manhunterCore';
		core.hp = core.maxHp = 1000;
		core.respawns = false;
		const { p, w } = arena('hawkgirl', [core]);
		p.hero!.target = core;
		p.hero!.cooldowns.dive = p.hero!.cooldowns.rush = p.hero!.cooldowns.thunder = 99;
		run(p, w, 0.4);
		expect(core.maxHp - core.hp).toBeCloseTo(MACE.damage * NTH_VS_CORE);
	});
});

describe('Superman', () => {
	it('Haymaker: across the street in a blink, and one punch that sends them flying', () => {
		const e = foe(420, 0);
		const { p, w } = arena('superman', [e]);
		p.hero!.target = e;
		p.hero!.cooldowns.heat = 99;
		let speed = 0;
		run(p, w, 0.7, () => (speed = Math.max(speed, Math.hypot(e.vx, e.vy))));
		expect(e.maxHp - e.hp).toBeGreaterThanOrEqual(HAYMAKER.damage);
		expect(speed).toBeGreaterThan(300);
		expect(e.x).toBeGreaterThan(440);
	});

	it('Heat Vision burns someone out of reach, without him moving in', () => {
		const e = foe(500, 0);
		const { p, w } = arena('superman', [e]);
		p.hero!.target = e;
		p.hero!.cooldowns.haymaker = 99;
		// (he uses it half the time it's ready: give him a few chances)
		run(p, w, 3);
		expect(e.hp).toBeLessThan(e.maxHp - 40);
		expect(Math.abs(p.x)).toBeLessThan(40);
	});

	it('Freeze Breath stops everything in the cone where it stands, and nothing behind him', () => {
		const front = [foe(160, -30), foe(200, 40)];
		const behind = foe(-180, 0);
		const { p, w } = arena('superman', [...front, behind]);
		p.hero!.target = front[0];
		p.hero!.cooldowns.frost = 0;
		run(p, w, 0.4);
		for (const e of front) expect(e.stun).toBeGreaterThan(FROST.stun - 0.5);
		expect(behind.stun).toBe(0);
	});

	it('is the Man of Steel: only part of any hit gets through', () => {
		const { p, w } = arena('superman', []);
		damagePlayer(w, p, 40, 100, 0);
		expect(p.maxHealth - p.health).toBeCloseTo(40 * STEEL);
	});
});

describe('Wonder Woman', () => {
	it('Lasso: ropes someone out of reach and drags them to her, helpless', () => {
		const e = foe(450, 0);
		const { p, w } = arena('wonderwoman', [e]);
		p.hero!.target = e;
		p.hero!.cooldowns.lasso = 0;
		run(p, w, 0.3);
		expect(p.hero!.move?.power).toBe('lasso');
		expect(e.stun).toBeGreaterThan(1);
		run(p, w, LASSO.pullTime + 0.3);
		expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(200);
		expect(e.hp).toBeLessThan(e.maxHp);
	});

	it('Bracelets: up against a big hit, most of it is turned aside and shots near her burst', () => {
		const e = foe(200, 0);
		const { p, w } = arena('wonderwoman', [e]);
		e.brain.target = p;
		e.brain.state = 'windup';
		p.hero!.cooldowns.lasso = 99;
		run(p, w, 0.1);
		expect(p.hero!.guard).toBeGreaterThan(BRACELETS.time - 0.2);
		w.red.shots.push({ kind: 'bolt', owner: e, x: p.x + 60, y: p.y, prevX: p.x + 60, prevY: p.y, vx: -100, vy: 0, life: 2, speed: 100, damage: 10, knockback: 0, ignore: [], hit: [], travelled: 0, out: 400, returning: false });
		run(p, w, 0.05);
		expect(w.red.shots.length).toBe(0);
		damagePlayer(w, p, 40, 100, 0);
		expect(p.maxHealth - p.health).toBeCloseTo(40 * GUARD.takes);
	});

	it('Sword: lunges in and cuts', () => {
		const e = foe(250, 0);
		const { p, w } = arena('wonderwoman', [e]);
		p.hero!.target = e;
		p.hero!.cooldowns.lasso = 99;
		run(p, w, 1.2);
		expect(e.hp).toBeLessThan(e.maxHp - 30);
	});
});
