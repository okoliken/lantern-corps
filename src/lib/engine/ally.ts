// An AI partner: a computer-controlled Lantern for playing co-op on your own.
//
// It's just another InputSource. Each tick it looks at the fight and returns
// the same Intent a keyboard would ("move this way, shoot there, press
// construct 3"), so it plays by exactly the same rules as a person: same
// willpower, same cooldowns, same constructs.
//
// What it does:
//  - sticks near its partner, and flies when there's a fight,
//  - goes for whoever is about to hit its partner, else the nearest enemy,
//  - keeps its Lantern's preferred distance (Hal closer, John further back),
//  - dodges Rage Slam circles and claws winding up on it,
//  - shields itself or its partner when they're hurt and something's coming,
//  - uses constructs that suit the moment, and its signature when surrounded.

import { BUBBLE_SHIELD } from './constructs/defs';
import type { ConstructWorld } from './constructs/system';
import { isStanding, type Dummy } from './dummy';
import { isEnemy, type Enemy } from './enemies/enemies';
import { IDLE, type InputSource, type Intent } from './input';
import type { Player } from './player';

export interface AllyWorld {
	readonly players: readonly Player[];
	readonly dummies: readonly Dummy[];
	readonly constructs: ConstructWorld;
}

/** read() is called once per fixed tick. */
const TICK = 1 / 60;

