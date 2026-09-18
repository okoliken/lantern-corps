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
import { aimPoint, isStanding, type Dummy } from './dummy';
import { isEnemy, rangeOf, type Enemy } from './enemies/enemies';
import { IDLE, type InputSource, type Intent } from './input';
import type { Player } from './player';

export interface AllyWorld {
	readonly players: readonly Player[];
	readonly dummies: readonly Dummy[];
	readonly constructs: ConstructWorld;
}

/** Enemies that fight from range (worth pulling in with the chain). */
const ENEMY_IS_RANGED = (e: Enemy) => rangeOf(e) >= 250;

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
	/** Seconds before it will use its signature again (so it's a big moment, not always on). */
	private signatureRest = 8;
	/** Seconds before it will shield again, unless someone's badly hurt. */
	private shieldRest = 0;
	/** Seconds before it reconsiders shielding against a big attack it has already seen coming. */
	private shieldRoll = 0;

	constructor(private world: AllyWorld) {}

	read(): Intent {
		const me = this.me;
		if (me && this.lockedPartner) {
			me.lock = null;
			this.lockedPartner = false;
		}
		this.signatureRest = Math.max(0, this.signatureRest - TICK);
		this.shieldRest = Math.max(0, this.shieldRest - TICK);
		this.shieldRoll = Math.max(0, this.shieldRoll - TICK);
		if (!me || me.downed || me.dash) {
			this.plan = null;
			return IDLE;
		}

		const partner = this.world.players.find((p) => p !== me && !p.downed) ?? null;
		const enemies = this.world.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
		const target = this.pickTarget(me, partner, enemies);
		const intent: Intent = { ...IDLE };

		if (enemies.length > 0 && !me.flying) intent.toggleFly = true;
		this.move(me, partner, enemies, target, intent);
		if (target) {
			// Put the crosshair on the enemy's drawn body (the game adds ring height back on)
			const [ax, ay] = aimPoint(target, me.ringLift);
			intent.pointer = { x: ax, y: ay - me.ringLift };
			intent.shot = true;
		}
		this.defend(me, partner, enemies, intent);
		if (target && me.surge >= 100 && this.signatureRest === 0 && this.worthASignature(me, partner, enemies)) {
			intent.signature = true;
			this.signatureRest = 30;
		}
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
		const nearest = enemies.reduce<Enemy | null>((best, e) => (!best || dist(e, me) < dist(best, me) ? e : best), null);
		if (!target && nearest) {
			// Enemies about, but none close: go and find them
			gx = nearest.x;
			gy = nearest.y;
		} else if (!target) {
			// Close enough already: hold still (two AI partners would otherwise chase each other's spot)
			if (partner && dist(me, partner) > 200) {
				const side = me.x < partner.x ? -1 : 1;
				gx = partner.x + side * 120;
				gy = partner.y;
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

	/** Save the signature for a big moment: surrounded, or when someone's in trouble. */
	private worthASignature(me: Player, partner: Player | null, enemies: Enemy[]): boolean {
		const near = enemies.filter((e) => dist(e, me) < 360).length;
		const hurt = me.health < 60 || (partner !== null && partner.health < 60);
		return near >= 3 || (near >= 2 && hurt);
	}

	/**
	 * Bubble shield on myself or my partner: against a big attack winding up
	 * (slam, roar, chain) at any health, or anything at all once hurt.
	 */
	private defend(me: Player, partner: Player | null, enemies: Enemy[], intent: Intent) {
		if (me.shieldCooldown > 0 || me.exhausted || me.willpower < BUBBLE_SHIELD.cost) return;
		const shields = this.world.constructs.shields;
		const winding = (p: Player, big: boolean) =>
			enemies.some(
				(e) =>
					e.brain.target === p &&
					e.brain.state === 'windup' &&
					dist(e, p) < 380 &&
					(!big || e.brain.ability === 'slam' || e.brain.ability === 'roar' || e.brain.ability === 'chain')
			);
		// A big attack coming: react about half the time (people don't always see it either)
		const bigComing = (p: Player) => {
			if (!winding(p, true) || this.shieldRoll > 0 || this.shieldRest > 0) return false;
			this.shieldRoll = 1;
			return Math.random() < 0.45;
		};
		const needs = (p: Player, hurtBelow: number) =>
			!shields.some((s) => s.target === p) && ((p.health < hurtBelow && winding(p, false)) || bigComing(p));

		if (needs(me, 40)) {
			intent.shield = true;
			this.shieldRest = 12;
			return;
		}
		if (partner && dist(partner, me) < BUBBLE_SHIELD.range * 0.9 && needs(partner, 40)) {
			me.lock = { kind: 'ally', player: partner };
			this.lockedPartner = true;
			intent.shield = true;
			this.shieldRest = 12;
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

		// Everything that makes sense right now, best first
		const options: { id: string; plan: Plan; closeIn?: boolean }[] = [];
		const add = (id: string, plan: Plan, closeIn = false) => {
			if (ready(id)) options.push({ id, plan, closeIn });
		};
		const near = (r: number) => enemies.filter((e) => dist(e, me) < r).length;
		if (me.def.id === 'hal') {
			if (d < 90) add('sword', press('sword'), true);
			if (d < 110 && clustered) add('hammer', press('hammer'), true);
			if (d < 120 && clustered) add('fist', press('fist'), true);
			if (d < 200 && near(220) >= 2) add('shotgun', press('shotgun'), true);
			// Burn straight through a target that's lined up and not too far
			if (d > 110 && d < 250 && Math.random() < 0.3) add('afterburner', press('afterburner'));
			if (d > 150 && d < 520 && enemies.length >= 2) add('rockets', press('rockets'));
			if (d > 100 && d < 320) add('buzzsaw', press('buzzsaw'));
			if (d > 170 && d < 340 && ENEMY_IS_RANGED(target)) add('chain', press('chain'), true);
			if (d < 440 && me.willpower > 40) {
				const gun = Math.random() < 0.5 ? 'minigun' : 'beam';
				add(gun, hold(gun, 0.9));
			}
		} else {
			const turrets = this.world.constructs.turrets.filter((t) => t.owner === me).length;
			const rushing = enemies.some((e) => e.brain.target === me && dist(e, me) < 160 && e.brain.engaged);
			const partner = this.world.players.find((o) => o !== me && !o.downed) ?? null;
			const hurt = me.health < 60 || (partner !== null && partner.health < 60);
			const aidUp = this.world.constructs.aids.some((a) => a.owner === me);
			if (hurt && !aidUp) add('aid', press('aid'));
			if (rushing && Math.random() < 0.5) add('wall', press('wall'));
			if (near(150) >= 2) add('shockwave', press('shockwave'));
			if (rushing) add('mines', press('mines'));
			if (rushing && Math.random() < 0.4) add('cage', press('cage'));
			if (turrets < 1 && enemies.length >= 2) add('turret', press('turret'));
			if (d < 320 && clustered) add('pillars', press('pillars'));
			if (d > 150 && d < 500 && clustered) add('cannon', press('cannon'));
			if (d > 140) add('sniper', hold('sniper', 1));
			if (d < 400 && me.willpower > 45) add('beam', hold('beam', 1));
		}

		this.closeIn = false;
		if (options.length === 0) return;
		const pick = options[0];
		this.plan = pick.plan;
		if (pick.closeIn) this.closeIn = true;
		this.runPlan(intent);
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
