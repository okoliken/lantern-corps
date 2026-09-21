import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import { IDLE } from '../input';
import type { LanternId } from '../lanterns';
import { THE_FIRST } from '../../story/scenes';
import { TheFirst } from '../scenes/theFirst';
import { LEARN_AT, LEARN_TIME, ManhunterPrimeBoss, REBUILD_TIME, buildHeartMap, mostUsed } from './manhunterPrime';

function setup(me: LanternId = 'hal') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true }
		],
		map: buildHeartMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new ManhunterPrimeBoss();
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
	/** Past the opening, with Prime up. */
	const toFight = () => {
		run(3.1 + 5.2);
		expect(mission.prime).not.toBeNull();
	};
	/** Take Prime's health down to just under `share`. */
	const hurtTo = (share: number) => {
		const p = mission.prime!;
		p.hp = p.brain.lastHp = Math.floor(p.maxHp * share) - 1;
	};
	return { game, mission, run, safe, toFight, hurtTo };
}

describe('Act 2, the boss: Manhunter Prime', () => {
	it('you choose who to play, and the other Lantern fights beside you', () => {
		for (const me of ['hal', 'john'] as const) {
			const { game } = setup(me);
			expect(game.players.map((p) => p.def.id)).toEqual(me === 'hal' ? ['hal', 'john'] : ['john', 'hal']);
		}
	});

	it('Prime wakes on the dais', () => {
		const { mission, run } = setup();
		run(3.1);
		expect(mission.phase).toBe('descent');
		expect(mission.prime).toBeNull();
		run(5.2);
		expect(mission.phase).toBe('fight');
		expect(isStanding(mission.prime!)).toBe(true);
	});

	it('counts what each Lantern uses, and picks the one used most', () => {
		const { game } = setup();
		const hal = game.players[0];
		const [a, b] = hal.loadout;
		hal.usage[a.id] = 3;
		hal.usage[b.id] = 7;
		expect(mostUsed(hal)).toBe(b.id);
		hal.locked.add(b.id);
		expect(mostUsed(hal)).toBe(a.id);
		hal.usage = {};
		expect(mostUsed(hal)).toBeNull();
	});

	it('at 70% it stops, can\'t be hurt, takes each Lantern\'s favourite construct and copies it', () => {
		const { game, mission, run, toFight, hurtTo } = setup();
		toFight();
		const [hal, john] = game.players;
		const halFav = hal.loadout[2].id;
		const johnFav = john.loadout[1].id;
		hal.usage = { [halFav]: 20 };
		john.usage = { [johnFav]: 20 };
		const kitBefore = mission.prime!.brain.kit.length;
		hurtTo(LEARN_AT[0]);
		run(0.1);
		expect(mission.phase).toBe('learning');
		const held = mission.prime!.hp;
		mission.prime!.hp -= 500;
		run(0.1);
		expect(mission.prime!.hp).toBe(held);
		run(LEARN_TIME);
		expect(mission.phase).toBe('fight');
		expect(mission.stage).toBe(2);
		expect(hal.locked.has(halFav)).toBe(true);
		expect(john.locked.has(johnFav)).toBe(true);
		expect(mission.learned.map((l) => l.construct)).toEqual([halFav, johnFav]);
		expect(mission.prime!.brain.kit.length).toBeGreaterThan(kitBefore);
		// And the ranks start waking
		expect(game.enemies.filter((e) => e.kind !== 'manhunterPrime').length).toBeGreaterThan(0);
	});

	it('a locked construct can\'t be made', () => {
		const { game, run, toFight } = setup();
		toFight();
		const hal = game.players[0];
		const slot = hal.loadout.findIndex((d) => d.behavior === 'smash');
		hal.locked.add(hal.loadout[slot].id);
		hal.selected = slot;
		const before = hal.willpower;
		hal.input = { read: () => ({ ...IDLE, construct: true, constructPressed: true }) };
		run(0.3);
		expect(hal.cooldowns[slot]).toBe(0);
		expect(hal.willpower).toBeGreaterThanOrEqual(before);
	});

	it('learns three times in all, and the last makes it faster and stronger', () => {
		const { game, mission, run, toFight, hurtTo } = setup();
		toFight();
		const might = mission.prime!.brain.might;
		for (let i = 0; i < 3; i++) {
			for (const p of game.players) p.usage = { [p.loadout[i + 3].id]: 10 };
			hurtTo(LEARN_AT[i]);
			run(0.1);
			run(LEARN_TIME + 0.2);
		}
		expect(mission.stage).toBe(4);
		expect(mission.learned.length).toBe(6);
		expect(mission.prime!.brain.might).toBeGreaterThan(might);
	});

	it('broken, it rebuilds round its core unless the core is smashed', () => {
		const { mission, run, toFight } = setup();
		toFight();
		mission.prime!.hp = 0;
		mission.prime!.down = 1;
		run(0.2);
		expect(mission.phase).toBe('core');
		expect(mission.core).not.toBeNull();
		run(REBUILD_TIME + 0.5);
		// Broken before it learned anything: it comes back and catches up first
		expect(['fight', 'learning']).toContain(mission.phase);
		expect(mission.rebuilds).toBe(1);
		expect(isStanding(mission.prime!)).toBe(true);
	});

	it('smash its core and it is over: the ranks drop and every ring gets its light back', () => {
		const { game, mission, run, toFight, hurtTo } = setup();
		toFight();
		for (const p of game.players) p.usage = { [p.loadout[0].id]: 10 };
		hurtTo(LEARN_AT[0]);
		run(0.1);
		run(LEARN_TIME + 0.2);
		expect(game.players.every((p) => p.locked.size === 1)).toBe(true);
		mission.prime!.hp = 0;
		mission.prime!.down = 1;
		run(0.2);
		mission.core!.hp = 0;
		mission.core!.down = 1;
		run(0.2);
		expect(mission.phase).toBe('fallen');
		expect(game.enemies.filter(isStanding).length).toBe(0);
		expect(game.players.every((p) => p.locked.size === 0)).toBe(true);
		run(60);
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(3);
	});

	it('your Lantern going down three times loses it', () => {
		const { game, mission, run } = setup('john');
		run(3.1);
		const me = game.players[0];
		for (let i = 0; i < 3; i++) {
			me.health = 0;
			me.downed = true;
			me.downTimer = 0.3;
			run(0.1, () => {});
			me.downed = false;
			me.health = 100;
			run(0.1);
		}
		expect(mission.state).toBe('lost');
	});

	it('opens on Oa with the Guardians', () => {
		const scene = new TheFirst(THE_FIRST);
		expect(THE_FIRST.some((l) => l.who === 'guardian')).toBe(true);
		expect(scene.done).toBe(false);
	});
});
