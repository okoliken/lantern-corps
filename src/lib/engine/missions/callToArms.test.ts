import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import { CORE_HP, CallToArms, GRODD_ESCAPE, GRODD_STAGE_2, REBUILD_TIMES, buildCentralCityMap } from './callToArms';

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
			if (e.kind === 'grodd' || e.kind === 'manhunter') continue;
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
