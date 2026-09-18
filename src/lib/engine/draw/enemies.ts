// Drawing enemies: picks the right art for each kind (Red Lanterns in
// redLanterns.ts, lieutenants, machines, turrets) and draws what goes over
// every enemy: its shield, the weapon forming in its hand, and the tells.
//
// Every red construct has a tell: claws flare, a red orb or saw forms in the
// hand with an aim line, the body crouches before a slam, and red rings pull
// inward before a roar.

import type { LanternPose } from '../animation';
import { ENEMIES, type Enemy } from '../enemies/enemies';
import { ABILITIES, RED_HAND_LIFT, SLAM_HEIGHT } from '../enemies/redConstructs';
import { isStanding } from '../dummy';
import { drawRedLanternAlien, redLanternHand, redLanternTop } from './redLanterns';
import { drawLieutenant, isLieutenantKind, lieutenantHand, lieutenantTop } from './lieutenants';
import { drawManhunterDrone, drawRedFighter, machineMuzzle } from './machines';
import { axePath, drawRageTurret, drawWard, macePath, rage, rageCannonPath } from './redConstructs';

const RED = '#ff2a2a';
const BLACK = '#140808';
const FIGURE_SCALE = 1.35;
const TAU = Math.PI * 2;
/** Red Lanterns hover a little off the ground. */
const HOVER = 12;

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
	if (e.kind === 'rageTurret') {
		drawRageTurret(ctx, e, x, y, hasGround, time);
		if (isStanding(e)) drawEnemyOverlay(ctx, e, x, y, y - 78, [x + e.brain.aimX * 26, y - RED_HAND_LIFT], time);
		return;
	}
	if (isLieutenantKind(e.kind)) {
		drawLieutenant(ctx, e, x, y, hasGround, time);
		if (isStanding(e)) drawEnemyOverlay(ctx, e, x, y, lieutenantTop(e, y), lieutenantHand(e, x, y), time);
		return;
	}
	// Rage Grunts: humanoid aliens, one build per role (redLanterns.ts)
	drawRedLanternAlien(ctx, e, x, y, hasGround, time);
	if (isStanding(e)) drawEnemyOverlay(ctx, e, x, y, redLanternTop(e, y), redLanternHand(e, x, y), time);
}

/** Where an enemy's projectiles, beams and chains come from, in world coordinates. */
export function enemyMuzzle(e: Enemy, x: number, y: number): [number, number] {
	if (e.kind === 'manhunterDrone' || e.kind === 'redFighter') return machineMuzzle(e, x, y);
	if (e.kind === 'rageTurret') return [x + e.brain.aimX * 26, y - RED_HAND_LIFT];
	if (isLieutenantKind(e.kind)) return lieutenantHand(e, x, y);
	return redLanternHand(e, x, y);
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
		// Leans into flying forward; backing off (still facing its target) stays upright
		lean: Math.min(1, Math.max(0, e.vx * e.dir + Math.abs(e.vy) * 0.3) / (def.speed * 1.5)) * 0.7,
		glow: false,
		shadow: hasGround,
		firing: tell === 'aim' || tell === 'strike' || tell === 'build' || a === 'charge' || a === 'scythe',
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

	// A Rage Shield around it
	if (e.ward) drawWard(ctx, x, (y + top) / 2 + 4, (y - top) * 0.5, e.ward.hp / e.ward.maxHp, time);

	// Weapon constructs forming in the hand during the windup
	if (winding === 'axe' || winding === 'mace' || winding === 'cannon') {
		const [hx, hy] = muzzle;
		ctx.save();
		ctx.translate(hx, hy);
		ctx.globalAlpha = 0.4 + 0.6 * progress;
		const aimAngle = Math.atan2(b.aimY, b.aimX);
		if (winding === 'cannon') {
			ctx.rotate(aimAngle);
			if (b.aimX < 0) ctx.scale(1, -1);
			ctx.scale(0.5 + 0.5 * progress, 0.5 + 0.5 * progress);
			rage(ctx, rageCannonPath(), time);
		} else {
			// Raised back over the shoulder, ready to swing
			ctx.scale(e.dir, 1);
			ctx.rotate(-Math.PI / 2 - 0.6 * progress);
			if (winding === 'axe') rage(ctx, axePath(40 * (0.5 + 0.5 * progress)), time);
			else {
				const handle = new Path2D();
				handle.moveTo(0, 0);
				handle.lineTo(34, 0);
				rage(ctx, handle, time, 2.5);
				ctx.translate(36, 0);
				rage(ctx, macePath(10 * (0.5 + 0.5 * progress)), time);
			}
		}
		ctx.restore();
	}

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
		const long: (typeof winding)[] = ['beam', 'spikes', 'charge', 'sweep', 'strafe', 'eyeLaser', 'cannon'];
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

	// Lieutenants: their name, and a health bar from the start
	if (def.lieutenant) {
		ctx.save();
		ctx.font = '800 11px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.lineWidth = 3;
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
		ctx.fillStyle = '#ffb3b3';
		const label = e.brain.transformed ? `${def.name} ✦` : def.name;
		ctx.strokeText(label.toUpperCase(), x, top - 5);
		ctx.fillText(label.toUpperCase(), x, top - 5);
		ctx.restore();
	}
	// Health bar once hurt
	if (e.hp < e.maxHp || def.lieutenant) {
		const w = (def.lieutenant ? 56 : 36) * Math.sqrt(def.scale);
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
		const markY = def.lieutenant ? top - 20 : top - 6;
		ctx.strokeText(mark, x, markY);
		ctx.fillText(mark, x, markY);
		ctx.restore();
	}
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
