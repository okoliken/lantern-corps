// Red Lanterns. They share the Lanterns' animated skeleton (so they walk,
// lunge and flinch the same way), but look like what they are: black and
// blood-red suits, glowing red eyes, fanged mouths dripping rage plasma, and
// a flickering red aura that burns hotter as they get angrier.

import { computeSkeleton, type LanternPose, type Point, type Skeleton } from '../animation';
import { ENEMIES, type Enemy, type EnemyKind } from '../enemies/enemies';
import { isStanding } from '../dummy';
import { segment, poly } from './lantern';

const RED = '#ff2a2a';
const RED_DEEP = '#7a0b0b';
const RED_SUIT = '#9c1414';
const BLACK = '#140808';
const BLACK_LIT = '#2a1414';
const OUTLINE = '#050101';
const FIGURE_SCALE = 1.35;
/** Red Lanterns hover a little off the ground. */
const HOVER = 12;

/** Per-kind looks: each Red Lantern is a different alien. */
const LOOKS: Record<EnemyKind, { skin: string; hump: number; horns: boolean }> = {
	rageGrunt: { skin: '#6b5a78', hump: 0, horns: false },
	plasmaSpitter: { skin: '#7c8a4a', hump: 2, horns: false },
	rageBrute: { skin: '#7a3a2e', hump: 3, horns: true }
};

export function enemyPose(e: Enemy, hasGround: boolean, time: number): LanternPose {
	const def = ENEMIES[e.kind];
	const b = e.brain;
	const attacking = b.state === 'windup' || b.state === 'attack';
	return {
		dir: e.dir,
		walkPhase: 0,
		altitude: 1,
		hoverHeight: HOVER,
		lean: Math.min(1, Math.hypot(e.vx, e.vy) / (def.speed * 1.5)) * 0.7,
		glow: false,
		shadow: hasGround,
		firing: attacking,
		// Claws go where the attack is aimed, in the enemy's facing space
		aimX: b.aimX,
		aimY: b.aimY,
		cast: b.state === 'attack' ? 1 : b.state === 'windup' ? 0.35 + 0.15 * Math.sin(time * 30) : 0,
		hurt: e.flash > 0 ? 0.8 : e.stun > 0 ? 0.3 : 0,
		downed: !isStanding(e)
	};
}

/** How high above its anchor an enemy's chest is (for effects and bars). */
export function enemyChestLift(e: Enemy): number {
	return (HOVER + 34) * FIGURE_SCALE * ENEMIES[e.kind].scale * 0.75;
}

export function drawRedLantern(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const def = ENEMIES[e.kind];
	const look = LOOKS[e.kind];
	const pose = enemyPose(e, hasGround, time);
	const sk = computeSkeleton(pose, time);
	const s = FIGURE_SCALE * def.scale;
	const b = e.brain;
	const defeated = !isStanding(e);
	const fade = defeated ? Math.min(1, e.down / 0.5) : 1;

	ctx.save();
	ctx.globalAlpha = fade;
	ctx.translate(x, y);
	ctx.scale(s, s);

	if (pose.shadow) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		ctx.beginPath();
		ctx.ellipse(0, 0, 12, 3.8, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	ctx.scale(pose.dir, 1);

	// Rage aura: a flickering, jagged red halo that grows with rage and flares on attack
	if (!defeated) {
		const [cx, cy] = [(sk.hip[0] + sk.neck[0]) / 2, (sk.hip[1] + sk.neck[1]) / 2];
		const heat = 0.18 + 0.25 * b.rage + (b.state === 'windup' ? 0.25 : 0);
		const flicker = 0.8 + 0.2 * Math.sin(time * 23 + x);
		const aura = ctx.createRadialGradient(cx, cy, 3, cx, cy, 24 + 4 * b.rage);
		aura.addColorStop(0, `rgba(255, 42, 42, ${heat * flicker})`);
		aura.addColorStop(1, 'rgba(255, 42, 42, 0)');
		ctx.fillStyle = aura;
		ctx.beginPath();
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * Math.PI * 2;
			const r = (21 + 4 * b.rage) * (i % 2 === 0 ? 1.1 : 0.85) + Math.sin(time * 9 + i) * 2;
			ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fill();
	}

	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	// Windup tell: the whole body flashes hot
	const tell = b.state === 'windup' && Math.sin(time * 30) > 0;
	const flash = e.flash > 0 || tell;

	drawArm(ctx, sk.back, true, flash, false);
	drawLeg(ctx, sk.back, true, flash);
	drawTorso(ctx, sk, look.hump, flash);
	drawLeg(ctx, sk.front, false, flash);
	drawHead(ctx, sk, look, b.state === 'windup' || b.state === 'attack', time, flash);
	drawArm(ctx, sk.front, false, flash, b.state === 'windup' || b.state === 'attack');

	ctx.restore();

	if (!defeated) {
		// Health bar once hurt
		const top = y - (HOVER + 52) * s;
		if (e.hp < e.maxHp) {
			const w = 36 * Math.sqrt(def.scale);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
			ctx.fillRect(x - w / 2 - 1, top - 1, w + 2, 6);
			ctx.fillStyle = RED;
			ctx.fillRect(x - w / 2, top, w * (e.hp / e.maxHp), 4);
		}
		// Windup warning above the head
		if (b.state === 'windup') {
			ctx.save();
			ctx.font = '900 16px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.lineWidth = 4;
			ctx.strokeStyle = 'rgba(0,0,0,0.7)';
			ctx.fillStyle = tell ? '#ffffff' : RED;
			ctx.strokeText('!', x, top - 6);
			ctx.fillText('!', x, top - 6);
			ctx.restore();
		}
	}
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
	look: (typeof LOOKS)[EnemyKind],
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

	if (look.horns) {
		ctx.fillStyle = '#2a1a14';
		ctx.beginPath();
		ctx.moveTo(-1, -R + 0.5);
		ctx.quadraticCurveTo(-5, -R - 5, -8, -R - 3);
		ctx.quadraticCurveTo(-4, -R - 1, -3, -R + 1.5);
		ctx.closePath();
		ctx.fill();
	} else {
		// Spiked crest
		ctx.fillStyle = RED_DEEP;
		for (let i = 0; i < 3; i++) {
			const bx = -3 + i * 2.6;
			ctx.beginPath();
			ctx.moveTo(bx - 1.2, -R + 0.8);
			ctx.lineTo(bx - 0.4, -R - 3 - (i === 1 ? 1 : 0));
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
