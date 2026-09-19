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

import { pickConstruct } from './constructs/smart';
import { BUBBLE_SHIELD } from './constructs/defs';
import type { ConstructWorld } from './constructs/system';
import { aimPoint, isStanding, type Dummy } from './dummy';
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
/** Seconds before a partner will put up another shield after raising one. */
const SHIELD_REST = 5;

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
			// The surge bar is the real limit; this just stops it firing the moment it refills
			this.signatureRest = 6;
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
			// Hal darts in and out, Kilowog brawls up close, John keeps his distance
			const range = me.def.id === 'hal' ? (this.closeIn ? 55 : 200) : me.def.id === 'kilowog' ? 90 : 300;
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
		// A big attack coming: react most of the time (not always: people miss things too)
		const bigComing = (p: Player) => {
			if (!winding(p, true) || this.shieldRoll > 0 || this.shieldRest > 0) return false;
			this.shieldRoll = 0.6;
			return Math.random() < 0.85;
		};
		// Any attack coming once a bit hurt, or under a lot of pressure at once
		const pressed = (p: Player) => enemies.filter((e) => e.brain.target === p && e.brain.state === 'windup' && dist(e, p) < 380).length;
		const needs = (p: Player, hurtBelow: number) =>
			!shields.some((s) => s.target === p) && ((p.health < hurtBelow && winding(p, false)) || pressed(p) >= 2 || bigComing(p));

		if (needs(me, me.maxHealth * 0.6)) {
			intent.shield = true;
			this.shieldRest = SHIELD_REST;
			return;
		}
		if (partner && dist(partner, me) < BUBBLE_SHIELD.range * 0.9 && needs(partner, partner.maxHealth * 0.6)) {
			me.lock = { kind: 'ally', player: partner };
			this.lockedPartner = true;
			intent.shield = true;
			this.shieldRest = SHIELD_REST;
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

		// The smart ring picks, for every partner; a little willpower is kept in reserve so they're never left exhausted
		this.closeIn = false;
		const smart = me.willpower > 30 ? pickConstruct(me, this.world.constructs) : null;
		if (!smart) return;
		const def = me.loadout[smart.slot];
		// Hal goes in close for his melee constructs
		this.closeIn = me.def.id === 'hal' && (def.behavior === 'slash' || def.behavior === 'smash' || def.behavior === 'grind');
		this.plan = { slot: smart.slot, hold: smart.hold, selected: false };
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
