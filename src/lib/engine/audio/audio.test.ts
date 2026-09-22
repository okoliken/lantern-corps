import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { hitDummyWithFx } from '../constructs/system';
import { Music } from './music';
import { SoundDirector } from './soundDirector';
import type { SoundName, Synth } from './synth';

function setup() {
	const game = new Game({ players: [{ lantern: 'hal', keys: 'solo' }] });
	game.setView({ width: 1400, height: 800 });
	game.dummies.length = 0;
	const heard: SoundName[] = [];
	const sounds = new SoundDirector((name) => heard.push(name));
	const frame = () => {
		game.update(1 / 60);
		sounds.observe(game);
	};
	frame();
	heard.length = 0;
	return { game, heard, sounds, frame };
}

describe('the sound director', () => {
	it('a hit on your Lantern sounds hurt, and going down sounds down', () => {
		const { game, heard, frame } = setup();
		const me = game.players[0];
		me.health -= 20;
		frame();
		expect(heard).toContain('hurt');
		me.health = 0;
		me.downed = true;
		me.downTimer = 5;
		frame();
		expect(heard).toContain('down');
	});

	it('an enemy beaten, an explosion, a new radio line and a win each make their sound', () => {
		const { game, heard, frame, sounds } = setup();
		const e = game.spawnEnemy('rageGrunt', 900, 900);
		frame();
		expect(heard).toContain('spawn');
		hitDummyWithFx(game.constructs, e, e.hp + 10, 0, 800, 900, game.players[0]);
		for (let i = 0; i < 3; i++) frame();
		expect(heard).toContain('enemyDown');
		game.constructs.effects.push({ kind: 'blast', x: 0, y: 0, age: 0, life: 1 });
		frame();
		expect(heard).toContain('boom');
		const director = { line: { who: 'Hal', text: 'Hi' }, state: 'playing' };
		(game as unknown as { director: unknown }).director = director;
		sounds.observe(game);
		expect(heard).toContain('radio');
		director.state = 'won';
		sounds.observe(game);
		expect(heard).toContain('win');
	});

	it('each thing sounds once, not every frame', () => {
		const { game, heard, frame } = setup();
		game.constructs.effects.push({ kind: 'impact', x: 0, y: 0, age: 0, life: 1 });
		frame();
		frame();
		frame();
		expect(heard.filter((s) => s === 'hit').length).toBe(1);
	});
});

describe('the music', () => {
	/** A pretend synth: an audio clock we move by hand, and a count of every note. */
	function fakeSynth() {
		const notes: string[] = [];
		const ctx = { currentTime: 0, state: 'running' };
		const synth = {
			ctx,
			musicBus: {},
			tone: (_t: number, type: string) => notes.push(type),
			noise: () => notes.push('noise')
		} as unknown as Synth;
		return { synth, ctx, notes };
	}

	it('stays silent until it has a mood, then plays in time', () => {
		const { synth, ctx, notes } = fakeSynth();
		const music = new Music(synth);
		for (let t = 0; t < 2; t += 0.05) {
			ctx.currentTime = t;
			music.tick();
		}
		expect(notes.length).toBe(0);
		music.setMood('battle');
		for (let t = 2; t < 6; t += 0.05) {
			ctx.currentTime = t;
			music.tick();
		}
		// Drums, bass, arpeggio and chords over a couple of bars
		expect(notes.filter((n) => n === 'noise').length).toBeGreaterThan(4);
		expect(notes.filter((n) => n === 'square').length).toBeGreaterThan(8);
		expect(notes.filter((n) => n === 'triangle').length).toBeGreaterThan(8);
	});

	it('boss music is busier than battle music', () => {
		const count = (mood: 'battle' | 'boss') => {
			const { synth, ctx, notes } = fakeSynth();
			const music = new Music(synth);
			music.setMood(mood);
			for (let t = 0; t < 8; t += 0.05) {
				ctx.currentTime = t;
				music.tick();
			}
			return notes.length;
		};
		expect(count('boss')).toBeGreaterThan(count('battle'));
	});

	it('going quiet waits for the end of the bar, then stops', () => {
		const { synth, ctx, notes } = fakeSynth();
		const music = new Music(synth);
		music.setMood('battle');
		for (let t = 0; t < 1; t += 0.05) {
			ctx.currentTime = t;
			music.tick();
		}
		music.setMood('quiet');
		for (let t = 1; t < 4; t += 0.05) {
			ctx.currentTime = t;
			music.tick();
		}
		const after = notes.length;
		for (let t = 4; t < 8; t += 0.05) {
			ctx.currentTime = t;
			music.tick();
		}
		expect(notes.length).toBe(after);
	});
});
