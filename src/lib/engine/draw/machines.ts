// Machines: Manhunter Drones (flying robots) and Red Lantern fighters (ships).
//
// Both are drawn side-on like everyone else, facing left or right. Their eye
// or nose sits at RED_HAND_LIFT above the ground anchor, which is the height
// their lasers fly at, so shots come out of the right place.

import { ENEMIES, type Enemy } from '../enemies/enemies';
import { ABILITIES, RED_HAND_LIFT } from '../enemies/redConstructs';
import { isStanding } from '../dummy';

const TAU = Math.PI * 2;
/** Machines are drawn in their own units; these bring them up to the Lanterns' size. */
const DRONE_SCALE = 1.7;
const FIGHTER_SCALE = 2.1;
const AMBER = '#ffb040';
const RED = '#ff2a2a';

// Manhunter colours: red and blue armour over silver, like the show's androids
const SILVER = '#b9bfc9';
const SILVER_DARK = '#6c7380';
const STEEL = '#3a404b';
const MH_RED = '#b3261e';
const MH_BLUE = '#2b4f9e';
const OUTLINE = '#0b0d11';

/** 0..1 through the current windup. */
const windup = (e: Enemy) =>
	e.brain.state === 'windup' && e.brain.ability ? 1 - e.brain.timer / ABILITIES[e.brain.ability].windup : 0;

/** Where its lasers and beams come from, in world coordinates. */
export function machineMuzzle(e: Enemy, x: number, y: number): [number, number] {
	if (e.kind === 'redFighter') return [x + Math.cos(e.brain.heading) * 23 * FIGHTER_SCALE, y - RED_HAND_LIFT];
	return [x + e.dir * 9 * DRONE_SCALE * ENEMIES[e.kind].scale, y - RED_HAND_LIFT];
}

// ------------------------------------------------------------ Manhunter Drone

