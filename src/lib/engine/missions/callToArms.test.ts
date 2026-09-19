import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import { CORE_HP, CallToArms, GRODD_ESCAPE, GRODD_STAGE_2, REBUILD_TIMES, RF_FLEES, buildCentralCityMap } from './callToArms';

/**
 * A stand-in canvas: every call is a no-op, except it throws on a negative
 * radius, like a real browser canvas does (which froze the game once).
 */
function fakeCanvas(): CanvasRenderingContext2D {
	// Paths too (Node has no Path2D): every call a no-op
	(globalThis as { Path2D?: unknown }).Path2D ??= class {
		constructor() {
			return new Proxy(this, { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : () => {}) });
		}
	};
	const gradient = { addColorStop() {} };
	const check = (name: string, ...radii: number[]) => {
		if (radii.some((r) => r < 0 || Number.isNaN(r))) throw new Error(`${name}: negative radius`);
	};
	return new Proxy({} as CanvasRenderingContext2D, {
		get(target, key) {
			if (key === 'ellipse') return (_x: number, _y: number, rx: number, ry: number) => check('ellipse', rx, ry);
			if (key === 'arc') return (_x: number, _y: number, r: number) => check('arc', r);
			if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
			if (key in target) return (target as unknown as Record<string, unknown>)[key as string];
			return () => {};
		},
		set(target, key, value) {
			(target as unknown as Record<string, unknown>)[key as string] = value;
			return true;
		}
	});
}

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'john', keys: 'solo' },
			{ lantern: 'flash', keys: 'p2', ai: true },
			{ lantern: 'hawkgirl', keys: 'p2', ai: true }
		],
		map: buildCentralCityMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new CallToArms();
	game.director = mission;
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const clear = () => {
		for (const e of game.enemies) {
			if (e.kind === 'grodd' || e.kind === 'manhunter' || e.kind === 'reverseFlash') continue;
			e.hp = 0;
			e.down = 1;
		}
		run(0.1, safe);
	};
	/** Through the gorilla waves: Grodd comes up out of the dig. */
	const toGrodd = () => {
		run(3.1);
		for (let i = 0; i < 6 && mission.phase !== 'grodd'; i++) {
			clear();
			run(0.5, safe);
		}
	};
	/** Grodd beaten: he gets away, and the Manhunter wakes. */
	const toManhunter = () => {
		toGrodd();
		mission.grodd!.hp = mission.grodd!.maxHp * (GRODD_ESCAPE - 0.01);
		run(8, safe);
	};
	return { game, mission, run, safe, clear, toGrodd, toManhunter };
}

