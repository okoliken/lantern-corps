// Signature abilities: each Lantern's big move, charged by fighting.
//
// The SURGE meter fills from damage dealt, constructs used and allies
// shielded (see gainSurge in system.ts). When it's full, the Signature
// button unleashes:
//
//  - HAL, JET STRIKE: a construct fighter jet. Hal rockets along his aim,
//    over buildings, hitting everything in his path once. When the run ends
//    the jet fires a volley of homing missiles at enemies nearby.
//  - JOHN, FORTRESS: a dome where he stands. Enemies are pushed out, anyone
//    inside takes no damage, and turrets on the rim shoot enemies in range.
//  - KILOWOG, HAMMER QUAKE: a giant hammer brought down where he stands;
//    everything around is smashed, knocked flying and stunned.

import { footprintGap, isStanding, type Dummy } from '../dummy';
import type { Intent } from '../input';
import type { RingBearerId } from '../lanterns';
import type { Player } from '../player';
import type { ConstructDef } from './defs';
import {
	SURGE_MAX,
	breakables,
	center,
	damageObstacle,
	hitDummyWithFx,
	launch,
	type ConstructWorld,
	type Fortress
} from './system';

export interface SignatureDef {
	id: 'jetStrike' | 'fortress' | 'hammerQuake';
	name: string;
	description: string;
}

export const SIGNATURES: Record<RingBearerId, SignatureDef> = {
	hal: {
		id: 'jetStrike',
		name: 'Jet Strike',
		description: 'Rocket forward in a construct fighter jet, smashing through enemies, then unload homing missiles.'
	},
	john: {
		id: 'fortress',
		name: 'Fortress',
		description: 'Raise a dome that keeps enemies out and protects everyone inside, with auto-turrets on the rim.'
	},
	kilowog: {
		id: 'hammerQuake',
		name: 'Hammer Quake',
		description: 'Bring a giant hammer down where you stand: everything around is smashed, thrown back and stunned.'
	},
	// The prisoners use the same three moves, each in their own style
	arisia: {
		id: 'jetStrike',
		name: 'Comet Dive',
		description: 'Streak through the enemy line like a comet, then let loose a burst of homing bolts.'
	},
	katma: {
		id: 'fortress',
		name: 'Korugar Bastion',
		description: 'A fortified dome that shelters everyone inside, with turrets on the rim.'
	},
	boodikka: {
		id: 'hammerQuake',
		name: 'Bellatrix Quake',
		description: 'A war hammer brought down with everything she has: smashes, scatters and stuns.'
	}
};

/** Hammer Quake: how far it reaches, how hard it hits, and how long enemies stay stunned. */
export const QUAKE = { radius: 210, damage: 90, knockback: 700, stun: 1.2 };

// ------------------------------------------------------------ Jet Strike

export const JET = {
	speed: 950,
	/** Seconds of dash. Speed × time = about 520px. */
	duration: 0.55,
	/** How close to Hal's path something has to be to get hit. */
	hitRadius: 38,
	damage: 60,
	knockback: 560,
	missiles: 6,
	/** How far the missiles look for targets. */
	missileRange: 420
};

const MISSILE: ConstructDef = {
	id: 'jetMissile',
	name: 'Missile',
	behavior: 'heavy',
	shape: 'bolt',
	cost: 0,
	cooldown: 0,
	damage: 24,
	knockback: 260,
	range: 700,
	speed: 560,
	radius: 48
};

// -------------------------------------------------------------- Fortress

export const FORTRESS = {
	radius: 120,
	/** Seconds, before John's durability. */
	duration: 9,
	turrets: 3,
	turretRange: 380,
	/** Seconds between turret shots. */
	turretRate: 0.32
};

const TURRET_BOLT: ConstructDef = {
	id: 'turretBolt',
	name: 'Turret bolt',
	behavior: 'rapid',
	shape: 'bolt',
	cost: 0,
	cooldown: 0,
	damage: 10,
	knockback: 80,
	range: 420,
	speed: 900
};

// ---------------------------------------------------------------- per player

/**
 * One tick: start the signature ability if it was pressed and the meter is
 * full, and run Hal's jet while it's going. Call AFTER updatePlayer (which
 * moves Hal along the dash).
 */
export function updateSignature(p: Player, intent: Intent, dt: number, w: ConstructWorld) {
	if (p.dash) {
		if (p.dash.kind === 'burn') runBurn(p, dt, w);
		else runJet(p, dt, w);
		return;
	}
	if (!intent.signature || p.surge < SURGE_MAX || p.downed || p.def.hero) return;

	p.surge = 0;
	const sig = SIGNATURES[p.def.id as RingBearerId];
	const id = sig.id;
	if (id === 'jetStrike') startJet(p, w);
	else if (id === 'hammerQuake') hammerQuake(p, w);
	else startFortress(p, w);
	w.effects.push({
		kind: 'callout',
		x: p.x,
		y: p.y,
		age: 0,
		life: 1.4,
		text: sig.name.toUpperCase() + '!',
		owner: p
	});
}

