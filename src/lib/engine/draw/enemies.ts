// Red Lanterns. They share the Lanterns' animated skeleton (so they walk,
// lunge and flinch the same way), but look like what they are: black and
// blood-red suits, glowing red eyes, fanged mouths dripping rage plasma, and
// a flickering red aura that burns hotter as they get angrier.
//
// Every red construct has a tell drawn here: claws flare, a red orb or saw
// forms in the hand with an aim line, the body crouches before a slam, and
// red rings pull inward before a roar.

import { computeSkeleton, type LanternPose, type Point, type Skeleton } from '../animation';
import { ENEMIES, type Enemy, type Role } from '../enemies/enemies';
import { ABILITIES, RED_HAND_LIFT, SLAM_HEIGHT } from '../enemies/redConstructs';
import { isStanding } from '../dummy';
import { segment, poly } from './lantern';
import { drawManhunterDrone, drawRedFighter, machineMuzzle } from './machines';

const RED = '#ff2a2a';
const RED_DEEP = '#7a0b0b';
const RED_SUIT = '#9c1414';
const BLACK = '#140808';
const BLACK_LIT = '#2a1414';
const OUTLINE = '#050101';
const FIGURE_SCALE = 1.35;
const TAU = Math.PI * 2;
/** Red Lanterns hover a little off the ground. */
const HOVER = 12;

interface Look {
	skin: string;
	hump: number;
	crest: 'spikes' | 'fin' | 'mohawk' | 'horns';
}

/** Each role is a different alien, so you can tell them apart at a glance. */
const ROLE_LOOKS: Record<Role, Look> = {
	berserker: { skin: '#6b5a78', hump: 1.5, crest: 'spikes' },
	hunter: { skin: '#4f6572', hump: 0, crest: 'fin' },
	gunner: { skin: '#80704a', hump: 0, crest: 'mohawk' }
};

function lookFor(e: Enemy): Look {
	return ROLE_LOOKS[e.brain.role];
}

/** Draw any enemy: Red Lanterns, Manhunter Drones, Red Lantern fighters. */
export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	if (e.kind === 'manhunterDrone') {
		drawManhunterDrone(ctx, e, x, y, hasGround, time);
		if (isStanding(e)) drawEnemyOverlay(ctx, e, x, y, y - RED_HAND_LIFT - 38, machineMuzzle(e, x, y), time);
		return;
	}
	if (e.kind === 'redFighter') {
		drawRedFighter(ctx, e, x, y, hasGround, time);
		if (isStanding(e)) drawEnemyOverlay(ctx, e, x, y, y - RED_HAND_LIFT - 30, machineMuzzle(e, x, y), time);
		return;
	}
	drawRedLantern(ctx, e, x, y, hasGround, time);
}

/** Where an enemy's projectiles, beams and chains come from, in world coordinates. */
export function enemyMuzzle(e: Enemy, x: number, y: number): [number, number] {
	if (e.kind === 'manhunterDrone' || e.kind === 'redFighter') return machineMuzzle(e, x, y);
	return [x + e.dir * 12, y - RED_HAND_LIFT];
}

/** 0..1 through the current windup. */
const windupProgress = (e: Enemy) =>
	e.brain.state === 'windup' && e.brain.ability ? 1 - e.brain.timer / ABILITIES[e.brain.ability].windup : 0;

export function enemyPose(e: Enemy, hasGround: boolean, time: number): LanternPose {
	const def = ENEMIES[e.kind];
	const b = e.brain;
	const busy = b.state === 'windup' || b.state === 'act';
	const a = busy ? b.ability : null;
	const s = FIGURE_SCALE * def.scale;
	const tell = a ? ABILITIES[a].tell : null;
	let cast = 0;
	if (tell === 'strike') cast = b.state === 'act' ? 1 : 0.35 + 0.15 * Math.sin(time * 30);
	else if (tell === 'heavy' || tell === 'sky') cast = b.state === 'act' ? 1 : 0.5 + 0.2 * Math.sin(time * 40);
	else if (a) cast = b.state === 'act' ? 0.8 : 0.3 * windupProgress(e);
	return {
		dir: e.dir,
		walkPhase: 0,
		altitude: 1,
		hoverHeight: HOVER + (b.air * SLAM_HEIGHT) / s,
		lean: Math.min(1, Math.hypot(e.vx, e.vy) / (def.speed * 1.5)) * 0.7,
		glow: false,
		shadow: hasGround,
		firing: tell === 'aim' || tell === 'strike' || a === 'charge' || a === 'scythe',
		aimX: b.aimX,
		aimY: b.aimY,
		cast,
		// Crouching before a slam reads as a coiled spring
		hurt: e.flash > 0 ? 0.8 : e.stun > 0 ? 0.3 : a === 'slam' && b.state === 'windup' ? 0.6 : 0,
		downed: !isStanding(e)
	};
}

