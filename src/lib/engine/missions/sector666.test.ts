import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import type { LanternId } from '../lanterns';
import { DEAD_SECTOR } from '../../story/scenes';
import { DeadSector } from '../scenes/deadSector';
import { GANTHET_HP, GANTHET_SPEED, IntoSector666, STORM_RADIUS, buildSector666Map } from './sector666';

function setup(me: LanternId = 'hal') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true },
			{ lantern: 'arisia', keys: 'p2', ai: true }
		],
		map: buildSector666Map()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new IntoSector666();
	game.director = mission;
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const run = (seconds: number, each: () => void = safe) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	const sweep = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
	};
	/** Keep Ganthet safe and out of storms. */
	const guard = () => {
		safe();
		mission.ganthet.hp = GANTHET_HP;
		for (const s of mission.storms) s.y = 260;
	};
	return { game, mission, run, safe, sweep, guard };
}

describe('Act 3, Mission 3: Into Sector 666', () => {
	it('Hal or John, the other, and Arisia escort Ganthet; his light is the battery', () => {
		const { game, mission, run } = setup('john');
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'hal', 'arisia']);
		run(3.1);
		const b = game.batteries[0];
		expect(Math.hypot(b.x - mission.ganthet.x, b.y - mission.ganthet.y)).toBeLessThan(150);
	});

	it('Ganthet goes on when the way is clear, and stops while the Reds are on him', () => {
		const { game, mission, run, sweep, guard } = setup();
		run(3.1);
		const x0 = mission.ganthet.x;
		run(2, guard);
		expect(mission.ganthet.x).toBeGreaterThan(x0 + GANTHET_SPEED * 1.5);
		const e = game.spawnEnemy('rageGrunt', mission.ganthet.x + 100, mission.ganthet.y);
		const x1 = mission.ganthet.x;
		run(2, () => {
			guard();
			// (the allies would beat it: keep it standing)
			e.hp = e.maxHp;
			e.down = 0;
			e.x = mission.ganthet.x + 100;
			e.y = mission.ganthet.y;
		});
		expect(mission.ganthet.x).toBeCloseTo(x1, 0);
		sweep();
		run(1, guard);
		expect(mission.ganthet.x).toBeGreaterThan(x1);
	});

	it('a rage storm burns a Lantern, drains their will, and hurts Ganthet unless he is shielded', () => {
		const { game, mission, run } = setup();
		run(3.1);
		const me = game.players[0];
		const storm = mission.storms[0];
		const will = me.willpower;
		run(2, () => {
			storm.x = me.x;
			storm.y = me.y;
			storm.vx = storm.vy = 0;
		});
		expect(me.health).toBeLessThan(me.maxHealth);
		expect(me.willpower).toBeLessThan(will);
		const hp = mission.ganthet.hp;
		run(2, () => {
			for (const p of game.players) p.invuln = 1;
			storm.x = mission.ganthet.x;
			storm.y = mission.ganthet.y;
			storm.vx = storm.vy = 0;
		});
		expect(mission.ganthet.hp).toBeLessThan(hp);
		expect(STORM_RADIUS).toBeGreaterThan(100);
	});

	it('patrols come as Ganthet crosses; at the gate Bleez holds it, and beating her opens it', () => {
		const { game, mission, run, sweep, guard } = setup();
		run(3.1);
		for (let t = 0; t < 400 && mission.phase === 'crossing'; t += 1) {
			sweep();
			run(1, guard);
		}
		expect(mission.phase).toBe('gate');
		expect(mission.bleez).not.toBeNull();
		sweep();
		run(0.5, guard);
		expect(mission.phase).toBe('open');
		expect(game.enemies.filter(isStanding).length).toBe(0);
		run(60, guard);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(3);
	});

	it('Ganthet falling loses it', () => {
		const { mission, run } = setup();
		run(3.1);
		mission.ganthet.hp = 0.5;
		mission.ganthet.hp -= 1;
		run(0.1);
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('ganthet');
	});

	it('opens at the edge of the dead sector', () => {
		const scene = new DeadSector(DEAD_SECTOR);
		expect(DEAD_SECTOR.some((l) => l.who === 'ganthet')).toBe(true);
		expect(scene.done).toBe(false);
	});
});
