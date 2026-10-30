// People without rings (enemies/gear.ts): Gotham thugs, Korugar Enforcers and
// the Weaponers of Qward, each drawn as themselves, on their feet, holding
// what they fight with. Also their rounds (bullets, rifle bolts, cannon
// slugs), stun grenades in the air, and the swings and flashes.

import { HEAD_R, computeSkeleton, turnScale, type LanternPose, type Point, type Skeleton } from '../animation';
import type { ConstructWorld } from '../constructs/system';
import { isStanding } from '../dummy';
import { ENEMIES, type Enemy, type EnemyKind } from '../enemies/enemies';
import { gearOf, grenadeProgress, isGearMelee } from '../enemies/gear';
import type { AbilityId, RedShot } from '../enemies/redConstructs';
import { enemyPose } from './enemies';
import { faceShape, frame, torsoShape } from './heroes';
import { FIGURE_HEIGHT, lerpP, poly, segment, shadeColor } from './lantern';

const TAU = Math.PI * 2;
const OUTLINE = '#030504';
const FIGURE_SCALE = 1.35;

export type RinglessKind = 'thug' | 'enforcer' | 'weaponer';
export const isRinglessKind = (kind: EnemyKind): kind is RinglessKind => kind === 'thug' || kind === 'enforcer' || kind === 'weaponer';

/** What's in their hand: the melee weapon while they swing it, a gun while they fire it, otherwise whatever they reach for first. */
type Held = 'pistol' | 'bat' | 'rifle' | 'baton' | 'cannon' | 'blade' | 'grenade';
const HELD: Partial<Record<AbilityId, Held>> = {
	pistol: 'pistol',
	batSwing: 'bat',
	pulseRifle: 'rifle',
	shockBaton: 'baton',
	stunGrenade: 'grenade',
	handCannon: 'cannon',
	forgeBlade: 'blade'
};
function heldBy(e: Enemy): Held {
	const b = e.brain;
	const using = b.state === 'windup' || b.state === 'act' ? b.ability : null;
	if (using && HELD[using]) {
		// A grenade is thrown from the off hand: the rifle stays up
		if (using !== 'stunGrenade') return HELD[using]!;
	}
	const first = b.kit.find((id) => HELD[id] && id !== 'stunGrenade') ?? b.kit[0];
	return HELD[first] ?? 'pistol';
}

/** A little variety within a crew, steady per person (from where they started). */
function seedOf(e: Enemy): number {
	const n = Math.sin(e.homeX * 12.9898 + e.homeY * 78.233) * 43758.5453;
	return n - Math.floor(n);
}
const pick = <T>(list: readonly T[], k: number): T => list[Math.floor(k * list.length) % list.length];

/** On their feet: no hovering, legs that walk, no lean into flight. */
function footPose(e: Enemy, hasGround: boolean, time: number): LanternPose {
	const base = enemyPose(e, hasGround, time);
	const speed = Math.hypot(e.vx, e.vy);
	return {
		...base,
		altitude: 0,
		hoverHeight: 0,
		lean: Math.min(0.12, speed / 2000),
		walkPhase: speed > 14 ? time * Math.min(speed, 420) * 0.055 + e.homeX : 0,
		glow: false
	};
}

const scaleOf = (e: Enemy) => FIGURE_SCALE * ENEMIES[e.kind].scale;

export function drawRinglessEnemy(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const pose = footPose(e, hasGround, time);
	const sk = computeSkeleton(pose, time);
	const s = scaleOf(e);
	const seed = seedOf(e);
	const held = heldBy(e);
	ctx.save();
	ctx.globalAlpha = !isStanding(e) ? Math.min(1, e.down / 0.5) : 1;
	if (e.flash > 0) ctx.globalAlpha *= 0.55;
	ctx.translate(x, y);
	ctx.scale(s, s);
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
		ctx.beginPath();
		ctx.ellipse(0, 0, 12.5, 3.8, 0, 0, TAU);
		ctx.fill();
	}
	ctx.scale(pose.dir * turnScale(pose), 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	const aiming = pose.firing === true;
	if (e.kind === 'thug') drawThug(ctx, sk, seed, held, aiming, time);
	else if (e.kind === 'enforcer') drawEnforcer(ctx, sk, held, aiming, time);
	else drawWeaponer(ctx, sk, held, aiming, time);
	ctx.restore();
}

