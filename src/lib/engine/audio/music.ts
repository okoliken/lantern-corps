// The music: a small sequencer playing synthesized loops in time, scheduled
// a moment ahead on the audio clock so it never drifts. Three moods:
//
//   battle   a heroic loop in D minor (Dm, Bb, F, C) at 112 bpm
//   boss     a heavier, faster one in C minor (Cm, Ab, Fm, G) at 132 bpm
//   calm     just the chords, softly (nothing to fight right now)
//   quiet    nothing (paused, or a scene is playing)
//
// A change of mood waits for the next bar, so it never cuts off mid-phrase.

import type { Synth } from './synth';

export type Mood = 'battle' | 'boss' | 'calm' | 'quiet';

interface Style {
	bpm: number;
	/** Each bar's chord: the root (a MIDI note) and whether it's minor. */
	chords: [number, boolean][];
	kicks: number[];
	snares: number[];
	bass: number[];
	/** Play an arpeggio note every this many steps. */
	arpEvery: number;
}

const STYLES: Record<'battle' | 'boss', Style> = {
	battle: {
		bpm: 112,
		chords: [
			[50, true],
			[46, false],
			[53, false],
			[48, false]
		],
		kicks: [0, 8, 10],
		snares: [4, 12],
		bass: [0, 3, 6, 8, 11, 14],
		arpEvery: 2
	},
	boss: {
		bpm: 132,
		chords: [
			[48, true],
			[44, false],
			[41, true],
			[43, false]
		],
		kicks: [0, 3, 6, 8, 11, 14],
		snares: [4, 12],
		bass: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
		arpEvery: 1
	}
};

const STEPS = 16;
/** How far ahead to schedule (seconds). */
const AHEAD = 0.15;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Music {
	private mood: Mood = 'quiet';
	private wanted: Mood = 'quiet';
	private style: Style = STYLES.battle;
	private step = 0;
	private bar = 0;
	private nextAt = 0;

	constructor(private synth: Synth) {}

	/** What to play; takes effect at the next bar (straight away from silence). */
	setMood(mood: Mood) {
		this.wanted = mood;
		if (this.mood === 'quiet' && mood !== 'quiet') this.switchNow();
	}

	/** Call every frame: schedules whatever falls due in the next moment. */
	tick() {
		const ctx = this.synth.ctx;
		const bus = this.synth.musicBus;
		if (!ctx || !bus || ctx.state !== 'running') return;
		if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + 0.05;
		while (this.nextAt < ctx.currentTime + AHEAD) {
			if (this.step === 0 && this.wanted !== this.mood) this.switchNow();
			if (this.mood !== 'quiet') this.playStep(this.nextAt, bus);
			const stepDur = 60 / this.style.bpm / 4;
			this.nextAt += stepDur;
			this.step = (this.step + 1) % STEPS;
			if (this.step === 0) this.bar = (this.bar + 1) % this.style.chords.length;
		}
	}

	private switchNow() {
		this.mood = this.wanted;
		if (this.mood === 'battle' || this.mood === 'boss') this.style = STYLES[this.mood];
		this.step = 0;
		this.bar = 0;
	}

	private playStep(t: number, bus: AudioNode) {
		const s = this.synth;
		const style = this.style;
		const stepDur = 60 / style.bpm / 4;
		const [root, minor] = style.chords[this.bar];
		const tones = [0, minor ? 3 : 4, 7];
		const step = this.step;
		// The chords, held for the bar
		if (step === 0) for (const tn of tones) s.tone(t, 'triangle', hz(root + 12 + tn), hz(root + 12 + tn), stepDur * STEPS * 0.95, this.mood === 'calm' ? 0.05 : 0.035, 0.25, bus);
		if (this.mood === 'calm') return;
		// Drums
		if (style.kicks.includes(step)) s.tone(t, 'sine', 150, 42, 0.2, 0.5, 0.003, bus);
		if (style.snares.includes(step)) s.noise(t, 'bandpass', 1800, 1200, 0.14, 0.22, 0.8, bus);
		if (step % 4 === 2) s.noise(t, 'highpass', 7000, 7000, 0.03, 0.07, 1, bus);
		// Bass
		if (style.bass.includes(step)) s.tone(t, 'triangle', hz(root - 12), hz(root - 12), stepDur * 1.7, 0.16, 0.005, bus);
		// Arpeggio over the chord
		if (step % style.arpEvery === 0) {
			const n = tones[(step / style.arpEvery) % tones.length] + (step >= 8 ? 12 : 0);
			s.tone(t, 'square', hz(root + 24 + n), hz(root + 24 + n), stepDur * 0.8, 0.018, 0.004, bus);
		}
	}
}

/** Which enemies make it boss music. */
export const BOSS_KINDS: ReadonlySet<string> = new Set(['atrocitus', 'manhunterPrime', 'razer', 'grodd', 'reverseFlash', 'dexStarr', 'bleez']);
