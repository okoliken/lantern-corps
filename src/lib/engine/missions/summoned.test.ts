import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import { SUMMONED } from '../../story/scenes';
import { Summoned } from '../scenes/summoned';
import { HAL_AFTER, SINESTRO_STEPS_IN, SummonedTrial, buildTrialMap } from './summoned';

function setup() {
	const game = new Game({ players: [{ lantern: 'john', keys: 'solo' }], map: buildTrialMap() });
	game.setView({ width: 1400, height: 800 });
	const mission = new SummonedTrial();
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
	const toSinestro = () => {
		run(3.1);
		mission.kilowog!.hp = mission.kilowog!.maxHp * (SINESTRO_STEPS_IN - 0.01);
		run(0.1, safe);
	};
	return { game, mission, run, safe, toSinestro };
}

describe('Act 2, Mission 2: Summoned (the Trial on Oa)', () => {
	it('starts one on one: John against Kilowog', () => {
		const { game, mission, run } = setup();
		run(3.1);
		expect(mission.phase).toBe('kilowog');
		expect(game.enemies.map((e) => e.kind)).toEqual(['kilowog']);
		expect(game.players).toHaveLength(1);
	});

	it('hurt Kilowog enough and Sinestro steps in: two on one', () => {
		const { game, mission, toSinestro } = setup();
		toSinestro();
		expect(mission.phase).toBe('sinestro');
		expect(game.enemies.map((e) => e.kind).sort()).toEqual(['kilowog', 'sinestro']);
		expect(mission.line?.who).toBe('Sinestro');
	});

	it('Hal tags in after a while two on one, or sooner if John is badly hurt', () => {
		const a = setup();
		a.toSinestro();
		a.run(HAL_AFTER + 0.5, a.safe);
		expect(a.mission.phase).toBe('together');
		expect(a.game.players.map((p) => p.def.id)).toEqual(['john', 'hal']);

		const b = setup();
		b.toSinestro();
		b.run(8.5, () => {
			b.safe();
			b.game.players[0].health = 40;
		});
		expect(b.mission.phase).toBe('together');
	});

	it('both yield, the Guardians go quiet about the Manhunter, and that passes the trial', () => {
		const { game, mission, run, safe, toSinestro } = setup();
		toSinestro();
		run(HAL_AFTER + 0.5, safe);
		for (const e of [mission.kilowog!, mission.sinestro!]) {
			e.hp = 0;
			e.down = 0.9;
		}
		run(0.2, safe);
		expect(mission.phase).toBe('verdict');
		expect(isStanding(mission.kilowog!)).toBe(false);
		const said: string[] = [];
		run(90, () => {
			safe();
			if (mission.line && said[said.length - 1] !== mission.line.text) said.push(mission.line.text);
		});
		expect(said.some((t) => t.includes('Manhunter'))).toBe(true);
		expect(mission.state).toBe('won');
		expect(game.players.length).toBe(2);
	});

	it('John going down three times fails the trial', () => {
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

describe('the flight to Oa', () => {
	const play = (scene: Summoned, seconds: number) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) scene.update(1 / 60);
	};

	it('flies first, then lands, then the talking starts with the ring', () => {
		const scene = new Summoned(SUMMONED);
		play(scene, 4);
		expect(scene.current).toBeNull();
		play(scene, 5.5);
		expect(scene.current?.who).toBe('ring');
	});

	it('everyone on Oa gets a word in, and it plays through by itself', () => {
		for (const who of ['guardian', 'hal', 'tomar', 'kilowog', 'john']) expect(SUMMONED.some((l) => l.who === who)).toBe(true);
		const scene = new Summoned(SUMMONED);
		play(scene, 180);
		expect(scene.done).toBe(true);
	});
});
