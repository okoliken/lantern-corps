// Autopilot: the computer plays your Lantern through a mission, for
// recording gameplay footage (dev only, from the console: lc.autopilot()).
//
// It fights like an AI partner (moving, ring shots, the smart ring, shields),
// and when nothing's close it heads for the mission's next goal, the same
// spot the on-screen arrow points to. It shields whatever the mission has
// you protecting when that's under fire.

import { AllyInput } from './ally';
import type { Game } from './game';
import type { InputSource, Intent } from './input';
import type { Player } from './player';
import { BUBBLE_SHIELD } from './constructs/defs';

/** Enemies closer than this are worth fighting before moving on. */
const ENGAGE_RANGE = 520;
/** Close enough to the goal. */
const ARRIVED = 30;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class Autopilot implements InputSource {
	private brain: AllyInput;

	constructor(
		private game: Game,
		private me: Player
	) {
		this.brain = new AllyInput(game);
		this.brain.me = me;
	}

	read(): Intent {
		const me = this.me;
		const intent = this.brain.read();
		if (me.downed) return intent;
		const game = this.game;

		// Nothing to fight nearby: go where the mission wants you
		const goal = game.director?.goal?.();
		const fighting = game.enemies.some((e) => dist(e, me) < ENGAGE_RANGE);
		if (goal && !fighting) {
			const d = dist(goal, me);
			if (d > ARRIVED) {
				const k = Math.min(1, d / 80) / d;
				intent.moveX = (goal.x - me.x) * k;
				intent.moveY = (goal.y - me.y) * k;
			}
		}

		// Whatever you're protecting (a ship, colonists) gets the bubble when it's in danger
		const guard = game.constructs.protectables.some((t) => t.threat > 1 && dist(t, me) < BUBBLE_SHIELD.range + t.radius);
		if (guard && me.shieldCooldown === 0) intent.shield = true;
		return intent;
	}
}
