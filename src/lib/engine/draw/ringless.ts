// People without rings (enemies/gear.ts): Gotham thugs, Korugar Enforcers,
// the Weaponers of Qward, and Black Manta and his divers, each drawn as
// themselves, on their feet, holding what they fight with. Also their rounds
// (bullets, rifle bolts, cannon slugs, spears), stun grenades in the air,
// Manta's harpoon line and helmet beams, and the swings and flashes.

import { HEAD_R, computeSkeleton, turnScale, type LanternPose, type Point, type Skeleton } from '../animation';
import type { ConstructWorld } from '../constructs/system';
import { isStanding } from '../dummy';
import { ENEMIES, type Enemy, type EnemyKind } from '../enemies/enemies';
import { OPTIC_EYE_GAP, gearOf, grenadeProgress, isGearMelee } from '../enemies/gear';
import type { AbilityId, RedShot } from '../enemies/redConstructs';
import { enemyPose } from './enemies';
import { faceShape, frame, torsoShape } from './heroes';
import { FIGURE_HEIGHT, lerpP, poly, segment, shadeColor } from './lantern';

const TAU = Math.PI * 2;
const OUTLINE = '#030504';
const FIGURE_SCALE = 1.35;

export type RinglessKind = 'thug' | 'enforcer' | 'weaponer' | 'mantaDiver' | 'blackManta' | 'thunderer';
export const isRinglessKind = (kind: EnemyKind): kind is RinglessKind =>
	kind === 'thug' || kind === 'enforcer' || kind === 'weaponer' || kind === 'mantaDiver' || kind === 'blackManta' || kind === 'thunderer';

