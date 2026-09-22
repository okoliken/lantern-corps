// The game's sounds, made on the spot by the browser's audio engine: no
// sound files. Every effect is a short recipe of tones and noise with an
// envelope (an attack and a fade), so it fits a game drawn entirely in code.
//
// `Synth` owns the AudioContext (created on the first tap or key press:
// browsers won't play sound before one), a master compressor so a big fight
// doesn't clip, and separate volumes for effects and music.

export type SoundName =
	| 'shot'
	| 'enemyShot'
	| 'hit'
	| 'heavy'
	| 'construct'
	| 'boom'
	| 'chime'
	| 'pop'
	| 'shield'
	| 'hurt'
	| 'down'
	| 'enemyDown'
	| 'alert'
	| 'signature'
	| 'radio'
	| 'spawn'
	| 'win'
	| 'lose';

/** How often each sound may play (seconds): a hundred shots in a second is one buzz, not a hundred clicks. */
const COOLDOWN: Record<SoundName, number> = {
	shot: 0.06,
	enemyShot: 0.09,
	hit: 0.05,
	heavy: 0.1,
	construct: 0.12,
	boom: 0.12,
	chime: 0.15,
	pop: 0.1,
	shield: 0.25,
	hurt: 0.18,
	down: 1,
	enemyDown: 0.12,
	alert: 0.35,
	signature: 1,
	radio: 0.3,
	spawn: 0.25,
	win: 2,
	lose: 2
};

export class Synth {
	ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private sfxBus: GainNode | null = null;
	musicBus: GainNode | null = null;
	private noiseBuffer: AudioBuffer | null = null;
	private last = new Map<SoundName, number>();
	private sfxVolume = 0.8;
	private musicVolume = 0.5;

	/** Start the audio engine. Call from a tap or key press (browsers insist). Safe to call again. */
	unlock() {
		if (typeof window === 'undefined') return;
		if (!this.ctx) {
			const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Ctx) return;
			const ctx = new Ctx();
			const comp = ctx.createDynamicsCompressor();
			comp.threshold.value = -16;
			comp.ratio.value = 6;
			this.master = ctx.createGain();
			this.master.gain.value = 0.9;
			this.master.connect(comp);
			comp.connect(ctx.destination);
			this.sfxBus = ctx.createGain();
			this.musicBus = ctx.createGain();
			this.sfxBus.connect(this.master);
			this.musicBus.connect(this.master);
			// Half a second of white noise, reused by every noisy sound
			this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
			const data = this.noiseBuffer.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
			this.ctx = ctx;
			this.applyVolumes();
		}
		if (this.ctx.state === 'suspended') void this.ctx.resume();
	}

	setVolumes(sfx: number, music: number) {
		this.sfxVolume = sfx;
		this.musicVolume = music;
		this.applyVolumes();
	}

	private applyVolumes() {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this.sfxBus!.gain.setTargetAtTime(this.sfxVolume * this.sfxVolume, t, 0.05);
		this.musicBus!.gain.setTargetAtTime(this.musicVolume * this.musicVolume * 0.6, t, 0.05);
	}

	/** Play a sound (skipped if it played a moment ago, or there's no audio yet). `volume` 0..1 scales it. */
	play(name: SoundName, volume = 1) {
		const ctx = this.ctx;
		if (!ctx || ctx.state !== 'running' || this.sfxVolume <= 0) return;
		const now = ctx.currentTime;
		if (now - (this.last.get(name) ?? -1) < COOLDOWN[name]) return;
		this.last.set(name, now);
		RECIPES[name](this, now, volume);
	}

	// ---- building blocks ----

	/** A tone: oscillator `type` from `f0` to `f1` Hz over `dur` seconds, fading out. */
	tone(at: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, attack = 0.005, bus?: AudioNode) {
		const ctx = this.ctx!;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(f0, at);
		if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
		g.gain.setValueAtTime(0.0001, at);
		g.gain.exponentialRampToValueAtTime(gain, at + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		osc.connect(g);
		g.connect(bus ?? this.sfxBus!);
		osc.start(at);
		osc.stop(at + dur + 0.05);
	}

	/** Noise through a filter (`type` at `f0` Hz sweeping to `f1`), fading out over `dur`. */
	noise(at: number, type: BiquadFilterType, f0: number, f1: number, dur: number, gain: number, q = 1, bus?: AudioNode) {
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		src.buffer = this.noiseBuffer;
		src.loop = true;
		const filter = ctx.createBiquadFilter();
		filter.type = type;
		filter.Q.value = q;
		filter.frequency.setValueAtTime(f0, at);
		if (f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, at);
		g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
		g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		src.connect(filter);
		filter.connect(g);
		g.connect(bus ?? this.sfxBus!);
		src.start(at, Math.random() * 0.3);
		src.stop(at + dur + 0.05);
	}
}

/** A little pitch wobble, so the same sound twice isn't identical. */
const vary = (f: number) => f * (0.94 + Math.random() * 0.12);

