// Character animation: a simple skeleton driven by joint angles.
//
// A Lantern is a set of bones (thigh, shin, torso, upper arm, forearm,
// head). Every animation is just a set of joint ANGLES at a moment in time.
// computeSkeleton() turns the current situation (walking? flying? just fired?
// hurt?) into angles, then works out where every joint ends up. That step is
// called forward kinematics: start at the hip and add one bone at a time.
//
// There's no animation "state" stored anywhere. Everything comes from the
// player's continuous values (walk phase, altitude, timers), so animations
// blend smoothly on their own: take-off is simply altitude going 0 -> 1.
//
// Coordinates are LOCAL: facing right, unscaled, origin at the feet anchor,
// y grows downward (so "up" is negative), like the rest of the canvas.

export interface LanternPose {
	/** 1 = facing right, -1 = facing left. */
	dir: 1 | -1;
	/** Walk cycle angle. 0 when standing still or flying. */
	walkPhase: number;
	/** 0 = standing on the ground, 1 = fully airborne. In between during take-off/landing. */
	altitude: number;
	/** How high (unscaled) they float at altitude 1. */
	hoverHeight: number;
	/** 0..1, how hard a flying Lantern leans into flight (from horizontal speed). */
	lean: number;
	/** Green aura and glowing ring while airborne. */
	glow: boolean;
	/** Draw a shadow on the ground below (false in space). */
	shadow: boolean;
	/** The ring arm aims along (aimX, aimY): beam/minigun running, or just used something. */
	firing: boolean;
	aimX: number;
	aimY: number;
	/** 0..1 recoil from a ring shot (1 = just fired). */
	shotKick?: number;
	/** 0..1 construct cast (1 = just cast): a stronger thrust with the whole body. */
	cast?: number;
	/** 0..1 flinch from being hit. */
	hurt?: number;
	/** Knocked down, lying on the ground. */
	downed?: boolean;
	/** 0..1 victory pose. */
	victory?: number;
}

export type Point = [number, number];

/** Where every joint is, in local coordinates. */
export interface Skeleton {
	hip: Point;
	neck: Point;
	headCenter: Point;
	/** Tilt of the head (radians, positive = chin forward/down). */
	headAngle: number;
	/** Lean of the torso (radians from upright, positive = forward). */
	torsoAngle: number;
	front: Limbs;
	back: Limbs;
}

export interface Limbs {
	shoulder: Point;
	elbow: Point;
	hand: Point;
	hipJoint: Point;
	knee: Point;
	foot: Point;
}

// ---- Bone lengths (unscaled) ----
export const THIGH = 11;
export const SHIN = 11;
export const TORSO = 18;
export const NECK = 3.5;
/** Heroic proportions: a smaller head on a broad body. */
export const HEAD_R = 5.4;
export const UPPER_ARM = 9;
export const FOREARM = 8.5;
/** Feet to top of head when standing straight. */
export const STANDING_HEIGHT = THIGH + SHIN + TORSO + NECK + HEAD_R * 2;

/**
 * Joint angles. Limb angles are measured from pointing STRAIGHT DOWN,
 * positive swings FORWARD (toward the way they face).
 */
