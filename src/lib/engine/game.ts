// The Game owns the world state and knows how to update and draw it.
// It's plain TypeScript, with no Svelte, so it can run in /play, in any
// /lab page, and in tests.

import { Camera } from './camera';
import type { View } from './canvas';
import {
	FIGURE_HALF_WIDTH,
	FIGURE_HEIGHT,
	GREEN,
	HOVER_PLANET,
	HOVER_SPACE,
	drawLantern,
	drawNameTag
} from './draw/lantern';
import { drawEmblem, drawObstacle, drawPlanetGround, drawStarfield, makeStars, type WorldRect } from './draw/world';
import { ENVIRONMENT_RULES, type EnvironmentKind } from './environment';
import { KeyboardInput, KeyboardState, LAYOUTS, type LayoutName } from './input';
import { LANTERNS, type LanternId } from './lanterns';
import { buildTestMap, seededRandom, type GameMap } from './map';
import { FEET_HALF_H, FEET_HALF_W, clampToBounds, createPlayer, updatePlayer, type Player, type WorldRules } from './player';

export const LANTERN_GREEN = GREEN;

export interface PlayerConfig {
	lantern: LanternId;
	/** Which keys control this player. */
	keys: LayoutName;
}

export interface GameOptions {
	players: PlayerConfig[];
	/** Space: always flying. Planet: walk, take off, land. Defaults to space. */
	environment?: EnvironmentKind;
	/** A specific map. Defaults to the test map for the environment. */
	map?: GameMap;
	/** Show "P1"/"P2" under the name tags. */
	showSlots?: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Aim the camera at the Lantern's chest, not their feet. */
const CAMERA_AIM_UP = 30;

export class Game {
	/** Seconds of simulated time. Only update() changes it. */
	time = 0;
	readonly keyboard = new KeyboardState();
	readonly players: Player[];
	readonly map: GameMap;
	readonly camera = new Camera();
	/** Draw collision boxes. Toggled from the lab. */
	debug = false;

	private rules: WorldRules;
	private starLayers;
	private showSlots: boolean;
	private view: View = { width: 0, height: 0 };
	private started = false;

	constructor({ players, environment = 'space', map, showSlots = false }: GameOptions) {
		this.map = map ?? buildTestMap(environment);
		const env = ENVIRONMENT_RULES[this.map.environment];
		this.rules = { solids: this.map.obstacles, alwaysFlying: env.alwaysFlying };

		// Spawn side by side around the map's spawn point
		const gap = 170; // wide enough that name tags don't overlap
		const startX = this.map.spawn.x - (gap * (players.length - 1)) / 2;
		this.players = players.map((cfg, slot) => {
			const input = new KeyboardInput(this.keyboard, LAYOUTS[cfg.keys]);
			const p = createPlayer(slot, LANTERNS[cfg.lantern], input, startX + slot * gap, this.map.spawn.y);
			if (env.alwaysFlying) {
				p.flying = true;
				p.altitude = 1;
			}
			return p;
		});

		this.showSlots = showSlots;
		const rand = seededRandom(1);
		this.starLayers = [
			{ stars: makeStars(160, rand), parallax: 0.08 },
			{ stars: makeStars(70, rand), parallax: 0.25 }
		];
	}

	get environment(): EnvironmentKind {
		return this.map.environment;
	}

	/** GameCanvas hands over its live View object (it's updated on resize). */
	setView(view: View) {
		this.view = view;
	}

	/** One fixed tick of simulation. */
	update(dt: number) {
		this.time += dt;
		const { width } = this.view;
		if (width === 0) return; // canvas not measured yet

		const { map } = this;
		for (const p of this.players) {
			updatePlayer(p, p.input.read(), dt, this.rules);
			// Keep feet inside the map, with room above for the body
			clampToBounds(p, FIGURE_HALF_WIDTH, FIGURE_HEIGHT, map.width - FIGURE_HALF_WIDTH, map.height - 6);
		}

		const [tx, ty] = this.cameraTarget();
		if (!this.started) {
			this.camera.snapTo(tx, ty, this.view, map.width, map.height);
			this.started = true;
		} else {
			this.camera.follow(tx, ty, dt, this.view, map.width, map.height);
		}
	}

