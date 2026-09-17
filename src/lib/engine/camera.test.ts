import { describe, expect, it } from 'vitest';
import { Camera, clampCameraAxis } from './camera';

describe('clampCameraAxis', () => {
	it('follows freely in the middle of the map', () => {
		expect(clampCameraAxis(1000, 800, 3000)).toBe(1000);
	});

	it('stops at the left/top edge so no void shows', () => {
		expect(clampCameraAxis(100, 800, 3000)).toBe(400);
	});

	it('stops at the right/bottom edge', () => {
		expect(clampCameraAxis(2900, 800, 3000)).toBe(2600);
	});

	it('centres a map smaller than the screen', () => {
		expect(clampCameraAxis(0, 1200, 1000)).toBe(500);
	});
});

describe('Camera', () => {
	const view = { width: 800, height: 600 };

	it('glides toward the target instead of snapping', () => {
		const cam = new Camera(1);
		cam.snapTo(1000, 1000, view, 3000, 3000);
		cam.follow(1200, 1000, 1 / 60, view, 3000, 3000);
		expect(cam.x).toBeGreaterThan(1000);
		expect(cam.x).toBeLessThan(1200);
	});

	it('catches up after a moment', () => {
		const cam = new Camera(1);
		cam.snapTo(1000, 1000, view, 3000, 3000);
		for (let i = 0; i < 120; i++) cam.follow(1200, 1000, 1 / 60, view, 3000, 3000);
		expect(cam.x).toBeCloseTo(1200, 0);
	});

	it('zooming in means less world fits, so edge limits move inward', () => {
		const cam = new Camera(2);
		cam.snapTo(0, 0, view, 3000, 3000);
		// 800px screen at 2x zoom shows 400 world px, so centre can't go below 200
		expect(cam.x).toBe(200);
	});
});
