import { describe, expect, it } from 'vitest';
import { JOHN_CHOSEN, OA_LANDING } from '../../story/scenes';
import { JohnChosen } from './johnChosen';
import type { DialogueScene } from './scene';
import { OaLanding } from './oaLanding';

const run = (scene: DialogueScene, seconds: number) => {
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
	it('talks, and ends on the cliffhanger, before he puts the ring on', () => {
		const scene = new JohnChosen(JOHN_CHOSEN);
		run(scene, 6);
		expect(scene.current?.who).toBe('ring');
		expect(JOHN_CHOSEN.some((l) => l.mood === 'chosen')).toBe(false);
		run(scene, 120);
		expect(scene.done).toBe(true);
	});

	it('still plays the transformation when a line says so (for Act 2)', () => {
		const lines = [...JOHN_CHOSEN, { who: 'ring' as const, text: 'Welcome to the Green Lantern Corps.', mood: 'chosen' as const }];
		const scene = new JohnChosen(lines);
		run(scene, 120);
		expect(scene.done).toBe(true);
	});
});