export function drawManhunterDrone(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const s = ENEMIES[e.kind].scale * DRONE_SCALE;
	const defeated = !isStanding(e);
	// A defeated drone drops out of the sky, trailing smoke, and fades
	const drop = defeated ? 1 - Math.min(1, e.down / 0.9) : 0;
	const fade = defeated ? Math.min(1, e.down / 0.4) : 1;
	const bob = defeated ? 0 : Math.sin(time * 2.4 + e.homeX) * 3;
	const lift = (RED_HAND_LIFT + bob) * (1 - drop * 0.85);
	const k = windup(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const flash = e.flash > 0 || (winding === 'pulse' && Math.sin(time * 30) > 0);

	ctx.save();
	ctx.globalAlpha = fade;
	if (hasGround) {
		ctx.fillStyle = `rgba(0, 0, 0, ${0.3 - 0.1 * (lift / RED_HAND_LIFT)})`;
		ctx.beginPath();
		ctx.ellipse(x, y, 13 * s, 3.8 * s, 0, 0, TAU);
		ctx.fill();
	}

	ctx.translate(x, y - lift);
	ctx.scale(s * e.dir, s);
	// Tilts into its movement, and tumbles when it's shot down
	ctx.rotate(defeated ? drop * 1.2 : Math.max(-0.25, Math.min(0.25, (e.vx * e.dir) / 500)));

	// Thruster flame under the body
	if (!defeated) {
		const flick = 0.8 + 0.2 * Math.sin(time * 40 + x);
		const g = ctx.createLinearGradient(0, 8, 0, 24);
		g.addColorStop(0, 'rgba(210, 235, 255, 0.95)');
		g.addColorStop(0.4, 'rgba(90, 160, 255, 0.7)');
		g.addColorStop(1, 'rgba(90, 160, 255, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(-5, 9);
		ctx.quadraticCurveTo(0, 9 + 16 * flick, 5, 9);
		ctx.closePath();
		ctx.fill();
	} else if (Math.random() < 0.6) {
		// Smoke and sparks while falling
		ctx.fillStyle = 'rgba(60, 60, 60, 0.5)';
		ctx.beginPath();
		ctx.arc(-8 + Math.random() * 6, -10 - Math.random() * 6, 3 + Math.random() * 3, 0, TAU);
		ctx.fill();
	}

	ctx.lineJoin = 'round';
	ctx.lineWidth = 1;
	ctx.strokeStyle = OUTLINE;

	// Back fin and antenna
	ctx.fillStyle = flash ? '#ffffff' : MH_BLUE;
	ctx.beginPath();
	ctx.moveTo(-9, -5);
	ctx.lineTo(-19, -12);
	ctx.lineTo(-16, -2);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.strokeStyle = SILVER_DARK;
	ctx.beginPath();
	ctx.moveTo(-3, -12);
	ctx.lineTo(-7, -20);
	ctx.stroke();
	ctx.fillStyle = MH_RED;
	ctx.beginPath();
	ctx.arc(-7, -20, 1.4, 0, TAU);
	ctx.fill();

	// Arms: hang below, spread out while charging a pulse
	const spread = winding === 'pulse' ? k : acting === 'pulse' ? 1 : 0;
	drawArm(ctx, -3, 6, 0.3 + spread * 1.2, time, flash, true);

	// Body: an egg of silver armour, darker underneath
	const body = new Path2D();
	body.ellipse(0, 0, 13, 10.5, 0, 0, TAU);
	const shade = ctx.createLinearGradient(0, -10, 0, 10);
	shade.addColorStop(0, flash ? '#ffffff' : SILVER);
	shade.addColorStop(1, flash ? '#ffdddd' : SILVER_DARK);
	ctx.fillStyle = shade;
	ctx.fill(body);
	// Red armour band round the middle, blue crown plate on top
	ctx.save();
	ctx.clip(body);
	ctx.fillStyle = flash ? '#ffe0e0' : MH_RED;
	ctx.fillRect(-14, 1, 28, 4.5);
	ctx.fillStyle = flash ? '#e0e8ff' : MH_BLUE;
	ctx.beginPath();
	ctx.ellipse(-2, -9, 10, 5, 0, 0, TAU);
	ctx.fill();
	// Panel lines
	ctx.strokeStyle = 'rgba(20, 24, 30, 0.45)';
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(-6, -10);
	ctx.lineTo(-6, 10);
	ctx.moveTo(-14, -2);
	ctx.lineTo(4, -2);
	ctx.stroke();
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 1;
	ctx.stroke(body);

	// The single eye: a dark socket with a burning lens, brighter as it charges
	const charging = winding === 'eyeLaser' || winding === 'sweep' || acting === 'sweep' || acting === 'eyeLaser';
	const glow = defeated ? 0 : charging ? 0.6 + 0.4 * k + (acting ? 0.4 : 0) : 0.35 + 0.1 * Math.sin(time * 3);
	ctx.fillStyle = STEEL;
	ctx.beginPath();
	ctx.ellipse(8, -1, 5.2, 5.6, 0, 0, TAU);
	ctx.fill();
	ctx.save();
	ctx.shadowColor = AMBER;
	ctx.shadowBlur = 6 + 14 * glow;
	ctx.fillStyle = defeated ? '#3a2a1a' : AMBER;
	ctx.beginPath();
	ctx.ellipse(9, -1, 3.2 + glow, 3.6 + glow, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = defeated ? '#222' : '#fff4dc';
	ctx.beginPath();
	ctx.arc(9.6, -1.4, 1.3 + glow * 0.6, 0, TAU);
	ctx.fill();
	ctx.restore();

	// Near arm on top
	drawArm(ctx, 2, 6, 0.1 + spread * 1.5, time, flash, false);

	// Damage: sparks off a hurt drone
	if (!defeated && b.hurt > 0.45 && Math.sin(time * 13 + x) > 0.6) {
		ctx.strokeStyle = '#fff2b0';
		ctx.lineWidth = 0.8;
		const sx = -4 + Math.sin(time * 7) * 5;
		ctx.beginPath();
		ctx.moveTo(sx, -3);
		ctx.lineTo(sx + 3, -7);
		ctx.moveTo(sx, -3);
		ctx.lineTo(sx - 2, -8);
		ctx.stroke();
	}
	ctx.restore();

	// Pulse tell: rings of amber drawing in
	if (winding === 'pulse') {
		ctx.save();
		ctx.strokeStyle = AMBER;
		for (let i = 0; i < 2; i++) {
			const r = (k * 2 + i * 0.5) % 1;
			ctx.globalAlpha = r * 0.8;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.ellipse(x, y - lift, 60 * (1 - r) + 12, (60 * (1 - r) + 12) * 0.55, 0, 0, TAU);
			ctx.stroke();
		}
		ctx.restore();
	}
}

/** A thin two-part robot arm ending in a pincer. `swing` rotates it forward/up from hanging down. */
function drawArm(ctx: CanvasRenderingContext2D, sx: number, sy: number, swing: number, time: number, flash: boolean, far: boolean) {
	const sway = Math.sin(time * 2 + sx) * 0.08;
	const a1 = swing + sway;
	const ex = sx + Math.sin(a1) * 7;
	const ey = sy + Math.cos(a1) * 7;
	const a2 = a1 + 0.5;
	const hx = ex + Math.sin(a2) * 6;
	const hy = ey + Math.cos(a2) * 6;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.strokeStyle = flash ? '#ffffff' : far ? STEEL : SILVER_DARK;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(sx, sy);
	ctx.lineTo(ex, ey);
	ctx.lineTo(hx, hy);
	ctx.stroke();
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(hx, hy);
	ctx.lineTo(hx + Math.sin(a2 + 0.6) * 3, hy + Math.cos(a2 + 0.6) * 3);
	ctx.moveTo(hx, hy);
	ctx.lineTo(hx + Math.sin(a2 - 0.6) * 3, hy + Math.cos(a2 - 0.6) * 3);
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------ Red Lantern fighter

const HULL = '#3a0c0e';
const HULL_LIT = '#6e1518';
const HULL_EDGE = '#9c1f22';

export function drawRedFighter(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const b = e.brain;
	const defeated = !isStanding(e);
	const drop = defeated ? 1 - Math.min(1, e.down / 0.9) : 0;
	const fade = defeated ? Math.min(1, e.down / 0.4) : 1;
	const lift = (RED_HAND_LIFT + Math.sin(time * 3 + e.homeY) * 1.5) * (1 - drop * 0.9);
	const k = windup(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const flash = e.flash > 0;
	// Side-on, so a ship flying up or down the screen is seen more nose-on: it narrows
	const across = Math.cos(b.heading);
	const width = 0.5 + 0.5 * Math.abs(across);
	const pitch = Math.max(-0.3, Math.min(0.3, Math.sin(b.heading) * 0.3)) * (across >= 0 ? 1 : -1);
	const speed = Math.hypot(e.vx, e.vy);

	ctx.save();
	ctx.globalAlpha = fade;
	if (hasGround) {
		ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
		ctx.beginPath();
		ctx.ellipse(x, y, 20 * width * FIGHTER_SCALE, 4 * FIGHTER_SCALE, 0, 0, TAU);
		ctx.fill();
	}
	ctx.translate(x, y - lift);
	ctx.scale(e.dir * width * FIGHTER_SCALE, FIGHTER_SCALE);
	ctx.rotate(defeated ? drop * 0.9 : pitch);

	// Engine flame, longer the faster it goes
	if (!defeated) {
		const len = 8 + (speed / 250) * 14 + Math.sin(time * 45 + x) * 2;
		const g = ctx.createLinearGradient(-16, 0, -16 - len, 0);
		g.addColorStop(0, 'rgba(255, 220, 200, 0.95)');
		g.addColorStop(0.35, 'rgba(255, 60, 40, 0.8)');
		g.addColorStop(1, 'rgba(255, 42, 42, 0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(-15, -3);
		ctx.lineTo(-16 - len, 0);
		ctx.lineTo(-15, 3);
		ctx.closePath();
		ctx.fill();
	}

	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#080102';
	ctx.lineWidth = 1;

	// Far wing (behind the hull), swept back and down
	ctx.fillStyle = flash ? '#ffdddd' : HULL;
	ctx.beginPath();
	ctx.moveTo(2, -1);
	ctx.lineTo(-12, -10);
	ctx.lineTo(-7, -1);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Hull: a jagged dart, nose forward
	const hull = new Path2D();
	hull.moveTo(24, 1);
	hull.lineTo(10, -4);
	hull.lineTo(-4, -5);
	hull.lineTo(-15, -3.5);
	hull.lineTo(-16, 3);
	hull.lineTo(-2, 5);
	hull.lineTo(12, 4);
	hull.closePath();
	const shade = ctx.createLinearGradient(0, -5, 0, 5);
	shade.addColorStop(0, flash ? '#ffffff' : HULL_LIT);
	shade.addColorStop(1, flash ? '#ffdddd' : HULL);
	ctx.fillStyle = shade;
	ctx.fill(hull);
	ctx.stroke(hull);
	// Red trim along the side
	ctx.strokeStyle = HULL_EDGE;
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(-14, 1);
	ctx.lineTo(16, 1.5);
	ctx.stroke();

	// Tail fin
	ctx.fillStyle = flash ? '#ffffff' : HULL_LIT;
	ctx.strokeStyle = '#080102';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(-8, -4.5);
	ctx.lineTo(-15, -12);
	ctx.lineTo(-13, -3.5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Glowing red canopy
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 8;
	ctx.fillStyle = defeated ? '#401010' : '#ff4a4a';
	ctx.beginPath();
	ctx.moveTo(12, -3.6);
	ctx.quadraticCurveTo(6, -8.5, -1, -4.8);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	// Red Lantern emblem on the side
	ctx.fillStyle = '#120304';
	ctx.beginPath();
	ctx.arc(-4, 0.5, 2.6, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = RED;
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.arc(-4, 0.5, 1.9, 0, TAU);
	ctx.stroke();

	// Near wing, over the hull
	ctx.fillStyle = flash ? '#ffffff' : HULL_LIT;
	ctx.strokeStyle = '#080102';
	ctx.beginPath();
	ctx.moveTo(6, 2);
	ctx.lineTo(-11, 11);
	ctx.lineTo(-6, 2.5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	// Nose guns heat up before a strafing run, bomb bay glows before a bombing run
	const guns = winding === 'strafe' ? k : acting === 'strafe' ? 1 : 0;
	if (guns > 0) {
		ctx.save();
		ctx.shadowColor = RED;
		ctx.shadowBlur = 10 * guns;
		ctx.fillStyle = `rgba(255, 180, 170, ${0.4 + 0.6 * guns})`;
		ctx.beginPath();
		ctx.arc(23, 1, 1.5 + 1.5 * guns, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
	const bay = winding === 'bombs' ? k : acting === 'bombs' ? 1 : 0;
	if (bay > 0) {
		ctx.fillStyle = `rgba(255, 60, 40, ${0.5 + 0.5 * Math.sin(time * 30)})`;
		ctx.fillRect(-6, 4, 8, 2);
	}
	if (defeated && Math.random() < 0.7) {
		ctx.fillStyle = 'rgba(40, 30, 30, 0.55)';
		ctx.beginPath();
		ctx.arc(-10 - Math.random() * 8, -4 + Math.random() * 6, 3 + Math.random() * 4, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}
