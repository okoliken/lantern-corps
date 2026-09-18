import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { ENEMIES } from '../enemies/enemies';
import { Sparring } from './sparring';
import type { Effect } from '../constructs/system';
import { buildTrainingMap } from './training';

function setup() {
	const map = buildTrainingMap();
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map });
	game.setView({ width: 1400, height: 800 });
	const sparring = new Sparring(map);
	game.director = sparring;
	const run = (seconds: number) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
	};
	return { game, sparring, p: game.players[0], run };
}

describe('Sparring with Kilowog', () => {
	it('Kilowog arrives after a moment and fights as a Green Lantern', () => {
		const { sparring, run } = setup();
		expect(sparring.kilowog).toBeNull();
		run(3);
		expect(sparring.state).toBe('fighting');
		expect(sparring.kilowog?.kind).toBe('kilowog');
		expect(ENEMIES.kilowog.faction).toBe('corps');
	});

	it('his constructs are drawn green', () => {
		const { game, run } = setup();
		run(3);
		const seen = new Set<Effect>();
		for (let i = 0; i < 60 * 12; i++) {
			game.update(1 / 60);
			for (const e of game.constructs.effects) seen.add(e);
		}
		const his = [...seen].filter((e) => e.kind === 'redBlast' || e.kind === 'redMace' || e.kind === 'redAxe' || e.kind === 'slamMark' || e.kind === 'roar');
		expect(his.length).toBeGreaterThan(0);
		expect(his.filter((e) => !e.green).map((e) => `${e.kind}:${e.life}:${e.radius}`)).toEqual([]);
	});

	it('beating him wins; he yields', () => {
		const { sparring, run } = setup();
		run(3);
		sparring.kilowog!.hp = 0;
		sparring.kilowog!.down = 1;
		run(0.1);
		expect(sparring.state).toBe('won');
	});

	it('going down loses, and you stay down', () => {
		const { sparring, p, run } = setup();
		run(3);
		p.health = 0;
		p.downed = true;
		p.downTimer = 0.1;
		run(3);
		expect(sparring.state).toBe('lost');
		expect(p.downed).toBe(true);
	});
});
