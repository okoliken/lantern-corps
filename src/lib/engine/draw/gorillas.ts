// Act 2's enemies on Earth, and what they throw around:
//
//  - Gorilla Soldiers and Troopers from Gorilla City: hunched, huge-armed,
//    in steel armor, power gauntlets and energy rifles glowing amber,
//  - Gorilla Grodd: bigger than any of them, silver-chested, a psychic
//    amplifier round his head that glows purple when he uses his mind,
//  - the Manhunter: a red-and-blue android with a hooded cowl and burning
//    eyes, and its core when it's been broken apart,
//  - cars (parked, and thrown by Grodd), chunks of street, and the psychic
//    swirl over a Lantern with Grodd in their head.

import { computeSkeleton, type LanternPose, type Point, type Skeleton } from '../animation';
import { isStanding, type Dummy } from '../dummy';
import { ENEMIES, type Enemy } from '../enemies/enemies';
import { MIND_LOCK_TIME, type PsychicFx } from '../enemies/grodd';
import { ABILITIES, SLAM_HEIGHT, type RedShot } from '../enemies/redConstructs';
import type { Obstacle } from '../map';
import { enemyPose } from './enemies';
import { lerpP, rounded, segment, shadeColor } from './lantern';

const TAU = Math.PI * 2;
const OUTLINE = '#07080a';
const FIGURE_SCALE = 1.35;

// Gorilla City
const AMBER = '#ffb020';
const STEEL = '#8d939e';
const STEEL_DARK = '#5a606b';
const BRONZE = '#a8823f';
const MUZZLE = '#26201c';
// Grodd
const PSYCHIC = '#b36bff';
const PSYCHIC_LIGHT = '#e2c6ff';
// Manhunters
const MH_RED = '#b3261e';
const MH_RED_DARK = '#7c1712';
const MH_BLUE = '#233a82';
const MH_BLUE_DARK = '#152452';
const MH_FACE = '#c9ccd6';
const MH_EYE = '#ff8a2a';

const GORILLA_BUILD = { leg: 0.72, torso: 1.12, arm: 1.42, neck: 0.25 };
const MANHUNTER_BUILD = { leg: 1.05, torso: 1.1, arm: 1.05, neck: 0.7 };

export const isGorillaKind = (k: string) => k === 'gorillaBrute' || k === 'gorillaGunner' || k === 'grodd';

const scaleOf = (e: Enemy) => FIGURE_SCALE * ENEMIES[e.kind].scale;

/** On their feet (not hovering like a Lantern), walking when they move, off the ground mid-leap. */
function groundPose(e: Enemy, hasGround: boolean, time: number, build: LanternPose['build'], hunch: number): LanternPose {
	const base = enemyPose(e, hasGround, time);
	const speed = Math.hypot(e.vx, e.vy);
	const leaping = e.brain.air > 0.02;
	return {
		...base,
		altitude: leaping ? 1 : 0,
		hoverHeight: 0,
		lean: 0,
		walkPhase: !leaping && speed > 14 ? time * Math.min(speed, 400) * 0.05 + e.homeX : 0,
		build,
		hunch
	};
}

const windupK = (e: Enemy) => (e.brain.state === 'windup' && e.brain.ability ? 1 - e.brain.timer / ABILITIES[e.brain.ability].windup : 0);

/** Where a gorilla's shots and beams come from: the rifle muzzle, or Grodd's head. */
export function gorillaHand(e: Enemy, x: number, y: number): Point {
	const s = scaleOf(e);
	const pose = groundPose(e, true, 0, GORILLA_BUILD, 0.45);
	const sk = computeSkeleton({ ...pose, firing: true }, 0);
	const air = e.brain.air * SLAM_HEIGHT;
	if (e.kind === 'grodd') return [x + sk.headCenter[0] * e.dir * s, y - air + sk.headCenter[1] * s];
	const [hx, hy] = sk.front.hand;
	return [x + (hx + (e.kind === 'gorillaGunner' ? 12 : 0)) * e.dir * s, y - air + hy * s];
}

