import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import type { LanternId } from '../lanterns';
import { THE_TRAIL } from '../../story/scenes';
import { TheTrail } from '../scenes/theTrail';
import { BOLT_AT, DexStarrHunt, FLEE_TIME, HIDEOUTS, buildCrashSiteMap } from './dexStarr';

function setup(me: LanternId = 'hal') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true }
		],
		map: buildCrashSiteMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new DexStarrHunt();
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
	/** Everyone right next to (x, y). */
	const moveTo = (at: { x: number; y: number }) => {
		for (const p of game.players) {
			p.x = p.prevX = at.x - 120;
			p.y = p.prevY = at.y;
		}
	};
	const hurtDex = (share: number) => {
		const d = mission.dex!;
		d.hp = d.brain.lastHp = Math.floor(d.maxHp * share) - 1;
	};
	return { game, mission, run, safe, moveTo, hurtDex };
}

describe('Act 3, Mission 2: Dex-Starr', () => {
	it('you choose Hal or John; Dex-Starr waits at his first hiding place and can\'t be hurt yet', () => {
		const { game, mission, run } = setup('john');
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'hal']);
		run(3.1);
		expect(mission.phase).toBe('track');
		const d = mission.dex!;
		const hp = d.hp;
		d.hp -= 500;
		run(0.1);
		expect(d.hp).toBe(hp);
	});

	it('get close and he springs an ambush with Red Lanterns', () => {
		const { game, mission, run, moveTo } = setup();
		run(3.1);
		moveTo(HIDEOUTS[0]);
		run(0.2);
		expect(mission.phase).toBe('ambush');
		expect(game.enemies.filter((e) => e.kind === 'rageGrunt').length).toBeGreaterThanOrEqual(4);
	});

	it('hurt him and he bolts to the next hiding place, leaving a trail', () => {
		const { mission, run, moveTo, hurtDex } = setup();
		run(3.1);
		moveTo(HIDEOUTS[0]);
		run(0.2);
		hurtDex(BOLT_AT[0]);
		run(0.1);
		expect(mission.phase).toBe('flee');
		expect(mission.hideout).toBe(1);
		run(FLEE_TIME + 0.2, () => moveTo(mission.dex!));
		// (right on his tail, the next ambush springs as soon as he lands)
		expect(['track', 'ambush']).toContain(mission.phase);
		const d = mission.dex!;
		expect(Math.hypot(d.x - HIDEOUTS[1].x, d.y - HIDEOUTS[1].y)).toBeLessThan(80);
	});

	it('fall too far behind and the trail goes cold: he gets away', () => {
		const { game, mission, run, moveTo, hurtDex } = setup();
		run(3.1);
		moveTo(HIDEOUTS[0]);
		run(0.2);
		hurtDex(BOLT_AT[0]);
		run(60, () => {
			for (const p of game.players) {
				p.invuln = 1;
				p.x = p.prevX = 200;
				p.y = p.prevY = 2000;
			}
		});
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('escaped');
	});

	it('cornered at the bow, he drops Ganthet and runs; break the bubble to free him', () => {
		const { game, mission, run, moveTo, hurtDex } = setup();
		run(3.1);
		for (let i = 0; i < HIDEOUTS.length; i++) {
			moveTo(HIDEOUTS[i]);
			run(0.3, () => {
				for (const p of game.players) p.invuln = 1;
				moveTo(HIDEOUTS[i]);
			});
			expect(mission.phase).toBe('ambush');
			hurtDex(BOLT_AT[i]);
			run(0.2);
			if (i < HIDEOUTS.length - 1) run(FLEE_TIME + 0.2, () => moveTo(mission.dex!));
		}
		expect(mission.phase).toBe('rescue');
		expect(mission.bubble).not.toBeNull();
		mission.bubble!.hp = 0;
		mission.bubble!.down = 1;
		run(0.2);
		expect(mission.phase).toBe('freed');
		expect(game.enemies.filter(isStanding).length).toBe(0);
		run(90);
		expect(mission.state).toBe('won');
	});

	it('opens on Oa, the morning after the siege', () => {
		const scene = new TheTrail(THE_TRAIL);
		expect(THE_TRAIL.length).toBeGreaterThan(3);
		expect(scene.done).toBe(false);
	});
});
