// The Game owns the world state and knows how to update and draw it.
// It's plain TypeScript, with no Svelte, so it can run in /play, in any
// /lab page, and in tests.

import type { View } from './canvas';
import { FIGURE_HALF_WIDTH, FIGURE_HEIGHT, GREEN, drawLantern, drawNameTag } from './draw/lantern';
import { ENVIRONMENT_RULES, type EnvironmentKind } from './environment';
import { KeyboardInput, KeyboardState, LAYOUTS, type LayoutName } from './input';
import { LANTERNS, type LanternId } from './lanterns';
import { clampToBounds, createPlayer, updatePlayer, type Player } from './player';

export const LANTERN_GREEN = GREEN;

export interface PlayerConfig {
	lantern: LanternId;
	/** Which keys control this player. */
	keys: LayoutName;
}

export interface GameOptions {
	players: PlayerConfig[];
	/** Space: always flying. Planet: walking (flying comes in M2). Defaults to space. */
	environment?: EnvironmentKind;
	/** Show "P1"/"P2" under the name tags. */
	showSlots?: boolean;
}

interface Star {
	x: number; // 0..1 across the screen
	y: number; // 0..1 down the screen
	size: number;
	twinkle: number; // phase offset so stars don't blink in unison
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
	/** Seconds of simulated time. Only update() changes it. */
	time = 0;
	readonly keyboard = new KeyboardState();
	readonly players: Player[];

	readonly environment: EnvironmentKind;
	private stars: Star[];
	/** Ground speckles for planet missions (placeholder until M2 maps). */
	private pebbles: Star[];
	private showSlots: boolean;
	/** The drawable area. Until the world has a map (M2), the screen is the arena. */
	private view: View = { width: 0, height: 0 };
	private spawned = false;

	constructor({ players, environment = 'space', showSlots = false }: GameOptions) {
		this.environment = environment;
		const rules = ENVIRONMENT_RULES[environment];
		this.players = players.map((cfg, slot) => {
			const p = createPlayer(slot, LANTERNS[cfg.lantern], new KeyboardInput(this.keyboard, LAYOUTS[cfg.keys]), 0, 0);
			p.flying = rules.alwaysFlying;
			return p;
		});
		this.showSlots = showSlots;
		this.stars = Array.from({ length: 180 }, () => ({
			x: Math.random(),
			y: Math.random(),
			size: Math.random() * 1.6 + 0.3,
			twinkle: Math.random() * Math.PI * 2
		}));
		this.pebbles = Array.from({ length: 260 }, () => ({
			x: Math.random(),
			y: Math.random(),
			size: Math.random() * 3 + 1,
			twinkle: Math.random()
		}));
	}

	/** GameCanvas hands over its live View object (it's updated on resize). */
	setView(view: View) {
		this.view = view;
	}

	/** One fixed tick of simulation. */
	update(dt: number) {
		this.time += dt;
		const { width, height } = this.view;
		if (width === 0) return; // canvas not measured yet

		if (!this.spawned) this.spawn(width, height);

		// Positions are the Lantern's feet, so leave room above for the body.
		const padX = FIGURE_HALF_WIDTH;
		for (const p of this.players) {
			updatePlayer(p, p.input.read(), dt);
			clampToBounds(p, padX, FIGURE_HEIGHT + 4, width - padX, height - 6);
		}
	}

	/** Place players side by side in the middle of the screen. */
	private spawn(width: number, height: number) {
		const gap = 170; // wide enough that name tags don't overlap
		const startX = width / 2 - (gap * (this.players.length - 1)) / 2;
		this.players.forEach((p, i) => {
			p.x = p.prevX = startX + i * gap;
			p.y = p.prevY = height / 2 + 80;
		});
		this.spawned = true;
	}

	/**
	 * Draw the world. Reads state, never changes it.
	 * `alpha` (0..1) blends between the previous and current tick, so motion
	 * looks smooth even on monitors faster than 60Hz.
	 */
	render(ctx: CanvasRenderingContext2D, alpha = 1) {
		const { width, height } = this.view;

		if (this.environment === 'space') this.drawSpace(ctx, width, height);
		else this.drawPlanet(ctx, width, height);

		if (!this.spawned) return;
		const { hasGround } = ENVIRONMENT_RULES[this.environment];
		// Painter's order: whoever is lower on screen is closer to the viewer,
		// so draw them last (on top).
		const byDepth = [...this.players].sort((a, b) => a.y - b.y);
		for (const p of byDepth) {
			const x = lerp(p.prevX, p.x, alpha);
			const y = lerp(p.prevY, p.y, alpha);
			// Lean comes from horizontal speed: flying sideways fast = full lean.
			const lean = Math.min(Math.abs(p.vx) / p.def.maxSpeed, 1);
			// Glow whenever flying; shadow whenever there's ground under them.
			drawLantern(ctx, p.def, x, y, { ...p, lean, glow: p.flying, shadow: hasGround }, this.time);
			const tag = this.showSlots ? `P${p.slot + 1} · ${p.def.name}` : p.def.name;
			drawNameTag(ctx, tag, x, y);
		}
	}

	private drawSpace(ctx: CanvasRenderingContext2D, width: number, height: number) {
		ctx.fillStyle = '#03060a';
		ctx.fillRect(0, 0, width, height);

		for (const s of this.stars) {
			const glow = 0.5 + 0.5 * Math.sin(this.time * 2 + s.twinkle);
			ctx.globalAlpha = 0.3 + glow * 0.7;
			ctx.fillStyle = '#e8fff0';
			ctx.fillRect(s.x * width, s.y * height, s.size, s.size);
		}
		ctx.globalAlpha = 1;

		// Faint Corps emblem in the background
		this.drawEmblem(ctx, width / 2, height / 2, Math.min(width, height) * 0.12, 0.25);
	}

	/** Placeholder planet surface: dusty ground with pebbles. Real maps come in M2. */
	private drawPlanet(ctx: CanvasRenderingContext2D, width: number, height: number) {
		ctx.fillStyle = '#3b3a2e';
		ctx.fillRect(0, 0, width, height);

		for (const p of this.pebbles) {
			ctx.fillStyle = p.twinkle > 0.5 ? 'rgba(20, 18, 12, 0.35)' : 'rgba(120, 112, 88, 0.35)';
			ctx.beginPath();
			ctx.ellipse(p.x * width, p.y * height, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	private drawEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, opacity: number) {
		const pulse = 0.75 + 0.25 * Math.sin(this.time * 3);

		ctx.save();
		ctx.strokeStyle = GREEN;
		ctx.shadowColor = GREEN;
		ctx.shadowBlur = 30 * pulse;
		ctx.lineWidth = r * 0.14;
		ctx.globalAlpha = pulse * opacity;

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
