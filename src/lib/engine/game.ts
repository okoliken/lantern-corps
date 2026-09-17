// The Game owns the world state and knows how to update and draw it.
// It's plain TypeScript, with no Svelte, so it can run in /play, in any
// /lab page, and in tests.
//
// M0 only has a starfield and a pulsing Lantern emblem, to prove the loop,
// the canvas, and the routes all work. Players arrive in M1.

import type { View } from './canvas';

export const LANTERN_GREEN = '#3dff6e';

interface Star {
	x: number; // 0..1 across the screen
	y: number; // 0..1 down the screen
	size: number;
	twinkle: number; // phase offset so stars don't blink in unison
}

export class Game {
	/** Seconds of simulated time. Only update() changes it. */
	time = 0;
	private stars: Star[];

	constructor(starCount = 180) {
		this.stars = Array.from({ length: starCount }, () => ({
			x: Math.random(),
			y: Math.random(),
			size: Math.random() * 1.6 + 0.3,
			twinkle: Math.random() * Math.PI * 2
		}));
	}

	/** One fixed tick of simulation. */
	update(dt: number) {
		this.time += dt;
	}

	/** Draw the world. Reads state, never changes it. */
	render(ctx: CanvasRenderingContext2D, view: View) {
		const { width, height } = view;

		ctx.fillStyle = '#03060a';
		ctx.fillRect(0, 0, width, height);

		for (const s of this.stars) {
			const glow = 0.5 + 0.5 * Math.sin(this.time * 2 + s.twinkle);
			ctx.globalAlpha = 0.3 + glow * 0.7;
			ctx.fillStyle = '#e8fff0';
			ctx.fillRect(s.x * width, s.y * height, s.size, s.size);
		}
		ctx.globalAlpha = 1;

		this.drawEmblem(ctx, width / 2, height / 2, Math.min(width, height) * 0.12);
	}

	private drawEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
		const pulse = 0.75 + 0.25 * Math.sin(this.time * 3);

		ctx.save();
		ctx.strokeStyle = LANTERN_GREEN;
		ctx.shadowColor = LANTERN_GREEN;
		ctx.shadowBlur = 30 * pulse;
		ctx.lineWidth = r * 0.14;
		ctx.globalAlpha = pulse;

		// Outer ring
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.stroke();

		// The two bars through the middle of the Corps symbol
		const barW = r * 1.9;
		const barGap = r * 0.42;
		ctx.lineWidth = r * 0.16;
		ctx.beginPath();
		ctx.moveTo(x - barW / 2, y - barGap);
		ctx.lineTo(x + barW / 2, y - barGap);
		ctx.moveTo(x - barW / 2, y + barGap);
		ctx.lineTo(x + barW / 2, y + barGap);
		ctx.stroke();

		// Inner circle between the bars
		ctx.lineWidth = r * 0.12;
		ctx.beginPath();
		ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
		ctx.stroke();

		ctx.restore();
	}
}
