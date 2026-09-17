import { describe, expect, it } from 'vitest';
import { consumeTime, MAX_FRAME_MS, STEP_MS } from './loop';

describe('consumeTime', () => {
	it('runs one tick for exactly one step of time', () => {
		const r = consumeTime(0, STEP_MS);
		expect(r.steps).toBe(1);
		expect(r.accumulator).toBeCloseTo(0);
	});

	it('runs no ticks on a short frame but keeps the leftover time', () => {
		const r = consumeTime(0, STEP_MS / 2);
		expect(r.steps).toBe(0);
		expect(r.accumulator).toBeCloseTo(STEP_MS / 2);
		expect(r.alpha).toBeCloseTo(0.5);
	});

	it('leftover time from earlier frames adds up to a tick', () => {
		const first = consumeTime(0, STEP_MS * 0.6);
		const second = consumeTime(first.accumulator, STEP_MS * 0.6);
		expect(first.steps + second.steps).toBe(1);
	});

	it('a slow 30fps frame runs two ticks, so game speed stays the same', () => {
		expect(consumeTime(0, STEP_MS * 2).steps).toBe(2);
	});

	it('clamps huge gaps (like a backgrounded tab)', () => {
		// 250ms max frame / 16.67ms step = 15 ticks, not 600.
		expect(MAX_FRAME_MS).toBe(250);
		expect(consumeTime(0, 10_000).steps).toBe(15);
	});

	it('ignores negative frame times', () => {
		expect(consumeTime(0, -50).steps).toBe(0);
	});
});
