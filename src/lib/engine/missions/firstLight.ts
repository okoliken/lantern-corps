// Season two, Act 2, mission 8: First Light of Fear. Hal, alone.
//
// Sinestro comes back to Vesk, the colony where Hal first doubted him, wearing
// yellow. A duel, and the story says Hal loses it: the point is how well.
//
//   duel     two minutes against Sinestro with the yellow ring. The ring
//            shields him (he can't be brought below a third of his strength)
//            and every moment near him fills your dread. Hurt him as much as
//            you can, and stay on your feet.
//   defeat   when the time is up, or if Hal goes down, Sinestro wins. He
//            leaves Hal alive, on purpose, to tell the Guardians.
//
// It can't be failed: losing this fight is the story. The stars are for how
// much of a fight Hal put up.

import { addDread } from '../dread';
import { isStanding } from '../dummy';
import type { Enemy } from '../enemies/enemies';
import type { Drawable, Game } from '../game';
import type { GameMap } from '../map';
import { buildHardOrderMap } from './hardOrder';
import { Comms, type CommsLine, type MissionDirector, type MissionMeter, type MissionState, type MissionStat } from './mission';

export type FirstLightPhase = 'duel' | 'defeat';

const INTRO_TIME = 3;
/** How long Hal has to hold out. */
export const DUEL_TIME = 120;
/** Sinestro: the yellow ring keeps him above this share of his health. */
export const FLOOR = 0.35;
const SINESTRO_HEALTH = 6;
const SINESTRO_MIGHT = 2.6;
/** On top of the fear every yellow construct brings: dread a second within this range of him. */
const PRESENCE = { range: 620, dread: 0.03 };
const DEFEAT_TIME = 9;
/** Damage dealt (as a share of his health) for the second star. */
const GOOD_FIGHT = 0.4;

export function buildFirstLightMap(): GameMap {
	return { ...buildHardOrderMap(), name: 'Vesk, a year later' };
}

export class FirstLight implements MissionDirector {
	state: MissionState = 'intro';
	phase: FirstLightPhase = 'duel';
	timer = INTRO_TIME;
	lives = 1;
	elapsed = 0;
	/** Seconds left in the duel. */
	left = DUEL_TIME;
	/** Hal went down before the time was up. */
	fell = false;
	/** The most of his health Hal took off him (0..1). */
	dealt = 0;
	readonly comms = new Comms();
	readonly starHint = '★ done · ★ 40% of his strength taken off him · ★ still standing at the end';
	sinestro: Enemy | null = null;
	private defeatLeft = DEFEAT_TIME;
	private said = new Set<string>();

	// ------------------------------------------------------------ reporting

	get objective(): string {
		if (this.phase === 'defeat') return 'Sinestro';
		return 'Hold out against Sinestro';
	}

	get line(): CommsLine | null {
		return this.comms.current;
	}

