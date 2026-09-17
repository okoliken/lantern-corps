// Fixed-timestep game loop.
//
// The screen refreshes at whatever rate the monitor wants (60Hz, 120Hz, a
// laggy 40Hz...). If we moved things "per frame", a 120Hz player would move
// twice as fast as a 60Hz player. Instead the game simulation ticks at a
// FIXED rate (STEP_MS), and each frame we run as many ticks as real time
// says we owe. Rendering happens once per frame no matter how many ticks ran.
//
// This also matters for online multiplayer later: both computers must run
// the exact same number of identical ticks to stay in sync.

/** 60 simulation ticks per second. */
export const STEP_MS = 1000 / 60;

/** Never simulate more than this per frame (e.g. after switching tabs). */
export const MAX_FRAME_MS = 250;

export interface StepResult {
	/** How many fixed ticks to run this frame. */
	steps: number;
	/** Leftover time (ms) carried into the next frame. */
	accumulator: number;
	/** 0..1 — how far we are between the last tick and the next one. */
	alpha: number;
}

/**
 * Pure math of the fixed timestep: given leftover time and how long this
 * frame took, work out how many ticks to run. No browser APIs, so it's
 * easy to unit test.
 */
export function consumeTime(accumulator: number, frameMs: number, stepMs = STEP_MS): StepResult {
	// Clamp huge gaps so we don't try to catch up on 10 seconds of ticks at once
	// (the "spiral of death").
	let acc = accumulator + Math.min(Math.max(frameMs, 0), MAX_FRAME_MS);
	let steps = 0;
	// STEP_MS (16.666...) can't be stored exactly as a float, so repeated
	// subtraction drifts a hair short. The tiny epsilon stops us losing a tick.
	while (acc >= stepMs - 1e-6) {
		acc -= stepMs;
		steps++;
	}
	acc = Math.max(acc, 0);
	return { steps, accumulator: acc, alpha: acc / stepMs };
}

export interface LoopStats {
	/** Frames drawn per second. Depends on the monitor. */
	fps: number;
	/** Simulation ticks per second. Should sit at ~60 on any monitor. */
	ups: number;
}

export interface LoopOptions {
	/** Advance the game by one fixed tick. `dt` is in seconds. */
	update: (dt: number) => void;
	/** Draw the current state. `alpha` can smooth motion between ticks. */
	render: (alpha: number) => void;
	/** Called about once per second with fps/ups counts. */
	onStats?: (stats: LoopStats) => void;
}

/** Starts the loop. Returns a function that stops it. */
export function startLoop({ update, render, onStats }: LoopOptions): () => void {
	let accumulator = 0;
	let last = performance.now();
	let rafId = 0;

	let frames = 0;
	let ticks = 0;
	let statsStart = last;

	const frame = (now: number) => {
		const result = consumeTime(accumulator, now - last);
		last = now;
		accumulator = result.accumulator;

		for (let i = 0; i < result.steps; i++) update(STEP_MS / 1000);
		render(result.alpha);

		frames++;
		ticks += result.steps;
		if (onStats && now - statsStart >= 1000) {
			const secs = (now - statsStart) / 1000;
			onStats({ fps: Math.round(frames / secs), ups: Math.round(ticks / secs) });
			frames = 0;
			ticks = 0;
			statsStart = now;
		}

		rafId = requestAnimationFrame(frame);
	};

	rafId = requestAnimationFrame(frame);
	return () => cancelAnimationFrame(rafId);
}