/** A construct to use: pick the slot, then press it once or hold it for a while. */
interface Plan {
	slot: number;
	/** Seconds to hold the button. 0 = a single press. */
	hold: number;
	selected: boolean;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class AllyInput implements InputSource {
	/** The Lantern this brain controls (set once the player exists). */
	me: Player | null = null;
	private plan: Plan | null = null;
	private decideIn = 0.6;
	private strafe: 1 | -1 = 1;
	private strafeIn = 2;
	/** Hal wants to be in sword range. */
	private closeIn = false;
	/** We locked onto our partner last tick to shield them; let go again. */
	private lockedPartner = false;

	constructor(private world: AllyWorld) {}

	read(): Intent {
		const me = this.me;
		if (me && this.lockedPartner) {
			me.lock = null;
			this.lockedPartner = false;
		}
		if (!me || me.downed || me.dash) {
			this.plan = null;
			return IDLE;
		}

		const partner = this.world.players.find((p) => p !== me && !p.downed) ?? null;
		const enemies = this.world.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
		const target = this.pickTarget(me, partner, enemies);
		const intent: Intent = { ...IDLE };

		if (target && !me.flying) intent.toggleFly = true;
		this.move(me, partner, enemies, target, intent);
		if (target) {
			// The game lifts the pointer to ring height; aim so it lands on the enemy
			intent.pointer = { x: target.x, y: target.y - me.ringLift };
			intent.shot = true;
		}
		this.defend(me, partner, enemies, intent);
		if (target && me.surge >= 100 && enemies.filter((e) => dist(e, me) < 360).length >= 2) intent.signature = true;
		this.useConstructs(me, target, enemies, intent);
		return intent;
	}

	/** Whoever is winding up on my partner first, else the nearest enemy to me. */
	private pickTarget(me: Player, partner: Player | null, enemies: Enemy[]): Enemy | null {
		const threats = enemies.filter(
			(e) => partner && e.brain.target === partner && (e.brain.state === 'windup' || e.brain.state === 'act') && dist(e, me) < 520
		);
		const pool = threats.length > 0 ? threats : enemies.filter((e) => dist(e, me) < 620);
		let best: Enemy | null = null;
		for (const e of pool) if (!best || dist(e, me) < dist(best, me)) best = e;
		return best;
	}

	private move(me: Player, partner: Player | null, enemies: Enemy[], target: Enemy | null, intent: Intent) {
		let gx = me.x;
		let gy = me.y;
		if (!target) {
			if (partner) {
				const side = me.x < partner.x ? -1 : 1;
				gx = partner.x + side * 110;
				gy = partner.y + 20;
			}
		} else {
			this.strafeIn -= TICK;
			if (this.strafeIn <= 0) {
				this.strafe = this.strafe === 1 ? -1 : 1;
				this.strafeIn = 1.5 + Math.random() * 2;
			}
			const range = me.def.id === 'hal' ? (this.closeIn ? 55 : 200) : 300;
			const angle = Math.atan2(me.y - target.y, me.x - target.x) + this.strafe * 0.5;
			gx = target.x + Math.cos(angle) * range;
			gy = target.y + Math.sin(angle) * range;
			// Don't wander off from the partner
			if (partner) {
				const leash = dist({ x: gx, y: gy }, partner);
				if (leash > 380) {
					gx = partner.x + ((gx - partner.x) * 380) / leash;
					gy = partner.y + ((gy - partner.y) * 380) / leash;
				}
			}
		}

		// Dodging beats everything: out of slam circles, away from claws about to land
		const away = (x: number, y: number, far: number) => {
			const d = dist(me, { x, y }) || 1;
			gx = me.x + ((me.x - x) / d) * far;
			gy = me.y + ((me.y - y) / d) * far;
		};
		for (const fx of this.world.constructs.effects) {
			if (fx.kind === 'slamMark' && dist(me, fx) < (fx.radius ?? 70) + 24) away(fx.x, fx.y, 160);
		}
		for (const e of enemies) {
			if (e.brain.target === me && e.brain.state === 'windup' && e.brain.ability === 'claws' && dist(e, me) < 90) away(e.x, e.y, 140);
		}

		const dx = gx - me.x;
		const dy = gy - me.y;
		const d = Math.hypot(dx, dy);
		if (d > 14) {
			const k = Math.min(1, d / 60) / d;
			intent.moveX = dx * k;
			intent.moveY = dy * k;
		}
	}

	/** Bubble shield on myself, or my partner, when hurt and something is winding up on them. */
	private defend(me: Player, partner: Player | null, enemies: Enemy[], intent: Intent) {
		if (me.shieldCooldown > 0 || me.exhausted || me.willpower < BUBBLE_SHIELD.cost) return;
		const shields = this.world.constructs.shields;
		const threatened = (p: Player) => enemies.some((e) => e.brain.target === p && e.brain.state === 'windup' && dist(e, p) < 380);
		const unshielded = (p: Player) => !shields.some((s) => s.target === p);

		if (me.health < 50 && unshielded(me) && threatened(me)) {
			intent.shield = true;
			return;
		}
		if (partner && partner.health < 45 && unshielded(partner) && dist(partner, me) < BUBBLE_SHIELD.range * 0.9 && threatened(partner)) {
			me.lock = { kind: 'ally', player: partner };
			this.lockedPartner = true;
			intent.shield = true;
		}
	}

	private useConstructs(me: Player, target: Enemy | null, enemies: Enemy[], intent: Intent) {
		if (!target) {
			this.plan = null;
			return;
		}
		if (this.plan) {
			this.runPlan(intent);
			return;
		}
		this.decideIn -= TICK;
		if (this.decideIn > 0 || me.exhausted) return;
		this.decideIn = 0.35 + Math.random() * 0.4;

		const d = dist(me, target);
		const slotOf = (id: string) => me.loadout.findIndex((c) => c.id === id);
		const ready = (id: string) => {
			const i = slotOf(id);
			return i >= 0 && me.cooldowns[i] === 0 && me.willpower >= me.loadout[i].cost + 10;
		};
		const press = (id: string): Plan => ({ slot: slotOf(id), hold: 0, selected: false });
		const hold = (id: string, seconds: number): Plan => ({ slot: slotOf(id), hold: seconds, selected: false });
		const clustered = enemies.filter((e) => dist(e, target) < 100).length >= 2;

		if (me.def.id === 'hal') {
			this.closeIn = false;
			if (d < 90 && ready('sword')) {
				this.plan = press('sword');
				this.closeIn = true;
			} else if (clustered && d < 120 && ready('fist')) {
				this.plan = press('fist');
			} else if (target.brain.role === 'gunner' && d > 170 && d < 330 && ready('chain')) {
				this.plan = press('chain');
				this.closeIn = true;
			} else if (me.willpower > 55 && d < 440) {
				this.plan = hold(Math.random() < 0.5 ? 'minigun' : 'beam', 0.9);
			} else if (d < 170 && Math.random() < 0.5) {
				this.closeIn = true;
			}
		} else {
			const turrets = this.world.constructs.turrets.filter((t) => t.owner === me).length;
			const rushing = enemies.some((e) => e.brain.target === me && e.brain.engaged && dist(e, me) < 160);
			if (rushing && ready('wall') && Math.random() < 0.5) {
				this.plan = press('wall');
			} else if (turrets === 0 && enemies.length >= 2 && ready('turret')) {
				this.plan = press('turret');
			} else if (clustered && d < 320 && ready('pillars')) {
				this.plan = press('pillars');
			} else if (d > 160 && ready('sniper')) {
				this.plan = hold('sniper', 1);
			} else if (me.willpower > 60 && d < 400) {
				this.plan = hold('beam', 1);
			}
		}
		if (this.plan) this.runPlan(intent);
	}

	private runPlan(intent: Intent) {
		const plan = this.plan!;
		if (!plan.selected) {
			intent.select = plan.slot;
			plan.selected = true;
			return;
		}
		if (plan.hold === 0) {
			intent.construct = true;
			intent.constructPressed = true;
			this.plan = null;
			return;
		}
		plan.hold -= TICK;
		// Letting go is what fires a charged sniper shot
		intent.construct = plan.hold > 0;
		intent.shot = false;
		if (plan.hold <= 0) this.plan = null;
	}
}