export function gorillaTop(e: Enemy, y: number): number {
	return y - e.brain.air * SLAM_HEIGHT - 76 * scaleOf(e);
}

export function drawGorilla(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const s = scaleOf(e);
	const grodd = e.kind === 'grodd';
	const pose = groundPose(e, hasGround, time, GORILLA_BUILD, 0.45);
	const sk = computeSkeleton(pose, time);
	const defeated = !isStanding(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const flash = e.flash > 0 || ((tell === 'strike' || tell === 'heavy') && Math.sin(time * 30) > 0);
	const psychic = grodd && (winding || acting) && (tell === 'aim' || tell === 'sky' || tell === 'heavy');
	const fur = flash ? '#ffffff' : grodd ? '#2b2622' : e.kind === 'gorillaGunner' ? '#3e3630' : '#34302c';
	const furLit = flash ? '#ffffff' : shadeColor(grodd ? '#2b2622' : '#3a3530', 0.12);
	const air = b.air * SLAM_HEIGHT;

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	if (hasGround) {
		const k = Math.max(0.1, 1 - b.air * 0.5);
		ctx.fillStyle = `rgba(0, 0, 0, ${0.42 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 17 * s * k, 4.5 * s * k, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(0, -air);
	ctx.scale(s * e.dir, s);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	// Grodd's mind at work: a purple haze round his head
	if (psychic && !defeated) {
		const [hx, hy] = sk.headCenter;
		const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, 26);
		g.addColorStop(0, `rgba(179, 107, 255, ${0.45 + 0.2 * Math.sin(time * 18)})`);
		g.addColorStop(1, 'rgba(179, 107, 255, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(hx, hy, 26, 0, TAU);
		ctx.fill();
	}

	gorillaArm(ctx, sk.back, true, fur, e, time, winding, acting);
	gorillaLeg(ctx, sk.back, true, fur);
	gorillaTorso(ctx, sk, e, fur, furLit, flash);
	gorillaLeg(ctx, sk.front, false, fur);
	gorillaHead(ctx, sk, e, fur, flash, !!psychic, time);
	if (e.kind === 'gorillaGunner' && !defeated) rifle(ctx, sk.front, e, time);
	gorillaArm(ctx, sk.front, false, fur, e, time, winding, acting);

	// Telekinesis: a car lifted over his head, or rubble circling him
	if (grodd && !defeated) {
		const k = windupK(e);
		if (winding === 'carThrow') {
			const [hx, hy] = sk.headCenter;
			ctx.save();
			ctx.translate(hx - 4, hy - 26 - k * 22);
			ctx.rotate(Math.sin(time * 5) * 0.08);
			ctx.scale(0.62 / 1, 0.62);
			psychicGlow(ctx, 44, time);
			carShape(ctx, 0.3, false);
			ctx.restore();
		} else if (winding === 'debrisStorm' || acting === 'debrisStorm') {
			for (let i = 0; i < 6; i++) {
				const a = time * 3 + (i / 6) * TAU;
				const [hx, hy] = sk.hip;
				rock(ctx, hx + Math.cos(a) * 26, hy - 20 + Math.sin(a) * 9 - (k || 1) * 8, 3 + (i % 3), i);
			}
		}
	}
	ctx.restore();
}

function gorillaArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, fur: string, e: Enemy, time: number, winding: string | null, acting: string | null) {
	const color = far ? shadeColor(fur, -0.3) : fur;
	segment(ctx, l.shoulder, l.elbow, 4.6, 3.9, color);
	segment(ctx, l.elbow, l.hand, 3.9, 3.4, color);
	if (e.kind === 'gorillaBrute') {
		// Power gauntlet: steel over the forearm, amber glow at the knuckles
		const hot = winding === 'claws' || acting === 'claws' || winding === 'charge' || acting === 'charge' ? 1 : 0.35;
		segment(ctx, lerpP(l.elbow, l.hand, 0.35), l.hand, 4.1, 3.9, far ? STEEL_DARK : STEEL);
		ctx.save();
		ctx.shadowColor = AMBER;
		ctx.shadowBlur = 10 * hot;
		ctx.fillStyle = `rgba(255, 176, 32, ${0.4 + 0.6 * hot})`;
		ctx.beginPath();
		ctx.arc(l.hand[0], l.hand[1], 3.8, 0, TAU);
		ctx.fill();
		ctx.restore();
		return;
	}
	ctx.fillStyle = far ? '#15110f' : MUZZLE;
	ctx.beginPath();
	ctx.arc(l.hand[0], l.hand[1], 3.6, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
	void time;
}

function gorillaLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, fur: string) {
	const color = far ? shadeColor(fur, -0.3) : fur;
	segment(ctx, l.hipJoint, l.knee, 5, 4.2, color);
	segment(ctx, l.knee, l.foot, 4.2, 3.6, color);
	ctx.fillStyle = far ? '#15110f' : MUZZLE;
	ctx.beginPath();
	ctx.ellipse(l.foot[0] + 2.5, l.foot[1], 4.6, 2.2, 0, 0, TAU);
	ctx.fill();
}

function frame(sk: Skeleton) {
	const { hip, neck, torsoAngle } = sk;
	const up: Point = [Math.sin(torsoAngle), -Math.cos(torsoAngle)];
	const across: Point = [Math.cos(torsoAngle), Math.sin(torsoAngle)];
	const stretch = Math.hypot(neck[0] - hip[0], neck[1] - hip[1]) / 18;
	return (along: number, side: number): Point => [hip[0] + up[0] * along * stretch + across[0] * side, hip[1] + up[1] * along * stretch + across[1] * side];
}

function gorillaTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, e: Enemy, fur: string, furLit: string, flash: boolean) {
	const at = frame(sk);
	// A barrel of a body with a great hump of muscle over the shoulders
	const body = rounded([at(-2, -7), at(8, -8.5), at(16, -10), at(21, -6), at(22, 4), at(15, 10), at(7, 9), at(-2, 7)]);
	const [bx, by] = at(8, -9);
	const [fx, fy] = at(8, 9);
	const shade = ctx.createLinearGradient(bx, by, fx, fy);
	shade.addColorStop(0, fur);
	shade.addColorStop(1, furLit);
	ctx.fillStyle = shade;
	ctx.fill(body);
	ctx.save();
	ctx.clip(body);
	if (e.kind === 'grodd') {
		// Silver chest
		ctx.fillStyle = flash ? '#ffffff' : '#77726c';
		ctx.fill(rounded([at(4, 2), at(18, 3), at(18, 11), at(4, 10)]));
	} else {
		// Armor: a steel chest plate with bronze trim, a belt
		const plate = rounded([at(6, 0), at(19, 1), at(20, 11), at(6, 11)]);
		ctx.fillStyle = flash ? '#ffffff' : e.kind === 'gorillaGunner' ? '#6a7050' : STEEL;
		ctx.fill(plate);
		ctx.strokeStyle = BRONZE;
		ctx.lineWidth = 1.1;
		ctx.stroke(plate);
		ctx.fillStyle = STEEL_DARK;
		ctx.fillRect(...at(0.5, -10), 30, 2.6);
	}
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	if (e.kind !== 'grodd') {
		// Shoulder pauldron
		const [px, py] = at(19, 2);
		ctx.fillStyle = flash ? '#ffffff' : STEEL;
		ctx.beginPath();
		ctx.ellipse(px, py, 6, 4.2, sk.torsoAngle, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = BRONZE;
		ctx.lineWidth = 0.9;
		ctx.stroke();
	}
}

function gorillaHead(ctx: CanvasRenderingContext2D, sk: Skeleton, e: Enemy, fur: string, flash: boolean, psychic: boolean, time: number) {
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle - 0.2);
	// Skull with a crest, then the jutting muzzle
	const head = new Path2D();
	head.moveTo(-5.5, 3);
	head.quadraticCurveTo(-7, -4, -2, -8.5);
	head.quadraticCurveTo(3, -9.5, 5.5, -4.5);
	head.lineTo(8.5, -2.5);
	head.quadraticCurveTo(10.5, 2, 8, 5.5);
	head.quadraticCurveTo(2, 8, -3, 6);
	head.closePath();
	ctx.fillStyle = fur;
	ctx.fill(head);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(head);
	// Face: dark bare skin, heavy brow, nostrils
	ctx.fillStyle = flash ? '#ffffff' : MUZZLE;
	ctx.beginPath();
	ctx.moveTo(3, -3);
	ctx.lineTo(8.8, -2.6);
	ctx.quadraticCurveTo(10.6, 2, 8.2, 5.2);
	ctx.quadraticCurveTo(4.5, 6.4, 2.2, 4);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = shadeColor(fur, -0.4);
	ctx.fillRect(2.6, -4.4, 6.8, 1.8);
	// Eye: purple fire when Grodd reaches into a mind
	if (psychic) {
		ctx.shadowColor = PSYCHIC;
		ctx.shadowBlur = 8;
		ctx.fillStyle = PSYCHIC_LIGHT;
	} else ctx.fillStyle = e.kind === 'grodd' ? '#e0b64a' : '#c9a24a';
	ctx.beginPath();
	ctx.ellipse(6.2, -1.6, 1.1, 0.8, 0, 0, TAU);
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.fillStyle = '#0b0807';
	ctx.beginPath();
	ctx.arc(9.3, 1.4, 0.55, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#0b0807';
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(5, 4.6);
	ctx.lineTo(8.2, 4.2);
	ctx.stroke();

	if (e.kind === 'grodd') {
		// The psychic amplifier: a band round his head, a gem in front
		ctx.strokeStyle = flash ? '#ffffff' : '#4b2a7a';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-6, -4.5);
		ctx.quadraticCurveTo(0, -8, 6.2, -5.4);
		ctx.stroke();
		ctx.save();
		ctx.shadowColor = PSYCHIC;
		ctx.shadowBlur = psychic ? 14 : 6;
		ctx.fillStyle = psychic ? PSYCHIC_LIGHT : PSYCHIC;
		ctx.beginPath();
		ctx.arc(4.2, -6.3, 1.5 + (psychic ? 0.4 * Math.sin(time * 20) : 0), 0, TAU);
		ctx.fill();
		ctx.restore();
	} else {
		// Soldier's helmet
		ctx.fillStyle = flash ? '#ffffff' : e.kind === 'gorillaGunner' ? '#5d6448' : STEEL_DARK;
		ctx.beginPath();
		ctx.moveTo(-6.2, -1.5);
		ctx.quadraticCurveTo(-6.5, -8.5, -1.5, -9.6);
		ctx.quadraticCurveTo(4.5, -10.2, 6.8, -4.6);
		ctx.lineTo(4, -4.4);
		ctx.quadraticCurveTo(0, -5.8, -3.6, -1.2);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = BRONZE;
		ctx.lineWidth = 0.7;
		ctx.stroke();
	}
	ctx.restore();
}

/** A Trooper's energy rifle, held along the aim, the muzzle glowing as it charges. */
function rifle(ctx: CanvasRenderingContext2D, l: Skeleton['front'], e: Enemy, time: number) {
	const [hx, hy] = l.hand;
	const [ex, ey] = l.elbow;
	const a = Math.atan2(hy - ey, hx - ex);
	const k = windupK(e);
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(a);
	ctx.fillStyle = '#3b3f46';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.rect(-8, -2.4, 22, 4.2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#23262b';
	ctx.fillRect(-3, 1.6, 3.4, 4);
	ctx.fillStyle = BRONZE;
	ctx.fillRect(4, -3.2, 6, 1.2);
	ctx.shadowColor = AMBER;
	ctx.shadowBlur = 6 + 10 * k;
	ctx.fillStyle = `rgba(255, 176, 32, ${0.55 + 0.45 * Math.max(k, Math.sin(time * 6) * 0.3)})`;
	ctx.beginPath();
	ctx.arc(14.5, -0.3, 1.8 + k * 2, 0, TAU);
	ctx.fill();
	ctx.restore();
}

// ------------------------------------------------------------------ Manhunter

export function manhunterHand(e: Enemy, x: number, y: number): Point {
	const s = scaleOf(e);
	const pose = groundPose(e, true, 0, MANHUNTER_BUILD, 0);
	const sk = computeSkeleton({ ...pose, firing: true }, 0);
	// Its lasers come from its eyes
	return [x + (sk.headCenter[0] + 4) * e.dir * s, y - e.brain.air * SLAM_HEIGHT + sk.headCenter[1] * s];
}

export function manhunterTop(e: Enemy, y: number): number {
	return y - e.brain.air * SLAM_HEIGHT - 90 * scaleOf(e);
}

export function drawManhunter(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const s = scaleOf(e);
	const pose = groundPose(e, hasGround, time, MANHUNTER_BUILD, 0);
	const sk = computeSkeleton(pose, time);
	const defeated = !isStanding(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const flash = e.flash > 0 || ((tell === 'strike' || tell === 'heavy') && Math.sin(time * 30) > 0);
	const c = (col: string) => (flash ? '#ffffff' : col);
	const air = b.air * SLAM_HEIGHT;

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.beginPath();
		ctx.ellipse(0, 0, 14 * s, 4 * s, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(0, -air);
	ctx.scale(s * e.dir, s);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	const at = frame(sk);

	// The cape, hanging from the shoulders and swinging behind
	const sway = Math.sin(time * 2.2 + e.homeX) * 2 + Math.min(1, Math.hypot(e.vx, e.vy) / 150) * 5;
	const [nx, ny] = at(17, -3);
	ctx.fillStyle = c(MH_BLUE_DARK);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.moveTo(nx, ny);
	ctx.quadraticCurveTo(nx - 10 - sway, ny + 14, nx - 12 - sway * 1.5, ny + 34);
	ctx.lineTo(nx - 2 - sway, ny + 36);
	ctx.quadraticCurveTo(nx + 1, ny + 18, nx + 5, ny + 2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Far limbs
	segment(ctx, sk.back.shoulder, sk.back.elbow, 2.8, 2.4, c(MH_RED_DARK));
	segment(ctx, sk.back.elbow, sk.back.hand, 2.4, 2.2, c(MH_BLUE_DARK));
	segment(ctx, sk.back.hipJoint, sk.back.knee, 3.4, 2.8, c(MH_RED_DARK));
	segment(ctx, sk.back.knee, sk.back.foot, 2.8, 2.4, c(MH_BLUE_DARK));

	// Torso: red, a silver belt and the Manhunter disc on the chest
	const body = rounded([at(-1.5, -4.5), at(8, -4.4), at(17, -5.4), at(19.5, -3), at(19.5, 4), at(14, 6.8), at(6, 5.4), at(-1.5, 4.8)]);
	ctx.fillStyle = c(MH_RED);
	ctx.fill(body);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);
	ctx.strokeStyle = c('#b9bfc9');
	ctx.lineWidth = 1.6;
	ctx.beginPath();
	ctx.moveTo(...at(1.3, -4.4));
	ctx.lineTo(...at(1.3, 4.9));
	ctx.stroke();
	ctx.fillStyle = c('#d7dbe2');
	ctx.beginPath();
	ctx.arc(...at(13, 3.6), 2.3, 0, TAU);
	ctx.fill();
	ctx.fillStyle = c(MH_BLUE);
	ctx.beginPath();
	ctx.arc(...at(13, 3.6), 1.1, 0, TAU);
	ctx.fill();

	// Near leg: red, blue boot
	segment(ctx, sk.front.hipJoint, sk.front.knee, 3.6, 3, c(MH_RED));
	segment(ctx, sk.front.knee, sk.front.foot, 3, 2.6, c(MH_BLUE));

	// Head: a blue hood round a pale steel face, a black band over burning eyes
	ctx.save();
	ctx.translate(...sk.headCenter);
	ctx.rotate(sk.headAngle);
	ctx.fillStyle = c(MH_BLUE);
	ctx.beginPath();
	ctx.moveTo(-6, 6);
	ctx.quadraticCurveTo(-8, -6, 0, -7.5);
	ctx.quadraticCurveTo(6.5, -7.5, 7, -1);
	ctx.lineTo(4.5, 7);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke();
	ctx.fillStyle = c(MH_FACE);
	ctx.beginPath();
	ctx.moveTo(1, -4.8);
	ctx.quadraticCurveTo(6.6, -4.6, 6.4, 0.5);
	ctx.quadraticCurveTo(6, 5, 2.2, 5.6);
	ctx.quadraticCurveTo(0.2, 1, 1, -4.8);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#0a0b0e';
	ctx.fillRect(1.2, -2.6, 5.4, 2);
	if (!defeated) {
		ctx.shadowColor = MH_EYE;
		ctx.shadowBlur = 8 + (tell === 'aim' ? 8 * windupK(e) : 0);
		ctx.fillStyle = MH_EYE;
		ctx.fillRect(3.6, -2.1, 2.6, 0.9);
		ctx.shadowBlur = 0;
	}
	ctx.restore();

	// Near arm, with its baton
	segment(ctx, sk.front.shoulder, sk.front.elbow, 3, 2.6, c(MH_RED));
	segment(ctx, sk.front.elbow, sk.front.hand, 2.6, 2.3, c(MH_BLUE));
	const [hx, hy] = sk.front.hand;
	const [ex, ey] = sk.front.elbow;
	const a = Math.atan2(hy - ey, hx - ex) - 0.5;
	ctx.strokeStyle = c('#c8cdd6');
	ctx.lineWidth = 1.4;
	ctx.beginPath();
	ctx.moveTo(hx - Math.cos(a) * 3, hy - Math.sin(a) * 3);
	ctx.lineTo(hx + Math.cos(a) * 14, hy + Math.sin(a) * 14);
	ctx.stroke();
	ctx.fillStyle = MH_EYE;
	ctx.beginPath();
	ctx.arc(hx + Math.cos(a) * 14, hy + Math.sin(a) * 14, 1.6, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/**
 * A broken Manhunter: its parts scattered round a glowing core. As it
 * rebuilds (d.rebuild 0..1) the parts drag themselves back in.
 */
export function drawManhunterCore(ctx: CanvasRenderingContext2D, d: Dummy, x: number, y: number, time: number) {
	const k = d.rebuild ?? 0;
	const spread = 1 - k * 0.85;
	const pulse = 0.6 + 0.4 * Math.sin(time * (6 + k * 14));
	ctx.save();
	ctx.translate(x, y);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	// The pieces: limbs, the cape, the head
	const parts: [number, number, number, string, number][] = [
		[-46, 6, 0.4, MH_RED, 26],
		[40, 10, -0.9, MH_RED, 24],
		[-26, -18, 1.8, MH_BLUE, 20],
		[30, -16, 2.6, MH_RED_DARK, 22],
		[-8, 22, -0.2, MH_BLUE_DARK, 30]
	];
	for (const [px, py, rot, color, len] of parts) {
		const jitter = k > 0.5 ? Math.sin(time * 40 + px) * 1.5 : 0;
		ctx.save();
		ctx.translate(px * spread + jitter, py * spread - k * 20);
		ctx.rotate(rot * (1 - k));
		segment(ctx, [-len / 2, 0], [len / 2, 0], 4, 3.4, color);
		ctx.restore();
	}
	// The head, eyes still burning
	ctx.save();
	ctx.translate(58 * spread, -4 * spread - k * 30);
	ctx.fillStyle = MH_FACE;
	ctx.beginPath();
	ctx.ellipse(0, 0, 7, 8, 0.4, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#0a0b0e';
	ctx.fillRect(-1, -2.4, 7.5, 2.4);
	ctx.fillStyle = MH_EYE;
	ctx.fillRect(2.5, -1.9, 3.4, 1.1);
	ctx.restore();
	// Threads of energy pulling the parts back together
	if (k > 0) {
		ctx.strokeStyle = `rgba(255, 138, 42, ${0.3 + 0.5 * k})`;
		ctx.lineWidth = 1.2;
		for (const [px, py] of parts) {
			ctx.beginPath();
			ctx.moveTo(0, -18);
			ctx.lineTo(px * spread, py * spread - k * 20);
			ctx.stroke();
		}
	}
	// The core: a hot orange heart that beats faster as it rebuilds
	const g = ctx.createRadialGradient(0, -18, 2, 0, -18, 30);
	g.addColorStop(0, `rgba(255, 220, 160, ${pulse})`);
	g.addColorStop(0.4, `rgba(255, 138, 42, ${0.7 * pulse})`);
	g.addColorStop(1, 'rgba(255, 90, 20, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(0, -18, 30, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#39404c';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * TAU + time * 0.8;
		ctx.lineTo(Math.cos(a) * 10, -18 + Math.sin(a) * 10);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = `rgba(255, 200, 120, ${pulse})`;
	ctx.beginPath();
	ctx.arc(0, -18, 5, 0, TAU);
	ctx.fill();
	// Its health
	const hp = d.hp / d.maxHp;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
	ctx.fillRect(-24, -52, 48, 5);
	ctx.fillStyle = MH_EYE;
	ctx.fillRect(-24, -52, 48 * hp, 5);
	ctx.restore();
}

// --------------------------------------------------------------------- cars

const CAR_COLORS = ['#b8322a', '#2f5fa8', '#d9d2c2', '#2d6a4a', '#d6a324', '#3a3d44'];

/** A car side-on, centred on (0, 0) at its wheels' axle line, about 70 px long. */
function carShape(ctx: CanvasRenderingContext2D, seed: number, wrecked: boolean) {
	const body = CAR_COLORS[Math.floor(seed * CAR_COLORS.length) % CAR_COLORS.length];
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	// Body
	ctx.fillStyle = wrecked ? shadeColor(body, -0.45) : body;
	ctx.beginPath();
	ctx.moveTo(-35, -4);
	ctx.lineTo(-34, -14);
	ctx.lineTo(-18, -16);
	ctx.lineTo(-10, -27);
	ctx.lineTo(14, -27);
	ctx.lineTo(24, -16);
	ctx.lineTo(35, -14);
	ctx.lineTo(36, -4);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// Windows
	ctx.fillStyle = wrecked ? '#1a1c20' : '#8fb4cc';
	ctx.beginPath();
	ctx.moveTo(-8, -24.5);
	ctx.lineTo(1, -24.5);
	ctx.lineTo(1, -17);
	ctx.lineTo(-14.5, -17);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(4, -24.5);
	ctx.lineTo(13, -24.5);
	ctx.lineTo(20, -17);
	ctx.lineTo(4, -17);
	ctx.closePath();
	ctx.fill();
	// Lights
	ctx.fillStyle = '#ffe9a8';
	ctx.fillRect(32, -12, 3, 3);
	ctx.fillStyle = '#b3201a';
	ctx.fillRect(-35, -12, 2.5, 3);
	// Wheels
	for (const wx of [-20, 21]) {
		ctx.fillStyle = '#121316';
		ctx.beginPath();
		ctx.arc(wx, -4, 6.5, 0, TAU);
		ctx.fill();
		ctx.fillStyle = '#7d828c';
		ctx.beginPath();
		ctx.arc(wx, -4, 2.8, 0, TAU);
		ctx.fill();
	}
}

/** A parked car on the street: cover, until something wrecks it. */
export function drawParkedCar(ctx: CanvasRenderingContext2D, o: Obstacle) {
	const x = o.x + o.w / 2;
	const y = o.y + o.h / 2;
	const wrecked = o.hp !== undefined && o.maxHp !== undefined && o.hp < o.maxHp * 0.5;
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
	ctx.beginPath();
	ctx.ellipse(x, y + 2, o.w * 0.55, o.h * 0.5, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x, y + 4);
	if (o.seed > 0.5) ctx.scale(-1, 1);
	carShape(ctx, o.seed, wrecked);
	if (wrecked) {
		ctx.fillStyle = 'rgba(40, 40, 44, 0.5)';
		ctx.beginPath();
		ctx.arc(-4 + Math.sin(o.seed * 50) * 8, -32, 7, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

function psychicGlow(ctx: CanvasRenderingContext2D, r: number, time: number) {
	const g = ctx.createRadialGradient(0, -14, 4, 0, -14, r);
	g.addColorStop(0, `rgba(179, 107, 255, ${0.45 + 0.15 * Math.sin(time * 12)})`);
	g.addColorStop(1, 'rgba(179, 107, 255, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(0, -14, r, 0, TAU);
	ctx.fill();
}

function rock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
	ctx.fillStyle = '#5b5750';
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * TAU + seed;
		const rr = r * (0.75 + 0.25 * Math.sin(seed * 7 + i * 2.3));
		ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
}

/** Something Grodd threw: a tumbling car, or a chunk of street, in a purple grip. */
export function drawThrownDebris(ctx: CanvasRenderingContext2D, s: RedShot, x: number, y: number, lift: number, time: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.beginPath();
	ctx.ellipse(x, y, (s.size ?? 10) * 1.3, (s.size ?? 10) * 0.35, 0, 0, TAU);
	ctx.fill();
	ctx.translate(x, y - lift);
	if (s.look === 'car') {
		ctx.rotate(time * 5 * Math.sign(s.vx || 1));
		psychicGlow(ctx, 50, time);
		ctx.translate(0, 12);
		carShape(ctx, (s.owner.homeX % 1) + 0.2, false);
	} else {
		psychicGlow(ctx, 16, time);
		rock(ctx, 0, 0, 7, s.x * 0.01);
	}
	ctx.restore();
}

// ------------------------------------------------------------------ psychic

/** Grodd in someone's head: a purple swirl over them while their moves go wrong. */
export function drawMindLock(ctx: CanvasRenderingContext2D, x: number, y: number, left: number, time: number) {
	const k = Math.min(1, left / 0.4, (MIND_LOCK_TIME - left) / 0.2 + 0.2);
	ctx.save();
	ctx.globalAlpha = Math.max(0, Math.min(1, k));
	ctx.strokeStyle = PSYCHIC;
	ctx.shadowColor = PSYCHIC;
	ctx.shadowBlur = 8;
	ctx.lineWidth = 2;
	for (let i = 0; i < 3; i++) {
		const a = time * 5 + (i / 3) * TAU;
		ctx.beginPath();
		ctx.ellipse(x, y, 16, 6, 0, a, a + 1.6);
		ctx.stroke();
	}
	ctx.fillStyle = PSYCHIC_LIGHT;
	ctx.font = '700 11px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('⟲', x, y - 8);
	ctx.restore();
}

/** Psychic Blasts spreading out, and the line of Mind Control reaching into someone. */
export function drawPsychicFx(ctx: CanvasRenderingContext2D, list: readonly PsychicFx[], time: number) {
	for (const f of list) {
		const k = f.age / f.life;
		ctx.save();
		ctx.shadowColor = PSYCHIC;
		ctx.shadowBlur = 14;
		if (f.kind === 'wave') {
			// Rings of force spreading out in a cone, at head height
			for (let i = 0; i < 3; i++) {
				const r = f.radius * Math.min(1, k * 1.15 - i * 0.12);
				if (r <= 10) continue;
				ctx.strokeStyle = `rgba(200, 150, 255, ${0.75 * (1 - k)})`;
				ctx.lineWidth = 6 - i * 1.5;
				ctx.beginPath();
				ctx.ellipse(f.x, f.y - 50, r, r * 0.55, 0, f.angle - 0.6, f.angle + 0.6);
				ctx.stroke();
			}
		} else {
			ctx.strokeStyle = `rgba(200, 150, 255, ${0.85 * (1 - k)})`;
			ctx.lineWidth = 2.5;
			ctx.setLineDash([6, 5]);
			ctx.lineDashOffset = -time * 60;
			ctx.beginPath();
			ctx.moveTo(f.x, f.y - 110);
			ctx.quadraticCurveTo((f.x + f.x2!) / 2, Math.min(f.y, f.y2!) - 170, f.x2!, f.y2! - 70);
			ctx.stroke();
		}
		ctx.restore();
	}
}
