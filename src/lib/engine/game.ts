// The Game owns the world state and knows how to update and draw it.
// It's plain TypeScript, with no Svelte, so it can run in /play, in any
// /lab page, and in tests.

import { BEAM_DPS, BEAM_RANGE, castBeam } from './beam';
import { Camera } from './camera';
import type { View } from './canvas';
import { BURST_LIFETIME, drawBattery, drawBeam, drawBurst, drawChargeLink, drawHud, type Burst } from './draw/effects';
import {
	FIGURE_HALF_WIDTH,
	FIGURE_HEIGHT,
	GREEN,
	HOVER_PLANET,
	HOVER_SPACE,
	drawLantern,
	drawNameTag,
	ringPosition,
	type LanternPose
} from './draw/lantern';
import { drawObstacle, drawPlanetGround, drawStarfield, makeStars, type WorldRect } from './draw/world';
import { ENVIRONMENT_RULES, type EnvironmentKind } from './environment';
import { KeyboardInput, KeyboardState, LAYOUTS, type LayoutName } from './input';
import { LANTERNS, type LanternId } from './lanterns';
import { buildTestMap, seededRandom, type GameMap } from './map';
import { FEET_HALF_H, FEET_HALF_W, clampToBounds, createPlayer, updatePlayer, type Player, type WorldRules } from './player';
import { BATTERY_MAX_CHARGE, updateBattery, updateWillpower, type Battery } from './willpower';

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
	readonly batteries: Battery[];
	/** Draw collision boxes. Toggled from the lab. */
	debug = false;

	private rules: WorldRules;
	private bursts: Burst[] = [];
	private starLayers;
	private showSlots: boolean;
	private view: View = { width: 0, height: 0 };
	private started = false;

	constructor({ players, environment = 'space', map, showSlots = false }: GameOptions) {
		this.map = map ?? buildTestMap(environment);
		const env = ENVIRONMENT_RULES[this.map.environment];
		this.rules = { solids: this.map.obstacles, alwaysFlying: env.alwaysFlying };
		this.batteries = [{ ...this.map.battery, charge: BATTERY_MAX_CHARGE }];

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
		for (const b of this.batteries) updateBattery(b, dt);

		for (const p of this.players) {
			const intent = p.input.read();
			updatePlayer(p, intent, dt, this.rules);
			// Keep feet inside the map, with room above for the body
			clampToBounds(p, FIGURE_HALF_WIDTH, FIGURE_HEIGHT, map.width - FIGURE_HALF_WIDTH, map.height - 6);
			updateWillpower(p, intent.fire, dt, this.batteries);
			this.updateBeam(p, dt);
		}

		for (const b of this.bursts) b.age += dt;
		this.bursts = this.bursts.filter((b) => b.age < BURST_LIFETIME);

		const [tx, ty] = this.cameraTarget();
		if (!this.started) {
			this.camera.snapTo(tx, ty, this.view, map.width, map.height);
			this.started = true;
		} else {
			this.camera.follow(tx, ty, dt, this.view, map.width, map.height);
		}
	}

	/**
	 * Cast the beam and damage what it touches.
	 *
	 * The beam is drawn from the ring hand, but it's CAST along the ground
	 * plane from the Lantern's feet. Obstacles are footprints on the ground,
	 * so that's where "what am I pointing at" lives in this view.
	 */
	private updateBeam(p: Player, dt: number) {
		if (!p.firing) {
			p.beamLength = 0;
			return;
		}
		const { length, hit } = castBeam(p.x, p.y, p.aimX, p.aimY, this.map.obstacles);
		p.beamLength = length;

		if (hit?.hp !== undefined) {
			hit.hp -= BEAM_DPS * dt;
			if (hit.hp <= 0) {
				// Removing it from map.obstacles also removes it from collisions,
				// since the world rules share that same array.
				this.map.obstacles.splice(this.map.obstacles.indexOf(hit), 1);
				this.bursts.push({ x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 - hit.height, age: 0 });
			}
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

	private poseFor(p: Player): LanternPose {
		const env = ENVIRONMENT_RULES[this.map.environment];
		return {
			...p,
			// Lean comes from horizontal speed: flying sideways fast = full lean.
			lean: p.flying ? Math.min(Math.abs(p.vx) / p.def.maxSpeed, 1) : 0,
			hoverHeight: this.map.environment === 'space' ? HOVER_SPACE : HOVER_PLANET,
			glow: true,
			shadow: env.hasGround
		};
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

		if (map.environment === 'planet') drawPlanetGround(ctx, visible, map.width, map.height);

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
		for (const b of this.batteries) {
			ground.push({ baseY: b.y, draw: () => drawBattery(ctx, b, env.hasGround, this.time) });
		}

		const overlays: (() => void)[] = [];
		const tags: (() => void)[] = [];
		for (const p of this.players) {
			const x = lerp(p.prevX, p.x, alpha);
			const y = lerp(p.prevY, p.y, alpha);
			const pose = this.poseFor(p);
			const list = p.altitude > 0.5 ? air : ground;
			list.push({ baseY: y, draw: () => drawLantern(ctx, p.def, x, y, pose, this.time) });

			if (p.charging) {
				const chestY = y - (pose.hoverHeight * p.altitude + 28) * 1.35;
				for (const b of this.batteries) {
					overlays.push(() => drawChargeLink(ctx, b, env.hasGround, x, chestY, this.time));
				}
			}
			if (p.firing) {
				const [rx, ry] = ringPosition(x, y, pose, this.time);
				overlays.push(() => drawBeam(ctx, rx, ry, p.aimX, p.aimY, p.beamLength, p.beamLength < BEAM_RANGE, this.time));
			}

			const tag = this.showSlots ? `P${p.slot + 1} · ${p.def.name}` : p.def.name;
			const lift = pose.hoverHeight * p.altitude * 1.35;
			tags.push(() => drawNameTag(ctx, tag, x, y, lift));
		}

		for (const list of [ground, air]) {
			list.sort((a, b) => a.baseY - b.baseY);
			for (const d of list) d.draw();
		}
		for (const o of overlays) o();
		for (const b of this.bursts) drawBurst(ctx, b);
		for (const t of tags) t();

		if (this.debug) this.drawDebug(ctx);
		ctx.restore();

		// ---- Screen space ----
		drawHud(
			ctx,
			this.players.map((p) => ({ name: p.def.name, slot: p.slot, willpower: p.willpower, charging: p.charging })),
			width,
			height,
			this.time
		);
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
