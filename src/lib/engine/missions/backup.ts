// Calling for backup: a solo Lantern presses B and a partner flies in to
// fight beside them for a while, then has to leave. A mission decides who
// comes, how many times, and for how long; this runs the arrivals and exits.

import type { Game } from '../game';
import { IDLE } from '../input';
import { LANTERNS, type CrewId } from '../lanterns';
import type { Player } from '../player';
import type { Comms } from './mission';

export interface BackupLines {
	/** Said when they arrive. */
	arrive: string[];
	/** Said as they leave. */
	leave: string[];
}

/** Seconds the partner takes to fly off before they're gone. */
const LEAVE_TIME = 2;
/** How far away they fly in from. */
const ARRIVE_FROM = 650;

export class Backup {
	partner: Player | null = null;
	usesLeft: number;
	/** Seconds left before they have to go. */
	timeLeft = 0;
	private leaving = 0;

	constructor(
		readonly who: CrewId,
		uses: number,
		/** Seconds they stay. */
		readonly duration: number,
		private readonly comms: Comms,
		private readonly lines: BackupLines
	) {
		this.usesLeft = uses;
	}

	get name(): string {
		return LANTERNS[this.who].name.split(' ')[0];
	}

	/** Can they be called right now? */
	get ready(): boolean {
		return !this.partner && this.usesLeft > 0;
	}

	/** The caller pressed Call for backup. */
	call(game: Game, caller: Player) {
		if (!this.ready) return;
		this.usesLeft--;
		// Flying in from off to one side, toward the caller
		const side = caller.x > game.map.width / 2 ? -1 : 1;
		const x = Math.max(60, Math.min(game.map.width - 60, caller.x - side * ARRIVE_FROM));
		const y = Math.max(160, caller.y - 120);
		this.partner = game.addPartner(this.who, x, y);
		this.timeLeft = this.duration;
		this.leaving = 0;
		const n = this.lines.arrive.length;
		this.comms.say(this.name, this.lines.arrive[(this.usesLeft + n - 1) % n], true);
	}

	update(game: Game, dt: number) {
		const p = this.partner;
		if (!p) return;
		if (this.leaving === 0) {
			this.timeLeft -= dt;
			if (this.timeLeft <= 0) {
				this.leaving = dt;
				const n = this.lines.leave.length;
				this.comms.say(this.name, this.lines.leave[this.usesLeft % n], true);
				// Knocked down when their time's up: they're taken back to Oa to recover
				if (p.downed) {
					game.removePartner(p);
					this.partner = null;
					return;
				}
				// Off they go, up and away
				p.input = { read: () => ({ ...IDLE, moveX: p.x > game.map.width / 2 ? 1 : -1, moveY: -0.6 }) };
			}
			return;
		}
		this.leaving += dt;
		if (this.leaving >= LEAVE_TIME) {
			game.removePartner(p);
			this.partner = null;
		}
	}

	/** For the mission panel: "B: call Hal (2 left)" / "Hal: 34s". */
	status(key: string): string {
		if (this.partner) return this.leaving ? `${this.name} is heading out` : `${this.name} is here: ${Math.ceil(this.timeLeft)}s`;
		if (this.usesLeft <= 0) return `No more backup`;
		return `${key}: call ${this.name} for backup (${this.usesLeft} left)`;
	}
}
