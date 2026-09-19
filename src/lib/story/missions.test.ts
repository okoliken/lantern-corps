import { describe, expect, it } from 'vitest';
import { ACTS, MISSIONS, placeOf } from './missions';

describe('the story in acts', () => {
	it('every built mission is in exactly one act', () => {
		for (const m of MISSIONS) {
			const acts = ACTS.filter((a) => a.lineup.includes(m.id));
			expect(acts, m.id).toHaveLength(1);
		}
	});

	it('every mission id in an act is a built mission', () => {
		for (const act of ACTS) {
			for (const entry of act.lineup) if (typeof entry === 'string') expect(MISSIONS.some((m) => m.id === entry), entry).toBe(true);
		}
	});

	it('Act 1 is Hal and Kilowog; John joins in Act 2', () => {
		expect(placeOf('the-interceptor')).toMatchObject({ act: { number: 1 }, number: 3 });
		expect(placeOf('colony-under-fire').act.number).toBe(2);
		const act1 = MISSIONS.filter((m) => placeOf(m.id).act.number === 1);
		expect(act1.every((m) => m.lantern === 'hal')).toBe(true);
	});
});
