// Ships: Red Lantern fighters fly like aircraft, not like Lanterns.
//
// A ship can't stop or strafe sideways. It always flies forward and turns
// at a limited rate, so it fights in PASSES:
//
//   line up ──(nose on target, its turn to attack)──▶ windup ──▶ strafe / bombs ─┐
//      ▲                                                                         │
//      └──── loop round (wide turn out to range) ◀── fly on past the target ◀────┘
//
// That makes it easy to read: when its nose swings onto you and the aim line
// shows, step out of the line.

import type { ConstructWorld } from '../constructs/system';
import type { Obstacle } from '../map';
import { boxOverlap } from '../physics';
import type { Player } from '../player';
import { attackStarted, mayAttack, type Attacker } from './director';
import { ENEMIES, beginWindup, face, type Enemy } from './enemies';
import { ABILITIES, startAbility, updateAbility, type AbilityId } from './redConstructs';

/** Nose within this angle of the target counts as lined up. */
const LINED_UP = 0.28;
/** Seconds of flying straight on after a run before looping round. */
const PASS_TIME = 0.8;
/** How far out it swings before coming back for another pass. */
const LOOP_DISTANCE = 360;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function flyShip(
	e: Enemy,
	t: Player | null,
	attackers: readonly (Attacker & { e: Enemy })[],
	w: ConstructWorld,
	players: readonly Player[],
	dt: number
) {
	const def = ENEMIES[e.kind];
	const b = e.brain;
	let want = b.heading;
	b.pass = Math.max(0, b.pass - dt);

	switch (b.state) {
		case 'idle': {
			// Patrol: a slow circle round where it arrived
			const home = Math.atan2(e.homeY - e.y, e.homeX - e.x);
			want = home + (Math.hypot(e.homeX - e.x, e.homeY - e.y) > 160 ? 0 : Math.PI / 2);
			if (t) {
				b.state = 'move';
				b.goal = 'approach';
			}
			break;
		}
		case 'move': {
			if (!t) {
				b.state = 'idle';
				break;
			}
			const dx = t.x - e.x;
			const dy = t.y - e.y;
			const d = Math.hypot(dx, dy);
			if (b.pass > 0) break; // flying on past
			if (b.goal === 'retreat') {
				// Loop: swing out wide to one side, then come back round
				const out = Math.atan2(e.y - t.y, e.x - t.x) + b.strafe * 1.1;
				want = Math.atan2(t.y + Math.sin(out) * LOOP_DISTANCE - e.y, t.x + Math.cos(out) * LOOP_DISTANCE - e.x);
				if (d > LOOP_DISTANCE * 0.9) b.goal = 'approach';
				break;
			}
			// Line up, leading the target a little
			const lead = Math.min(d / 820, 0.45);
			want = Math.atan2(dy + t.vy * lead, dx + t.vx * lead);
			const lined = Math.abs(wrap(want - b.heading)) < LINED_UP;
			b.think -= dt;
			if (lined && b.sees && b.think <= 0) {
				b.think = b.reaction * 0.5;
				attackRun(e, t, d, attackers, w);
			}
			// Too close and not lined up: overshoot and come round again
			if (!lined && d < 110) {
				b.goal = 'retreat';
				b.strafe = Math.random() < 0.5 ? 1 : -1;
			}
			break;
		}
		case 'windup': {
			if (t) want = Math.atan2(t.y - e.y, t.x - e.x);
			b.timer -= dt;
			if (b.timer <= 0) startAbility(e, w, players);
			break;
		}
		case 'act': {
			if (updateAbility(e, w, players, dt)) {
				const a = ABILITIES[b.ability!];
				b.state = 'recover';
				b.timer = a.recover;
				b.cooldowns[a.id] = a.cooldown * (0.85 + Math.random() * 0.3);
				b.pass = PASS_TIME;
				b.goal = 'retreat';
				b.strafe = Math.random() < 0.5 ? 1 : -1;
			}
			break;
		}
		case 'recover': {
			b.timer -= dt;
			if (b.timer <= 0) {
				b.state = t ? 'move' : 'idle';
				b.ability = null;
			}
			break;
		}
	}

	// Don't fly into asteroids: something ahead means turn away hard
	if (blockedAhead(e, w.obstacles)) want = b.heading + b.strafe * 1.4;

	const turn = wrap(want - b.heading);
	const rate = (def.turnRate ?? 2) * (b.state === 'act' ? 0.35 : 1);
	b.heading = wrap(b.heading + Math.max(-rate * dt, Math.min(rate * dt, turn)));

	// Always flying forward. Easing into it (rather than setting it) lets knockback still shove it.
	const speed = def.speed * b.speedMul * (1 + 0.25 * b.rage) * (b.state === 'windup' ? 0.8 : 1);
	const k = 1 - Math.exp(-def.accel * dt);
	e.vx += (Math.cos(b.heading) * speed - e.vx) * k;
	e.vy += (Math.sin(b.heading) * speed - e.vy) * k;
	b.aimX = Math.cos(b.heading);
	b.aimY = Math.sin(b.heading);
	face(e, Math.cos(b.heading) * 10);
}

/** Pick the run: bombs if it's right over the target, otherwise a strafe. Needs its turn from the director. */
function attackRun(e: Enemy, t: Player, d: number, attackers: readonly (Attacker & { e: Enemy })[], w: ConstructWorld) {
	const b = e.brain;
	const me = attackers.find((a) => a.e === e) ?? { target: t, attack: null };
	const order: AbilityId[] = d < ABILITIES.bombs.maxRange ? ['bombs', 'strafe'] : ['strafe', 'bombs'];
	for (const id of order) {
		if (!b.kit.includes(id) || b.cooldowns[id] > 0) continue;
		const a = ABILITIES[id];
		if (d < a.minRange || d > a.maxRange) continue;
		if (!mayAttack(w.pressure, me, t, a, attackers, w.redTempo)) continue;
		if (Math.random() > Math.min(1, a.chance * w.redTempo)) continue;
		b.uses[id]++;
		beginWindup(e, id, t);
		attackStarted(w.pressure, t, w.redTempo);
		return;
	}
}

function blockedAhead(e: Enemy, obstacles: readonly Obstacle[]): boolean {
	const h = e.brain.heading;
	for (const reach of [50, 100]) {
		const x = e.x + Math.cos(h) * reach;
		const y = e.y + Math.sin(h) * reach;
		if (obstacles.some((o) => o.blocksFlying && boxOverlap(x, y, 10, 8, o))) return true;
	}
	return false;
}
