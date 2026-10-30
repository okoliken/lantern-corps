import { describe, expect, it } from 'vitest';
import { ARMORY } from './constructs/defs';
import { DUMMY_HP } from './dummy';
import { ConstructDemo, demoLength, demoPeak } from './demo';

const run = (demo: ConstructDemo, seconds: number) => {
	for (let t = 0; t < seconds; t += 1 / 60) demo.update(1 / 60);
};

describe('construct demos', () => {
	for (const lantern of ['hal', 'john'] as const) {
		for (const id of ARMORY[lantern]!) {
			it(`${lantern}: ${id} does something you can see`, () => {
				const subject = { kind: 'construct', id } as const;
				const demo = new ConstructDemo(lantern, subject);
				const w = demo.game.constructs;
				let acted = false;
				for (let t = 0; t < demoLength(subject) - 0.05; t += 1 / 60) {
					demo.update(1 / 60);
					const p = demo.game.players[0];
					if (w.projectiles.length || w.turrets.length || w.traps.length || w.pillarStrikes.length || w.effects.some((e) => e.kind !== 'number') || p.dash || p.armor || p.lockOn > 0 || p.chaff > 0 || p.firing || demo.game.dummies.some((d) => d.hp < DUMMY_HP)) acted = true;
				}
				expect(acted).toBe(true);
				expect(demoPeak(subject)).toBeLessThan(demoLength(subject));
			});
		}
	}

	it('loops: after its length it starts again with a fresh game', () => {
		const demo = new ConstructDemo('john', { kind: 'construct', id: 'tank' });
		const first = demo.game;
		run(demo, demoLength({ kind: 'construct', id: 'tank' }) + 0.1);
		expect(demo.game).not.toBe(first);
	});

	it('the signature demo fires the signature', () => {
		const demo = new ConstructDemo('hal', { kind: 'signature' });
		run(demo, 0.6);
		expect(demo.game.players[0].dash || demo.game.constructs.effects.length > 0).toBeTruthy();
	});
});