/** Where their rounds leave from: the end of the gun (or the hand), in world coordinates. */
export function ringlessMuzzle(e: Enemy, x: number, y: number): [number, number] {
	const pose = footPose(e, true, 0);
	const sk = computeSkeleton(pose, 0);
	const s = scaleOf(e);
	const k = pose.dir * turnScale(pose) * s;
	const reach = MUZZLE[heldBy(e)];
	const [ux, uy] = along(sk.front.elbow, sk.front.hand);
	return [x + (sk.front.hand[0] + ux * reach) * k, y + (sk.front.hand[1] + uy * reach) * s];
}
const MUZZLE: Record<Held, number> = { pistol: 8, bat: 0, rifle: 22, baton: 0, cannon: 13, blade: 0, grenade: 0 };

/** Just above their head. */
export function ringlessTop(e: Enemy, y: number): number {
	return y - FIGURE_HEIGHT * ENEMIES[e.kind].scale - (e.kind === 'weaponer' ? 12 : 8);
}

function along(a: Point, b: Point): [number, number] {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const d = Math.hypot(dx, dy) || 1;
	return [dx / d, dy / d];
}

function outline(ctx: CanvasRenderingContext2D, w = 0.8) {
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = w;
	ctx.stroke();
}

function shoe(ctx: CanvasRenderingContext2D, l: Skeleton['front'], color: string, sole: string | null, size = 4.4) {
	const shin = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]);
	const toe: Point = [l.foot[0] + Math.cos(shin - Math.PI / 2) * size, l.foot[1] + Math.sin(shin - Math.PI / 2) * size];
	segment(ctx, l.foot, toe, 2.4, 1.7, color);
	if (!sole) return;
	ctx.strokeStyle = sole;
	ctx.lineWidth = 1.1;
	ctx.beginPath();
	ctx.moveTo(l.foot[0] - 1.6, l.foot[1] + 2.2);
	ctx.lineTo(toe[0] + 0.6, toe[1] + 1.6);
	ctx.stroke();
}

// ---------------------------------------------------------------- Gotham thugs

const THUG_JACKETS = ['#3d4450', '#5b2f2a', '#2f4a3a', '#4b4136', '#2e2e34'] as const;
const THUG_SKIN = ['#c99a76', '#8d5a3c', '#e2b58e', '#6b4430', '#d9a982'] as const;
const THUG_CAPS = ['#20232a', '#6e2420', '#2b3a2a', '#3a3a40'] as const;
const DENIM = '#34405a';
const SNEAKER = '#d9d8d0';

