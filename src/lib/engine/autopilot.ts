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
import { isStanding } from './dummy';

/** Enemies closer than this are worth fighting before moving on. */
const ENGAGE_RANGE = 520;
/** Close enough to the goal. */
const ARRIVED = 30;
/** How close a cell has to be to start breaking it open. */
const BREAK_RANGE = 260;

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
		if (goal && (!fighting || game.director?.goalFirst)) {
			const d = dist(goal, me);
			if (d > ARRIVED) {
				const k = Math.min(1, d / 80) / d;
				intent.moveX = (goal.x - me.x) * k;
				intent.moveY = (goal.y - me.y) * k;
			}
		}

		// Nothing to fight: break open whatever the mission needs broken (a prison cell)
		if (!fighting) {
			const cell = game.map.obstacles.find((o) => o.kind === 'cell' && o.hp !== undefined && dist({ x: o.x + o.w / 2, y: o.y + o.h / 2 }, me) < BREAK_RANGE);
			if (cell) {
				intent.pointer = { x: cell.x + cell.w / 2, y: cell.y + cell.h / 2 - me.ringLift };
				intent.shot = true;
				intent.moveX = intent.moveY = 0;
			}
		}

		// A broken Manhunter's core: smash it before it rebuilds, whatever else is going on
		// (the one furthest along, if there are several)
		const core = game.dummies.filter((d) => d.kind === 'manhunterCore' && isStanding(d)).sort((a, b) => (b.rebuild ?? 0) - (a.rebuild ?? 0))[0];
		if (core) {
			intent.pointer = { x: core.x, y: core.y - 20 - me.ringLift };
			intent.shot = true;
			const d = dist(core, me);
			if (d > 150) {
				intent.moveX = (core.x - me.x) / d;
				intent.moveY = (core.y - me.y) / d;
			}
		}

		// Something the mission wants torn down (a signal spire): shoot it whenever nobody's in the way
		const spire = game.dummies.filter((d) => (d.kind === 'signalSpire' || d.kind === 'rageBubble' || d.kind === 'bloodConduit') && isStanding(d)).sort((a, b) => dist(a, me) - dist(b, me))[0];
		if (spire && !core && !game.enemies.some((e) => isStanding(e) && dist(e, me) < 260)) {
			intent.pointer = { x: spire.x, y: spire.y - 90 - me.ringLift };
			intent.shot = true;
			const d = dist(spire, me);
			if (d > 320) {
				intent.moveX = (spire.x - me.x) / d;
				intent.moveY = (spire.y - me.y) / d;
			}
		}

		// Whatever you're protecting (a ship, colonists) gets the bubble when it's in danger
		const guard = game.constructs.protectables.some((t) => t.threat > 1 && dist(t, me) < BUBBLE_SHIELD.range + t.radius);
		if (guard && me.shieldCooldown === 0) intent.shield = true;
		return intent;
	}
}