type Recipe = (s: Synth, t: number, v: number) => void;

const RECIPES: Record<SoundName, Recipe> = {
	// A ring bolt: a bright chirp up, and a click
	shot: (s, t, v) => {
		s.tone(t, 'square', vary(620), vary(1250), 0.07, 0.07 * v);
		s.noise(t, 'highpass', 3000, 3000, 0.03, 0.05 * v);
	},
	// A Red Lantern's bolt: lower and rougher
	enemyShot: (s, t, v) => {
		s.tone(t, 'sawtooth', vary(320), vary(170), 0.1, 0.045 * v);
	},
	// Something struck
	hit: (s, t, v) => {
		s.noise(t, 'bandpass', vary(1400), 500, 0.07, 0.12 * v, 1.4);
		s.tone(t, 'sine', vary(190), 90, 0.08, 0.12 * v);
	},
	// A hammer, a fist, a heavy blow: a deep thud
	heavy: (s, t, v) => {
		s.tone(t, 'sine', vary(130), 45, 0.26, 0.3 * v);
		s.noise(t, 'lowpass', 900, 200, 0.2, 0.22 * v);
	},
	// A construct forming: a quick bright arpeggio and a shimmer
	construct: (s, t, v) => {
		[523, 659, 784].forEach((f, i) => s.tone(t + i * 0.03, 'triangle', vary(f), vary(f), 0.16, 0.07 * v));
		s.noise(t, 'highpass', 5000, 8000, 0.18, 0.03 * v);
	},
	// An explosion
	boom: (s, t, v) => {
		s.noise(t, 'lowpass', 1400, 150, 0.7, 0.4 * v);
		s.tone(t, 'sine', vary(90), 32, 0.55, 0.35 * v);
	},
	// Something done: a bell
	chime: (s, t, v) => {
		s.tone(t, 'sine', 880, 880, 0.5, 0.1 * v, 0.004);
		s.tone(t + 0.02, 'sine', 1320, 1320, 0.45, 0.06 * v, 0.004);
	},
	// A shield or a target breaking
	pop: (s, t, v) => {
		s.tone(t, 'triangle', vary(950), 380, 0.12, 0.1 * v);
		s.noise(t, 'highpass', 2500, 2500, 0.08, 0.06 * v);
	},
	// A bubble shield going up: a soft rising sweep
	shield: (s, t, v) => {
		s.tone(t, 'sine', 280, 900, 0.32, 0.12 * v, 0.03);
		s.tone(t, 'triangle', 420, 1350, 0.32, 0.05 * v, 0.03);
	},
	// You're hit
	hurt: (s, t, v) => {
		s.tone(t, 'square', vary(230), 110, 0.16, 0.12 * v);
		s.noise(t, 'bandpass', 700, 300, 0.12, 0.12 * v, 1);
	},
	// You're down
	down: (s, t, v) => {
		s.tone(t, 'sawtooth', 330, 70, 0.9, 0.16 * v, 0.01);
		s.tone(t, 'sine', 165, 40, 0.9, 0.14 * v, 0.01);
	},
	// An enemy beaten
	enemyDown: (s, t, v) => {
		s.noise(t, 'lowpass', 1800, 200, 0.3, 0.16 * v);
		s.tone(t, 'sawtooth', vary(420), 60, 0.28, 0.07 * v);
	},
	// Look out: a two-note warning
	alert: (s, t, v) => {
		s.tone(t, 'square', 440, 440, 0.12, 0.06 * v);
		s.tone(t + 0.14, 'square', 330, 330, 0.16, 0.06 * v);
	},
	// A signature ability: a big rising swell
	signature: (s, t, v) => {
		s.tone(t, 'sawtooth', 180, 820, 0.9, 0.1 * v, 0.2);
		s.tone(t, 'sine', 90, 410, 0.9, 0.16 * v, 0.2);
		s.noise(t + 0.3, 'highpass', 2000, 6000, 0.6, 0.05 * v);
	},
	// A voice on the radio: a tiny squelch
	radio: (s, t, v) => {
		s.noise(t, 'bandpass', 2200, 2200, 0.05, 0.04 * v, 3);
		s.tone(t, 'square', 1250, 1250, 0.03, 0.025 * v);
	},
	// Something new on the field
	spawn: (s, t, v) => {
		s.noise(t, 'bandpass', 380, 220, 0.3, 0.07 * v, 2);
	},
	// Mission complete
	win: (s, t, v) => {
		[523, 659, 784, 1047].forEach((f, i) => s.tone(t + i * 0.12, 'triangle', f, f, 0.5, 0.12 * v, 0.01));
	},
	// Mission failed
	lose: (s, t, v) => {
		[392, 311, 262, 196].forEach((f, i) => s.tone(t + i * 0.18, 'triangle', f, f, 0.6, 0.1 * v, 0.01));
	}
};