function drawThug(ctx: CanvasRenderingContext2D, sk: Skeleton, seed: number, held: Held, aiming: boolean, time: number) {
	const jacket = pick(THUG_JACKETS, seed);
	const skin = pick(THUG_SKIN, seed * 7.3);
	const cap = pick(THUG_CAPS, seed * 3.1);
	const arm = (l: Skeleton['front'], far: boolean) => {
		const c = far ? shadeColor(jacket, -0.3) : jacket;
		segment(ctx, l.shoulder, l.elbow, 3.3, 2.8, c);
		const cuff = lerpP(l.elbow, l.hand, 0.82);
		segment(ctx, l.elbow, cuff, 2.8, 2.5, c);
		ctx.fillStyle = far ? shadeColor(skin, -0.2) : skin;
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 2.1, 0, TAU);
		ctx.fill();
		outline(ctx);
	};
	const leg = (l: Skeleton['front'], far: boolean) => {
		const c = far ? shadeColor(DENIM, -0.3) : DENIM;
		segment(ctx, l.hipJoint, l.knee, 3.7, 3.0, c);
		segment(ctx, l.knee, l.foot, 3.0, 2.6, c);
		shoe(ctx, l, far ? '#b9b8b0' : SNEAKER, '#77766f');
	};
	arm(sk.back, true);
	leg(sk.back, true);
	// The jacket: a hoodie under it, the hood bunched behind the neck
	const at = frame(sk);
	const body = torsoShape(at);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, shadeColor(jacket, -0.35));
	shade.addColorStop(1, shadeColor(jacket, 0.12));
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	// The hoodie showing down the open front
	ctx.fillStyle = '#8a8c90';
	ctx.fill(poly([at(19, 3.6), at(19, 6.6), at(-2, 6.6), at(-2, 4.6)]));
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	// Zip line and a pocket
	ctx.strokeStyle = shadeColor(jacket, -0.5);
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(...at(17, 4.4));
	ctx.lineTo(...at(0, 4.4));
	ctx.moveTo(...at(5.5, -0.5));
	ctx.lineTo(...at(5.5, 3.6));
	ctx.stroke();
	// The hood, bunched behind the neck
	const [hx, hy] = at(17.5, -3.6);
	ctx.fillStyle = '#7b7d82';
	ctx.beginPath();
	ctx.ellipse(hx, hy, 3.4, 2.4, sk.torsoAngle, 0, TAU);
	ctx.fill();
	outline(ctx);
	leg(sk.front, false);
	// Head: a knit cap pulled low, stubble
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = skin;
	ctx.fill(faceShape());
	ctx.save();
	ctx.clip(faceShape());
	ctx.fillStyle = 'rgba(30, 24, 20, 0.35)';
	ctx.beginPath();
	ctx.ellipse(R * 0.45, R * 0.95, R * 0.75, R * 0.45, 0.2, 0, TAU);
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(faceShape());
	// Eye and brow, hard
	ctx.fillStyle = '#141414';
	ctx.beginPath();
	ctx.arc(R * 0.6, -0.4, 0.75, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#141414';
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.moveTo(R * 0.15, -1.9);
	ctx.lineTo(R * 1.0, -1.4);
	ctx.stroke();
	// The cap: a dome down to the brow, a folded band
	ctx.fillStyle = cap;
	ctx.beginPath();
	ctx.moveTo(-R - 0.6, -0.6);
	ctx.arc(0, -0.8, R + 0.6, Math.PI, 0);
	ctx.lineTo(R + 0.6, -0.6);
	ctx.closePath();
	ctx.fill();
	outline(ctx);
	ctx.fillStyle = shadeColor(cap, 0.18);
	ctx.beginPath();
	ctx.rect(-R - 0.8, -2.8, R * 2 + 1.6, 2.4);
	ctx.fill();
	outline(ctx, 0.6);
	ctx.restore();
	drawHeld(ctx, sk.front, held, aiming, time);
	arm(sk.front, false);
}

// ---------------------------------------------------------- Korugar Enforcers

const ARMOUR = '#3b2252';
const ARMOUR_LIT = '#6b3d8c';
const ARMOUR_DARK = '#22122f';
const KORUGAR_SKIN = '#b84a82';
const VISOR = '#d77ac0';

