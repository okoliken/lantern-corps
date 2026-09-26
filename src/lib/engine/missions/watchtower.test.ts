import { describe, expect, it } from 'vitest';
import { damagePlayer } from '../combat';
import { isStanding } from '../dummy';
import { ENEMIES } from '../enemies/enemies';
import { Game } from '../game';
import { BOUTS, BOUT_TIME, FLOOR_AT, Watchtower, YIELD_AT, buildWatchtowerMap } from './watchtower';

function setup() {
	const game = new Game({ players: [{ lantern: 'john', keys: 'solo' }], map: buildWatchtowerMap() });
	game.setView({ width: 1400, height: 800 });
	const mission = new Watchtower();
	game.director = mission;
	const run = (seconds: number, each: () => void = () => {}) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	return { game, mission, run };
}

describe('the Watchtower', () => {
	it('the Flash steps into the ring once the introductions are over', () => {
		const { game, mission, run } = setup();
		expect(mission.state).toBe('intro');
		run(5);
		expect(mission.state).toBe('playing');
		expect(mission.bout).toBe('flash');
		expect(mission.fighter?.kind).toBe('flashSpar');
		// One in the ring with him, and nobody else
		expect(game.enemies.filter(isStanding).length).toBe(1);
		expect(mission.objective).toContain('Flash');
	});

	it('the League fight as themselves, not as Red Lanterns', () => {
		for (const kind of ['flashSpar', 'supermanSpar', 'wonderwomanSpar', 'hawkgirlSpar'] as const) {
			expect(ENEMIES[kind].faction).not.toBe('red');
			expect(ENEMIES[kind].tint).toBeUndefined();
			expect(ENEMIES[kind].kit?.length ?? 0).toBeGreaterThan(0);
		}
	});

	it('it is a real fight: standing there, he gets hit', () => {
		const { game, run } = setup();
		run(5);
		const me = game.players[0];
		let taken = 0;
		let last = me.health;
		run(20, () => {
			if (me.health < last) taken += last - me.health;
			last = me.health;
		});
		expect(taken).toBeGreaterThan(0);
	});

	it('but nobody goes down on this deck: the floor picks him up', () => {
		const { game, mission, run } = setup();
		run(5);
		const me = game.players[0];
		damagePlayer(game.constructs, me, me.maxHealth * 2, me.x + 30, me.y, 0);
		run(0.1);
		expect(me.downed).toBe(false);
		expect(me.health).toBeGreaterThan(me.maxHealth * FLOOR_AT);
		expect(mission.floors).toBe(1);
		expect(mission.lives).toBe(3);
		expect(mission.state).toBe('playing');
	});

	it('they yield with a third left, and the next one steps in', () => {
		const { mission, run } = setup();
		run(5);
		const flash = mission.fighter!;
		flash.hp = Math.floor(flash.maxHp * YIELD_AT) - 1;
		run(0.1);
		expect(mission.results.flash?.won).toBe(true);
		expect(mission.fighter).toBeNull();
		run(4);
		expect(mission.bout).toBe('superman');
		expect(mission.fighter?.kind).toBe('supermanSpar');
	});

	it('a bout they cannot finish gets called on time', () => {
		const { game, mission, run } = setup();
		run(5);
		run(BOUT_TIME + 0.5, () => {
			game.players[0].invuln = 1;
		});
		expect(mission.results.flash).toBeTruthy();
		expect(mission.results.flash?.won).toBe(false);
	});

	it('runs all four bouts and finishes the session', () => {
		const { mission, run } = setup();
		const seen = new Set<string>();
		run(5);
		// Win each bout as it comes
		run(60, () => {
			seen.add(mission.bout);
			const f = mission.fighter;
			if (f) f.hp = Math.min(f.hp, Math.floor(f.maxHp * YIELD_AT) - 1);
		});
		for (const bout of BOUTS) expect(seen.has(bout)).toBe(true);
		expect(mission.state).toBe('won');
		expect(mission.bout).toBe('done');
		expect(mission.stars).toBeGreaterThanOrEqual(2);
	});
});
