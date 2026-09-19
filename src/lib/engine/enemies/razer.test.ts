import { describe, expect, it } from 'vitest';
import { updatePlayerCombat } from '../combat';
import { CONSTRUCTS } from '../constructs/defs';
import { createConstructWorld, updateConstructWorld, updatePlayerConstructs, type ConstructWorld } from '../constructs/system';
import { updateDummy } from '../dummy';
import { IDLE } from '../input';
import { LANTERNS } from '../lanterns';
import { createPlayer, updatePlayer, type Player } from '../player';
import { createEnemy, updateEnemies, type Enemy } from './enemies';
import { ABILITIES, type AbilityId } from './redConstructs';
import { BRAND_TIME } from './razer';

const DT = 1 / 60;

function arena(px = 150) {
	const p = createPlayer(0, LANTERNS.hal, { read: () => IDLE }, px, 0);
	const razer = createEnemy('razer', 0, 0);
	const w = createConstructWorld([], [razer]);
	w.players = [p];
	return { p, razer, w };
}

function run(w: ConstructWorld, players: Player[], seconds: number, each?: () => void) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		for (const p of players) {
			updatePlayerCombat(p, DT);
			updatePlayer(p, IDLE, DT);
		}
		updateEnemies(w, players, DT);
		updateConstructWorld(w, DT);
		for (const d of w.dummies) updateDummy(d, DT, w.obstacles, false);
		each?.();
	}
}

/** Skip to the end of the windup: the construct happens next tick. */
function force(e: Enemy, id: AbilityId, t: Player) {
	const dx = t.x - e.x;
	const dy = t.y - e.y;
	const len = Math.hypot(dx, dy) || 1;
	e.brain.kit = [id];
	Object.assign(e.brain, { state: 'windup', ability: id, timer: 1e-6, target: t, aimX: dx / len, aimY: dy / len, sees: true });
}

describe("Razer's constructs", () => {
	it('Construct Shatter pops bubble shields, knocks down walls and turrets, and strips Power Armor', () => {
		const { p, razer, w } = arena(120);
		w.shields.push({ owner: p, target: p, hp: 999, maxHp: 999, life: 10, maxLife: 10, ripple: 0 });
		w.obstacles.push({ kind: 'wall', x: 60, y: -40, w: 12, h: 80, height: 70, blocksFlying: true, seed: 0.5, hp: 300, maxHp: 300, life: 20, maxLife: 20 });
		w.turrets.push({ owner: p, def: CONSTRUCTS.turret, x: 100, y: 60, aim: 0, cooldown: 1, life: 10, maxLife: 10, hp: 80, maxHp: 80 });
		p.armor = { def: CONSTRUCTS.powerArmor, time: 8, maxTime: 8 };
		force(razer, 'shatter', p);
		run(w, [p], 0.2);
		expect(w.shields).toHaveLength(0);
		expect(w.obstacles.some((o) => o.kind === 'wall')).toBe(false);
		expect(w.turrets).toHaveLength(0);
		expect(p.armor).toBeNull();
	});

	it("Rage Brand stops a Lantern's ring building anything; ring shots still work", () => {
		const { p, razer, w } = arena(300);
		force(razer, 'brand', p);
		run(w, [p], 0.2);
		expect(p.branded).toBeGreaterThan(BRAND_TIME - 0.5);
		p.selected = p.loadout.findIndex((d) => d.id === 'glove');
		const will = p.willpower;
		updatePlayerConstructs(p, { ...IDLE, construct: true, constructPressed: true, shield: true }, DT, w);
		expect(p.willpower).toBe(will);
		expect(w.shields).toHaveLength(0);
		updatePlayerConstructs(p, { ...IDLE, shot: true }, DT, w);
		expect(w.projectiles.length).toBeGreaterThan(0);
	});

	it('a bubble shield takes a Rage Brand instead', () => {
		const { p, razer, w } = arena(300);
		w.shields.push({ owner: p, target: p, hp: 999, maxHp: 999, life: 10, maxLife: 10, ripple: 0 });
		force(razer, 'brand', p);
		run(w, [p], 0.2);
		expect(p.branded).toBe(0);
	});

	it('Crimson Nova: a long warning, then a huge blast; standing clear is safe', () => {
		const near = arena(150);
		force(near.razer, 'crimsonNova', near.p);
		run(near.w, [near.p], 0.3);
		expect(near.w.red.strikes.some((s) => s.kind === 'nova')).toBe(true);
		expect(near.p.health).toBe(near.p.maxHealth);
		run(near.w, [near.p], 1.2);
		expect(near.p.health).toBeLessThan(near.p.maxHealth);

		const far = arena((ABILITIES.crimsonNova.radius ?? 250) + 120);
		force(far.razer, 'crimsonNova', far.p);
		run(far.w, [far.p], 1.5, () => {
			far.razer.x = far.razer.y = 0;
		});
		expect(far.p.health).toBe(far.p.maxHealth);
	});

	it('the Blade Storm drags a Lantern in', () => {
		const { p, razer, w } = arena(260);
		force(razer, 'razerStorm', p);
		const start = Math.hypot(p.x - razer.x, p.y - razer.y);
		run(w, [p], 0.8);
		expect(Math.hypot(p.x - razer.x, p.y - razer.y)).toBeLessThan(start - 40);
	});

	it('Crimson Chakrams swing round in arcs instead of flying straight', () => {
		const { p, razer, w } = arena(360);
		force(razer, 'chakram', p);
		run(w, [p], 0.05);
		const shots = w.red.shots.filter((s) => s.kind === 'saw');
		expect(shots).toHaveLength(2);
		const before = shots.map((s) => Math.atan2(s.vy, s.vx));
		run(w, [p], 0.3);
		shots.forEach((s, i) => expect(Math.abs(Math.atan2(s.vy, s.vx) - before[i])).toBeGreaterThan(0.2));
	});
});