function drawEnforcer(ctx: CanvasRenderingContext2D, sk: Skeleton, held: Held, aiming: boolean, time: number) {
	const arm = (l: Skeleton['front'], far: boolean) => {
		segment(ctx, l.shoulder, l.elbow, 3.2, 2.7, far ? ARMOUR_DARK : ARMOUR);
		segment(ctx, l.elbow, l.hand, 2.7, 2.4, far ? ARMOUR_DARK : ARMOUR);
		// Vambrace and glove
		segment(ctx, lerpP(l.elbow, l.hand, 0.25), lerpP(l.elbow, l.hand, 0.8), 2.9, 2.6, far ? shadeColor(ARMOUR_LIT, -0.3) : ARMOUR_LIT);
		ctx.fillStyle = '#0c0810';
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 2.3, 0, TAU);
		ctx.fill();
		outline(ctx);
		// The pauldron: a plate over the shoulder
		ctx.fillStyle = far ? shadeColor(ARMOUR_LIT, -0.3) : ARMOUR_LIT;
		ctx.beginPath();
		ctx.ellipse(l.shoulder[0], l.shoulder[1] + 0.6, 4.6, 3.3, sk.torsoAngle, 0, TAU);
		ctx.fill();
		outline(ctx);
	};
	const leg = (l: Skeleton['front'], far: boolean) => {
		const c = far ? ARMOUR_DARK : '#2b1838';
		segment(ctx, l.hipJoint, l.knee, 3.8, 3.1, c);
		segment(ctx, l.knee, l.foot, 3.1, 2.8, c);
		// Knee guard, and armoured boots to mid-shin
		ctx.fillStyle = far ? shadeColor(ARMOUR_LIT, -0.3) : ARMOUR_LIT;
		ctx.beginPath();
		ctx.ellipse(l.knee[0] + 0.8, l.knee[1], 2.6, 3.0, 0, 0, TAU);
		ctx.fill();
		outline(ctx);
		segment(ctx, lerpP(l.knee, l.foot, 0.5), l.foot, 3.2, 2.9, '#0b070f');
		shoe(ctx, l, '#0b070f', null, 4.8);
	};
	arm(sk.back, true);
	leg(sk.back, true);
	// Body armour: plates over a dark suit, a high collar, the Korugar insignia
	const at = frame(sk);
	const body = torsoShape(at, -0.4);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, ARMOUR_DARK);
	shade.addColorStop(1, ARMOUR);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	ctx.fillStyle = ARMOUR_LIT;
	ctx.fill(poly([at(17, -1), at(17, 7.4), at(9, 6.6), at(9, -1)]));
	ctx.fill(poly([at(7.5, -1.5), at(7.5, 6.2), at(2.5, 5.6), at(2.5, -1.5)]));
	ctx.fillStyle = '#0c0810';
	ctx.fill(poly([at(1.8, -6), at(1.8, 8), at(-0.4, 8), at(-0.4, -6)]));
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	// Insignia: Sinestro's mark on Korugar, a gold chevron
	ctx.fillStyle = '#e9c13a';
	ctx.fill(poly([at(15, 3.2), at(13.2, 5.2), at(15, 5.6)]));
	leg(sk.front, false);
	// The helmet: the whole head, a visor across the eyes, the jaw open
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = KORUGAR_SKIN;
	ctx.fill(faceShape());
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(faceShape());
	ctx.fillStyle = '#2e1a40';
	ctx.beginPath();
	ctx.moveTo(R + 1.4, 1.2);
	ctx.lineTo(R + 1.2, -2.8);
	ctx.arc(0, -0.6, R + 1.0, -0.35, Math.PI + 0.2, true);
	ctx.lineTo(-R - 0.6, 3.8);
	ctx.lineTo(-1, 4.4);
	ctx.lineTo(1.2, 1.2);
	ctx.closePath();
	ctx.fill();
	outline(ctx);
	// Visor: dark glass with a light along it
	ctx.fillStyle = '#100816';
	ctx.beginPath();
	ctx.moveTo(R * 0.05, -2.6);
	ctx.lineTo(R + 1.5, -2.4);
	ctx.lineTo(R + 1.5, 0.6);
	ctx.lineTo(R * 0.15, 0.3);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = VISOR;
	ctx.lineWidth = 0.7;
	ctx.globalAlpha *= 0.65 + 0.35 * Math.sin(time * 3);
	ctx.beginPath();
	ctx.moveTo(R * 0.3, -1.3);
	ctx.lineTo(R + 1.3, -1.2);
	ctx.stroke();
	ctx.restore();
	drawHeld(ctx, sk.front, held, aiming, time);
	arm(sk.front, false);
}

// --------------------------------------------------------- Weaponers of Qward

const ROBE = '#33302b';
const ROBE_LIT = '#4f493f';
const ROBE_DARK = '#1f1d1a';
const APRON = '#5a3f28';
const GAUNTLET = '#5c544a';
const QWARD_EYES = '#9fe6ff';

