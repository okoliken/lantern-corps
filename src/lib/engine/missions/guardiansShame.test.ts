import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { ENEMIES } from '../enemies/enemies';
import { Game } from '../game';
import { CONFESSION } from '../../story/scenes';
import { Confession } from '../scenes/confession';
import { GuardiansShame, PYLONS, PYLON_TIME, REBUILD_TIME, buildVaultMap } from './guardiansShame';

function setup() {
	const game = new Game({
		players: [
			{ lantern: 'hal', keys: 'solo' },
			{ lantern: 'kilowog', keys: 'p2', ai: true },
			{ lantern: 'razer', keys: 'p2', ai: true }
		],
		map: buildVaultMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new GuardiansShame();
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
	const kill = (which: (kind: string) => boolean) => {
		for (const e of game.enemies) {
			if (!which(e.kind)) continue;
			e.hp = 0;
			e.down = 1;
		}
	};
	/** The Reds at the seal beaten: the vault opens. */
	const toBreakout = () => {
		run(3.1);
		kill(() => true);
		run(0.2, safe);
	};
	/** Past the breakout, to the pylons. */
	const toReseal = () => {
		toBreakout();
		run(6.2, safe);
	};
	return { game, mission, run, safe, kill, toBreakout, toReseal };
}

describe("Act 2, Mission 4: The Guardians' Shame", () => {
	it('Hal arrives with Kilowog and Razer, and the Red Lanterns are cutting the seal', () => {
		const { game, mission, run } = setup();
		run(3.1);
		expect(game.players.map((p) => p.def.id)).toEqual(['hal', 'kilowog', 'razer']);
		expect(mission.phase).toBe('reds');
		expect(game.enemies.every((e) => ENEMIES[e.kind].faction === 'red')).toBe(true);
		const before = mission.seal;
		run(5, () => {
			for (const p of game.players) p.invuln = 1;
		});
		expect(mission.seal).toBeLessThan(before);
	});

	it('Razer fights on your side: his blades hurt the Reds', () => {
		const { game, run, safe } = setup();
		run(3.1);
		const razer = game.players[2];
		const red = game.enemies[0];
		razer.x = red.x - 120;
		razer.y = red.y;
		const hp = red.hp;
		run(3, () => {
			safe();
			// Only Razer's doing
			game.players[0].x = 100;
			game.players[1].x = 100;
		});
		expect(red.hp).toBeLessThan(hp);
	});

	it('the seal fails and Manhunters pour out; Reds and Manhunters shoot each other', () => {
		const { game, mission, run, safe, toBreakout } = setup();
		toBreakout();
		expect(mission.phase).toBe('breakout');
		const machines = game.enemies.filter((e) => ENEMIES[e.kind].faction === 'manhunter');
		const reds = game.enemies.filter((e) => ENEMIES[e.kind].faction === 'red' && isStanding(e));
		expect(machines.length).toBeGreaterThanOrEqual(4);
		expect(reds.length).toBeGreaterThanOrEqual(4);
		// Put one of each side by side, well away from the Lanterns
		const [m] = machines;
		const [r] = reds;
		Object.assign(m, { x: 1200, y: 1300 });
		Object.assign(r, { x: 1350, y: 1300 });
		const [mh, rh] = [m.hp, r.hp];
		run(3, () => {
			safe();
			for (const p of game.players) p.x = 200;
			Object.assign(m, { x: 1200, y: 1300 });
			Object.assign(r, { x: 1350, y: 1300 });
		});
		expect(m.hp).toBeLessThan(mh);
		expect(r.hp).toBeLessThan(rh);
	});

	it('a broken Manhunter leaves a core that rebuilds it, unless the core is smashed', () => {
		const a = setup();
		a.toBreakout();
		a.kill((k) => k === 'manhunter');
		a.run(0.2, a.safe);
		expect(a.mission.cores.length).toBe(2);
		a.run(REBUILD_TIME + 0.3, () => {
			a.safe();
			for (const p of a.game.players) p.x = 200;
		});
		expect(a.mission.cores.length).toBe(0);
		expect(a.game.enemies.filter((e) => e.kind === 'manhunter' && isStanding(e)).length).toBeGreaterThanOrEqual(2);

		const b = setup();
		b.toBreakout();
		b.kill((k) => k === 'manhunter');
		b.run(0.2, b.safe);
		for (const core of b.mission.cores) {
			core.hp = 0;
			core.down = 1;
		}
		b.run(0.2, b.safe);
		expect(b.mission.cores.length).toBe(0);
		b.run(REBUILD_TIME, () => {
			b.safe();
			for (const p of b.game.players) p.x = 200;
		});
		expect(b.game.enemies.filter((e) => e.kind === 'manhunter' && isStanding(e)).length).toBe(0);
	});

	it('standing by a pylon charges it; all three seal the vault and Bleez arrives', () => {
		const { game, mission, run, safe, toReseal } = setup();
		toReseal();
		expect(mission.phase).toBe('reseal');
		const hal = game.players[0];
		PYLONS.forEach((pylon, i) => {
			run(PYLON_TIME + 0.3, () => {
				safe();
				hal.x = pylon.x + 40;
				hal.y = pylon.y;
			});
			expect(mission.charge[i]).toBe(1);
		});
		expect(mission.phase).toBe('bleez');
		expect(mission.bleez && isStanding(mission.bleez)).toBe(true);
	});

	it('Bleez and everything else beaten, every core smashed: the vault holds, and some got away', () => {
		const { game, mission, run, safe, kill, toReseal } = setup();
		toReseal();
		mission.escaped = 2;
		const hal = game.players[0];
		for (const pylon of PYLONS) {
			run(PYLON_TIME + 0.3, () => {
				safe();
				hal.x = pylon.x + 40;
				hal.y = pylon.y;
			});
		}
		for (let i = 0; i < 6 && mission.phase !== 'sealed'; i++) {
			kill(() => true);
			for (const core of mission.cores) {
				core.hp = 0;
				core.down = 1;
			}
			run(0.5, safe);
		}
		expect(mission.phase).toBe('sealed');
		run(90, safe);
		expect(mission.state).toBe('won');
		expect(mission.resultText).toContain('Earth');
	});

	it('Hal going down three times loses it', () => {
		const { game, mission, run } = setup();
		run(3.1);
		const hal = game.players[0];
		for (let i = 0; i < 3; i++) {
			hal.health = 0;
			hal.downed = true;
			hal.downTimer = 4;
			run(0.1);
			hal.downed = false;
			hal.health = hal.maxHealth;
			run(0.1);
		}
		expect(mission.state).toBe('lost');
	});
});

describe('the confession', () => {
	it('the Guardians say it, Razer hears it, and it plays through by itself', () => {
		for (const who of ['hal', 'guardian', 'kilowog', 'razer']) expect(CONFESSION.some((l) => l.who === who)).toBe(true);
		const scene = new Confession(CONFESSION);
		for (let i = 0; i < 60 * 3; i++) scene.update(1 / 60);
		expect(scene.current?.who).toBe('hal');
		for (let i = 0; i < 60 * 240; i++) scene.update(1 / 60);
		expect(scene.done).toBe(true);
	});
});
