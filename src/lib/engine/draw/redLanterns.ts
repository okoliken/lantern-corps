// Red Lanterns: humanoid, but not human.
//
// A red ring picks its bearer for rage, from any species in the universe.
// So they're built on the same skeleton as the Green Lanterns (two arms, two
// legs, they fly, lean, aim, cast and flinch exactly the same way), but every
// one is a different alien: its own proportions, head, skin, and oddities.
//
// Each enemy's ANATOMY is rolled once from its spawn spot, shaped by its
// fighting role:
//
//   Brute   (Berserker)  hulking, hunched, backward-bending legs, horned or split-jawed
//   Stalker (Hunter)     tall and thin, FOUR arms, a long skull or a crest, a whip tail
//   Spitter (Gunner)     squat, a big tentacled or one-eyed head, a tattered red cape
//
// ...with a chance of a head from another species, so a pack never matches.
// They all wear the Red Lantern colours: black suits with ragged red panels,
// the emblem on the chest, the ring on the hand, a flickering rage aura.

import { computeSkeleton, type Build, type LanternPose, type Point, type Skeleton } from '../animation';
import { ENEMIES, type Enemy, type Role } from '../enemies/enemies';
import { ABILITIES } from '../enemies/redConstructs';
import { isStanding } from '../dummy';
import { enemyPose } from './enemies';
import { segment } from './lantern';

const RED = '#ff2a2a';
const RED_DEEP = '#7a0b0b';
const RED_SUIT = '#9c1414';
const HOT = '#ffd0d0';
const BLACK = '#140808';
const BLACK_LIT = '#2a1414';
const OUTLINE = '#050101';
const TAU = Math.PI * 2;
const FIGURE_SCALE = 1.35;

type HeadKind = 'horned' | 'splitjaw' | 'longskull' | 'crested' | 'tentacled' | 'cyclops';

export interface Anatomy {
	build: Build;
	/** Limb and torso thickness. */
	bulk: number;
	hunch: number;
	/** Overall size. */
	size: number;
	headSize: number;
	skin: string;
	skinDark: string;
	head: HeadKind;
	extraArms: boolean;
	tail: 'none' | 'spiked' | 'whip';
	back: 'none' | 'spines' | 'hump';
	/** Backward-bending, animal legs. */
	digitigrade: boolean;
	gear: 'plates' | 'harness' | 'cape';
	/** 0..1 for small per-alien variations (horn size, crest height...). */
	quirk: number;
}

const SKINS: [string, string][] = [
	['#8a7a9e', '#5a4a6e'],
	['#6f8f7a', '#44604f'],
	['#9e8a62', '#6a5a3a'],
	['#7a6a5a', '#4f4035'],
	['#a07070', '#6a3a3a'],
	['#6a8a9e', '#3f5a6e'],
	['#a39a70', '#6e6640'],
	['#8e6a8a', '#5e3a5a'],
	['#7f9a5a', '#4f6a30']
];

interface Template {
	build: Build;
	bulk: number;
	hunch: number;
	size: number;
	headSize: number;
	heads: HeadKind[];
	backs: Anatomy['back'][];
	tails: Anatomy['tail'][];
	digitigrade: boolean;
	extraArms: boolean;
	gear: Anatomy['gear'];
}

const TEMPLATES: Record<Role, Template> = {
	berserker: {
		build: { leg: 0.9, torso: 1.12, arm: 1.2, neck: 0.35 },
		bulk: 1.55,
		hunch: 0.32,
		size: 1.12,
		headSize: 1.05,
		heads: ['horned', 'splitjaw'],
		backs: ['hump', 'spines'],
		tails: ['spiked', 'none'],
		digitigrade: true,
		extraArms: false,
		gear: 'plates'
	},
	hunter: {
		build: { leg: 1.25, torso: 1.1, arm: 1.22, neck: 1.6 },
		bulk: 0.8,
		hunch: 0.14,
		size: 1.04,
		headSize: 1,
		heads: ['longskull', 'crested'],
		backs: ['spines', 'none'],
		tails: ['whip'],
		digitigrade: true,
		extraArms: true,
		gear: 'harness'
	},
	gunner: {
		build: { leg: 0.85, torso: 0.92, arm: 1, neck: 0.7 },
		bulk: 0.95,
		hunch: 0.2,
		size: 0.98,
		headSize: 1.25,
		heads: ['tentacled', 'cyclops'],
		backs: ['none', 'hump'],
		tails: ['none'],
		digitigrade: false,
		extraArms: false,
		gear: 'cape'
	}
};

const ALL_HEADS: HeadKind[] = ['horned', 'splitjaw', 'longskull', 'crested', 'tentacled', 'cyclops'];

/**
 * A tiny seeded random generator, so an alien looks the same every frame.
 * The seed is scrambled first: enemies that spawn close together would
 * otherwise roll nearly the same numbers and all look alike.
 */
