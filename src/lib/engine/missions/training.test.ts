import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { IDLE, type Intent } from '../input';
import { Training, buildTrainingMap } from './training';

function setup() {
	const map = buildTrainingMap();
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }], map });
	game.setView({ width: 1400, height: 800 });
	const training = new Training(map);
	game.director = training;
	const p = game.players[0];
	let intent: Intent = IDLE;
	p.input = { read: () => intent };
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const press = (i: Partial<Intent>) => {
		intent = { ...IDLE, ...i };
		run(1 / 60);
		intent = IDLE;
	};
	/** Finish the "nice!" pause and move on to the next step. */
	const waitForNext = () => run(1.6);
	return { game, training, p, run, press, waitForNext };
}

describe('Training on Oa', () => {
	it('walks a new Lantern through every step, one at a time', () => {
		const { game, training, p, run, press, waitForNext } = setup();
		expect(training.step).toBe('welcome');
		run(5.1);
		waitForNext();

		// Move: walk onto each marker
		expect(training.step).toBe('move');
		for (let i = 0; i < 3; i++) {
			const m = (training as unknown as { markers: { x: number; y: number }[] }).markers[i];
			p.x = m.x;
			p.y = m.y;
			run(1 / 60);
		}
		waitForNext();

		// Take off, then land on the marker
		expect(training.step).toBe('fly');
		press({ toggleFly: true });
		run(1);
		waitForNext();
		expect(training.step).toBe('land');
		const spot = (training as unknown as { markers: { x: number; y: number }[] }).markers[0];
		p.x = spot.x;
		p.y = spot.y;
		press({ toggleFly: true });
		run(1.5);
		waitForNext();

		// Knock down both targets
		expect(training.step).toBe('shoot');
		for (const d of game.dummies) d.hp = 1;
		const scripted = p.input;
		run(3, () => {
			const d = game.dummies.find((x) => x.down === 0 && !x.gone);
			if (d) p.lock = { kind: 'enemy', dummy: d };
			p.input = { read: () => ({ ...IDLE, shot: training.step === 'shoot' }) };
		});
		p.input = scripted;
		p.lock = null;

		// Three constructs, the smart ring choosing
		expect(training.step).toBe('construct');
		p.smartRing = true;
		p.willpower = p.maxWillpower;
		for (let i = 0; i < 3; i++) {
			press({ construct: true, constructPressed: true });
			run(1.2);
			p.willpower = p.maxWillpower;
		}
		waitForNext();

		// Shield yourself, then the pod under fire
		expect(training.step).toBe('shieldSelf');
		press({ shield: true });
		waitForNext();
		expect(training.step).toBe('shieldPod');
		run(0.6); // a bolt is on its way
		press({ shield: true });
		expect(game.constructs.shields.some((s) => s.target !== p)).toBe(true);
		run(3);
		waitForNext();

		// Recharge at the Lantern
		expect(training.step).toBe('recharge');
		expect(p.willpower).toBeLessThan(20);
		p.x = game.batteries[0].x;
		p.y = game.batteries[0].y + 40;
		run(3);
		waitForNext();

		// Signature
		expect(training.step).toBe('signature');
		press({ signature: true });
		run(0.5);
		waitForNext();
		expect(training.finished).toBe(true);
	});

	it('nobody gets hurt in training', () => {
		const { game, p, run } = setup();
		run(0.1);
		expect(game.godMode).toBe(true);
		expect(p.health).toBe(p.maxHealth);
	});
});
