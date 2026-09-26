import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { buildTrainingMap } from './training';
import { LESSONS, lessonById, School, TEACHERS } from './school';
import { MAX_WILLPOWER } from '../willpower';

function setup(id: string) {
	const map = buildTrainingMap();
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map });
	game.setView({ width: 1400, height: 800 });
	const school = new School(lessonById(id)!, map);
	game.director = school;
	const run = (seconds: number, each: () => void = () => {}) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	return { game, school, run };
}

describe('Survival School', () => {
	it('has lessons, each with a teacher and a mark to beat', () => {
		expect(LESSONS.length).toBe(4);
		for (const lesson of LESSONS) {
			expect(TEACHERS[lesson.teacher]).toBeTruthy();
			expect(lesson.pass).toBeGreaterThan(0);
			expect(lessonById(lesson.id)).toBe(lesson);
		}
	});

	it("the drill yard's bolts actually hurt: they were being absorbed into nothing", () => {
		const { game, school, run } = setup('shields');
		run(3.4);
		const me = game.players[0];
		const full = me.health;
		// Stand still in the open, no bubble, and let the drones work
		run(12, () => {
			me.x = me.prevX = 900;
			me.y = me.prevY = 700;
		});
		expect(school.state).toBe('running');
		expect(me.health).toBeLessThan(full);
	});

	it('Take the Hit only scores a heavy bolt that a bubble was actually up for', () => {
		const { game, school, run } = setup('take-the-hit');
		run(3.4);
		const me = game.players[0];
		const full = me.health;
		run(12, () => {
			me.x = me.prevX = 900;
			me.y = me.prevY = 700;
		});
		// No bubble the whole time, so nothing braced and it hurt
		expect(school.score).toBe(0);
		expect(me.health).toBeLessThan(full);
	});

	it('Shields First only counts targets broken with the bubble up', () => {
		const { game, school, run } = setup('shields');
		run(3.4);
		expect(school.state).toBe('running');
		const unshielded = game.dummies.find((d) => d.kind === 'dummy')!;
		unshielded.hp = 0;
		unshielded.down = 1;
		run(0.2);
		expect(school.score).toBe(0);

		// Put a bubble on him, then break one
		const me = game.players[0];
		game.constructs.shields.push({ target: me, owner: me, hp: 200, maxHp: 200, life: 10, maxLife: 10, ripple: 0 });
		const shielded = game.dummies.find((d) => d.kind === 'dummy')!;
		shielded.hp = 0;
		shielded.down = 1;
		run(0.2);
		expect(school.score).toBe(1);
	});

	it('Running on Empty starts you low with no battery to lean on', () => {
		const { game, school, run } = setup('empty');
		run(3.4);
		expect(game.players[0].willpower).toBeLessThan(MAX_WILLPOWER * 0.4);
		expect(game.map.noBattery).toBe(true);
		// Here every target counts, shielded or not
		const target = game.dummies.find((d) => d.kind === 'dummy')!;
		target.hp = 0;
		target.down = 1;
		run(0.2);
		expect(school.score).toBe(1);
	});

	it('the Fear Drill shakes the ring while they crowd you, and settles when they do not', () => {
		const { game, school, run } = setup('fear');
		run(3.4);
		expect(game.enemies.length).toBe(5);
		const me = game.players[0];
		// Stand among them: fear climbs
		run(6, () => {
			me.invuln = 1;
			for (const e of game.enemies) {
				e.x = me.x + 60;
				e.y = me.y;
			}
		});
		expect(school.fear).toBeGreaterThan(0.5);
		// Drive them off and it settles
		run(6, () => {
			me.invuln = 1;
			for (const e of game.enemies) {
				e.x = me.x + 1400;
			}
		});
		expect(school.fear).toBeLessThan(0.2);
	});

	it('every lesson ends when its minute is up', () => {
		const { school, run } = setup('take-the-hit');
		run(3.4);
		expect(school.state).toBe('running');
		run(61);
		expect(school.state).toBe('over');
		expect(school.clock).toBe(0);
	});
});