function startJet(p: Player, w: ConstructWorld) {
	const len = Math.hypot(p.aimX, p.aimY) || 1;
	p.dash = {
		kind: 'jet',
		dx: p.aimX / len,
		dy: p.aimY / len,
		speed: JET.speed,
		time: JET.duration * p.def.traits.durability,
		blocked: false,
		hit: []
	};
	// Take to the air: the jet flies over buildings
	p.flying = true;
	p.firing = false;
	w.effects.push({ kind: 'snap', x: p.x, y: p.y, age: 0, life: 0.4, radius: 60 });
}

function runJet(p: Player, dt: number, w: ConstructWorld) {
	const d = p.dash!;
	const damage = JET.damage * p.def.traits.power;
	const knockback = JET.knockback * p.def.traits.power;

	// Everything close to Hal's path gets hit, once, and flung aside
	for (const t of w.dummies) {
		if (!isStanding(t) || d.hit.includes(t)) continue;
		if (footprintGap(t, p.x, p.y) > JET.hitRadius) continue;
		d.hit.push(t);
		// Knock them away from the jet's line, not just backward
		const side = (t.x - p.x) * -d.dy + (t.y - p.y) * d.dx >= 0 ? 1 : -1;
		const fx = t.x + d.dy * side * 20 - d.dx * 10;
		const fy = t.y - d.dx * side * 20 - d.dy * 10;
		hitDummyWithFx(w, t, damage, knockback, fx, fy, p, damage, false);
	}
	for (const o of breakables(w)) {
		const [cx, cy] = center(o);
		if (d.hit.includes(o) || Math.hypot(cx - p.x, cy - p.y) > JET.hitRadius + Math.max(o.w, o.h) / 2) continue;
		d.hit.push(o);
		damageObstacle(w, o, damage);
	}

	d.time -= dt;
	if (d.time <= 0 || d.blocked) finishJet(p, w);
}

/** Afterburner (a construct, not the signature): the same kind of run, shorter, with no jet and no missiles. */
function runBurn(p: Player, dt: number, w: ConstructWorld) {
	const d = p.dash!;
	for (const t of w.dummies) {
		if (!isStanding(t) || d.hit.includes(t) || footprintGap(t, p.x, p.y) > JET.hitRadius) continue;
		d.hit.push(t);
		const side = (t.x - p.x) * -d.dy + (t.y - p.y) * d.dx >= 0 ? 1 : -1;
		hitDummyWithFx(w, t, d.damage ?? 20, d.knockback ?? 300, t.x + d.dy * side * 20 - d.dx * 10, t.y - d.dx * side * 20 - d.dy * 10, p);
	}
	// Green afterimages streaming behind
	w.effects.push({ kind: 'afterimage', x: p.x, y: p.y, age: 0, life: 0.3, angle: Math.atan2(d.dy, d.dx), owner: p, lift: p.ringLift });
	d.time -= dt;
	if (d.time <= 0 || d.blocked) {
		p.dash = null;
		p.vx *= 0.3;
		p.vy *= 0.3;
	}
}

/** The run ends: the jet fires its missiles and dissolves. */
function finishJet(p: Player, w: ConstructWorld) {
	p.dash = null;
	p.vx *= 0.25;
	p.vy *= 0.25;
	w.effects.push({ kind: 'blast', x: p.x, y: p.y, age: 0, life: 0.5, radius: 70, owner: p, lift: p.ringLift });

	// Nearest enemies first; with fewer targets than missiles, spread missiles across them
	const targets = w.dummies
		.filter((t) => isStanding(t) && Math.hypot(t.x - p.x, t.y - p.y) <= JET.missileRange)
		.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
	if (targets.length === 0) return;

	const def = { ...MISSILE, damage: MISSILE.damage * p.def.traits.power };
	for (let i = 0; i < JET.missiles; i++) {
		const target: Dummy = targets[i % targets.length];
		// Fan the launch angles out so the volley spreads before curving in
		const spread = ((i - (JET.missiles - 1) / 2) / JET.missiles) * 2.2;
		const base = Math.atan2(target.y - p.y, target.x - p.x);
		const m = launch(p, def, 'missile', Math.cos(base + spread), Math.sin(base + spread), w);
		m.homing = target;
		m.noSurge = true;
	}
}