/** What's in their hand: the melee weapon while they swing it, a gun while they fire it, otherwise whatever they reach for first. */
type Held = 'pistol' | 'bat' | 'rifle' | 'baton' | 'cannon' | 'blade' | 'grenade' | 'speargun' | 'knife' | 'wrist' | 'qwa';
const HELD: Partial<Record<AbilityId, Held>> = {
	pistol: 'pistol',
	batSwing: 'bat',
	pulseRifle: 'rifle',
	shockBaton: 'baton',
	stunGrenade: 'grenade',
	handCannon: 'cannon',
	forgeBlade: 'blade',
	speargun: 'speargun',
	diveKnife: 'knife',
	wristBlades: 'wrist',
	mantaHarpoon: 'wrist',
	opticBlast: 'wrist',
	qwaBolt: 'qwa',
	qwaBlade: 'qwa'
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
	else if (e.kind === 'mantaDiver') drawDiver(ctx, sk, seed, held, aiming, time);
	else if (e.kind === 'blackManta') drawBlackManta(ctx, sk, e, time);
	else if (e.kind === 'thunderer') drawThunderer(ctx, sk, held, aiming, time);
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
const MUZZLE: Record<Held, number> = { pistol: 8, bat: 0, rifle: 22, baton: 0, cannon: 13, blade: 0, grenade: 0, speargun: 26, knife: 0, wrist: 4, qwa: 18 };

/** Just above their head. */
export function ringlessTop(e: Enemy, y: number): number {
	return y - FIGURE_HEIGHT * ENEMIES[e.kind].scale - (e.kind === 'blackManta' ? 22 : e.kind === 'thunderer' ? 16 : e.kind === 'weaponer' ? 12 : 8);
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

// ----------------------------------------------------- Black Manta's divers

const WETSUIT = '#15181d';
const WETSUIT_LIT = '#262b33';
const WETSUIT_DARK = '#0b0d10';
/** The panels down their sides: each diver's own colour, from the same rig. */
const DIVER_STRIPES = ['#2a8c8c', '#b8402c', '#2a8c8c', '#c99a2e'] as const;
const DIVER_SKIN = ['#c99a76', '#8d5a3c', '#e2b58e', '#6b4430'] as const;
const TANK = '#d9b02a';

function drawDiver(ctx: CanvasRenderingContext2D, sk: Skeleton, seed: number, held: Held, aiming: boolean, time: number) {
	const stripe = pick(DIVER_STRIPES, seed);
	const skin = pick(DIVER_SKIN, seed * 5.7);
	const arm = (l: Skeleton['front'], far: boolean) => {
		segment(ctx, l.shoulder, l.elbow, 3.1, 2.6, far ? WETSUIT_DARK : WETSUIT);
		segment(ctx, l.elbow, l.hand, 2.6, 2.3, far ? WETSUIT_DARK : WETSUIT_LIT);
		// Gloves
		ctx.fillStyle = '#0a0b0d';
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 2.2, 0, TAU);
		ctx.fill();
		outline(ctx);
	};
	const leg = (l: Skeleton['front'], far: boolean) => {
		const c = far ? WETSUIT_DARK : WETSUIT;
		segment(ctx, l.hipJoint, l.knee, 3.6, 2.9, c);
		segment(ctx, l.knee, l.foot, 2.9, 2.5, c);
		// A stripe down the leg, and dive boots
		ctx.strokeStyle = far ? shadeColor(stripe, -0.4) : stripe;
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		ctx.moveTo(...lerpP(l.hipJoint, l.knee, 0.1));
		ctx.lineTo(...lerpP(l.knee, l.foot, 0.8));
		ctx.stroke();
		shoe(ctx, l, '#0a0b0d', '#3a3f47', 4.6);
	};
	// The air tank on the back, behind everything
	const at = frame(sk);
	const tank = poly([at(17, -5.6), at(17, -9.4), at(3, -9.4), at(3, -5.6)]);
	ctx.fillStyle = TANK;
	ctx.fill(tank);
	outline(ctx, 0.7);
	ctx.fillStyle = '#3a3f47';
	ctx.beginPath();
	ctx.arc(...at(18.2, -7.5), 1.3, 0, TAU);
	ctx.fill();
	arm(sk.back, true);
	leg(sk.back, true);
	// The wetsuit: a coloured panel down the side, a weight belt
	const body = torsoShape(at);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, WETSUIT_DARK);
	shade.addColorStop(1, WETSUIT_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	ctx.fillStyle = stripe;
	ctx.fill(poly([at(18, 0.4), at(18, 2.2), at(-2, 2.2), at(-2, 0.4)]));
	ctx.fillStyle = '#2c2f35';
	ctx.fill(poly([at(1.8, -6), at(1.8, 8), at(-0.6, 8), at(-0.6, -6)]));
	ctx.fillStyle = '#9aa1ad';
	for (const k of [-3.5, 1.5, 5.5]) ctx.fill(poly([at(1.6, k), at(1.6, k + 1.6), at(-0.4, k + 1.6), at(-0.4, k)]));
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	// The hose from the tank over the shoulder to the mask
	ctx.strokeStyle = '#2b2f36';
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(...at(17.5, -6));
	ctx.quadraticCurveTo(...at(22, -1), sk.headCenter[0] + HEAD_R * 0.6, sk.headCenter[1] + HEAD_R * 0.9);
	ctx.stroke();
	leg(sk.front, false);
	// Head: a hood, a full-face mask with a glass front and the regulator under it
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = WETSUIT;
	ctx.fill(faceShape());
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(faceShape());
	ctx.fillStyle = '#2b2f36';
	ctx.beginPath();
	ctx.ellipse(R * 0.62, 0.2, R * 0.62, R * 0.95, 0, 0, TAU);
	ctx.fill();
	outline(ctx, 0.7);
	// The glass, the face behind it, light catching it
	ctx.fillStyle = skin;
	ctx.beginPath();
	ctx.ellipse(R * 0.7, -0.6, R * 0.44, R * 0.52, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(111, 182, 201, 0.55)';
	ctx.fill();
	ctx.fillStyle = '#121418';
	ctx.beginPath();
	ctx.arc(R * 0.82, -0.9, 0.7, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = `rgba(230, 250, 255, ${0.6 + 0.3 * Math.sin(time * 2)})`;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.arc(R * 0.7, -0.6, R * 0.34, -2.4, -1.5);
	ctx.stroke();
	ctx.fillStyle = '#0b0d10';
	ctx.beginPath();
	ctx.ellipse(R * 0.95, R * 0.7, 1.6, 1.2, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
	drawHeld(ctx, sk.front, held, aiming, time);
	arm(sk.front, false);
}

// ------------------------------------------------------- Thunderers of Qward

const QWARD_ARMOUR = '#2a2a2e';
const QWARD_ARMOUR_LIT = '#45454c';
const QWARD_DARK = '#141416';
const QWARD_SKIN = '#c9c6b4';
/** Their mark, and their bolts: lightning gone the wrong colour, pale and sour. */
const QWA = '#e8e3b0';

function drawThunderer(ctx: CanvasRenderingContext2D, sk: Skeleton, held: Held, aiming: boolean, time: number) {
	const arm = (l: Skeleton['front'], far: boolean) => {
		segment(ctx, l.shoulder, l.elbow, 3.3, 2.8, far ? QWARD_DARK : QWARD_ARMOUR);
		segment(ctx, l.elbow, l.hand, 2.8, 2.5, far ? QWARD_DARK : QWARD_ARMOUR_LIT);
		// Bracer ridges
		ctx.strokeStyle = far ? '#0a0a0b' : '#5d5d66';
		ctx.lineWidth = 0.8;
		for (const k of [0.35, 0.55, 0.75]) {
			const [px, py] = lerpP(l.elbow, l.hand, k);
			ctx.beginPath();
			ctx.arc(px, py, 2.7, 0, TAU);
			ctx.stroke();
		}
		ctx.fillStyle = far ? '#7d7a6c' : QWARD_SKIN;
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 2.2, 0, TAU);
		ctx.fill();
		outline(ctx);
		// A pointed shoulder plate
		ctx.fillStyle = far ? QWARD_DARK : QWARD_ARMOUR_LIT;
		ctx.beginPath();
		ctx.moveTo(l.shoulder[0] - 4.5, l.shoulder[1] + 2);
		ctx.lineTo(l.shoulder[0] - 1, l.shoulder[1] - 5);
		ctx.lineTo(l.shoulder[0] + 4.5, l.shoulder[1] + 1);
		ctx.closePath();
		ctx.fill();
		outline(ctx);
	};
	const leg = (l: Skeleton['front'], far: boolean) => {
		segment(ctx, l.hipJoint, l.knee, 3.8, 3.1, far ? QWARD_DARK : QWARD_ARMOUR);
		segment(ctx, l.knee, l.foot, 3.1, 2.8, far ? QWARD_DARK : QWARD_ARMOUR_LIT);
		segment(ctx, lerpP(l.knee, l.foot, 0.55), l.foot, 3.3, 3.0, '#0c0c0d');
		shoe(ctx, l, '#0c0c0d', null, 5);
	};
	arm(sk.back, true);
	leg(sk.back, true);
	// A short ragged cape behind
	const at = frame(sk);
	ctx.fillStyle = '#1a1820';
	ctx.fill(poly([at(18, -5.5), at(18, -9), at(-6, -10.5), at(-4, -7), at(-8, -6)]));
	const body = torsoShape(at, -0.3);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, QWARD_DARK);
	shade.addColorStop(1, QWARD_ARMOUR_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	// Their mark on the chest: a lightning bolt, pale
	ctx.fillStyle = QWA;
	ctx.globalAlpha *= 0.8 + 0.2 * Math.sin(time * 5);
	ctx.fill(poly([at(15.5, 2.6), at(12, 4.6), at(12.4, 3.2), at(8.5, 5), at(11.6, 2.2), at(11.2, 3.6)]));
	ctx.globalAlpha /= 0.8 + 0.2 * Math.sin(time * 5);
	leg(sk.front, false);
	// The helmet: tall, crested, a slit across where the eyes would be with a pale light behind it
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = QWARD_SKIN;
	ctx.fill(faceShape());
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(faceShape());
	ctx.fillStyle = QWARD_ARMOUR;
	ctx.beginPath();
	ctx.moveTo(-R - 1, R * 0.9);
	ctx.lineTo(-R - 1.5, -R * 0.6);
	ctx.quadraticCurveTo(-R * 0.6, -R - 6, R * 0.2, -R - 9);
	ctx.lineTo(R * 0.6, -R - 1.5);
	ctx.quadraticCurveTo(R + 1.6, -R * 0.4, R + 1.6, R * 0.1);
	ctx.lineTo(R + 1.2, R * 0.3);
	ctx.lineTo(0, R * 0.2);
	ctx.closePath();
	ctx.fill();
	outline(ctx);
	ctx.fillStyle = '#060607';
	ctx.fillRect(R * 0.05, -2.1, R + 1.4, 1.8);
	ctx.fillStyle = QWA;
	ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(time * 3.1);
	ctx.fillRect(R * 0.35, -1.7, R * 0.9, 1);
	ctx.restore();
	drawHeld(ctx, sk.front, held, aiming, time);
	arm(sk.front, false);
}

// --------------------------------------------------------------- Black Manta

const MANTA = '#111114';
const MANTA_LIT = '#24242b';
const MANTA_RIB = '#3a3a44';
const MANTA_RED = '#c8141c';
const MANTA_EYE = '#ff2a2a';

function drawBlackManta(ctx: CanvasRenderingContext2D, sk: Skeleton, e: Enemy, time: number) {
	const b = e.brain;
	const using = b.state === 'windup' || b.state === 'act' ? b.ability : null;
	// The eyes glow up through the windup before the beams
	const glare = using === 'opticBlast' ? (b.state === 'act' ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(time * 14))) : 0.35;
	const arm = (l: Skeleton['front'], far: boolean) => {
		segment(ctx, l.shoulder, l.elbow, 3.4, 2.9, far ? '#08080a' : MANTA);
		segment(ctx, l.elbow, l.hand, 2.9, 2.6, far ? '#08080a' : MANTA_LIT);
		// The wrist launcher: a red-edged housing, the blade folded along it (out when he cuts)
		const a = lerpP(l.elbow, l.hand, 0.35);
		const c = lerpP(l.elbow, l.hand, 0.9);
		segment(ctx, a, c, 3.3, 3.1, far ? '#16161a' : MANTA_RIB);
		const [ux, uy] = along(l.elbow, l.hand);
		const out = using === 'wristBlades' ? 1 : 0.35;
		ctx.fillStyle = far ? '#7a7f88' : '#c9ced6';
		ctx.beginPath();
		ctx.moveTo(c[0] - uy * 2, c[1] + ux * 2);
		ctx.lineTo(c[0] + ux * 13 * out - uy * 1, c[1] + uy * 13 * out + ux * 1);
		ctx.lineTo(c[0] - uy * 0.2, c[1] + ux * 0.2);
		ctx.closePath();
		ctx.fill();
		outline(ctx, 0.5);
		if (using === 'mantaHarpoon' && !far) {
			// The harpoon loaded on the launcher, its head out over the fist
			ctx.fillStyle = '#e4e8ee';
			ctx.beginPath();
			ctx.moveTo(l.hand[0] + ux * 9, l.hand[1] + uy * 9);
			ctx.lineTo(l.hand[0] + ux * 4 - uy * 2.6, l.hand[1] + uy * 4 + ux * 2.6);
			ctx.lineTo(l.hand[0] + ux * 4 + uy * 2.6, l.hand[1] + uy * 4 - ux * 2.6);
			ctx.closePath();
			ctx.fill();
		}
		ctx.fillStyle = '#060607';
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 2.4, 0, TAU);
		ctx.fill();
		outline(ctx);
		ctx.strokeStyle = MANTA_RED;
		ctx.lineWidth = 0.6;
		ctx.beginPath();
		ctx.moveTo(...a);
		ctx.lineTo(...c);
		ctx.stroke();
	};
	const leg = (l: Skeleton['front'], far: boolean) => {
		segment(ctx, l.hipJoint, l.knee, 3.9, 3.2, far ? '#08080a' : MANTA);
		segment(ctx, l.knee, l.foot, 3.2, 2.9, far ? '#08080a' : MANTA_LIT);
		// Ribbed boots
		segment(ctx, lerpP(l.knee, l.foot, 0.45), l.foot, 3.3, 3.0, far ? '#16161a' : MANTA_RIB);
		shoe(ctx, l, '#060607', null, 5);
	};
	const at = frame(sk);
	// The air pack on his back, and the two hoses up into the helmet
	const pack = poly([at(18, -5.4), at(18, -10.4), at(4, -10.4), at(4, -5.4)]);
	ctx.fillStyle = MANTA_RIB;
	ctx.fill(pack);
	outline(ctx, 0.7);
	arm(sk.back, true);
	leg(sk.back, true);
	// The suit: black, ribbed across the chest, a red line down the middle and a red belt
	const body = torsoShape(at, -0.2);
	const [bx, by] = at(8, -6);
	const [fx, fy] = at(8, 7);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, '#060607');
	shade.addColorStop(1, MANTA_LIT);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	ctx.strokeStyle = MANTA_RIB;
	ctx.lineWidth = 0.9;
	for (let k = 7; k <= 17; k += 2.5) {
		ctx.beginPath();
		ctx.moveTo(...at(k, -6));
		ctx.lineTo(...at(k, 8));
		ctx.stroke();
	}
	ctx.fillStyle = MANTA_RED;
	ctx.fill(poly([at(1.6, -6), at(1.6, 8), at(-0.6, 8), at(-0.6, -6)]));
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	ctx.strokeStyle = '#2b2b33';
	ctx.lineWidth = 1.5;
	for (const k of [-7, -9]) {
		ctx.beginPath();
		ctx.moveTo(...at(17, k));
		ctx.quadraticCurveTo(...at(24, k + 1), sk.headCenter[0] - HEAD_R * 0.8, sk.headCenter[1] + HEAD_R * 0.6);
		ctx.stroke();
	}
	leg(sk.front, false);
	// The helmet: a great black dome far bigger than the head, a ridge over the top, and the two red eyes
	const R = HEAD_R;
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = MANTA;
	ctx.beginPath();
	ctx.moveTo(-R * 1.5, R * 1.25);
	ctx.quadraticCurveTo(-R * 1.95, -R * 1.2, -R * 0.2, -R * 1.75);
	ctx.quadraticCurveTo(R * 1.9, -R * 1.7, R * 1.85, R * 0.1);
	ctx.quadraticCurveTo(R * 1.7, R * 1.3, R * 0.6, R * 1.45);
	ctx.closePath();
	ctx.fill();
	outline(ctx, 0.9);
	ctx.strokeStyle = MANTA_RIB;
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(-R * 1.2, -R * 1.2);
	ctx.quadraticCurveTo(R * 0.2, -R * 2.05, R * 1.5, -R * 1.1);
	ctx.stroke();
	// A grille over the mouth
	ctx.strokeStyle = '#3d3d47';
	ctx.lineWidth = 0.6;
	for (let i = 0; i < 4; i++) {
		ctx.beginPath();
		ctx.moveTo(R * 0.7 + i * 0.9, R * 0.75);
		ctx.lineTo(R * 0.9 + i * 0.9, R * 1.25);
		ctx.stroke();
	}
	// The eyes: huge, red, glowing harder before the beams
	ctx.save();
	ctx.shadowColor = MANTA_EYE;
	ctx.shadowBlur = 4 + 10 * glare;
	for (const [ex, ey, rx, ry] of [
		[R * 1.15, -R * 0.35, R * 0.62, R * 0.48],
		[R * 0.05, -R * 0.4, R * 0.5, R * 0.44]
	]) {
		ctx.fillStyle = '#4a0606';
		ctx.beginPath();
		ctx.ellipse(ex, ey, rx, ry, -0.15, 0, TAU);
		ctx.fill();
		ctx.fillStyle = `rgba(255, ${Math.round(40 + 60 * glare)}, ${Math.round(40 + 40 * glare)}, ${0.55 + 0.45 * glare})`;
		ctx.beginPath();
		ctx.ellipse(ex, ey, rx * 0.82, ry * 0.8, -0.15, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
	ctx.restore();
	arm(sk.front, false);
}

// ---------------------------------------------------------------- what they hold

/** Between shots a gun is held at the ready: forward and pointed down a little. */
const LOW_READY = 0.5;
const GUNS: ReadonlySet<Held> = new Set<Held>(['pistol', 'rifle', 'cannon', 'speargun']);

/**
 * A weapon in a hand. A gun points along the arm while they aim (the arm is
 * on the target) and at the ready otherwise; a bat or blade goes with the
 * forearm, so it swings with it. Drawn before the arm, so the hand closes
 * over the grip.
 */
function drawHeld(ctx: CanvasRenderingContext2D, l: Skeleton['front'], held: Held, aiming: boolean, time: number) {
	if (held === 'grenade' || held === 'wrist') return;
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
		case 'speargun': {
			// A long black stock, the spear loaded along the top, its barbed head out past the end
			ctx.fillStyle = '#1c1f24';
			ctx.fill(poly([[-6, -1.4], [17, -1.4], [17, 1.1], [5, 1.1], [4, 4.2], [1.4, 4.2], [1, 1.1], [-6, 1.1]]));
			outline(ctx, 0.6);
			ctx.strokeStyle = '#c9ced6';
			ctx.lineWidth = 0.9;
			ctx.beginPath();
			ctx.moveTo(-4, -2.2);
			ctx.lineTo(25, -2.2);
			ctx.stroke();
			ctx.fillStyle = '#e4e8ee';
			ctx.fill(poly([[25, -3.6], [29, -2.2], [25, -0.8]]));
			// The bands that throw it
			ctx.strokeStyle = '#2d6e6e';
			ctx.lineWidth = 0.8;
			ctx.beginPath();
			ctx.moveTo(15, -2.2);
			ctx.lineTo(12, 0.6);
			ctx.stroke();
			break;
		}
		case 'qwa': {
			// A javelin of black lightning, jagged, edged in pale light
			ctx.rotate(-0.25);
			ctx.strokeStyle = 'rgba(232, 227, 176, 0.55)';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(-10, 0);
			ctx.lineTo(-2, -2);
			ctx.lineTo(6, 1.5);
			ctx.lineTo(14, -1.5);
			ctx.lineTo(22, 0);
			ctx.stroke();
			ctx.strokeStyle = '#0a0a06';
			ctx.lineWidth = 1.3;
			ctx.stroke();
			break;
		}
		case 'knife': {
			ctx.rotate(-1.05);
			ctx.fillStyle = '#1a1a1d';
			ctx.fillRect(-2.6, -1, 3.6, 2);
			ctx.fillStyle = '#cfd5dc';
			ctx.fill(poly([[1, -1.3], [10, -1], [12.5, 0.2], [10, 1.2], [1, 1.2]]));
			outline(ctx, 0.5);
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
	} else if (s.look === 'qwa') {
		// A qwa-bolt in flight: black lightning, crackling, pale at the edges
		const r = Math.floor(time * 30);
		const pts: [number, number][] = [];
		for (let i = 0; i <= 5; i++) {
			const k = i / 5;
			const jitter = i === 0 || i === 5 ? 0 : (((r * 7 + i * 13) % 9) - 4) * 1.6;
			pts.push([x - ux * 34 * (1 - k) - uy * jitter, hy - uy * 34 * (1 - k) + ux * jitter]);
		}
		ctx.strokeStyle = 'rgba(232, 227, 176, 0.6)';
		ctx.lineWidth = 6;
		ctx.beginPath();
		pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
		ctx.stroke();
		ctx.strokeStyle = '#0a0a06';
		ctx.lineWidth = 2.2;
		ctx.stroke();
	} else if (s.look === 'spear') {
		// A speargun's spear: a steel shaft, a barbed head, a line trailing behind
		ctx.strokeStyle = 'rgba(160, 200, 210, 0.35)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x - ux * 60, hy - uy * 60 + 3);
		ctx.quadraticCurveTo(x - ux * 40, hy - uy * 40 + 6, x - ux * 26, hy - uy * 26);
		ctx.stroke();
		ctx.strokeStyle = '#c9ced6';
		ctx.lineWidth = 2.2;
		ctx.beginPath();
		ctx.moveTo(x - ux * 26, hy - uy * 26);
		ctx.lineTo(x, hy);
		ctx.stroke();
		ctx.fillStyle = '#eef2f6';
		ctx.beginPath();
		ctx.moveTo(x + ux * 8, hy + uy * 8);
		ctx.lineTo(x - uy * 3.5, hy + ux * 3.5);
		ctx.lineTo(x + uy * 3.5, hy - ux * 3.5);
		ctx.closePath();
		ctx.fill();
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

const SWING_COLOR: Partial<Record<AbilityId, string>> = {
	batSwing: '255, 255, 255',
	shockBaton: '214, 160, 255',
	forgeBlade: '255, 154, 60',
	diveKnife: '210, 230, 240',
	wristBlades: '255, 90, 80',
	qwaBlade: '232, 227, 176'
};
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
	for (const h of g.harpoons) {
		// The line from his wrist to the harpoon, slack in flight and taut once it bites
		const o = h.owner;
		const [hx, hy] = ringlessMuzzle(o, o.x, o.y);
		const tx = h.x;
		const ty = h.y - (h.caught ? lift + 6 : lift);
		ctx.save();
		ctx.strokeStyle = '#c9ced6';
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.moveTo(hx, hy);
		if (h.caught) ctx.lineTo(tx, ty);
		else ctx.quadraticCurveTo((hx + tx) / 2, (hy + ty) / 2 + 24, tx, ty);
		ctx.stroke();
		const a = Math.atan2(ty - hy, tx - hx);
		ctx.translate(tx, ty);
		ctx.rotate(a);
		ctx.fillStyle = '#eef2f6';
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 0.8;
		ctx.beginPath();
		ctx.moveTo(10, 0);
		ctx.lineTo(-2, -5);
		ctx.lineTo(0, 0);
		ctx.lineTo(-2, 5);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}
	for (const bm of g.beams) {
		// Two red beams from the helmet's eyes, a white core in each
		const o = bm.owner;
		const eyeY = o.y - FIGURE_HEIGHT * ENEMIES[o.kind].scale * 0.86;
		const ux = Math.cos(bm.angle);
		const uy = Math.sin(bm.angle);
		const flicker = 0.85 + 0.15 * Math.sin(time * 50);
		ctx.save();
		ctx.lineCap = 'round';
		for (const side of [-1, 1]) {
			const sx = o.x + o.dir * 10 - uy * side * OPTIC_EYE_GAP;
			const sy = eyeY + ux * side * OPTIC_EYE_GAP * 0.5;
			const ex = o.x + ux * bm.length;
			const ey = o.y + uy * bm.length - lift + side * 4;
			ctx.strokeStyle = `rgba(255, 40, 30, ${0.35 * flicker})`;
			ctx.lineWidth = 14;
			ctx.beginPath();
			ctx.moveTo(sx, sy);
			ctx.lineTo(ex, ey);
			ctx.stroke();
			ctx.strokeStyle = `rgba(255, 210, 200, ${flicker})`;
			ctx.lineWidth = 3;
			ctx.stroke();
		}
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
			ctx.fillStyle = f.weapon === 'pulseRifle' ? `rgba(255, 210, 245, ${1 - k})` : f.weapon === 'qwaBolt' ? `rgba(240, 236, 200, ${1 - k})` : `rgba(255, 220, 140, ${1 - k})`;
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
