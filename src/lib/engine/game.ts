// The Game owns the world state and knows how to update and draw it.
// It's plain TypeScript, with no Svelte, so it can run in /play, in any
// /lab page, and in tests.

import { Camera } from './camera';
import type { View } from './canvas';
import {
	costOf,
	createConstructWorld,
	updateConstructWorld,
	updatePlayerConstructs,
	type ConstructWorld
} from './constructs/system';
import {
	drawChain,
	drawDummy,
	drawEffect,
	drawHeldConstruct,
	drawProjectile,
	drawReticle,
	drawShield,
	drawTrap
} from './draw/constructs';
import { drawBattery, drawBeam, drawChargeLink, drawHud } from './draw/effects';
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
import { DUMMY_HALF_H, DUMMY_HALF_W, createDummy, isStanding, updateDummy, type Dummy } from './dummy';
import { ENVIRONMENT_RULES, type EnvironmentKind } from './environment';
import { KeyboardInput, KeyboardState, LAYOUTS, type LayoutName } from './input';
import { LANTERNS, type LanternId } from './lanterns';
import { buildTestMap, seededRandom, type GameMap, type Obstacle } from './map';
import { FEET_HALF_H, FEET_HALF_W, clampToBounds, createPlayer, updatePlayer, type Player, type WorldRules } from './player';
import { BUBBLE_SHIELD } from './constructs/defs';
import { autoReach, sameTarget, targetPosition, updateTargeting, type Target, type TargetWorld } from './targeting';
import { BATTERY_MAX_CHARGE, canSpend, updateBattery, updateWillpower, type Battery } from './willpower';

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