function drawWeaponer(ctx: CanvasRenderingContext2D, sk: Skeleton, held: Held, aiming: boolean, time: number) {
	const arm = (l: Skeleton['front'], far: boolean) => {
		// Wide robe sleeves, heavy gauntlets
		segment(ctx, l.shoulder, l.elbow, 3.6, 3.4, far ? ROBE_DARK : ROBE);
		segment(ctx, l.elbow, lerpP(l.elbow, l.hand, 0.5), 3.8, 3.9, far ? ROBE_DARK : ROBE_LIT);
		segment(ctx, lerpP(l.elbow, l.hand, 0.45), l.hand, 2.9, 2.6, far ? shadeColor(GAUNTLET, -0.3) : GAUNTLET);
		ctx.fillStyle = far ? shadeColor(GAUNTLET, -0.3) : GAUNTLET;
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 2.6, 0, TAU);
		ctx.fill();
		outline(ctx);
	};
	const leg = (l: Skeleton['front'], far: boolean) => {
		// Only the shins and boots show below the robe
		segment(ctx, l.hipJoint, l.knee, 3.6, 3.0, far ? ROBE_DARK : '#24221e');
		segment(ctx, l.knee, l.foot, 3.0, 3.0, far ? '#121110' : '#1b1a17');
		shoe(ctx, l, far ? '#121110' : '#1b1a17', null, 5);
	};
	arm(sk.back, true);
	leg(sk.back, true);
	leg(sk.front, false);
	// The robe: to below the knee, the hem swinging with the stride
	const at = frame(sk);
	const kneeB = lerpP(sk.back.knee, sk.back.foot, 0.35);
	const kneeF = lerpP(sk.front.knee, sk.front.foot, 0.35);
	const hemBack: Point = [Math.min(kneeB[0], kneeF[0]) - 3, Math.max(kneeB[1], kneeF[1]) + 1];
	const hemFront: Point = [Math.max(kneeB[0], kneeF[0]) + 3, Math.max(kneeB[1], kneeF[1]) + 1];
	const skirt = poly([at(2, -5.2), at(2, 6), hemFront, hemBack]);
	ctx.fillStyle = ROBE;
	ctx.fill(skirt);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(skirt);
	const body = torsoShape(at, -0.6);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, ROBE_DARK);
	shade.addColorStop(1, ROBE_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.stroke(body);
	// The smith's apron, down the front and over the robe
	const apron = poly([at(15.5, 2.4), at(15.5, 7.2), [hemFront[0] - 1, hemFront[1] - 3], at(-2, 2.6)]);
	ctx.fillStyle = APRON;
	ctx.fill(apron);
	outline(ctx, 0.7);
	ctx.strokeStyle = '#3a2818';
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.moveTo(...at(4, -4.5));
	ctx.lineTo(...at(4, 6.4));
	ctx.stroke();
	// The hood: deep, and dark inside, two pale eyes looking out
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = ROBE;
	ctx.beginPath();
	ctx.moveTo(-R - 2.2, R + 3);
	ctx.quadraticCurveTo(-R - 3, -R - 2, 0, -R - 3.4);
	ctx.quadraticCurveTo(R + 2.6, -R - 2, R + 2.4, 0);
	ctx.lineTo(R + 1.6, R + 2.6);
	ctx.closePath();
	ctx.fill();
	outline(ctx);
	ctx.fillStyle = '#0a0a0c';
	ctx.beginPath();
	ctx.ellipse(R * 0.55, 0.6, R * 0.75, R * 0.95, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = QWARD_EYES;
	ctx.globalAlpha *= 0.75 + 0.25 * Math.sin(time * 2.3);
	ctx.beginPath();
	ctx.ellipse(R * 0.85, -0.4, 0.9, 0.55, 0, 0, TAU);
	ctx.ellipse(R * 0.25, -0.5, 0.75, 0.5, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
	drawHeld(ctx, sk.front, held, aiming, time);
	arm(sk.front, false);
}

// ---------------------------------------------------------------- what they hold

/** Between shots a gun is held at the ready: forward and pointed down a little. */
const LOW_READY = 0.5;
const GUNS: ReadonlySet<Held> = new Set<Held>(['pistol', 'rifle', 'cannon']);

/**
 * A weapon in a hand. A gun points along the arm while they aim (the arm is
 * on the target) and at the ready otherwise; a bat or blade goes with the
 * forearm, so it swings with it. Drawn before the arm, so the hand closes
 * over the grip.
 */
function drawHeld(ctx: CanvasRenderingContext2D, l: Skeleton['front'], held: Held, aiming: boolean, time: number) {
	if (held === 'grenade') return;
	const [ux, uy] = along(l.elbow, l.hand);
	ctx.save();
	ctx.translate(...l.hand);
	ctx.rotate(GUNS.has(held) && !aiming ? LOW_READY : Math.atan2(uy, ux));
	switch (held) {
		case 'pistol':
			ctx.fillStyle = '#3b3d44';
			ctx.fill(poly([[-1.5, -1.6], [8.5, -1.6], [8.5, 0.7], [1.4, 0.7], [0.8, 3.9], [-1.8, 3.6]]));
			outline(ctx, 0.6);
			ctx.fillStyle = '#7d808a';
			ctx.fillRect(0, -1.6, 8.5, 0.7);
			break;
		case 'rifle': {
			// Korugar make: a long gunmetal rifle with a power cell glowing along it
			ctx.fillStyle = '#5a5464';
			ctx.fill(poly([[-7, -1.6], [22, -1.6], [22, 0.9], [7, 0.9], [6, 3.8], [3, 3.8], [2.4, 0.9], [-4, 0.9], [-8, 2.9], [-8.8, 0.2]]));
			outline(ctx, 0.6);
			ctx.fillStyle = '#9a90a8';
			ctx.fillRect(-6, -1.6, 28, 0.7);
			ctx.fillStyle = `rgba(232, 120, 214, ${0.8 + 0.2 * Math.sin(time * 6)})`;
			ctx.fillRect(5, -0.6, 10, 1.1);
			break;
		}
		case 'baton': {
			// Held up from the fist, the tip crackling
			ctx.rotate(-1.15);
			ctx.fillStyle = '#121014';
			ctx.fillRect(-1, -0.9, 13, 1.8);
			outline(ctx, 0.5);
			ctx.strokeStyle = '#e3b9ff';
			ctx.lineWidth = 0.6;
			ctx.beginPath();
			for (let i = 0; i < 4; i++) {
				const a = time * 40 + i * 1.7;
				ctx.moveTo(12, 0);
				ctx.lineTo(12 + Math.cos(a) * 3, Math.sin(a) * 3);
			}
			ctx.stroke();
			ctx.fillStyle = '#f4e4ff';
			ctx.beginPath();
			ctx.arc(12, 0, 1.1, 0, TAU);
			ctx.fill();
			break;
		}
		case 'bat': {
			ctx.rotate(-1.25);
			ctx.fillStyle = '#b48a55';
			ctx.beginPath();
			ctx.moveTo(-2, -0.8);
			ctx.lineTo(9, -1.2);
			ctx.quadraticCurveTo(19, -2.3, 19.5, 0);
			ctx.quadraticCurveTo(19, 2.3, 9, 1.2);
			ctx.lineTo(-2, 0.8);
			ctx.closePath();
			ctx.fill();
			outline(ctx, 0.6);
			ctx.fillStyle = '#2a2420';
			ctx.fillRect(-2.2, -0.9, 3.4, 1.8);
			break;
		}
		case 'cannon': {
			// Forged in Qward: a short, fat barrel in brass, bound with iron, a coal glowing in the mouth
			ctx.fillStyle = '#a9843d';
			ctx.fill(poly([[-4, -2.8], [11, -3.3], [13, -2.6], [13, 2.6], [11, 3.3], [-4, 2.8]]));
			outline(ctx, 0.6);
			ctx.fillStyle = '#3a342c';
			ctx.fillRect(1, -3.1, 1.6, 6.2);
			ctx.fillRect(7, -3.3, 1.6, 6.6);
			ctx.fillStyle = `rgba(255, 140, 50, ${0.6 + 0.3 * Math.sin(time * 8)})`;
			ctx.beginPath();
			ctx.ellipse(13, 0, 0.9, 2, 0, 0, TAU);
			ctx.fill();
			break;
		}
		case 'blade': {
			// A broad dark blade, its edge still hot from the forge
			ctx.rotate(-1.2);
			ctx.fillStyle = '#2b2a2c';
			ctx.fill(poly([[-3, -1], [2, -1], [2, -3], [3.2, -3], [3.2, -2.2], [21, -2.4], [25, 0], [21, 2.6], [3.2, 2.2], [3.2, 3], [2, 3], [2, 1], [-3, 1]]));
			outline(ctx, 0.6);
			ctx.strokeStyle = '#ff9a3c';
			ctx.lineWidth = 0.7;
			ctx.beginPath();
			ctx.moveTo(4, 2.1);
			ctx.lineTo(21, 2.4);
			ctx.lineTo(24.4, 0.2);
			ctx.stroke();
			break;
		}
	}
	ctx.restore();
}

// ---------------------------------------------------------------- rounds in the air

/** A real weapon's round: a pistol's tracer, a rifle's bolt, a cannon's slug. `lift` raises it to hand height. */
export function drawGearShot(ctx: CanvasRenderingContext2D, s: RedShot, x: number, y: number, lift: number, time: number) {
	const speed = Math.hypot(s.vx, s.vy) || 1;
	const ux = s.vx / speed;
	const uy = s.vy / speed;
	const hy = y - lift;
	ctx.save();
	ctx.lineCap = 'round';
	if (s.look === 'bullet') {
		const g = ctx.createLinearGradient(x - ux * 22, hy - uy * 22, x, hy);
		g.addColorStop(0, 'rgba(255, 230, 150, 0)');
		g.addColorStop(1, 'rgba(255, 244, 205, 0.95)');
		ctx.strokeStyle = g;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(x - ux * 22, hy - uy * 22);
		ctx.lineTo(x, hy);
		ctx.stroke();
	} else if (s.look === 'energy') {
		ctx.strokeStyle = 'rgba(214, 112, 196, 0.45)';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.moveTo(x - ux * 18, hy - uy * 18);
		ctx.lineTo(x, hy);
		ctx.stroke();
		ctx.strokeStyle = '#ffe1f6';
		ctx.lineWidth = 2;
		ctx.stroke();
	} else {
		// The slug: a ball of molten metal, trailing heat
		const trail = ctx.createLinearGradient(x - ux * 26, hy - uy * 26, x, hy);
		trail.addColorStop(0, 'rgba(255, 120, 30, 0)');
		trail.addColorStop(1, 'rgba(255, 150, 60, 0.7)');
		ctx.strokeStyle = trail;
		ctx.lineWidth = 7;
		ctx.beginPath();
		ctx.moveTo(x - ux * 26, hy - uy * 26);
		ctx.lineTo(x, hy);
		ctx.stroke();
		ctx.fillStyle = '#3a2a1c';
		ctx.beginPath();
		ctx.arc(x, hy, 5.5, 0, TAU);
		ctx.fill();
		ctx.fillStyle = `rgba(255, ${150 + Math.round(60 * Math.sin(time * 20))}, 60, 0.95)`;
		ctx.beginPath();
		ctx.arc(x + ux * 1.5, hy + uy * 1.5, 3.2, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

// ------------------------------------------------- grenades, swings and flashes

const SWING_COLOR: Partial<Record<AbilityId, string>> = { batSwing: '255, 255, 255', shockBaton: '214, 160, 255', forgeBlade: '255, 154, 60' };
const GRENADE_ARC = 150;

/** Stun grenades in the air (and where they'll land), weapon swings, muzzle flashes, grenades going off. */
export function drawGearWorld(ctx: CanvasRenderingContext2D, w: ConstructWorld, lift: number, time: number) {
	const g = gearOf(w);
	for (const n of g.grenades) {
		const k = grenadeProgress(n);
		// Where it lands: a ring that fills as it comes down
		ctx.save();
		ctx.strokeStyle = `rgba(230, 170, 255, ${0.45 + 0.4 * k})`;
		ctx.lineWidth = 2;
		ctx.setLineDash([8, 6]);
		ctx.lineDashOffset = -time * 30;
		ctx.beginPath();
		ctx.ellipse(n.x, n.y, n.radius, n.radius * 0.45, 0, 0, TAU);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = `rgba(214, 112, 196, ${0.08 + 0.18 * k})`;
		ctx.beginPath();
		ctx.ellipse(n.x, n.y, n.radius * k, n.radius * 0.45 * k, 0, 0, TAU);
		ctx.fill();
		// The grenade, lobbed in an arc from the hand
		const gx = n.fromX + (n.x - n.fromX) * k;
		const gy = n.fromY + (n.y - n.fromY) * k - lift * (1 - k) - GRENADE_ARC * 4 * k * (1 - k);
		ctx.translate(gx, gy);
		ctx.rotate(time * 9);
		ctx.fillStyle = '#2a1838';
		ctx.fillRect(-3.5, -5, 7, 10);
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 1;
		ctx.strokeRect(-3.5, -5, 7, 10);
		ctx.fillStyle = Math.sin(time * 30) > 0 ? '#ffd0f4' : '#d670c4';
		ctx.fillRect(-1.5, -6.5, 3, 2);
		ctx.restore();
	}
	for (const f of g.fx) {
		const k = f.age / f.life;
		ctx.save();
		if (f.kind === 'swing') {
			// A curved streak where the weapon went
			const rgb = SWING_COLOR[f.weapon ?? 'batSwing'] ?? '255, 255, 255';
			ctx.strokeStyle = `rgba(${rgb}, ${0.75 * (1 - k)})`;
			ctx.lineWidth = f.weapon === 'forgeBlade' ? 6 : 4;
			ctx.beginPath();
			const sweep = 1.7;
			const start = f.angle - (sweep / 2) * f.dir;
			ctx.ellipse(f.x, f.y - lift + 8, f.radius, f.radius * 0.55, 0, start, start + sweep * f.dir * (0.4 + 0.6 * Math.min(1, k * 3)), f.dir < 0);
			ctx.stroke();
		} else if (f.kind === 'muzzle') {
			const big = f.weapon === 'handCannon' ? 1.8 : f.weapon === 'pulseRifle' ? 1.1 : 0.8;
			const mx = f.x + Math.cos(f.angle) * 30;
			const my = f.y - lift + Math.sin(f.angle) * 12;
			ctx.translate(mx, my);
			ctx.rotate(f.angle);
			ctx.fillStyle = f.weapon === 'pulseRifle' ? `rgba(255, 210, 245, ${1 - k})` : `rgba(255, 220, 140, ${1 - k})`;
			ctx.beginPath();
			ctx.moveTo(0, -4 * big);
			ctx.lineTo(12 * big, 0);
			ctx.lineTo(0, 4 * big);
			ctx.lineTo(3 * big, 0);
			ctx.closePath();
			ctx.fill();
		} else if (f.kind === 'spark') {
			// The baton's jolt, crawling over them
			ctx.strokeStyle = `rgba(226, 190, 255, ${1 - k})`;
			ctx.lineWidth = 1.4;
			ctx.beginPath();
			for (let i = 0; i < 6; i++) {
				const a = i * 1.05 + time * 25;
				const r = f.radius * (0.4 + 0.6 * ((i * 37) % 10) / 10);
				ctx.moveTo(f.x, f.y - 45);
				ctx.lineTo(f.x + Math.cos(a) * r * 0.6, f.y - 45 + Math.sin(a) * r);
			}
			ctx.stroke();
		} else {
			// A stun grenade going off: a hard white flash and a ring
			ctx.fillStyle = `rgba(255, 240, 255, ${0.55 * (1 - k)})`;
			ctx.beginPath();
			ctx.ellipse(f.x, f.y, f.radius * (0.6 + 0.4 * k), f.radius * 0.45 * (0.6 + 0.4 * k), 0, 0, TAU);
			ctx.fill();
			ctx.strokeStyle = `rgba(214, 112, 196, ${1 - k})`;
			ctx.lineWidth = 3;
			ctx.stroke();
		}
		ctx.restore();
	}
}