function hammerQuake(p: Player, w: ConstructWorld) {
	const damage = QUAKE.damage * p.def.traits.power;
	for (const d of w.dummies) {
		if (!isStanding(d) || footprintGap(d, p.x, p.y) > QUAKE.radius) continue;
		hitDummyWithFx(w, d, damage, QUAKE.knockback, p.x, p.y, p);
		d.stun = Math.max(d.stun, QUAKE.stun);
	}
	for (const o of breakables(w)) {
		const [cx, cy] = center(o);
		if (Math.hypot(cx - p.x, cy - p.y) <= QUAKE.radius) damageObstacle(w, o, damage);
	}
	p.actionTimer = 0.6;
	p.actionShape = null;
	w.effects.push({ kind: 'bigHammer', x: p.x, y: p.y, age: 0, life: 0.8, angle: Math.atan2(p.aimY, p.aimX), value: 30, radius: QUAKE.radius, lift: 40 });
}

function startFortress(p: Player, w: ConstructWorld) {
	const life = FORTRESS.duration * p.def.traits.durability;
	// One Fortress per Lantern: a new one replaces the old
	w.fortresses = w.fortresses.filter((f) => f.owner !== p);
	w.fortresses.push({
		owner: p,
		x: p.x,
		y: p.y,
		radius: FORTRESS.radius,
		life,
		maxLife: life,
		turrets: Array.from({ length: FORTRESS.turrets }, (_, i) => {
			// Spread around the dome starting at the FRONT, so none sits behind John's head
			const angle = Math.PI / 2 + (i * Math.PI * 2) / FORTRESS.turrets;
			return { angle, aim: angle, cooldown: 0.4 + i * 0.1 };
		})
	});
	p.actionTimer = 0.6;
	p.actionShape = null;
	w.effects.push({ kind: 'shockwave', x: p.x, y: p.y, age: 0, life: 0.6, radius: FORTRESS.radius, owner: p });
}

// ---------------------------------------------------------------- world tick

/** Height of a turret's barrel above the ground (matches drawTurret). */
export const TURRET_HEAD_HEIGHT = 14;
/** In space the Fortress is a sphere and its turrets are drones floating around it. */
export const FORTRESS_DRONE_HOVER = 34;

/** Where a Fortress turret sits, on the dome's rim (flattened like the ground). */
export function turretPosition(f: Fortress, angle: number): { x: number; y: number } {
	return { x: f.x + Math.cos(angle) * f.radius, y: f.y + Math.sin(angle) * f.radius * 0.5 };
}

/** One tick for Fortresses: turrets fire, enemies get pushed out, domes expire. */
export function updateSignatureWorld(w: ConstructWorld, dt: number) {
	for (const f of [...w.fortresses]) {
		f.life -= dt;
		if (f.life <= 0) {
			w.fortresses.splice(w.fortresses.indexOf(f), 1);
			w.effects.push({ kind: 'fizzle', x: f.x, y: f.y - 20, age: 0, life: 0.6 });
			continue;
		}

		// Keep enemies out: anything inside is shoved to the edge
		for (const d of w.dummies) {
			if (!isStanding(d)) continue;
			const dx = d.x - f.x;
			const dy = d.y - f.y;
			const dist = Math.hypot(dx, dy);
			if (dist >= f.radius) continue;
			const nx = dist > 0.01 ? dx / dist : 1;
			const ny = dist > 0.01 ? dy / dist : 0;
			d.x = f.x + nx * f.radius;
			d.y = f.y + ny * f.radius;
			d.vx = nx * 260;
			d.vy = ny * 260;
		}

		// Turrets: each tracks the nearest enemy in range and fires
		for (const t of f.turrets) {
			t.cooldown -= dt;
			const pos = turretPosition(f, t.angle);
			const target = nearestEnemy(w, pos.x, pos.y, FORTRESS.turretRange);
			if (!target) continue;
			t.aim = Math.atan2(target.y - pos.y, target.x - pos.x);
			if (t.cooldown > 0) continue;
			t.cooldown = FORTRESS.turretRate;
			const bolt = launch(f.owner, TURRET_BOLT, 'bolt', Math.cos(t.aim), Math.sin(t.aim), w, pos);
			bolt.noSurge = true;
			// Fired from the turret head (or the floating drone, in space), not the owner's ring
			bolt.lift = w.space ? FORTRESS_DRONE_HOVER : TURRET_HEAD_HEIGHT;
		}
	}
}

function nearestEnemy(w: ConstructWorld, x: number, y: number, range: number): Dummy | null {
	let best: Dummy | null = null;
	let bestDist = range;
	for (const d of w.dummies) {
		if (!isStanding(d)) continue;
		const dist = Math.hypot(d.x - x, d.y - y);
		if (dist <= bestDist) {
			best = d;
			bestDist = dist;
		}
	}
	return best;
}
