import { describe, expect, it } from 'vitest';
import { STANDING_HEIGHT, THIGH, SHIN, computeSkeleton, type LanternPose } from './animation';

const base: LanternPose = {
	dir: 1,
	walkPhase: 0,
	altitude: 0,
	hoverHeight: 26,
	lean: 0,
	glow: false,
	shadow: true,
	firing: false,
	aimX: 1,
	aimY: 0
};
const pose = (over: Partial<LanternPose>): LanternPose => ({ ...base, ...over });
const T = 1.234;

describe('standing', () => {
	it('keeps the lowest foot on the ground', () => {
		const sk = computeSkeleton(base, T);
		expect(Math.max(sk.front.foot[1], sk.back.foot[1])).toBeCloseTo(0);
	});

	it('head is at about standing height', () => {
		const sk = computeSkeleton(base, T);
		const top = sk.headCenter[1] - 6.3;
		expect(-top).toBeGreaterThan(STANDING_HEIGHT * 0.9);
		expect(-top).toBeLessThan(STANDING_HEIGHT * 1.05);
	});
});

describe('walking', () => {
	it('legs swing opposite each other', () => {
		const sk = computeSkeleton(pose({ walkPhase: Math.PI / 2 }), T);
		expect(sk.front.foot[0]).toBeGreaterThan(sk.hip[0]);
		expect(sk.back.foot[0]).toBeLessThan(sk.hip[0]);
	});

	it('a foot always stays planted', () => {
		for (const phase of [0.3, 1, 2, 3, 4, 5]) {
			const sk = computeSkeleton(pose({ walkPhase: phase }), T);
			expect(Math.max(sk.front.foot[1], sk.back.foot[1])).toBeCloseTo(0);
		}
	});
});

describe('flying', () => {
	it('body rises by the hover height', () => {
		const ground = computeSkeleton(base, 0);
		const air = computeSkeleton(pose({ altitude: 1 }), 0);
		expect(ground.hip[1] - air.hip[1]).toBeGreaterThan(20);
	});

	it('take-off crouches first: hips dip below standing height a quarter of the way up', () => {
		const standing = computeSkeleton(base, 0);
		const crouched = computeSkeleton(pose({ altitude: 0.25, hoverHeight: 0 }), 0);
		expect(crouched.hip[1]).toBeGreaterThan(standing.hip[1]);
	});

	it('flying fast leans the body forward', () => {
		const slow = computeSkeleton(pose({ altitude: 1 }), T);
		const fast = computeSkeleton(pose({ altitude: 1, lean: 1 }), T);
		expect(fast.torsoAngle).toBeGreaterThan(slow.torsoAngle + 0.8);
	});
});

describe('aiming', () => {
	const armDirection = (p: LanternPose) => {
		const sk = computeSkeleton(p, T);
		const dx = sk.front.hand[0] - sk.front.shoulder[0];
		const dy = sk.front.hand[1] - sk.front.shoulder[1];
		const len = Math.hypot(dx, dy);
		return [dx / len, dy / len];
	};

	it('the ring arm points straight along the aim', () => {
		const [x, y] = armDirection(pose({ firing: true, aimX: 0.6, aimY: -0.8 }));
		expect(x).toBeCloseTo(0.6);
		expect(y).toBeCloseTo(-0.8);
	});

	it('facing left, local space is mirrored, so a left aim points "forward"', () => {
		const [x] = armDirection(pose({ firing: true, dir: -1, aimX: -1, aimY: 0 }));
		expect(x).toBeCloseTo(1);
	});

	it('aiming straightens a flying Lantern up', () => {
		const sk = computeSkeleton(pose({ altitude: 1, lean: 1, firing: true }), T);
		expect(sk.torsoAngle).toBeLessThanOrEqual(0.25);
	});
});

describe('reactions', () => {
	it('hurt knocks the body back', () => {
		expect(computeSkeleton(pose({ hurt: 1 }), T).torsoAngle).toBeLessThan(computeSkeleton(base, T).torsoAngle);
	});

	it('downed lies flat near the ground', () => {
		const sk = computeSkeleton(pose({ downed: true }), T);
		expect(Math.abs(sk.torsoAngle)).toBeGreaterThan(1.3);
		expect(sk.headCenter[1]).toBeGreaterThan(-THIGH);
	});

	it('victory raises the ring fist above the head', () => {
		const sk = computeSkeleton(pose({ victory: 1 }), T);
		expect(sk.front.hand[1]).toBeLessThan(sk.headCenter[1]);
	});

	it('legs never stretch past their bone lengths', () => {
		const sk = computeSkeleton(pose({ walkPhase: 1, cast: 1, hurt: 0.5 }), T);
		for (const l of [sk.front, sk.back]) {
			expect(Math.hypot(l.foot[0] - l.hipJoint[0], l.foot[1] - l.hipJoint[1])).toBeLessThanOrEqual(THIGH + SHIN + 1e-9);
		}
	});
});
