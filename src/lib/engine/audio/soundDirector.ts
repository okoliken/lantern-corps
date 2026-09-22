// What the game sounds like: watches the world each frame and says which
// sounds to play. It doesn't change the game, and it doesn't know about
// audio: it hands sound names to a `play` function (the Synth, or a test's
// list). New things are spotted by keeping a note of what's been heard.
//
//   ring shots and constructs    the first Lantern loudest, partners quieter
//   hits, blows, explosions      from the effects the game already draws
//   shields, signatures          when one goes up
//   hurt, down                   your Lantern
//   enemies beaten               each one that falls
//   radio                        each new line
//   win, lose                    once

import { isStanding } from '../dummy';
import { isEnemy } from '../enemies/enemies';
import type { Game } from '../game';
import { heroFx } from '../heroes';
import type { SoundName } from './synth';

export type Play = (name: SoundName, volume?: number) => void;

/** What each kind of drawn effect sounds like (and how loud). */
const EFFECT_SOUNDS: Partial<Record<string, [SoundName, number]>> = {
	impact: ['hit', 0.7],
	slash: ['hit', 0.8],
	swordArc: ['hit', 0.8],
	scythe: ['hit', 0.7],
	claw: ['hit', 0.7],
	redAxe: ['hit', 0.8],
	fist: ['heavy', 0.8],
	hammer: ['heavy', 0.9],
	bigHammer: ['heavy', 1],
	hammerDrop: ['heavy', 1],
	redMace: ['heavy', 0.8],
	pillars: ['heavy', 0.9],
	shockwave: ['heavy', 0.9],
	redBlast: ['heavy', 0.9],
	spikeBurst: ['heavy', 0.7],
	blast: ['boom', 0.6],
	redImpact: ['boom', 0.6],
	pulse: ['boom', 0.8],
	snap: ['chime', 0.6],
	pop: ['pop', 0.8],
	fizzle: ['pop', 0.4],
	roar: ['spawn', 0.8],
	slamMark: ['alert', 0.5]
};

/** The heroes' powers (the Flash's lightning, Superman's heat vision, a Batwing bomb). */
const HERO_SOUNDS: Partial<Record<string, [SoundName, number]>> = {
	bolt: ['shot', 0.7],
	heat: ['shot', 0.5],
	zip: ['shot', 0.4],
	boom: ['boom', 1],
	quake: ['heavy', 1],
	thunder: ['heavy', 1],
	nova: ['heavy', 1],
	tornado: ['construct', 0.6],
	frost: ['construct', 0.6],
	lasso: ['construct', 0.5],
	mace: ['hit', 0.8],
	cut: ['hit', 0.8],
	chakram: ['hit', 0.6]
};

export class SoundDirector {
	private heard = new WeakSet<object>();
	private cooling = new WeakMap<object, number[]>();
	private health = -1;
	private wasDown = false;
	private dashing = false;
	private standing = -1;
	private lastLine = '';
	private lastState = '';

	constructor(private play: Play) {}

	/** One frame: whatever is new since the last one makes its sound. */
	observe(game: Game) {
		const cw = game.constructs;
		for (const e of cw.effects) {
			if (this.heard.has(e)) continue;
			this.heard.add(e);
			if (e.kind === 'callout') {
				if (e.hurt) this.play('alert', 0.6);
				continue;
			}
			const sound = EFFECT_SOUNDS[e.kind];
			if (sound) this.play(sound[0], sound[1]);
		}
		for (const f of heroFx(cw)) {
			if (this.heard.has(f) || f.age < 0) continue;
			this.heard.add(f);
			const sound = HERO_SOUNDS[f.kind];
			if (sound) this.play(sound[0], sound[1]);
		}

		// Ring shots and thrown constructs (yours loudest)
		const me = game.players[0];
		for (const p of cw.projectiles) {
			if (this.heard.has(p)) continue;
			this.heard.add(p);
			const mine = p.owner === me ? 1 : 0.45;
			this.play(p.kind === 'bolt' || p.kind === 'bullet' ? 'shot' : 'construct', mine);
		}
		for (const s of cw.red.shots) {
			if (this.heard.has(s)) continue;
			this.heard.add(s);
			this.play('enemyShot', 0.6);
		}
		for (const s of cw.shields) {
			if (this.heard.has(s)) continue;
			this.heard.add(s);
			this.play('shield', s.owner === me ? 1 : 0.5);
		}
		for (const f of cw.fortresses) {
			if (this.heard.has(f)) continue;
			this.heard.add(f);
			this.play('signature', 1);
		}

		// Constructs made: a slot's cooldown starting
		for (const p of game.players) {
			if (p.hero) continue;
			const before = this.cooling.get(p);
			const now = p.cooldowns.slice();
			if (before) {
				for (let i = 0; i < now.length; i++) {
					if (before[i] === 0 && now[i] > 0.3) {
						this.play('construct', p === me ? 1 : 0.4);
						break;
					}
				}
			}
			this.cooling.set(p, now);
		}

		if (me) {
			if (me.dash && !this.dashing) this.play('signature', 1);
			this.dashing = !!me.dash;
			if (this.health >= 0 && me.health < this.health - 0.5 && !me.downed) this.play('hurt', 1);
			if (me.downed && !this.wasDown) this.play('down', 1);
			this.health = me.health;
			this.wasDown = me.downed;
		}

		// Enemies beaten
		let standing = 0;
		for (const d of game.dummies) if (isEnemy(d) && isStanding(d)) standing++;
		if (this.standing >= 0 && standing < this.standing) this.play('enemyDown', Math.min(1, 0.6 + (this.standing - standing) * 0.2));
		this.standing = standing;

		// The radio, and how it ends
		const director = game.director as { line?: { who: string; text: string } | null; state?: string } | null;
		const line = director?.line ? `${director.line.who}:${director.line.text}` : '';
		if (line && line !== this.lastLine) this.play('radio', 1);
		this.lastLine = line;
		const state = director?.state ?? '';
		if (state !== this.lastState) {
			if (state === 'won') this.play('win', 1);
			if (state === 'lost') this.play('lose', 1);
			this.lastState = state;
		}
	}
}