/** How high above its anchor an enemy's chest is (for effects and bars). */
export function enemyChestLift(e: Enemy): number {
	return (HOVER + 34) * FIGURE_SCALE * ENEMIES[e.kind].scale * 0.75 + e.brain.air * SLAM_HEIGHT;
}

export function drawRedLantern(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const def = ENEMIES[e.kind];
	const look = lookFor(e);
	const pose = enemyPose(e, hasGround, time);
	const sk = computeSkeleton(pose, time);
	const s = FIGURE_SCALE * def.scale;
	const b = e.brain;
	const defeated = !isStanding(e);
	const fade = defeated ? Math.min(1, e.down / 0.5) : 1;
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const progress = windupProgress(e);

	ctx.save();
	ctx.globalAlpha = fade;
	ctx.translate(x, y);
	ctx.scale(s, s);

	if (pose.shadow) {
		// The shadow shrinks while leaping
		const k = 1 - b.air * 0.5;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 12 * k, 3.8 * k, 0, 0, TAU);
		ctx.fill();
	}

	ctx.scale(pose.dir, 1);

	// Rage aura: a flickering, jagged red halo that grows with rage and flares on a windup
	if (!defeated) {
		const [cx, cy] = [(sk.hip[0] + sk.neck[0]) / 2, (sk.hip[1] + sk.neck[1]) / 2];
		const heat = 0.18 + 0.25 * b.rage + (winding ? 0.25 : 0);
		const flicker = 0.8 + 0.2 * Math.sin(time * 23 + x);
		const aura = ctx.createRadialGradient(cx, cy, 3, cx, cy, 24 + 4 * b.rage);
		aura.addColorStop(0, `rgba(255, 42, 42, ${heat * flicker})`);
		aura.addColorStop(1, 'rgba(255, 42, 42, 0)');
		ctx.fillStyle = aura;
		ctx.beginPath();
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * TAU;
			const r = (21 + 4 * b.rage) * (i % 2 === 0 ? 1.1 : 0.85) + Math.sin(time * 9 + i) * 2;
			ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fill();
	}

	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	// Windup tell: the whole body flashes hot before close and heavy attacks
	const windTell = winding ? ABILITIES[winding].tell : null;
	const bodyTell = windTell === 'strike' || windTell === 'heavy' || windTell === 'sky';
	const tell = bodyTell && Math.sin(time * 30) > 0;
	const flash = e.flash > 0 || tell;
	const claws = (b.ability === 'claws' || b.ability === 'scythe') && (winding !== null || acting !== null);

	drawArm(ctx, sk.back, true, flash, false);
	drawLeg(ctx, sk.back, true, flash);
	drawTorso(ctx, sk, look.hump, flash);
	if (b.role === 'hunter' && e.kind === 'rageGrunt') drawChainCoil(ctx, sk, time);
	drawLeg(ctx, sk.front, false, flash);
	drawHead(ctx, sk, look, winding !== null || acting !== null, time, flash);
	drawArm(ctx, sk.front, false, flash, claws);

	// Something forming in the hand
	if (!defeated) {
		const [hx, hy] = sk.front.hand;
		if (winding === 'saw') drawSawShape(ctx, hx, hy, 2 + progress * 5, time * 20);
		else if (windTell === 'aim') drawHandOrb(ctx, hx, hy, 1.5 + progress * 3.5, time);
		else if (windTell === 'sky') drawHandOrb(ctx, sk.headCenter[0], sk.headCenter[1] - 12 - progress * 4, 2 + progress * 5, time);
		else if (e.kind === 'rageGrunt' && b.role === 'gunner') drawHandOrb(ctx, hx, hy, 1.4, time);
	}

	ctx.restore();

	if (defeated) return;

	const air = b.air * SLAM_HEIGHT;
	const top = y - (HOVER + 52) * s - air;
	drawEnemyOverlay(ctx, e, x, y, top, [x + e.dir * 8 * s, y - RED_HAND_LIFT], time);
}