	meters(): MissionMeter[] {
		const list: MissionMeter[] = [];
		if (this.phase === 'duel') {
			const s = Math.ceil(this.left);
			list.push({ label: 'Hold', value: 1 - this.left / DUEL_TIME, text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` });
		}
		const e = this.sinestro;
		if (e) list.push({ label: 'Sinestro', value: Math.max(0, e.hp) / e.maxHp, text: `${Math.round((Math.max(0, e.hp) / e.maxHp) * 100)}%` });
		return list;
	}

	warning(game: Game): string | null {
		if (this.state !== 'playing' || this.phase !== 'duel') return null;
		const e = this.sinestro;
		if (e && e.hp <= e.maxHp * FLOOR + 1) return 'The yellow ring is shielding him!';
		if (game.players[0].dread > 0.8) return 'Fear is taking over! Shield up!';
		return null;
	}

	get stars(): number {
		if (this.state !== 'won') return 0;
		return 1 + (this.dealt >= GOOD_FIGHT ? 1 : 0) + (this.fell ? 0 : 1);
	}

	get resultText(): string {
		return this.fell
			? 'Sinestro left Hal in the ashes of Vesk, alive on purpose, to carry the news to Oa.'
			: 'Hal was still standing when Sinestro stopped fighting. It did not matter. He left anyway, to carry the news to Oa.';
	}

	stats(): MissionStat[] {
		return [
			{ label: 'Sinestro hurt', value: `${Math.round(this.dealt * 100)}%` },
			{ label: 'Held out', value: `${Math.round(DUEL_TIME - Math.max(0, this.left))}s of ${DUEL_TIME}s` },
			{ label: 'Still standing', value: this.fell ? 'No' : 'Yes' }
		];
	}

	// ---------------------------------------------------------------- rules

	update(game: Game, dt: number) {
		this.comms.update(dt);
		const hal = game.players[0];

		switch (this.state) {
			case 'intro':
				this.timer -= dt;
				if (this.timer <= 0) {
					this.state = 'playing';
					const e = game.spawnEnemy('sinestroYellow', hal.x + 650, hal.y);
					e.brain.might = SINESTRO_MIGHT;
					e.brain.alert = 10;
					e.hp = e.maxHp = e.brain.lastHp = Math.round(e.maxHp * SINESTRO_HEALTH);
					this.sinestro = e;
					this.comms.scene([
						['Hal', 'Vesk. You came back here.'],
						['Sinestro', 'This is where you first looked at me the way the Guardians do, Jordan. It seemed fitting.'],
						['Hal', 'Yellow. You took a ring from Qward.'],
						['Sinestro', 'I took the truth. Will is a fine thing. Fear is better. Let me show you.']
					]);
				}
				return;
			case 'won':
			case 'lost':
				this.timer += dt;
				return;
		}

		this.elapsed += dt;
		const e = this.sinestro;
		if (!e) return;

		switch (this.phase) {
			case 'duel': {
				this.left -= dt;
				// The ring won't let him fall
				if (e.hp < e.maxHp * FLOOR) e.hp = e.maxHp * FLOOR;
				if (!isStanding(e)) {
					e.hp = e.maxHp * FLOOR;
					e.down = 0;
				}
				this.dealt = Math.max(this.dealt, 1 - e.hp / e.maxHp);
				// His presence alone
				if (!hal.downed && Math.hypot(hal.x - e.x, hal.y - e.y) < PRESENCE.range) addDread(hal, PRESENCE.dread * dt);
				if (this.dealt >= 0.3) this.once('hurt', 'Sinestro', 'Good. GOOD. I taught you well. It will not be enough.');
				if (e.hp <= e.maxHp * FLOOR + 1) this.once('floor', 'Hal', "I'm hitting him with everything... the ring just keeps him standing!");
				if (this.left < 60) this.once('half', 'Sinestro', 'Do you feel it, Jordan? That is not weakness. That is the truth, at last.');
				if (hal.downed) {
					this.fell = true;
					this.startDefeat(game);
				} else if (this.left <= 0) this.startDefeat(game);
				break;
			}
			case 'defeat':
				this.defeatLeft -= dt;
				e.vx = e.vy = 0;
				if (hal.downed) hal.downTimer = Math.max(hal.downTimer, 2);
				if (this.defeatLeft <= 0) this.end(game);
				break;
		}
	}

	private startDefeat(game: Game) {
		this.phase = 'defeat';
		this.defeatLeft = DEFEAT_TIME;
		game.freezeEnemies = true;
		const hal = game.players[0];
		hal.dread = 1;
		this.comms.scene(
			this.fell
				? [
						['Sinestro', 'Stay down. I am not going to kill you, Jordan. I need someone to tell the Guardians.'],
						['Sinestro', 'Tell them the yellow light has come. Tell them there will be more of us.'],
						['Hal', '...Sinestro...']
					]
				: [
						['Sinestro', 'Enough. You are still standing. I respect that, truly.'],
						['Sinestro', 'Go home and tell the Guardians the yellow light has come. Tell them there will be more of us.'],
						['Hal', "I'll stop you. Whatever it takes."]
					]
		);
	}

	private end(game: Game) {
		this.state = 'won';
		this.timer = 0;
		game.freezeEnemies = false;
		const e = this.sinestro;
		if (e) {
			// He's gone: away into the sky
			e.hp = 0;
			e.down = 1;
		}
		const hal = game.players[0];
		hal.dread = 0;
		this.comms.say('Hal', 'Guardians. This is Jordan. Sinestro has a yellow ring... and he is building an army.', true);
	}

	private once(id: string, who: string, text: string) {
		if (this.said.has(id)) return;
		this.said.add(id);
		this.comms.say(who, text, true);
	}

	// -------------------------------------------------------------- drawing

	cameraPoints(): [number, number][] {
		const e = this.sinestro;
		return e && isStanding(e) ? [[e.x, e.y - 60]] : [];
	}

	goal(): { x: number; y: number } | null {
		return null;
	}

	drawables(): Drawable[] {
		return [];
	}
}