describe('Act 2, Mission 1: Call to Arms', () => {
	it("John lands in the middle of the Flash and Hawkgirl's fight, with no battery on Earth", () => {
		const { game, mission, run } = setup();
		run(3.1);
		expect(mission.phase).toBe('arrival');
		expect(game.batteries).toHaveLength(0);
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'flash', 'hawkgirl']);
		expect(game.enemies.every((e) => e.kind === 'gorillaBrute' || e.kind === 'gorillaGunner')).toBe(true);
	});

	it('squad after squad: the arrival, the side streets, the dig and the troopers behind it; then Grodd', () => {
		const { mission, run, safe, clear } = setup();
		run(3.1);
		const phases: string[] = [mission.phase];
		for (let i = 0; i < 6 && mission.phase !== 'grodd'; i++) {
			clear();
			run(0.5, safe);
			if (phases[phases.length - 1] !== mission.phase) phases.push(mission.phase);
		}
		expect(phases).toEqual(['arrival', 'flank', 'push', 'grodd']);
		expect(mission.defeated).toBeGreaterThanOrEqual(20);
		expect(mission.phase).toBe('grodd');
		expect(mission.grodd && isStanding(mission.grodd)).toBe(true);
	});

	it('hurt, Grodd calls in more soldiers, and takes the Flash\'s mind first with his Mind Control', () => {
		const { game, mission, run, safe, toGrodd } = setup();
		toGrodd();
		const g = mission.grodd!;
		g.hp = g.maxHp * (GRODD_STAGE_2 - 0.01);
		run(0.1, safe);
		expect(mission.stage).toBe(2);
		expect(g.brain.kit).toContain('debrisStorm');
		expect(game.enemies.filter((e) => e.kind !== 'grodd').length).toBeGreaterThanOrEqual(4);
		const [john, flash] = game.players;
		let locked = false;
		run(12, () => {
			safe();
			// Everyone in the fight
			john.x = g.x - 300;
			john.y = g.y;
			flash.x = g.x + 250;
			flash.y = g.y + 60;
			for (const p of game.players) p.health = p.maxHealth;
			if (flash.confused > 0) locked = true;
		});
		expect(locked).toBe(true);
		expect(g.brain.kit).toContain('mindLock');
	});

	it('beaten, Grodd gets away and a Manhunter wakes up in the dig', () => {
		const { game, mission, toManhunter } = setup();
		toManhunter();
		expect(mission.grodd && game.dummies.includes(mission.grodd)).toBe(false);
		expect(mission.phase).toBe('manhunter');
		expect(mission.manhunter && isStanding(mission.manhunter)).toBe(true);
	});

	it('broken, the Manhunter falls apart round its core and rebuilds itself, stronger, unless the core is smashed', () => {
		const { game, mission, run, safe, toManhunter } = setup();
		toManhunter();
		const m = mission.manhunter!;
		const might = m.brain.might;
		m.hp = 0;
		m.down = 0.9;
		run(0.1, safe);
		const core = mission.core!;
		expect(core.kind).toBe('manhunterCore');
		expect(game.dummies).toContain(core);
		expect(mission.objective).toContain('core');
		// Leave it alone (keep everyone well away) and it gets back up
		run(REBUILD_TIMES[0] + 0.2, () => {
			safe();
			for (const p of game.players) {
				p.x = 300;
				p.y = 1050;
			}
		});
		expect(mission.rebuilds).toBe(1);
		expect(mission.core).toBeNull();
		expect(mission.manhunter && isStanding(mission.manhunter)).toBe(true);
		expect(mission.manhunter!.brain.might).toBeGreaterThan(might);
		expect(game.enemies.some((e) => e.kind === 'manhunterDrone')).toBe(true);
	});

	it('smash the core and it stays down: the ring carries John off to Oa, and that wins', () => {
		const { game, mission, run, safe, toManhunter } = setup();
		toManhunter();
		const m = mission.manhunter!;
		m.hp = 0;
		m.down = 0.9;
		run(0.1, safe);
		mission.core!.hp = 0;
		mission.core!.down = 1;
		run(0.1, safe);
		expect(mission.phase).toBe('farewell');
		run(60, safe);
		expect(mission.state).toBe('won');
		const john = game.players[0];
		run(4);
		expect(john.boarded).toBe(true);
		expect(CORE_HP).toBeGreaterThan(0);
	});

	it("draws Grodd's escape and everything after it without a canvas error (a frozen game, once)", () => {
		const { mission, run, safe, toGrodd } = setup();
		toGrodd();
		const ctx = fakeCanvas();
		const draw = () => {
			for (const d of mission.drawables(ctx, 1, 0)) d.draw();
		};
		mission.grodd!.hp = mission.grodd!.maxHp * (GRODD_ESCAPE - 0.01);
		run(8, () => {
			safe();
			draw();
		});
		expect(mission.phase).toBe('manhunter');
	});

	it('Reverse-Flash comes with the side-street squad, goes after the Flash, and the Flash takes him on', () => {
		const { game, mission, run, safe, clear } = setup();
		run(3.1);
		clear();
		run(0.5, safe);
		expect(mission.phase).toBe('flank');
		const rf = mission.reverseFlash!;
		expect(rf.kind).toBe('reverseFlash');
		const flash = game.players[1];
		run(4, safe);
		expect(rf.brain.target).toBe(flash);
		expect(flash.hero!.target).toBe(rf);
		expect(rf.hp).toBeLessThan(rf.maxHp);
	});

	it('beaten down, Reverse-Flash runs; and if he is still here when Grodd escapes, he goes too', () => {
		const a = setup();
		a.run(3.1);
		a.clear();
		a.run(0.5, a.safe);
		const rf = a.mission.reverseFlash!;
		rf.hp = rf.maxHp * (RF_FLEES - 0.01);
		a.run(0.1, a.safe);
		expect(a.mission.reverseFlash).toBeNull();
		expect(a.game.dummies).not.toContain(rf);

		const b = setup();
		b.toGrodd();
		expect(b.mission.reverseFlash).not.toBeNull();
		b.mission.grodd!.hp = b.mission.grodd!.maxHp * (GRODD_ESCAPE - 0.01);
		b.run(0.2, b.safe);
		expect(b.mission.reverseFlash).toBeNull();
	});

	it("at the end the Flash and Hawkgirl stay put and watch the ring take John", () => {
		const { game, mission, run, safe, toManhunter } = setup();
		toManhunter();
		const m = mission.manhunter!;
		m.hp = 0;
		m.down = 0.9;
		run(0.1, safe);
		mission.core!.hp = 0;
		mission.core!.down = 1;
		run(0.1, safe);
		const [john, flash, hawk] = game.players;
		const at = [flash.x, flash.y, hawk.x, hawk.y];
		run(60, safe);
		run(3);
		expect(john.boarded).toBe(true);
		expect(Math.hypot(flash.x - at[0], flash.y - at[1])).toBeLessThan(60);
		expect(Math.hypot(hawk.x - at[2], hawk.y - at[3])).toBeLessThan(60);
	});

	it('John going down three times loses it', () => {
		const { game, mission, run } = setup();
		run(3.1);
		const john = game.players[0];
		for (let i = 0; i < 3; i++) {
			john.health = 0;
			john.downed = true;
			john.downTimer = 4;
			run(0.1);
			john.downed = false;
			john.health = john.maxHealth;
			run(0.1);
		}
		expect(mission.state).toBe('lost');
	});
});