interface Angles {
	lean: number;
	head: number;
	frontThigh: number;
	frontKnee: number;
	backThigh: number;
	backKnee: number;
	frontShoulder: number;
	frontElbow: number;
	backShoulder: number;
	backElbow: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (a: number, b: number, t: number) => {
	const k = clamp01((t - a) / (b - a));
	return k * k * (3 - 2 * k);
};

function mix(a: Angles, b: Angles, t: number): Angles {
	const out = { ...a };
	for (const key of Object.keys(a) as (keyof Angles)[]) out[key] = lerp(a[key], b[key], t);
	return out;
}

/** A unit vector pointing "down" rotated forward by `angle`. */
const down = (angle: number): Point => [Math.sin(angle), Math.cos(angle)];
const add = (p: Point, v: Point, len: number): Point => [p[0] + v[0] * len, p[1] + v[1] * len];

// ------------------------------------------------------------------ poses

function groundAngles(pose: LanternPose, time: number): Angles {
	if (pose.walkPhase !== 0) {
		// Walk cycle: legs swing opposite each other, arms opposite the legs.
		// A knee bends as its leg swings through under the body.
		const s = Math.sin(pose.walkPhase);
		const kneeFor = (phase: number) => 0.12 + 0.65 * Math.max(0, Math.cos(phase));
		return {
			lean: 0.08,
			head: -0.04,
			frontThigh: 0.5 * s,
			frontKnee: kneeFor(pose.walkPhase),
			backThigh: -0.5 * s,
			backKnee: kneeFor(pose.walkPhase + Math.PI),
			frontShoulder: -0.45 * s + 0.08,
			frontElbow: 0.4,
			backShoulder: 0.45 * s - 0.08,
			backElbow: 0.4
		};
	}
	// Idle: standing tall, breathing, a little weight shift
	const breath = Math.sin(time * 2);
	return {
		lean: 0.02 + breath * 0.01,
		head: breath * 0.02,
		frontThigh: 0.06,
		frontKnee: 0.06,
		backThigh: -0.08,
		backKnee: 0.1,
		frontShoulder: 0.14 + breath * 0.03,
		frontElbow: 0.3,
		backShoulder: -0.12 - breath * 0.03,
		backElbow: 0.25
	};
}

function airAngles(pose: LanternPose, time: number): Angles {
	// L = how much they're leaning into flight
	const L = clamp01(pose.lean);
	const lean = 1.15 * L;
	const dangle = Math.sin(time * 1.6) * 0.08 * (1 - L);
	return {
		lean,
		// Chin up while flying flat, so they look where they're going
		head: -lean * 0.6,
		// Hover: one knee up, relaxed. Fast: legs straight out behind the body line
		frontThigh: lerp(0.3 + dangle, -lean + 0.06, L),
		frontKnee: lerp(0.75, 0.08, L),
		backThigh: lerp(-0.05 - dangle, -lean - 0.08, L),
		backKnee: lerp(0.3, 0.2, L),
		// Hover: fists slightly out. Fast: ring arm reaching ahead, the other along the side
		frontShoulder: lerp(0.35, Math.PI - lean - 0.1, L * 0.95),
		frontElbow: lerp(0.35, 0, L),
		backShoulder: lerp(-0.25, -lean - 0.2, L),
		backElbow: lerp(0.3, 0.1, L)
	};
}

function downedAngles(time: number): Angles {
	// Flat on their back, head toward the back, one knee up. The ring arm
	// lies along the ground toward the feet (clear of the face); the other
	// arm is flung out past the head.
	const stir = Math.sin(time * 1.3) * 0.04;
	return {
		lean: -1.5,
		head: -0.1 + stir,
		frontThigh: 1.1,
		frontKnee: 1.2,
		backThigh: 1.52,
		backKnee: 0.05,
		frontShoulder: 1.25 + stir,
		frontElbow: 0.25,
		backShoulder: -2.2,
		backElbow: 0.4
	};
}

// --------------------------------------------------------------- skeleton

export function computeSkeleton(pose: LanternPose, time: number): Skeleton {
	if (pose.downed) return solve(downedAngles(time), -4, 4);

	const air = clamp01(pose.altitude);
	// Take-off and landing: a crouch that peaks a quarter of the way up
	const crouch = air < 0.5 ? Math.sin((air / 0.5) * Math.PI) : 0;
	// Blend from standing to flying poses in the middle of the rise
	const flyWeight = smoothstep(0.3, 0.75, air);

	let a = mix(groundAngles(pose, time), airAngles(pose, time), flyWeight);

	if (crouch > 0) {
		a = {
			...a,
			lean: a.lean + 0.35 * crouch,
			frontThigh: a.frontThigh + 0.9 * crouch,
			frontKnee: a.frontKnee + 1.5 * crouch,
			backThigh: a.backThigh + 0.7 * crouch,
			backKnee: a.backKnee + 1.4 * crouch,
			frontShoulder: a.frontShoulder - 0.7 * crouch,
			backShoulder: a.backShoulder - 0.6 * crouch
		};
	}

	// ---- Aiming: the ring arm points straight along the aim ----
	if (pose.firing || (pose.cast ?? 0) > 0) {
		// Upright enough to aim, even mid-flight
		a.lean = Math.min(a.lean, 0.25);
		a.head = Math.max(a.head, -0.2);
		// Turn the world aim into this facing's local space, then into an angle from "down"
		a.frontShoulder = Math.atan2(pose.aimX * pose.dir, pose.aimY);
		a.frontElbow = 0;
		// Other hand comes up to brace near the chest
		a.backShoulder = lerp(a.backShoulder, 0.5, 0.8);
		a.backElbow = lerp(a.backElbow, 1.4, 0.8);
	}

	const kick = pose.shotKick ?? 0;
	if (kick > 0) {
		// Recoil: elbow gives a little, shoulders rock back
		a.frontElbow += 0.45 * kick;
		a.lean -= 0.06 * kick;
	}

	const cast = pose.cast ?? 0;
	if (cast > 0) {
		// Throwing a construct: back arm swings behind, wide stance, body drives forward
		a.backShoulder = lerp(a.backShoulder, -1.1, cast);
		a.backElbow = lerp(a.backElbow, 0.3, cast);
		a.lean += 0.14 * cast;
		if (flyWeight < 0.5) {
			a.frontThigh += 0.3 * cast;
			a.backThigh -= 0.35 * cast;
			a.frontKnee += 0.35 * cast;
			a.backKnee += 0.15 * cast;
		}
	}

	const hurt = pose.hurt ?? 0;
	if (hurt > 0) {
		// Flinch: knocked back, head snaps, arms fly up
		a.lean -= 0.45 * hurt;
		a.head -= 0.35 * hurt;
		a.frontShoulder -= 0.7 * hurt;
		a.backShoulder -= 1.0 * hurt;
		a.frontElbow += 0.9 * hurt;
		a.backElbow += 0.9 * hurt;
		a.frontKnee += 0.35 * hurt;
		a.backKnee += 0.35 * hurt;
	}

	const win = pose.victory ?? 0;
	if (win > 0) {
		// Ring fist raised high, other hand on hip, chest out
		a = mix(a, {
			lean: -0.08,
			// Looking up at the raised fist
			head: -0.3,
			frontThigh: 0.2,
			frontKnee: 0.05,
			backThigh: -0.2,
			backKnee: 0.05,
			// Fist raised up and forward, so it doesn't cover the face
			frontShoulder: Math.PI - 0.55,
			frontElbow: 0.2,
			// Elbow out behind, forearm angled forward so the hand rests on the hip
			backShoulder: -0.6,
			backElbow: 1.6
		}, win);
	}

	// Height: on the ground the lowest foot touches y = 0; in the air the body
	// rises by the hover height (with a slow bob).
	const legsOnly = solve(a, 0, 0);
	const groundHipY = -Math.max(legsOnly.front.foot[1], legsOnly.back.foot[1]);
	const airHipY = -(THIGH + SHIN) - pose.hoverHeight + Math.sin(time * 2.2) * 1.6;
	return solve(a, lerp(groundHipY, airHipY, air), 0);
}

/** Forward kinematics: from the hip outward, one bone at a time. */
function solve(a: Angles, hipY: number, hipX: number): Skeleton {
	const hip: Point = [hipX, hipY];
	// Torso "up" direction, leaning forward by a.lean
	const up: Point = [Math.sin(a.lean), -Math.cos(a.lean)];
	// Across the body, toward the front
	const across: Point = [Math.cos(a.lean), Math.sin(a.lean)];

	const neck = add(hip, up, TORSO);
	const headUp: Point = [Math.sin(a.lean + a.head), -Math.cos(a.lean + a.head)];
	const headCenter = add(neck, headUp, NECK + HEAD_R);
	const shoulderBase = add(hip, up, TORSO - 2.2);

	const limbs = (side: 1 | -1, thigh: number, knee: number, shoulderA: number, elbow: number): Limbs => {
		// Shoulders sit toward the back of the chest, so the chest shows in front of the arm
		const shoulder = add(shoulderBase, across, side === 1 ? -0.4 : -1.9);
		const elbowP = add(shoulder, down(shoulderA), UPPER_ARM);
		const hand = add(elbowP, down(shoulderA + elbow), FOREARM);
		const hipJoint = add(hip, across, 1.6 * side);
		const kneeP = add(hipJoint, down(thigh), THIGH);
		const foot = add(kneeP, down(thigh - knee), SHIN);
		return { shoulder, elbow: elbowP, hand, hipJoint, knee: kneeP, foot };
	};

	return {
		hip,
		neck,
		headCenter,
		headAngle: a.lean + a.head,
		torsoAngle: a.lean,
		front: limbs(1, a.frontThigh, a.frontKnee, a.frontShoulder, a.frontElbow),
		back: limbs(-1, a.backThigh, a.backKnee, a.backShoulder, a.backElbow)
	};
}