/**
 * Everything drawn over an enemy that isn't its body: the aim line before a
 * ranged attack, the roar's closing rings, the health bar, and "!" / "!!"
 * before close and heavy attacks. `top` is just above its head.
 */
function drawEnemyOverlay(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, top: number, muzzle: [number, number], time: number) {
	const def = ENEMIES[e.kind];
	const s = FIGURE_SCALE * def.scale;
	const b = e.brain;
	const winding = b.state === 'windup' ? b.ability : null;
	const windTell = winding ? ABILITIES[winding].tell : null;
	const bodyTell = windTell === 'strike' || windTell === 'heavy' || windTell === 'sky';
	const tell = bodyTell && Math.sin(time * 30) > 0;
	const progress = windupProgress(e);
	const color = def.faction === 'manhunter' ? '#ffb040' : RED;

	// Ranged tells: an aim line in the last part of the windup (that's when the aim locks)
	if ((windTell === 'aim' || winding === 'charge') && progress > 0.4) {
		const [ox, oy] = muzzle;
		ctx.save();
		ctx.globalAlpha = (progress - 0.4) / 0.6;
		ctx.strokeStyle = color;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([6, 5]);
		ctx.lineDashOffset = -time * 40;
		ctx.beginPath();
		ctx.moveTo(ox, oy);
		const long: (typeof winding)[] = ['beam', 'spikes', 'charge', 'sweep', 'strafe', 'eyeLaser'];
		const reach = long.includes(winding) ? 260 : 120;
		ctx.lineTo(ox + b.aimX * reach, oy + b.aimY * reach);
		ctx.stroke();
		ctx.restore();
	}

	// Roar tell: rings of red closing in on the body
	if (winding === 'roar') {
		ctx.save();
		ctx.strokeStyle = RED;
		for (let i = 0; i < 2; i++) {
			const k = (progress * 2 + i * 0.5) % 1;
			ctx.globalAlpha = k * 0.8;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.ellipse(x, y - 30 * s, 70 * (1 - k) + 10, (70 * (1 - k) + 10) * 0.55, 0, 0, TAU);
			ctx.stroke();
		}
		ctx.restore();
	}

	// Health bar once hurt
	if (e.hp < e.maxHp) {
		const w = 36 * Math.sqrt(def.scale);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
		ctx.fillRect(x - w / 2 - 1, top - 1, w + 2, 6);
		ctx.fillStyle = color;
		ctx.fillRect(x - w / 2, top, w * (e.hp / e.maxHp), 4);
	}
	// Close-attack warning above the head
	if (bodyTell) {
		ctx.save();
		ctx.font = '900 16px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.lineWidth = 4;
		ctx.strokeStyle = 'rgba(0,0,0,0.7)';
		ctx.fillStyle = tell ? '#ffffff' : color;
		const mark = windTell === 'strike' ? '!' : '!!';
		ctx.strokeText(mark, x, top - 6);
		ctx.fillText(mark, x, top - 6);
		ctx.restore();
	}
}

function drawHandOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.arc(x, y, r * (1 + 0.12 * Math.sin(time * 25)), 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#ffd0d0';
	ctx.beginPath();
	ctx.arc(x, y, r * 0.45, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** A jagged red disc: the Rage Saw (in the hand, and flying). */
export function drawSawShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(spin);
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = RED;
	ctx.beginPath();
	const teeth = 8;
	for (let i = 0; i < teeth * 2; i++) {
		const a = (i / (teeth * 2)) * TAU;
		const rr = i % 2 === 0 ? r : r * 0.62;
		ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
	}
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = BLACK;
	ctx.beginPath();
	ctx.arc(0, 0, r * 0.3, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** Hunters carry their Barbed Chain looped at the hip. */
function drawChainCoil(ctx: CanvasRenderingContext2D, sk: Skeleton, time: number) {
	const [hx, hy] = sk.hip;
	ctx.save();
	ctx.strokeStyle = RED_DEEP;
	ctx.lineWidth = 1.2;
	ctx.shadowColor = RED;
	ctx.shadowBlur = 4 + 2 * Math.sin(time * 4);
	ctx.beginPath();
	ctx.ellipse(hx - 3, hy - 2, 3.4, 4.2, 0.3, 0, TAU);
	ctx.stroke();
	ctx.beginPath();
	ctx.ellipse(hx - 4.5, hy + 1, 3, 3.6, -0.2, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------------ parts

function drawLeg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, flash: boolean) {
	const black = flash ? '#ffdddd' : far ? BLACK : BLACK_LIT;
	const red = flash ? '#ffffff' : far ? RED_DEEP : RED_SUIT;
	segment(ctx, l.hipJoint, l.knee, 3.7, 2.9, black);
	const mid: Point = [(l.knee[0] + l.foot[0]) / 2, (l.knee[1] + l.foot[1]) / 2];
	segment(ctx, l.knee, mid, 2.9, 2.7, black);
	segment(ctx, mid, l.foot, 2.9, 2.2, red);
	// Clawed feet
	const shin = Math.atan2(l.foot[1] - l.knee[1], l.foot[0] - l.knee[0]) - Math.PI / 2;
	const toe: Point = [l.foot[0] + Math.cos(shin) * 4.5, l.foot[1] + Math.sin(shin) * 4.5];
	segment(ctx, l.foot, toe, 2, 0.8, red);
}

function drawArm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], far: boolean, flash: boolean, claws: boolean) {
	const black = flash ? '#ffdddd' : far ? BLACK : BLACK_LIT;
	const red = flash ? '#ffffff' : far ? RED_DEEP : RED_SUIT;
	segment(ctx, l.shoulder, l.elbow, 3, 2.4, black);
	const cuff: Point = [l.elbow[0] + (l.hand[0] - l.elbow[0]) * 0.55, l.elbow[1] + (l.hand[1] - l.elbow[1]) * 0.55];
	segment(ctx, l.elbow, cuff, 2.3, 2.2, black);
	segment(ctx, cuff, l.hand, 2.4, 2.2, red);

	if (!claws) return;
	// Rage claws: three jagged red energy blades off the hand
	const along = Math.atan2(l.hand[1] - l.elbow[1], l.hand[0] - l.elbow[0]);
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = far ? 'rgba(255, 42, 42, 0.55)' : RED;
	for (const spread of [-0.45, 0, 0.45]) {
		const a = along + spread;
		const len = 11 - Math.abs(spread) * 5;
		ctx.beginPath();
		ctx.moveTo(l.hand[0] + Math.cos(a + 1.5) * 1.4, l.hand[1] + Math.sin(a + 1.5) * 1.4);
		ctx.quadraticCurveTo(
			l.hand[0] + Math.cos(a) * len * 0.6 + Math.cos(a - 1.5) * 2.5,
			l.hand[1] + Math.sin(a) * len * 0.6 + Math.sin(a - 1.5) * 2.5,
			l.hand[0] + Math.cos(a) * len,
			l.hand[1] + Math.sin(a) * len
		);
		ctx.lineTo(l.hand[0] + Math.cos(a - 1.5) * 1.4, l.hand[1] + Math.sin(a - 1.5) * 1.4);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, hump: number, flash: boolean) {
	const { hip, torsoAngle } = sk;
	const up: Point = [Math.sin(torsoAngle), -Math.cos(torsoAngle)];
	const across: Point = [Math.cos(torsoAngle), Math.sin(torsoAngle)];
	const at = (along: number, side: number): Point => [
		hip[0] + up[0] * along + across[0] * side,
		hip[1] + up[1] * along + across[1] * side
	];

	// Hunched, heavier build than the Green Lanterns (hump pushes the back out)
	const body = poly([
		at(-1.5, -4.8),
		at(7, -4.8 - hump * 0.4),
		at(14, -7 - hump),
		at(18.4, -5 - hump * 0.5),
		at(18.8, 3.4),
		at(14, 8),
		at(8, 6.4),
		at(-1.5, 5.2)
	]);
	ctx.fillStyle = flash ? '#ffdddd' : BLACK_LIT;
	ctx.fill(body);

	// Red panel down the front with ragged edges
	const panel = poly([at(2, 3), at(9, 1.5), at(12, 3.5), at(16, 2), at(18.6, 3.3), at(14, 8), at(8, 6.4), at(3, 5.2)]);
	ctx.fillStyle = flash ? '#ffffff' : RED_SUIT;
	ctx.fill(panel);

	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.9;
	ctx.stroke(body);

	// Red Lantern emblem: a dark circle with a red ring and dripping lines
	const [ex, ey] = at(13, 5.6);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(torsoAngle);
	ctx.fillStyle = BLACK;
	ctx.beginPath();
	ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = RED;
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-1.2, 2.6);
	ctx.lineTo(-1.2, 4.6);
	ctx.moveTo(0.8, 2.8);
	ctx.lineTo(0.8, 5.4);
	ctx.stroke();
	ctx.restore();
}

function drawHead(
	ctx: CanvasRenderingContext2D,
	sk: Skeleton,
	look: Look,
	snarling: boolean,
	time: number,
	flash: boolean
) {
	const [hx, hy] = sk.headCenter;
	const R = 5.4;
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(sk.headAngle);

	// Brutish skull with a heavy brow and a jutting jaw
	const head = new Path2D();
	head.moveTo(-R, 0);
	head.arc(0, -0.5, R, Math.PI, Math.PI * 1.9);
	head.lineTo(R + 1.6, -1.8); // brow ridge
	head.lineTo(R + 1, 0.6);
	head.lineTo(R + 2.4, 3.8); // jaw
	head.lineTo(R - 1, 6.4);
	head.quadraticCurveTo(-1, 7, -R + 0.5, 3);
	head.closePath();
	ctx.fillStyle = flash ? '#ffffff' : look.skin;
	ctx.fill(head);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(head);

	if (look.crest === 'horns') {
		ctx.fillStyle = '#2a1a14';
		ctx.beginPath();
		ctx.moveTo(-1, -R + 0.5);
		ctx.quadraticCurveTo(-5, -R - 5, -8, -R - 3);
		ctx.quadraticCurveTo(-4, -R - 1, -3, -R + 1.5);
		ctx.closePath();
		ctx.fill();
	} else if (look.crest === 'fin') {
		// Swept-back fin, built for speed
		ctx.fillStyle = RED_DEEP;
		ctx.beginPath();
		ctx.moveTo(2, -R + 0.6);
		ctx.quadraticCurveTo(-3, -R - 3.5, -9, -R - 1.5);
		ctx.quadraticCurveTo(-5, -R + 0.5, -3.5, -R + 2.5);
		ctx.closePath();
		ctx.fill();
	} else if (look.crest === 'mohawk') {
		ctx.fillStyle = RED_DEEP;
		ctx.beginPath();
		ctx.moveTo(-3.5, -R + 1);
		ctx.lineTo(-1.5, -R - 4.2);
		ctx.lineTo(1.5, -R - 3.2);
		ctx.lineTo(2.5, -R + 0.8);
		ctx.closePath();
		ctx.fill();
	} else {
		// Spiked crest
		ctx.fillStyle = RED_DEEP;
		for (let i = 0; i < 3; i++) {
			const bx = -3 + i * 2.6;
			ctx.beginPath();
			ctx.moveTo(bx - 1.2, -R + 0.8);
			ctx.lineTo(bx - 0.4, -R - 3 - (i === 1 ? 1.5 : 0.5));
			ctx.lineTo(bx + 1.2, -R + 0.8);
			ctx.closePath();
			ctx.fill();
		}
	}

	// Glowing red eye
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 8;
	ctx.fillStyle = '#ff6a6a';
	ctx.beginPath();
	ctx.ellipse(R - 0.4, -0.6, 1.6, 0.8, -0.25, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();

	// Mouth: open wider when attacking, fangs, dripping rage plasma
	const open = snarling ? 2.4 : 1.2;
	ctx.fillStyle = '#2a0000';
	ctx.beginPath();
	ctx.moveTo(R - 1.5, 3.2);
	ctx.lineTo(R + 2, 3.4);
	ctx.lineTo(R + 1.4, 3.4 + open);
	ctx.lineTo(R - 1.2, 3.4 + open * 0.8);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = '#f2ead8';
	ctx.beginPath();
	ctx.moveTo(R + 0.2, 3.3);
	ctx.lineTo(R + 0.7, 3.3 + open * 0.7);
	ctx.lineTo(R + 1.2, 3.3);
	ctx.fill();
	// Plasma drip: grows and falls on a loop
	const drip = (time * 1.6 + hx * 0.01) % 1;
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.ellipse(R + 0.6, 4 + open + drip * 5, 0.7, 0.7 + drip * 1.2, 0, 0, Math.PI * 2);
	ctx.fill();

	ctx.restore();
}