	/** The middle of all players. With one player that's just them. */
	private cameraTarget(): [number, number] {
		let x = 0;
		let y = 0;
		for (const p of this.players) {
			x += p.x;
			y += p.y - CAMERA_AIM_UP;
		}
		return [x / this.players.length, y / this.players.length];
	}

	/**
	 * Draw the world. Reads state, never changes it.
	 * `alpha` (0..1) blends between the previous and current tick, so motion
	 * looks smooth even on monitors faster than 60Hz.
	 */
	render(ctx: CanvasRenderingContext2D, alpha = 1) {
		const { width, height } = this.view;
		const { camera, map } = this;
		const env = ENVIRONMENT_RULES[map.environment];
		const camX = lerp(camera.prevX, camera.x, alpha);
		const camY = lerp(camera.prevY, camera.y, alpha);
		const zoom = camera.zoom;

		if (map.environment === 'space') {
			drawStarfield(ctx, this.starLayers, camX, camY, width, height, this.time);
		}

		// ---- Switch to world coordinates ----
		// Put the camera point at the centre of the screen, scaled by zoom.
		ctx.save();
		ctx.translate(width / 2, height / 2);
		ctx.scale(zoom, zoom);
		ctx.translate(-camX, -camY);

		const visible: WorldRect = {
			left: camX - width / 2 / zoom,
			top: camY - height / 2 / zoom,
			right: camX + width / 2 / zoom,
			bottom: camY + height / 2 / zoom
		};

		if (map.environment === 'space') {
			drawEmblem(ctx, map.width / 2, map.height / 2, 260, 0.12, this.time);
		} else {
			drawPlanetGround(ctx, visible, map.width, map.height);
		}

		// ---- Everything with depth, sorted back to front ----
		// Ground things sort by their base y: lower on screen = in front.
		// Flying Lanterns are above it all, so they're drawn after.
		type Drawable = { baseY: number; draw: () => void };
		const ground: Drawable[] = [];
		const air: Drawable[] = [];

		for (const o of map.obstacles) {
			// Skip anything well off screen (tall things poke up, so pad the top)
			if (o.x > visible.right || o.x + o.w < visible.left) continue;
			if (o.y - o.height > visible.bottom || o.y + o.h < visible.top) continue;
			ground.push({ baseY: o.y + o.h, draw: () => drawObstacle(ctx, o) });
		}

		const hoverHeight = map.environment === 'space' ? HOVER_SPACE : HOVER_PLANET;
		const tags: (() => void)[] = [];
		for (const p of this.players) {
			const x = lerp(p.prevX, p.x, alpha);
			const y = lerp(p.prevY, p.y, alpha);
			// Lean comes from horizontal speed: flying sideways fast = full lean.
			const lean = p.flying ? Math.min(Math.abs(p.vx) / p.def.maxSpeed, 1) : 0;
			const pose = { ...p, lean, hoverHeight, glow: true, shadow: env.hasGround };
			const list = p.altitude > 0.5 ? air : ground;
			list.push({ baseY: y, draw: () => drawLantern(ctx, p.def, x, y, pose, this.time) });

			const tag = this.showSlots ? `P${p.slot + 1} · ${p.def.name}` : p.def.name;
			const lift = hoverHeight * p.altitude * 1.35;
			tags.push(() => drawNameTag(ctx, tag, x, y, lift));
		}

		for (const list of [ground, air]) {
			list.sort((a, b) => a.baseY - b.baseY);
			for (const d of list) d.draw();
		}
		for (const t of tags) t();

		if (this.debug) this.drawDebug(ctx);
		ctx.restore();
	}

	/** Collision footprints (red = blocks walkers only, orange = blocks flyers too) and feet boxes. */
	private drawDebug(ctx: CanvasRenderingContext2D) {
		ctx.lineWidth = 1.5;
		for (const o of this.map.obstacles) {
			ctx.strokeStyle = o.blocksFlying ? 'orange' : 'red';
			ctx.strokeRect(o.x, o.y, o.w, o.h);
		}
		for (const p of this.players) {
			ctx.strokeStyle = p.flying ? GREEN : 'cyan';
			ctx.strokeRect(p.x - FEET_HALF_W, p.y - FEET_HALF_H, FEET_HALF_W * 2, FEET_HALF_H * 2);
		}
	}
}
