import { describe, expect, it } from 'vitest';
import { Camera, clampCameraAxis, screenScale } from './camera';

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
	// A laptop-sized screen: the camera's zooms apply as they are
	const view = { width: 1280, height: 720 };

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
		// 1280px screen at 2x zoom shows 640 world px, so centre can't go below 320
		expect(cam.x).toBe(320);
	});

	it('zooms out to fit a wide group, but never closer than its normal zoom or past its limit', () => {
		const cam = new Camera(1.6);
		for (let i = 0; i < 600; i++) cam.fit(1600, 300, 1 / 60, view);
		expect(cam.zoom).toBeCloseTo(1, 2); // 1280 / 1600 = 0.8, clamped to minZoom 1
		for (let i = 0; i < 600; i++) cam.fit(100, 100, 1 / 60, view);
		expect(cam.zoom).toBeCloseTo(1.6, 2);
	});

	it('on a phone it zooms out, so about as much of the fight fits as on a laptop', () => {
		const phone = { width: 844, height: 390 };
		expect(screenScale(view)).toBe(1);
		expect(screenScale(phone)).toBeLessThan(0.7);
		expect(screenScale({ width: 320, height: 200 })).toBe(0.55);
		const cam = new Camera(1.6);
		cam.snapTo(1000, 1000, phone, 3000, 3000);
		expect(cam.zoom).toBeCloseTo(1.6 * screenScale(phone), 5);
		for (let i = 0; i < 600; i++) cam.fit(100, 100, 1 / 60, phone);
		expect(cam.zoom).toBeCloseTo(1.6 * screenScale(phone), 2);
	});
});
