// Sinestro's own kit: ten constructs no one else carries, and each one works.

import { describe, expect, it } from 'vitest';
import { DUMMY_HP, createDummy, updateDummy, type Dummy } from '../dummy';
import { IDLE, type Intent } from '../input';
import { LANTERNS, type CrewId } from '../lanterns';
import { createPlayer, type Player } from '../player';
import { MAX_WILLPOWER } from '../willpower';
import { CONSTRUCTS, LOADOUTS, type ConstructId } from './defs';
import { createConstructWorld, updateConstructWorld, updatePlayerConstructs, type ConstructWorld } from './system';

const DT = 1 / 60;
const PRESS: Intent = { ...IDLE, construct: true, constructPressed: true };
const HOLD: Intent = { ...IDLE, construct: true };

function setup(construct: ConstructId, dummies: Dummy[]) {
	const p = createPlayer(0, LANTERNS.sinestro, { read: () => IDLE }, 0, 0);
	p.selected = LOADOUTS.sinestro.indexOf(construct);
	return { p, w: createConstructWorld([], dummies) };
}

function run(p: Player, w: ConstructWorld, intent: Intent, seconds: number) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		p.willpower = MAX_WILLPOWER;
		updatePlayerConstructs(p, intent, DT, w);
		updateConstructWorld(w, DT);
		for (const d of w.dummies) updateDummy(d, DT, w.obstacles);
	}
}

describe("Sinestro's kit", () => {
	it('is ten constructs of his own: none of them is in anyone else’s kit', () => {
		const his = LOADOUTS.sinestro;
		expect(new Set(his).size).toBe(10);
		for (const [who, kit] of Object.entries(LOADOUTS) as [CrewId, ConstructId[]][]) {
			if (who === 'sinestro') continue;
			for (const id of kit) expect(his).not.toContain(id);
		}
		// And none of them borrows another construct's look
		const theirs = new Set(
			(Object.entries(LOADOUTS) as [CrewId, ConstructId[]][]).filter(([who]) => who !== 'sinestro').flatMap(([, kit]) => kit.map((id) => CONSTRUCTS[id].shape))
		);
		for (const id of his) expect(theirs.has(CONSTRUCTS[id].shape)).toBe(false);
	});

	// Where to stand the target for each, and how to use it
	const uses: [ConstructId, number, 'press' | 'hold'][] = [
		['korugarSaber', 70, 'press'],
		['verdict', 600, 'hold'],
		['needleVolley', 400, 'press'],
		['seizingTalon', 300, 'press'],
		['crescentGlaive', 250, 'press'],
		['korugarSpires', 216, 'press'],
		['sentinelBlades', 260, 'press'],
		['honorGuard', 260, 'press'],
		['rebuke', 120, 'press']
	];
	for (const [id, at, how] of uses) {
		it(`${CONSTRUCTS[id].name} hurts what it's used on`, () => {
			const d = createDummy(at, 0);
			const { p, w } = setup(id, [d]);
			if (how === 'hold') {
				run(p, w, HOLD, 0.8);
				run(p, w, IDLE, 0.3);
			} else {
				run(p, w, PRESS, DT);
				run(p, w, IDLE, 2);
			}
			expect(d.hp).toBeLessThan(DUMMY_HP);
		});
	}

	it('Seizing Talon drags them in', () => {
		const d = createDummy(300, 0);
		const { p, w } = setup('seizingTalon', [d]);
		run(p, w, PRESS, DT);
		run(p, w, IDLE, 0.6);
		expect(d.x).toBeLessThan(250);
	});

	it('Prism Cell closes round whatever walks in, and stands round it while it holds', () => {
		const d = createDummy(110, 0);
		const { p, w } = setup('prismCell', [d]);
		run(p, w, PRESS, DT);
		run(p, w, IDLE, 0.2);
		expect(d.caged).toBeGreaterThan(0);
		expect(w.effects.some((e) => e.kind === 'prismCell' && e.held === d)).toBe(true);
		// Free again: the cell is gone with the hold
		d.caged = 0;
		run(p, w, IDLE, DT);
		expect(w.effects.some((e) => e.kind === 'prismCell')).toBe(false);
	});
});
