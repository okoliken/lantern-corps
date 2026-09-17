import { describe, expect, it } from 'vitest';
import { BEAM_RANGE, castBeam } from './beam';
import type { Solid } from './player';

const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h, blocksFlying: false });

describe('castBeam', () => {
	it('reaches full range when nothing is in the way', () => {
		const r = castBeam(0, 0, 1, 0, []);
		expect(r.length).toBe(BEAM_RANGE);
		expect(r.hit).toBeNull();
	});

	it('stops at the near edge of a box in its path', () => {
		const target = box(100, -10, 40, 20);
		const r = castBeam(0, 0, 1, 0, [target]);
		expect(r.length).toBeCloseTo(100);
		expect(r.hit).toBe(target);
	});

	it('hits the NEAREST box when several are lined up', () => {
		const far = box(300, -10, 40, 20);
		const near = box(150, -10, 40, 20);
		expect(castBeam(0, 0, 1, 0, [far, near]).hit).toBe(near);
	});

	it('misses boxes that are off to the side', () => {
		expect(castBeam(0, 0, 1, 0, [box(100, 50, 40, 20)]).hit).toBeNull();
	});

	it('ignores boxes behind the shooter', () => {
		expect(castBeam(0, 0, 1, 0, [box(-100, -10, 40, 20)]).hit).toBeNull();
	});

	it('ignores boxes beyond its range', () => {
		expect(castBeam(0, 0, 1, 0, [box(BEAM_RANGE + 10, -10, 40, 20)]).hit).toBeNull();
	});

	it('works on diagonals', () => {
		const target = box(100, 100, 40, 40);
		const r = castBeam(0, 0, Math.SQRT1_2, Math.SQRT1_2, [target]);
		expect(r.hit).toBe(target);
		expect(r.length).toBeCloseTo(Math.hypot(100, 100));
	});

	it('shoots out of a box it starts inside (flying over a building)', () => {
		const roof = box(-50, -50, 100, 100);
		const target = box(200, -10, 40, 20);
		expect(castBeam(0, 0, 1, 0, [roof, target]).hit).toBe(target);
	});
});
