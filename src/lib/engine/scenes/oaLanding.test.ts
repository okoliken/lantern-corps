import { describe, expect, it } from 'vitest';
import { JOHN_CHOSEN, OA_LANDING } from '../../story/scenes';
import { JohnChosen } from './johnChosen';
import { OaLanding } from './oaLanding';

const run = (scene: OaLanding, seconds: number) => {
	for (let i = 0; i < Math.round(seconds * 60); i++) scene.update(1 / 60);
};

describe('the landing on Oa', () => {
	it('lands first, then the talking starts', () => {
		const scene = new OaLanding(OA_LANDING, 0.8);
		run(scene, 3);
		expect(scene.current).toBeNull();
		run(scene, 7);
		expect(scene.current?.who).toBe('tomar');
	});

	it('a click finishes the line, the next click moves on', () => {
		const scene = new OaLanding(OA_LANDING, 0.8);
		scene.advance(); // skips the arrival
		run(scene, 0.1);
		expect(scene.lineComplete).toBe(false);
		scene.advance();
		expect(scene.lineComplete).toBe(true);
		scene.advance();
		expect(scene.line).toBe(1);
	});

	it('plays through by itself and ends', () => {
		const scene = new OaLanding(OA_LANDING, 0.8);
		run(scene, 120);
		expect(scene.done).toBe(true);
	});

	it('Tomar-Re warns about the red light before it ends', () => {
		expect(OA_LANDING.some((l) => l.mood === 'alarm')).toBe(true);
	});

	it('skipping ends it straight away', () => {
		const scene = new OaLanding(OA_LANDING, 0.8);
		scene.skip();
		expect(scene.done).toBe(true);
	});
});

describe('the ring finds John Stewart', () => {
	it('talks, chooses him, and ends', () => {
		const scene = new JohnChosen(JOHN_CHOSEN);
		run(scene, 6);
		expect(scene.current?.who).toBe('ring');
		const chosen = JOHN_CHOSEN.findIndex((l) => l.mood === 'chosen');
		expect(chosen).toBeGreaterThan(0);
		run(scene, 120);
		expect(scene.done).toBe(true);
	});
});