/** "KeyE" -> "E", "Comma" -> ",", for HUD labels. */
const keyLabel = (code: string) => ({ Comma: ',', Period: '.', Slash: '/' })[code] ?? code.replace(/^(Key|Digit)/, '');

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
	readonly dummies: Dummy[];
	readonly constructs: ConstructWorld;
	/** Draw collision boxes. Toggled from the lab. */
	debug = false;
	/** Never run out of willpower. Toggled from the lab for trying constructs. */
	infiniteWillpower = false;

	private rules: WorldRules;
	/** Label for each player's slot keys, e.g. ["1".."5"] or ["6".."0"]. */
	private slotKeys: string[][];
	/** Label for each player's shield key. */
	private shieldKeys: string[];
	private starLayers;
	private showSlots: boolean;
	private view: View = { width: 0, height: 0 };
	private started = false;

	constructor({ players, environment = 'space', map, showSlots = false }: GameOptions) {
		this.map = map ?? buildTestMap(environment);
		const env = ENVIRONMENT_RULES[this.map.environment];
		this.rules = { solids: this.map.obstacles, alwaysFlying: env.alwaysFlying };
		this.batteries = [{ ...this.map.battery, charge: BATTERY_MAX_CHARGE }];
		this.dummies = this.map.dummies.map((d) => createDummy(d.x, d.y));
		// The construct world shares the map's obstacle array, so walls a
		// Lantern builds block movement, and crates it breaks stop blocking.
		this.constructs = createConstructWorld(this.map.obstacles, this.dummies);

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
		this.slotKeys = players.map((cfg) => LAYOUTS[cfg.keys].slots.map((codes) => codes[0].replace('Digit', '')));
		this.shieldKeys = players.map((cfg) => keyLabel(LAYOUTS[cfg.keys].shield[0]));

		this.showSlots = showSlots;
		const rand = seededRandom(1);
		this.starLayers = [
			{ stars: makeStars(160, rand), parallax: 0.08 },
			{ stars: makeStars(70, rand), parallax: 0.25 }
		];
	}

	/** What targeting can see: everything you might attack or protect. */
	get targetWorld(): TargetWorld {
		return { dummies: this.dummies, obstacles: this.map.obstacles, players: this.players };
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
			updateTargeting(p, intent.target, this.targetWorld, autoReach(p.loadout[p.selected]));
			updateWillpower(p, dt, this.batteries);
			updatePlayerConstructs(p, intent, dt, this.constructs);
			if (this.infiniteWillpower) {
				p.willpower = 100;
				p.exhausted = false;
			}
		}

		updateConstructWorld(this.constructs, dt);
		for (const d of this.dummies) {
			updateDummy(d, dt, map.obstacles);
			d.x = Math.min(Math.max(d.x, DUMMY_HALF_W), map.width - DUMMY_HALF_W);
			d.y = Math.min(Math.max(d.y, DUMMY_HALF_H), map.height - DUMMY_HALF_H);
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

	private poseFor(p: Player): LanternPose {
		const env = ENVIRONMENT_RULES[this.map.environment];
		return {
			...p,
			// Lean comes from horizontal speed: flying sideways fast = full lean.
			lean: p.flying ? Math.min(Math.abs(p.vx) / p.def.maxSpeed, 1) : 0,
			hoverHeight: this.map.environment === 'space' ? HOVER_SPACE : HOVER_PLANET,
			glow: true,
			shadow: env.hasGround,
			// The ring arm aims while a construct is running or just used
			firing: p.firing || p.actionTimer > 0
		};
	}

	/** How high above a Lantern's anchor their aimed ring is, in world px. */
	private ringLift(p: Player): number {
		const pose = { ...this.poseFor(p), firing: true };
		return -ringPosition(0, 0, pose, this.time)[1];
	}

	/**
	 * Draw the world. Reads state, never changes it.
	 * `alpha` (0..1) blends between the previous and current tick, so motion
	 * looks smooth even on monitors faster than 60Hz.
	 */
	render(ctx: CanvasRenderingContext2D, alpha = 1) {
		const { width, height } = this.view;
		const { camera, map, constructs: cw } = this;
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
		// Traps are markings on the ground: under everything
		for (const t of cw.traps) drawTrap(ctx, t, this.time);

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
			ground.push({ baseY: o.y + o.h, draw: () => drawObstacle(ctx, o, this.time) });
		}
		for (const b of this.batteries) {
			ground.push({ baseY: b.y, draw: () => drawBattery(ctx, b, env.hasGround, this.time) });
		}
		for (const d of this.dummies) {
			const x = lerp(d.prevX, d.x, alpha);
			const y = lerp(d.prevY, d.y, alpha);
			ground.push({ baseY: y, draw: () => drawDummy(ctx, d, x, y, env.hasGround, this.time) });
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

			if (pose.firing) {
				const [rx, ry] = ringPosition(x, y, pose, this.time);
				const def = p.loadout[p.selected];
				if (p.firing && def.behavior === 'beam') {
					overlays.push(() => drawBeam(ctx, rx, ry, p.aimX, p.aimY, p.beamLength, p.beamLength < def.range, this.time));
				}
				const held = p.firing ? def.shape : p.actionShape;
				if (held === 'minigun' || held === 'cannon') {
					overlays.push(() => drawHeldConstruct(ctx, held, rx, ry, p.aimX, p.aimY, this.time));
				}
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

		// Chains: from the hand to the flying hook, or to whatever it caught
		for (const pr of cw.projectiles) {
			const x = lerp(pr.prevX, pr.x, alpha);
			const y = lerp(pr.prevY, pr.y, alpha);
			const lift = this.ringLift(pr.owner);
			if (pr.kind === 'hook') {
				const [rx, ry] = ringPosition(pr.owner.x, pr.owner.y, { ...this.poseFor(pr.owner), firing: true }, this.time);
				drawChain(ctx, rx, ry, x, y - lift, this.time);
			}
			drawProjectile(ctx, pr, x, y, lift, this.time);
		}
		for (const t of cw.tethers) {
			const [rx, ry] = ringPosition(t.owner.x, t.owner.y, { ...this.poseFor(t.owner), firing: true }, this.time);
			const target = t.target;
			const [tx, ty] = 'homeX' in target ? [target.x, target.y - 38] : [target.x + target.w / 2, target.y - (target as Obstacle).height / 2];
			drawChain(ctx, rx, ry, tx, ty, this.time);
		}

		// Bubble shields around whoever they protect
		for (const sh of cw.shields) {
			const t = sh.target;
			const lift = this.poseFor(t).hoverHeight * t.altitude * 1.35;
			drawShield(ctx, sh, lerp(t.prevX, t.x, alpha), lerp(t.prevY, t.y, alpha), lift, this.time);
		}

		// Target markers: what each Lantern will hit, and who they're protecting
		for (const p of this.players) {
			for (const t of [p.attackTarget, p.protectTarget]) {
				if (!t) continue;
				const [tx, ty] = this.targetDrawPosition(t, alpha);
				drawReticle(ctx, t, tx, ty, sameTarget(t, p.lock), this.time);
			}
		}
		for (const e of cw.effects) {
			drawEffect(ctx, e, e.owner ? this.ringLift(e.owner) : 0, this.time);
		}
		for (const t of tags) t();

		if (this.debug) this.drawDebug(ctx);
		ctx.restore();

		// ---- Screen space ----
		drawHud(
			ctx,
			this.players.map((p, i) => ({
				name: p.def.name,
				slot: p.slot,
				willpower: p.willpower,
				exhausted: p.exhausted,
				charging: p.charging,
				selected: p.selected,
				slots: p.loadout.map((def, s) => ({
					name: def.name,
					key: this.slotKeys[i][s],
					cooldown: def.cooldown > 0 ? Math.min(1, p.cooldowns[s] / (def.cooldown * p.def.traits.cooldown)) : 0,
					affordable: canSpend(p, def.behavior === 'beam' ? 15 : costOf(p, def))
				})),
				shield: {
					key: this.shieldKeys[i],
					cooldown: Math.min(1, p.shieldCooldown / (BUBBLE_SHIELD.cooldown * p.def.traits.cooldown)),
					affordable: canSpend(p, BUBBLE_SHIELD.cost),
					active: cw.shields.some((sh) => sh.target === p)
				},
				targetLabel: this.targetLabel(p)
			})),
			width,
			height,
			this.time
		);
	}

	/** Where to draw a target marker, smoothed like everything else. */
	private targetDrawPosition(t: Target, alpha: number): [number, number] {
		if (t.kind === 'enemy') return [lerp(t.dummy.prevX, t.dummy.x, alpha), lerp(t.dummy.prevY, t.dummy.y, alpha)];
		if (t.kind === 'ally') return [lerp(t.player.prevX, t.player.x, alpha), lerp(t.player.prevY, t.player.y, alpha)];
		return targetPosition(t);
	}

	/** Short HUD text for what a Lantern is aiming at / protecting. */
	private targetLabel(p: Player): string {
		const name = (t: Target) => (t.kind === 'enemy' ? 'Dummy' : t.kind === 'ally' ? t.player.def.name : 'Crate');
		const parts: string[] = [];
		if (p.attackTarget) parts.push(`${sameTarget(p.attackTarget, p.lock) ? '🔒 ' : ''}${name(p.attackTarget)}`);
		if (p.protectTarget) parts.push(`🛡 ${name(p.protectTarget)}`);
		return parts.join('  ·  ');
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
		ctx.strokeStyle = 'yellow';
		for (const d of this.dummies) {
			if (isStanding(d)) ctx.strokeRect(d.x - DUMMY_HALF_W, d.y - DUMMY_HALF_H, DUMMY_HALF_W * 2, DUMMY_HALF_H * 2);
		}
	}
}