function seeded(x: number, y: number) {
	let h = (Math.imul(Math.floor(x * 100), 73856093) ^ Math.imul(Math.floor(y * 100), 19349663)) >>> 0;
	return () => {
		h = (h + 0x6d2b79f5) >>> 0;
		let t = h;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const cache = new WeakMap<Enemy, Anatomy>();

export function anatomyOf(e: Enemy): Anatomy {
	let an = cache.get(e);
	if (an) return an;
	const r = seeded(e.homeX, e.homeY);
	const t = TEMPLATES[e.brain.role];
	const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)];
	const [skin, skinDark] = pick(SKINS);
	const vary = () => 0.92 + r() * 0.16;
	an = {
		build: { leg: t.build.leg * vary(), torso: t.build.torso * vary(), arm: t.build.arm * vary(), neck: t.build.neck * vary() },
		bulk: t.bulk * vary(),
		hunch: t.hunch * vary(),
		size: t.size * vary(),
		headSize: t.headSize * vary(),
		skin,
		skinDark,
		// Now and then, a head from another species entirely
		head: r() < 0.2 ? pick(ALL_HEADS) : pick(t.heads),
		extraArms: t.extraArms,
		tail: pick(t.tails),
		back: pick(t.backs),
		digitigrade: t.digitigrade,
		gear: t.gear,
		quirk: r()
	};
	cache.set(e, an);
	return an;
}

function poseFor(e: Enemy, an: Anatomy, hasGround: boolean, time: number): LanternPose {
	return { ...enemyPose(e, hasGround, time), build: an.build, hunch: an.hunch };
}

const scaleOf = (e: Enemy, an: Anatomy) => FIGURE_SCALE * ENEMIES[e.kind].scale * an.size;

/** Where its ring hand is in world coordinates (constructs start here). */
export function redLanternHand(e: Enemy, x: number, y: number): Point {
	const an = anatomyOf(e);
	const s = scaleOf(e, an);
	const [hx, hy] = computeSkeleton(poseFor(e, an, true, 0), 0).front.hand;
	return [x + hx * e.dir * s, y + hy * s];
}

/** Top of its head, in world coordinates (health bar and warnings go above). */
export function redLanternTop(e: Enemy, y: number): number {
	const an = anatomyOf(e);
	const s = scaleOf(e, an);
	const sk = computeSkeleton(poseFor(e, an, true, 0), 0);
	return y + (sk.headCenter[1] - 9 * an.headSize) * s;
}

export function drawRedLanternAlien(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, hasGround: boolean, time: number) {
	const an = anatomyOf(e);
	const b = e.brain;
	const s = scaleOf(e, an);
	const pose = poseFor(e, an, hasGround, time);
	const sk = computeSkeleton(pose, time);
	const defeated = !isStanding(e);
	const winding = b.state === 'windup' ? b.ability : null;
	const acting = b.state === 'act' ? b.ability : null;
	const tell = winding ? ABILITIES[winding].tell : null;
	const bodyTell = (tell === 'strike' || tell === 'heavy' || tell === 'sky') && Math.sin(time * 30) > 0;
	const flash = e.flash > 0 || bodyTell;
	const snarl = winding || acting ? 1 : 0.2 + 0.15 * Math.sin(time * 2.5 + e.homeX);
	const claws = (b.ability === 'claws' || b.ability === 'scythe') && (winding !== null || acting !== null);

	ctx.save();
	ctx.globalAlpha = defeated ? Math.min(1, e.down / 0.5) : 1;
	ctx.translate(x, y);
	ctx.scale(s, s);
	if (pose.shadow) {
		const k = 1 - b.air * 0.5;
		ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * k})`;
		ctx.beginPath();
		ctx.ellipse(0, 0, 12 * k * Math.sqrt(an.bulk), 3.8 * k, 0, 0, TAU);
		ctx.fill();
	}
	ctx.scale(pose.dir, 1);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	const colors = {
		skin: flash ? '#ffffff' : an.skin,
		skinDark: flash ? '#ffdddd' : an.skinDark,
		suit: flash ? '#ffdddd' : BLACK_LIT,
		suitFar: flash ? '#ffdddd' : BLACK,
		red: flash ? '#ffffff' : RED_SUIT,
		redFar: flash ? '#ffdddd' : RED_DEEP
	};

	if (!defeated) aura(ctx, sk, b.rage + (winding ? 0.4 : 0), time, x);
	if (an.gear === 'cape') cape(ctx, sk, e, time, colors);
	if (an.tail !== 'none') tail(ctx, sk, an, time, colors);

	// Far side
	if (an.extraArms) extraArm(ctx, sk, sk.back, an, true, time, colors);
	arm(ctx, sk.back, an, true, colors, false);
	leg(ctx, sk.back, an, true, colors);

	torso(ctx, sk, an, colors);

	leg(ctx, sk.front, an, false, colors);
	head(ctx, sk, an, snarl, time, colors);
	if (an.extraArms) extraArm(ctx, sk, sk.front, an, false, time, colors);
	arm(ctx, sk.front, an, false, colors, claws);
	if (an.gear === 'plates') pauldron(ctx, sk, an, colors);
	ring(ctx, sk.front.hand);

	// Constructs forming in the hand
	if (!defeated) {
		const [hx, hy] = sk.front.hand;
		const k = winding ? 1 - b.timer / ABILITIES[winding].windup : 0;
		if (winding === 'saw') saw(ctx, hx, hy, 2 + k * 5, time * 20);
		else if (tell === 'aim' || tell === 'build') orb(ctx, hx, hy, 1.5 + k * 3.5, time);
		else if (tell === 'sky') orb(ctx, sk.headCenter[0], sk.headCenter[1] - 14 - k * 4, 2 + k * 5, time);
	}
	ctx.restore();
}

// ------------------------------------------------------------------ body

interface Colors {
	skin: string;
	skinDark: string;
	suit: string;
	suitFar: string;
	red: string;
	redFar: string;
}

/** A point along the torso: `along` up from the hip, `side` toward the front. */
function torsoPoint(sk: Skeleton, along: number, side: number): Point {
	const up: Point = [Math.sin(sk.torsoAngle), -Math.cos(sk.torsoAngle)];
	const across: Point = [Math.cos(sk.torsoAngle), Math.sin(sk.torsoAngle)];
	return [sk.hip[0] + up[0] * along + across[0] * side, sk.hip[1] + up[1] * along + across[1] * side];
}

function torsoLength(sk: Skeleton): number {
	return Math.hypot(sk.neck[0] - sk.hip[0], sk.neck[1] - sk.hip[1]);
}

function torso(ctx: CanvasRenderingContext2D, sk: Skeleton, an: Anatomy, c: Colors) {
	const L = torsoLength(sk);
	const w = 4.8 * an.bulk;
	const at = (k: number, side: number) => torsoPoint(sk, L * k, side);
	const hump = an.back === 'hump' ? 3 * an.bulk : 0;
	// Chest bigger than the waist; brutes are all shoulders
	const chest = an.bulk > 1.2 ? 1.35 : 1.05;
	const body = new Path2D();
	const pts: Point[] = [
		at(-0.05, -w * 0.9),
		at(0.4, -w * 0.95 - hump * 0.3),
		at(0.78, -w * chest - hump),
		at(1.02, -w * 0.8 - hump * 0.6),
		at(1.04, w * 0.7),
		at(0.8, w * chest),
		at(0.45, w * 0.85),
		at(-0.05, w * 0.95)
	];
	pts.forEach((p, i) => (i === 0 ? body.moveTo(...p) : body.lineTo(...p)));
	body.closePath();
	ctx.fillStyle = c.suit;
	ctx.fill(body);

	// A ragged red panel down the front, and a red belt
	ctx.save();
	ctx.clip(body);
	ctx.fillStyle = c.red;
	const panel = new Path2D();
	const pp: Point[] = [at(0.15, w * 0.1), at(0.5, -w * 0.1), at(0.62, w * 0.2), at(0.85, 0), at(1.05, w * 0.35), at(1.05, w), at(0.1, w)];
	pp.forEach((p, i) => (i === 0 ? panel.moveTo(...p) : panel.lineTo(...p)));
	panel.closePath();
	ctx.fill(panel);
	ctx.fillStyle = c.redFar;
	const belt = new Path2D();
	[at(0.02, -w), at(0.12, -w), at(0.12, w), at(0.02, w)].forEach((p, i) => (i === 0 ? belt.moveTo(...p) : belt.lineTo(...p)));
	ctx.fill(belt);
	// Harness: straps crossing the chest
	if (an.gear === 'harness') {
		ctx.strokeStyle = c.red;
		ctx.lineWidth = 1.3;
		ctx.beginPath();
		ctx.moveTo(...at(0.95, -w));
		ctx.lineTo(...at(0.2, w));
		ctx.moveTo(...at(0.95, w * 0.6));
		ctx.lineTo(...at(0.25, -w));
		ctx.stroke();
	}
	ctx.restore();
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(body);

	// Spines down the back
	if (an.back === 'spines') {
		ctx.fillStyle = c.skinDark;
		for (let i = 0; i < 4; i++) {
			const k = 0.35 + i * 0.18;
			const base = at(k, -w * 0.9 - hump);
			const tip = at(k + 0.06, -w * 0.9 - hump - 3.5 - an.quirk * 2);
			const side = at(k + 0.1, -w * 0.9 - hump);
			ctx.beginPath();
			ctx.moveTo(...base);
			ctx.lineTo(...tip);
			ctx.lineTo(...side);
			ctx.closePath();
			ctx.fill();
		}
	}

	// The Red Lantern emblem on the chest
	const [ex, ey] = at(0.72, w * 0.55);
	ctx.save();
	ctx.translate(ex, ey);
	ctx.rotate(sk.torsoAngle);
	ctx.fillStyle = BLACK;
	ctx.beginPath();
	ctx.arc(0, 0, 2.7, 0, TAU);
	ctx.fill();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 4;
	ctx.strokeStyle = RED;
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.arc(0, 0, 2, 0, TAU);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(-1.1, 2.4);
	ctx.lineTo(-1.1, 4.2);
	ctx.moveTo(0.7, 2.6);
	ctx.lineTo(0.7, 5);
	ctx.stroke();
	ctx.restore();
}

function arm(ctx: CanvasRenderingContext2D, l: Skeleton['front'], an: Anatomy, far: boolean, c: Colors, clawsOut: boolean) {
	const k = an.bulk;
	segment(ctx, l.shoulder, l.elbow, 2.9 * k, 2.4 * k, far ? c.suitFar : c.suit);
	// Bare alien forearm with a red cuff
	const cuff: Point = [l.elbow[0] + (l.hand[0] - l.elbow[0]) * 0.35, l.elbow[1] + (l.hand[1] - l.elbow[1]) * 0.35];
	segment(ctx, l.elbow, cuff, 2.4 * k, 2.3 * k, far ? c.redFar : c.red);
	segment(ctx, cuff, l.hand, 2.2 * k, 1.9 * k, far ? c.skinDark : c.skin);
	hand(ctx, l, an, far, clawsOut, c);
}

/** A second, smaller pair of arms lower on the torso (Stalkers), twitching on their own. */
function extraArm(ctx: CanvasRenderingContext2D, sk: Skeleton, main: Skeleton['front'], an: Anatomy, far: boolean, time: number, c: Colors) {
	const L = torsoLength(sk);
	const shoulder = torsoPoint(sk, L * 0.55, far ? -1 : 0.5);
	const twitch = Math.sin(time * 5 + (far ? 1 : 0)) * 0.2;
	// Mirror the main arm's swing, a beat behind, folded more
	const main1 = Math.atan2(main.elbow[0] - main.shoulder[0], main.elbow[1] - main.shoulder[1]);
	const a1 = main1 * 0.6 + 0.7 + twitch;
	const elbow: Point = [shoulder[0] + Math.sin(a1) * 9, shoulder[1] + Math.cos(a1) * 9];
	const a2 = a1 + 1.2;
	const handP: Point = [elbow[0] + Math.sin(a2) * 8, elbow[1] + Math.cos(a2) * 8];
	const k = Math.max(1, an.bulk);
	segment(ctx, shoulder, elbow, 2.3 * k, 2 * k, far ? c.skinDark : c.skin);
	segment(ctx, elbow, handP, 2 * k, 1.6 * k, far ? c.redFar : c.red);
	claw3(ctx, handP, a2, 4, far ? c.skinDark : '#d9cbb6');
}

function hand(ctx: CanvasRenderingContext2D, l: Skeleton['front'], an: Anatomy, far: boolean, clawsOut: boolean, c: Colors) {
	const along = Math.atan2(l.hand[1] - l.elbow[1], l.hand[0] - l.elbow[0]);
	if (!clawsOut) {
		claw3(ctx, l.hand, Math.PI / 2 - along, 2.6 + an.bulk, far ? c.skinDark : '#d9cbb6');
		return;
	}
	// Rage claws: three jagged red blades
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = far ? 'rgba(255, 42, 42, 0.55)' : RED;
	for (const spread of [-0.45, 0, 0.45]) {
		const a = along + spread;
		const len = 12 - Math.abs(spread) * 5;
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

/** Three curved talons fanning out from a point. `angle` is from straight down, positive forward. */
function claw3(ctx: CanvasRenderingContext2D, at: Point, angle: number, len: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 0.9;
	for (const spread of [-0.5, 0, 0.5]) {
		const a = angle + spread;
		ctx.beginPath();
		ctx.moveTo(...at);
		ctx.quadraticCurveTo(
			at[0] + Math.sin(a) * len * 0.7 + 0.8,
			at[1] + Math.cos(a) * len * 0.7,
			at[0] + Math.sin(a + 0.4) * len,
			at[1] + Math.cos(a + 0.4) * len
		);
		ctx.stroke();
	}
}

function leg(ctx: CanvasRenderingContext2D, l: Skeleton['front'], an: Anatomy, far: boolean, c: Colors) {
	const k = an.bulk;
	const suit = far ? c.suitFar : c.suit;
	const red = far ? c.redFar : c.red;
	const skin = far ? c.skinDark : c.skin;
	segment(ctx, l.hipJoint, l.knee, 3.6 * k, 2.9 * k, suit);
	if (an.digitigrade) {
		// Animal legs: the shin runs back to a high heel (the hock), then down to long toes
		const hock: Point = [l.knee[0] + (l.foot[0] - l.knee[0]) * 0.55 - 3.5, l.knee[1] + (l.foot[1] - l.knee[1]) * 0.55];
		segment(ctx, l.knee, hock, 2.9 * k, 2.2 * k, red);
		segment(ctx, hock, l.foot, 2 * k, 1.6 * k, skin);
		claw3(ctx, l.foot, 1.35, 3 + k, far ? c.skinDark : '#d9cbb6');
	} else {
		const mid: Point = [(l.knee[0] + l.foot[0]) / 2, (l.knee[1] + l.foot[1]) / 2];
		segment(ctx, l.knee, mid, 2.9 * k, 2.6 * k, suit);
		segment(ctx, mid, l.foot, 2.7 * k, 2.2 * k, red);
		// A splayed, clawed foot
		claw3(ctx, l.foot, 1.4, 4, far ? c.skinDark : '#d9cbb6');
	}
}

/** Spiked red shoulder armour (Brutes). */
function pauldron(ctx: CanvasRenderingContext2D, sk: Skeleton, an: Anatomy, c: Colors) {
	const [x, y] = sk.front.shoulder;
	const r = 3.6 * an.bulk;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(sk.torsoAngle);
	ctx.fillStyle = c.red;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.ellipse(0, 0.5, r * 1.1, r * 0.8, 0, Math.PI, TAU);
	ctx.lineTo(r * 1.1, 1.5);
	ctx.lineTo(-r * 1.1, 1.5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#2b1c16';
	for (const sx of [-r * 0.5, r * 0.2]) {
		ctx.beginPath();
		ctx.moveTo(sx - 1, -r * 0.6);
		ctx.lineTo(sx - 0.2, -r * 0.6 - 3);
		ctx.lineTo(sx + 1, -r * 0.6);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

/** A tattered red cape streaming back from the shoulders (Spitters). */
function cape(ctx: CanvasRenderingContext2D, sk: Skeleton, e: Enemy, time: number, c: Colors) {
	const [nx, ny] = torsoPoint(sk, torsoLength(sk) * 0.95, -2);
	const speed = Math.min(1, Math.hypot(e.vx, e.vy) / 150);
	const flow = 6 + speed * 10;
	const wave = (i: number) => Math.sin(time * 4 + i * 1.3) * 2;
	ctx.fillStyle = c.redFar;
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.6;
	ctx.beginPath();
	ctx.moveTo(nx + 2, ny);
	ctx.quadraticCurveTo(nx - flow * 0.6, ny + 8, nx - flow, ny + 20 + wave(0));
	// Ragged hem
	for (let i = 0; i < 4; i++) {
		ctx.lineTo(nx - flow + i * 3 + 1.5, ny + 22 + wave(i) - (i % 2) * 4);
	}
	ctx.lineTo(nx + 2, ny + 18);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
}

function tail(ctx: CanvasRenderingContext2D, sk: Skeleton, an: Anatomy, time: number, c: Colors) {
	const [hx, hy] = torsoPoint(sk, 1, -3 * an.bulk);
	const sway = Math.sin(time * 3 + an.quirk * 6);
	const long = an.tail === 'whip';
	const ex = hx - (long ? 22 : 13);
	const ey = hy + (long ? 6 : 3) + sway * (long ? 6 : 3);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = (long ? 2.4 : 4) * an.bulk + 1;
	ctx.beginPath();
	ctx.moveTo(hx, hy);
	ctx.quadraticCurveTo(hx - 8, hy - 6 + sway * 3, ex, ey);
	ctx.stroke();
	ctx.strokeStyle = c.skinDark;
	ctx.lineWidth = (long ? 2.4 : 4) * an.bulk;
	ctx.stroke();
	if (long) {
		// A red barb at the tip
		ctx.fillStyle = RED;
		ctx.beginPath();
		ctx.moveTo(ex, ey - 2);
		ctx.lineTo(ex - 5, ey);
		ctx.lineTo(ex, ey + 2);
		ctx.closePath();
		ctx.fill();
	} else {
		ctx.fillStyle = '#2b1c16';
		for (const k of [0.4, 0.7, 0.95]) {
			const px = hx + (ex - hx) * k;
			const py = hy + (ey - hy) * k - 2;
			ctx.beginPath();
			ctx.moveTo(px - 1.5, py + 1);
			ctx.lineTo(px - 0.5, py - 3);
			ctx.lineTo(px + 1.5, py + 1);
			ctx.closePath();
			ctx.fill();
		}
	}
}

function aura(ctx: CanvasRenderingContext2D, sk: Skeleton, heat: number, time: number, seed: number) {
	const [cx, cy] = [(sk.hip[0] + sk.neck[0]) / 2, (sk.hip[1] + sk.neck[1]) / 2];
	const alpha = 0.18 + 0.25 * Math.min(1.4, heat);
	const flicker = 0.8 + 0.2 * Math.sin(time * 23 + seed);
	const r0 = 22 + 4 * heat;
	const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, r0 + 4);
	g.addColorStop(0, `rgba(255, 42, 42, ${alpha * flicker})`);
	g.addColorStop(1, 'rgba(255, 42, 42, 0)');
	ctx.fillStyle = g;
	ctx.beginPath();
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * TAU;
		const r = r0 * (i % 2 === 0 ? 1.1 : 0.85) + Math.sin(time * 9 + i) * 2;
		ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.2);
	}
	ctx.closePath();
	ctx.fill();
}

// ------------------------------------------------------------------ heads
// Drawn facing right around the head centre, in head units (R ≈ 5.4).

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, an: Anatomy, snarl: number, time: number, c: Colors) {
	const [hx, hy] = sk.headCenter;
	ctx.save();
	ctx.translate(hx, hy);
	ctx.rotate(sk.headAngle);
	ctx.scale(an.headSize, an.headSize);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	switch (an.head) {
		case 'horned':
			headHorned(ctx, an, snarl, time, c);
			break;
		case 'splitjaw':
			headSplitJaw(ctx, an, snarl, time, c);
			break;
		case 'longskull':
			headLongSkull(ctx, an, snarl, time, c);
			break;
		case 'crested':
			headCrested(ctx, an, snarl, time, c);
			break;
		case 'tentacled':
			headTentacled(ctx, an, snarl, time, c);
			break;
		case 'cyclops':
			headCyclops(ctx, an, snarl, time, c);
			break;
	}
	ctx.restore();
}

function fillStroke(ctx: CanvasRenderingContext2D, p: Path2D, fill: string) {
	ctx.fillStyle = fill;
	ctx.fill(p);
	ctx.strokeStyle = OUTLINE;
	ctx.lineWidth = 0.8;
	ctx.stroke(p);
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, big = false) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = big ? 10 : 6;
	ctx.fillStyle = '#ff5a5a';
	ctx.beginPath();
	ctx.ellipse(x, y, rx, ry, -0.2, 0, TAU);
	ctx.fill();
	ctx.fillStyle = HOT;
	ctx.beginPath();
	ctx.ellipse(x + rx * 0.25, y - ry * 0.15, rx * 0.4, ry * 0.4, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
}

function fangs(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, len: number, down = true) {
	ctx.fillStyle = '#f2ead8';
	const n = Math.max(2, Math.round((x1 - x0) / 1.6));
	for (let i = 0; i < n; i++) {
		const x = x0 + ((x1 - x0) * i) / (n - 1);
		ctx.beginPath();
		ctx.moveTo(x - 0.5, y);
		ctx.lineTo(x, y + (down ? len : -len) * (i % 2 ? 0.7 : 1));
		ctx.lineTo(x + 0.5, y);
		ctx.fill();
	}
}

function drip(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number) {
	const k = (time * 1.4 + seed) % 1;
	ctx.save();
	ctx.globalAlpha *= 1 - k * 0.6;
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.ellipse(x, y + k * 6, 0.7, 0.7 + k * 1.2, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
}

/** Heavy brute skull sunk between the shoulders, big horns, tusks. */
function headHorned(ctx: CanvasRenderingContext2D, an: Anatomy, snarl: number, time: number, c: Colors) {
	const jaw = 1 + snarl * 2.5;
	const skull = new Path2D();
	skull.moveTo(-5, 1);
	skull.quadraticCurveTo(-5.5, -6, 1, -6);
	skull.quadraticCurveTo(6, -5.5, 7, -2);
	skull.lineTo(7.5, 1);
	skull.lineTo(-4, 3);
	skull.closePath();
	fillStroke(ctx, skull, c.skin);
	// Jaw drops open
	const lower = new Path2D();
	lower.moveTo(-3.5, 2.5);
	lower.lineTo(7, 1);
	lower.lineTo(6.5, 2.5 + jaw);
	lower.quadraticCurveTo(1, 4 + jaw, -3, 4);
	lower.closePath();
	fillStroke(ctx, lower, c.skinDark);
	ctx.fillStyle = '#300000';
	ctx.beginPath();
	ctx.moveTo(0, 2.4);
	ctx.lineTo(7, 1.2);
	ctx.lineTo(6.2, 1.8 + jaw * 0.8);
	ctx.closePath();
	ctx.fill();
	// Tusks up from the jaw
	ctx.fillStyle = '#e8dcc0';
	ctx.beginPath();
	ctx.moveTo(5, 2.5 + jaw * 0.6);
	ctx.quadraticCurveTo(8.5, 0, 7.5, -2.5);
	ctx.lineTo(6.2, 1.5);
	ctx.closePath();
	ctx.fill();
	drip(ctx, 6.5, 3 + jaw, time, an.quirk);
	// Horns sweeping forward and up
	const h = 1 + an.quirk * 0.6;
	ctx.fillStyle = c.skin === '#ffffff' ? '#ffffff' : '#2b1c16';
	ctx.beginPath();
	ctx.moveTo(-1, -5.5);
	ctx.bezierCurveTo(-4 * h, -12 * h, 3 * h, -15 * h, 7 * h, -11 * h);
	ctx.bezierCurveTo(2 * h, -11 * h, 0, -9, 2, -5.5);
	ctx.closePath();
	ctx.fill();
	// Heavy brow and small eyes
	ctx.fillStyle = c.skinDark;
	ctx.fillRect(1.5, -4.3, 5.5, 1.5);
	eye(ctx, 5, -2.2, 1.1, 0.7);
}

/** A head that opens sideways: an upper and lower jaw like a trap, three eyes. */
function headSplitJaw(ctx: CanvasRenderingContext2D, an: Anatomy, snarl: number, time: number, c: Colors) {
	const open = 0.25 + snarl * 0.5;
	const cranium = new Path2D();
	cranium.ellipse(-0.5, -1.5, 5.5, 4.5, 0, 0, TAU);
	fillStroke(ctx, cranium, c.skin);
	// Upper jaw hinged back, lower jaw hinged forward: the "mouth" is the whole front
	for (const [rot, dark] of [
		[-open, false],
		[open, true]
	] as const) {
		ctx.save();
		ctx.translate(1, 0.5);
		ctx.rotate(rot);
		const j = new Path2D();
		j.moveTo(0, 0);
		j.lineTo(8, dark ? 0.5 : -0.5);
		j.quadraticCurveTo(7, dark ? 3 : -3, 0, dark ? 2.5 : -2.5);
		j.closePath();
		fillStroke(ctx, j, dark ? c.skinDark : c.skin);
		fangs(ctx, 2, 7.5, dark ? 0.4 : -0.4, 1.3, !dark);
		ctx.restore();
	}
	// Glow from the throat
	ctx.fillStyle = `rgba(255, 50, 30, ${0.3 + 0.5 * snarl})`;
	ctx.beginPath();
	ctx.ellipse(2, 0.5, 1.5, 0.6 + open * 2, 0, 0, TAU);
	ctx.fill();
	eye(ctx, 1, -4, 0.9, 0.7);
	eye(ctx, 3.2, -4.2, 0.9, 0.7);
	eye(ctx, 2.1, -5.6, 0.7, 0.55);
	drip(ctx, 7, 2.5, time, an.quirk);
}

/** A long, back-swept skull (more skull than face), a slit eye, a lipless grin. */
function headLongSkull(ctx: CanvasRenderingContext2D, an: Anatomy, snarl: number, time: number, c: Colors) {
	const back = 9 + an.quirk * 4;
	const skull = new Path2D();
	skull.moveTo(6, 1);
	skull.quadraticCurveTo(7, -4, 2, -5);
	skull.quadraticCurveTo(-back * 0.6, -8, -back, -9);
	skull.quadraticCurveTo(-back * 0.6, -3, -3, 2);
	skull.quadraticCurveTo(1, 4, 6, 1);
	skull.closePath();
	fillStroke(ctx, skull, c.skin);
	// Ridges along the dome
	ctx.strokeStyle = c.skinDark;
	ctx.lineWidth = 0.6;
	for (let i = 1; i <= 3; i++) {
		ctx.beginPath();
		ctx.moveTo(-i * 2.5, -4.5 - i * 0.8);
		ctx.quadraticCurveTo(-i * 2.5 + 1, -2, -i * 2.5 + 0.5, 0.5);
		ctx.stroke();
	}
	eye(ctx, 3.8, -2, 1.6, 0.45);
	// Teeth, bared
	const open = 0.4 + snarl * 1.4;
	ctx.fillStyle = '#300000';
	ctx.beginPath();
	ctx.moveTo(1, 1);
	ctx.lineTo(6, 0.6);
	ctx.lineTo(5.5, 0.6 + open);
	ctx.lineTo(1, 1.5 + open * 0.6);
	ctx.closePath();
	ctx.fill();
	fangs(ctx, 1.5, 5.8, 0.8, 1, true);
	drip(ctx, 5, 1.6 + open, time, an.quirk);
}

/** A lizard-like head with a beaked snout and a big fan crest that flares when it's angry. */
function headCrested(ctx: CanvasRenderingContext2D, an: Anatomy, snarl: number, time: number, c: Colors) {
	const flare = 0.6 + snarl * 0.5;
	// The crest fan behind the head
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = snarl > 0.5 ? 6 : 0;
	ctx.fillStyle = RED_DEEP;
	ctx.beginPath();
	ctx.moveTo(-1, -2);
	for (let i = 0; i <= 5; i++) {
		const a = -Math.PI / 2 - 0.2 - (i / 5) * 1.6;
		const r = (8 + (i % 2) * 2) * flare * (0.9 + an.quirk * 0.3);
		ctx.lineTo(-1 + Math.cos(a) * r, -2 + Math.sin(a) * r);
	}
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = RED;
	ctx.lineWidth = 0.5;
	for (let i = 0; i <= 5; i++) {
		const a = -Math.PI / 2 - 0.2 - (i / 5) * 1.6;
		ctx.beginPath();
		ctx.moveTo(-1, -2);
		ctx.lineTo(-1 + Math.cos(a) * 7 * flare, -2 + Math.sin(a) * 7 * flare);
		ctx.stroke();
	}
	ctx.restore();
	const h = new Path2D();
	h.moveTo(-4, 1);
	h.quadraticCurveTo(-4, -5, 1, -4.5);
	h.lineTo(8.5, -1);
	h.lineTo(6, 1);
	h.lineTo(8, 2);
	h.lineTo(0, 3.5);
	h.closePath();
	fillStroke(ctx, h, c.skin);
	ctx.fillStyle = '#300000';
	ctx.beginPath();
	ctx.moveTo(2, 1.2);
	ctx.lineTo(7.5, 1.5 + snarl);
	ctx.lineTo(2, 2);
	ctx.closePath();
	ctx.fill();
	eye(ctx, 2.2, -2.2, 1, 0.9);
	drip(ctx, 7.5, 2.2, time, an.quirk);
}

/** A big domed head with a nest of face tentacles instead of a mouth. */
function headTentacled(ctx: CanvasRenderingContext2D, an: Anatomy, snarl: number, time: number, c: Colors) {
	// Tentacles first, hanging from the face and writhing
	for (let i = 0; i < 5; i++) {
		const bx = 1 + i * 1.2;
		const len = 6 + (i % 2) * 2 + snarl * 2;
		ctx.strokeStyle = OUTLINE;
		ctx.lineWidth = 1.8;
		ctx.beginPath();
		ctx.moveTo(bx, 1.5);
		const w1 = Math.sin(time * 4 + i * 1.7) * 2;
		const w2 = Math.sin(time * 4 + i * 1.7 + 1.2) * 2.5;
		ctx.bezierCurveTo(bx + w1, 1.5 + len * 0.4, bx - 1 + w2, 1.5 + len * 0.8, bx + w2 * 0.6, 1.5 + len);
		ctx.stroke();
		ctx.strokeStyle = i % 2 ? c.skinDark : c.skin;
		ctx.lineWidth = 1.1;
		ctx.stroke();
	}
	const dome = new Path2D();
	dome.moveTo(-5, 2);
	dome.quadraticCurveTo(-6.5, -7.5, 1, -7);
	dome.quadraticCurveTo(7.5, -6, 6.5, 0);
	dome.quadraticCurveTo(5, 2.5, -5, 2);
	dome.closePath();
	fillStroke(ctx, dome, c.skin);
	// Veins glowing red on the dome
	ctx.strokeStyle = 'rgba(255, 60, 60, 0.5)';
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(-3, -1);
	ctx.quadraticCurveTo(-2, -5, 1, -6);
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(1, -3, 4, -5);
	ctx.stroke();
	eye(ctx, 4, -2.5, 1.3, 1.1, true);
	eye(ctx, 1.8, -3, 0.8, 0.7);
}

/** One huge eye in a bony socket, a small fanged mouth, antennae. */
function headCyclops(ctx: CanvasRenderingContext2D, an: Anatomy, snarl: number, time: number, c: Colors) {
	// Antennae
	ctx.strokeStyle = c.skinDark;
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.moveTo(-1, -5);
	ctx.quadraticCurveTo(-4, -11, -7, -11 + Math.sin(time * 5) * 1.5);
	ctx.moveTo(1, -5.5);
	ctx.quadraticCurveTo(0, -12, -3, -13 + Math.sin(time * 5 + 1) * 1.5);
	ctx.stroke();
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.arc(-7, -11 + Math.sin(time * 5) * 1.5, 0.8, 0, TAU);
	ctx.arc(-3, -13 + Math.sin(time * 5 + 1) * 1.5, 0.8, 0, TAU);
	ctx.fill();
	const h = new Path2D();
	h.ellipse(0.5, -1, 6, 5.5, 0, 0, TAU);
	fillStroke(ctx, h, c.skin);
	// The eye socket and the eye, blinking now and then
	const blink = (time * 0.7 + an.quirk * 5) % 4 < 0.12 ? 0.15 : 1;
	ctx.fillStyle = c.skinDark;
	ctx.beginPath();
	ctx.ellipse(3, -1.8, 3.2, 3 * blink + 0.3, 0, 0, TAU);
	ctx.fill();
	eye(ctx, 3.3, -1.8, 2.3, 2.2 * blink, true);
	ctx.fillStyle = '#1a0000';
	ctx.beginPath();
	ctx.ellipse(3.8, -1.8, 0.8, 1.4 * blink, 0, 0, TAU);
	ctx.fill();
	// Little fanged mouth under it
	ctx.fillStyle = '#300000';
	ctx.beginPath();
	ctx.ellipse(4, 2.4, 1.6, 0.5 + snarl * 1.2, 0, 0, TAU);
	ctx.fill();
	fangs(ctx, 2.8, 5.2, 2, 0.9, true);
	drip(ctx, 4.5, 3 + snarl, time, an.quirk);
}

// ------------------------------------------------------------------ ring & constructs

function ring(ctx: CanvasRenderingContext2D, [x, y]: Point) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 6;
	ctx.strokeStyle = RED;
	ctx.lineWidth = 0.9;
	ctx.beginPath();
	ctx.arc(x, y, 1.3, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

function orb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
	ctx.save();
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.arc(x, y, r * (1 + 0.12 * Math.sin(time * 25)), 0, TAU);
	ctx.fill();
	ctx.fillStyle = HOT;
	ctx.beginPath();
	ctx.arc(x, y, r * 0.45, 0, TAU);
	ctx.fill();
	ctx.restore();
}

function saw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(spin);
	ctx.shadowColor = RED;
	ctx.shadowBlur = 10;
	ctx.fillStyle = RED;
	ctx.beginPath();
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * TAU;
		const rr = i % 2 === 0 ? r : r * 0.62;
		ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
	}
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}
