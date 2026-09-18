// The Game owns the world state and knows how to update and draw it.
// It's plain TypeScript, with no Svelte, so it can run in /play, in any
// /lab page, and in tests.

import { castBeam } from './beam';
import { Camera } from './camera';
import type { View } from './canvas';
import {
	ACTION_POSE_TIME,
	SHOT_POSE_TIME,
	costOf,
	createConstructWorld,
	isPlayer,
	updateAidStations,
	updateConstructWorld,
	updatePlayerConstructs,
	type ConstructWorld
} from './constructs/system';
import { chooseShieldTarget } from './constructs/smart';
import {
	drawAidStation,
	drawAutoTurret,
	drawChain,
	drawDummy,
	drawLaserSight,
	drawEffect,
	drawHeldConstruct,
	drawProjectile,
	drawReticle,
	drawShield,
	drawTrap
} from './draw/constructs';
import { drawBattery, drawBeam, drawChargeLink, drawCrosshair, drawDownedNotice, drawHud } from './draw/effects';
import { drawEnemy, enemyMuzzle } from './draw/enemies';
import { drawSpaceRock } from './draw/escort';
import { drawFallingMeteors, drawRedBeam, drawRedCage, drawRedChain, drawRedEffect, drawRedGround, drawRedShot } from './draw/redConstructs';
import { AllyInput } from './ally';
import { RED_HAND_LIFT } from './enemies/redConstructs';
import { updatePlayerCombat, revivePlayer } from './combat';
import { ENEMIES, createEnemy, enemyLabel, isEnemy, updateEnemies, type Enemy, type EnemyKind, type Role } from './enemies/enemies';
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
import { SIGNATURES, updateSignature, updateSignatureWorld } from './constructs/signature';
import { drawCallout, drawFortressBack, drawFortressFront, drawJet } from './draw/signature';
import { ENVIRONMENT_RULES, type EnvironmentKind } from './environment';
import {
	ACTIONS,
	BindingInput,
	ButtonState,
	PointerState,
	SLOT_ACTIONS,
	buttonLabel,
	shortLabel,
	usesMouse,
	type LayoutName
} from './input';
import { defaultSettings, type Settings } from './settings';
import { XP_PER_DEFEAT, addXp, applyProgression, type Profile, type Profiles } from './progression';
import { LANTERNS, type LanternId } from './lanterns';
import { buildTestMap, seededRandom, type GameMap, type Obstacle } from './map';
import { FEET_HALF_H, FEET_HALF_W, clampToBounds, createPlayer, updateFacing, updatePlayer, type Player, type WorldRules } from './player';
import { BUBBLE_SHIELD, constructLabel } from './constructs/defs';
import { autoReach, sameTarget, targetPosition, updateTargeting, type Target, type TargetWorld } from './targeting';
import { BATTERY_MAX_CHARGE, canSpend, updateBattery, updateWillpower, type Battery } from './willpower';

export const LANTERN_GREEN = GREEN;

export interface PlayerConfig {
	lantern: LanternId;
	/** Which keys control this player. */
	keys: LayoutName;
	/** Controlled by the computer (an AI partner) instead of keys. */
	ai?: boolean;
}

export interface GameOptions {
	players: PlayerConfig[];
	/** Space: always flying. Planet: walk, take off, land. Defaults to space. */
	environment?: EnvironmentKind;
	/** A specific map. Defaults to the test map for the environment. */
	map?: GameMap;
	/** Show "P1"/"P2" under the name tags. */
	showSlots?: boolean;
	/** Key bindings and accessibility options. Defaults if not given. */
	settings?: Settings;
	/**
	 * Hal's and John's saved progress. With it, upgrades apply and defeating
	 * enemies earns XP; without it (labs), there's no progression.
	 */
	profiles?: Profiles;
	/** Called whenever a profile changes (XP earned, level gained), so it can be saved. */
	onProgress?: (lantern: LanternId, profile: Profile, levelsGained: number) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Something drawn in the world, sorted by depth: lower `baseY` is further back. */
export interface Drawable {
	baseY: number;
	draw: () => void;
}

/** What runs a fight or a mission on top of the Game. */
export interface Director {
	update(game: Game, dt: number): void;
	/** Extra things of its own to draw in the world (a ship to escort...), depth-sorted with everything else. */
	drawables?(ctx: CanvasRenderingContext2D, alpha: number, time: number): Drawable[];
	/** Things the camera should keep in view along with the players (it centres between them all). */
	cameraPoints?(): [number, number][];
}

/** XP for knocking an asteroid apart, much less than for beating an enemy. */
const XP_PER_ROCK = 5;


/** Aim the camera at the Lantern's chest, not their feet. */
const CAMERA_AIM_UP = 30;

export class Game {
	/** Seconds of simulated time. Only update() changes it. */
	time = 0;
	/** Keys, mouse buttons and wheel, shared by every player on this computer. */
	readonly buttons = new ButtonState();
	/** Mouse position over the game. */
	readonly pointer = new PointerState();
	/** While paused, the world stops but keeps drawing. */
	paused = false;
	settings: Settings;
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
	/** Signature ability always ready. Toggled from the lab. */
	infiniteSurge = false;
	/** Lanterns can't be hurt. Toggled from the enemy lab. */
	godMode = false;
	/** Enemies stand still and don't attack. Toggled from the enemy lab. */
	freezeEnemies = false;
	/** Draw the health / willpower / construct bars. */
	hud = true;
	/** Show the big "is down, back up in..." notice (off when being down means game over). */
	downedNotice = true;
	/** Draw the Lanterns' names above their heads. */
	nameTags = true;
	/** Runs the fight: sends waves of enemies (the co-op lab), a scene, a mission. */
	director: Director | null = null;

	private rules: WorldRules;
	private inputs: BindingInput[];
	private profiles: Profiles | null;
	private onProgress: GameOptions['onProgress'];
	private starLayers;
	private showSlots: boolean;
	private view: View = { width: 0, height: 0 };
	private started = false;

	constructor({
		players,
		environment = 'space',
		map,
		showSlots = false,
		settings = defaultSettings(),
		profiles,
		onProgress
	}: GameOptions) {
		this.settings = settings;
		this.profiles = profiles ?? null;
		this.onProgress = onProgress;
		this.map = map ?? buildTestMap(environment);
		const env = ENVIRONMENT_RULES[this.map.environment];
		this.rules = { solids: this.map.obstacles, alwaysFlying: env.alwaysFlying };
		this.batteries = [{ ...this.map.battery, charge: BATTERY_MAX_CHARGE }];
		this.dummies = this.map.dummies.map((d) => createDummy(d.x, d.y));
		// The construct world shares the map's obstacle array, so walls a
		// Lantern builds block movement, and crates it breaks stop blocking.
		this.constructs = createConstructWorld(this.map.obstacles, this.dummies, this.map.environment === 'space');

		// Spawn side by side around the map's spawn point
		const gap = 170; // wide enough that name tags don't overlap
		const startX = this.map.spawn.x - (gap * (players.length - 1)) / 2;
		this.inputs = players.map((cfg) => new BindingInput(this.buttons, settings.bindings[cfg.keys]));
		this.layouts = players.map((cfg) => cfg.keys);
		this.players = players.map((cfg, slot) => {
			const ally = cfg.ai ? new AllyInput(this) : null;
			const p = createPlayer(slot, LANTERNS[cfg.lantern], ally ?? this.inputs[slot], startX + slot * gap, this.map.spawn.y);
			if (ally) {
				ally.me = p;
				this.aiSlots.add(slot);
			}
			if (env.alwaysFlying) {
				p.flying = true;
				p.altitude = 1;
			}
			if (profiles) {
				applyProgression(p, LANTERNS[cfg.lantern], profiles[cfg.lantern]);
				p.willpower = p.maxWillpower;
			}
			return p;
		});
		this.constructs.players = this.players;
		this.applySettings(settings);

		this.showSlots = showSlots;
		const rand = seededRandom(1);
		this.starLayers = [
			{ stars: makeStars(160, rand), parallax: 0.08 },
			{ stars: makeStars(70, rand), parallax: 0.25 }
		];
	}

	private layouts: LayoutName[];
	/** Players driven by an AI partner. */
	private aiSlots = new Set<number>();

	/**
	 * Use new settings (e.g. after changing them in the pause menu) without
	 * restarting the game.
	 */
	applySettings(settings: Settings) {
		this.settings = settings;
		this.buttons.gameButtons.clear();
		this.inputs.forEach((input, i) => {
			const bindings = settings.bindings[this.layouts[i]];
			input.bindings = bindings;
			input.options = {
				toggleShot: settings.toggleShot,
				quickCast: settings.quickCast,
				pointer: usesMouse(bindings)
					? { state: this.pointer, toWorld: (sx, sy) => this.screenToWorld(sx, sy) }
					: undefined
			};
			for (const action of ACTIONS) for (const code of bindings[action]) this.buttons.gameButtons.add(code);
		});
		this.players.forEach((p, i) => (p.smartRing = settings.smartRing && !this.aiSlots.has(i)));
	}

	/** Does any player aim with the mouse? (Then we hide the cursor and draw a crosshair.) */
	get usesMouse(): boolean {
		return this.inputs.some((input, slot) => !this.aiSlots.has(slot) && input.options.pointer !== undefined);
	}

	/** Screen (CSS px over the canvas) to world coordinates, through the camera. */
	screenToWorld(sx: number, sy: number): { x: number; y: number } {
		const { zoom } = this.camera;
		return {
			x: this.camera.x + (sx - this.view.width / 2) / zoom,
			y: this.camera.y + (sy - this.view.height / 2) / zoom
		};
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

		// Put the camera on the players straight away, even if the game starts
		// paused (behind the controls card), so the view behind it is right.
		if (!this.started) {
			const [tx, ty] = this.cameraTarget();
			this.camera.snapTo(tx, ty, this.view, this.map.width, this.map.height);
			this.started = true;
		}
		if (this.paused) return;

		const { map } = this;
		for (const b of this.batteries) updateBattery(b, dt);

		for (const p of this.players) {
			const intent = p.input.read();
			if (this.godMode) p.invuln = Math.max(p.invuln, 0.1);
			if (updatePlayerCombat(p, dt)) {
				// Back on their feet next to the battery
				const b = this.batteries[0] ?? map.spawn;
				revivePlayer(p, b.x + 40 * (p.slot === 0 ? -1 : 1), b.y + 60);
			}
			updatePlayer(p, intent, dt, this.rules);
			// Keep feet inside the map, with room above for the body (and the flying height)
			const top = FIGURE_HEIGHT + this.poseFor(p).hoverHeight * p.altitude * 1.35;
			clampToBounds(p, FIGURE_HALF_WIDTH, top, map.width - FIGURE_HALF_WIDTH, map.height - 6);
			// The crosshair sits where you SEE the shot land, at ring height. Shots
			// travel along the ground plane, so drop the aim point by that height.
			// Knocked down, the body lies still: no turning to the mouse, no aiming
			if (!p.downed) {
				const pointer = intent.pointer && { x: intent.pointer.x, y: intent.pointer.y + p.ringLift };
				updateTargeting(p, intent.target, this.targetWorld, autoReach(p.loadout[p.selected]), {
					pointer,
					aimAssist: this.settings.aimAssist
				});
				updateFacing(p, dt);
				// Now the aim is known, find the ring on the aimed skeleton
				this.updateRing(p);
			}
			updateWillpower(p, dt, this.batteries);
			updatePlayerConstructs(p, intent, dt, this.constructs);
			updateSignature(p, intent, dt, this.constructs);
			if (this.infiniteWillpower) {
				p.willpower = 100;
				p.exhausted = false;
			}
			if (this.infiniteSurge && !p.dash) p.surge = 100;
		}

		if (!this.freezeEnemies) updateEnemies(this.constructs, this.players, dt);
		updateConstructWorld(this.constructs, dt);
		updateAidStations(this.constructs, this.players, dt);
		updateSignatureWorld(this.constructs, dt);
		this.handleEvents();
		// Red Lanterns fly, so only tall things (asteroids, energy walls) block them
		const flyerSolids = map.obstacles.filter((o) => o.blocksFlying);
		for (const d of this.dummies) {
			const enemy = isEnemy(d);
			if (enemy && this.freezeEnemies) {
				d.vx = d.vy = 0;
				d.brain.state = 'idle';
			}
			// Drifting things (asteroids) keep their speed and pass over everything; their director removes them
			if (d.drift) {
				updateDummy(d, dt, [], false);
				continue;
			}
			updateDummy(d, dt, enemy ? flyerSolids : map.obstacles, !enemy);
			d.x = Math.min(Math.max(d.x, DUMMY_HALF_W), map.width - DUMMY_HALF_W);
			d.y = Math.min(Math.max(d.y, DUMMY_HALF_H), map.height - DUMMY_HALF_H);
		}
		// Defeated enemies that finished fading out leave the world (same array
		// the construct system and targeting use, so it's removed everywhere)
		for (let i = this.dummies.length - 1; i >= 0; i--) {
			if (this.dummies[i].gone) this.dummies.splice(i, 1);
		}

		this.director?.update(this, dt);

		const [tx, ty, fw, fh] = this.cameraTarget();
		if (this.players.length > 1 || this.director?.cameraPoints) this.camera.fit(fw, fh, dt, this.view);
		this.camera.follow(tx, ty, dt, this.view, map.width, map.height);
	}

	/** Put an enemy into the world (labs, scenes, missions). */
	spawnEnemy(kind: EnemyKind, x: number, y: number, role: Role = 'berserker'): Enemy {
		const e = createEnemy(kind, x, y, role);
		this.dummies.push(e);
		this.constructs.effects.push({ kind: 'roar', x, y, age: 0, life: 0.5, radius: 50, lift: 30 });
		// Named characters get announced
		if (ENEMIES[kind].lieutenant) {
			this.constructs.effects.push({ kind: 'callout', x, y: y - 110, age: 0, life: 2, text: ENEMIES[kind].name.toUpperCase(), hurt: true });
		}
		return e;
	}

	/** Enemies still standing. */
	get enemies(): Enemy[] {
		return this.dummies.filter((d): d is Enemy => isEnemy(d) && isStanding(d));
	}

	/** React to what happened this tick: XP and level-ups for defeats. */
	private handleEvents() {
		const cw = this.constructs;
		for (const event of cw.events) {
			if (event.type !== 'defeat' || !this.profiles) continue;
			const p = event.by;
			const id = p.def.id;
			const profile = this.profiles[id];
			const xp = event.what.kind === 'spaceRock' ? XP_PER_ROCK : XP_PER_DEFEAT;
			const gained = addXp(profile, xp);
			const headY = p.y - FIGURE_HEIGHT - this.poseFor(p).hoverHeight * p.altitude * 1.35;
			cw.effects.push({ kind: 'text', x: p.x, y: headY - 6, age: 0, life: 1.1, text: `+${xp} XP` });
			if (gained > 0) {
				cw.effects.push({ kind: 'callout', x: p.x, y: p.y, age: 0, life: 1.6, text: 'LEVEL UP!', owner: p });
				// New points are spent at Corps HQ; the level shows in the HUD right away
			}
			this.onProgress?.(id, profile, gained);
		}
		cw.events.length = 0;
	}

	/**
	 * What the camera frames: the middle and size of a box around every player
	 * (and anything the director wants in view, like a ship to escort), with
	 * room around it for bodies, name tags and incoming attacks.
	 */
	private cameraTarget(): [number, number, number, number] {
		// Anchors: the players, plus anything the director wants kept in view (the ship to escort)
		const anchors: [number, number][] = [
			...this.players.map((p): [number, number] => [p.x, p.y - CAMERA_AIM_UP]),
			...(this.director?.cameraPoints?.() ?? [])
		];
		const xs = anchors.map((p) => p[0]);
		const ys = anchors.map((p) => p[1]);
		const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
		const margin = 170;
		let x = 0;
		let y = 0;
		for (const [ax, ay] of anchors) {
			x += ax;
			y += ay;
		}
		x /= anchors.length;
		y /= anchors.length;
		const width = 2 * Math.max(x - minX, maxX - x) + margin * 2;
		const height = 2 * Math.max(y - minY, maxY - y) + margin * 2;
		return [x, y, width, height];
	}

	private poseFor(p: Player): LanternPose {
		const env = ENVIRONMENT_RULES[this.map.environment];
		return {
			...p,
			// Lean comes from horizontal speed: flying sideways fast = full lean.
			// Jet Strike is always full speed.
			// Flying backwards (facing a target while backing off) stays upright.
			lean: p.dash ? 1 : p.flying ? Math.min(Math.max(0, p.vx * p.dir) / p.def.maxSpeed, 1) : 0,
			hoverHeight: this.map.environment === 'space' ? HOVER_SPACE : HOVER_PLANET,
			glow: true,
			shadow: env.hasGround,
			// The ring arm aims while a construct is running or just used
			firing: p.firing || p.actionTimer > 0 || p.shotTimer > 0,
			shotKick: p.shotTimer / SHOT_POSE_TIME,
			// Cast is strongest right as the construct forms, then eases off
			cast: p.actionTimer > 0 ? Math.min(1, p.actionTimer / ACTION_POSE_TIME) : 0,
			hurt: Math.min(1, p.hurtTimer / 0.35),
			downed: p.downed,
			victory: Math.min(1, p.victoryTimer / 0.4)
		};
	}

	/** Where the ring is on this Lantern's aimed skeleton, relative to their anchor. */
	private updateRing(p: Player) {
		const pose = { ...this.poseFor(p), firing: true };
		const [rx, ry] = ringPosition(0, 0, pose, this.time);
		p.ringDX = rx;
		p.ringLift = -ry;
		// Where the body is drawn, so enemy shots hit what they're seen to touch
		p.bodyBottom = pose.hoverHeight * p.altitude * 1.35;
		p.bodyTop = p.bodyBottom + FIGURE_HEIGHT;
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
		// Traps and Fortress rings are markings on the ground: under everything
		for (const t of cw.traps) drawTrap(ctx, t, this.time);
		for (const e of cw.effects) if (e.kind === 'slamMark') drawRedEffect(ctx, e, 0, this.time);
		drawRedGround(ctx, cw.red.puddles, cw.red.strikes, this.time);
		const inSpace = map.environment === 'space';
		for (const f of cw.fortresses) drawFortressBack(ctx, f, this.time, inSpace);
		for (const a of cw.aids) drawAidStation(ctx, a, this.time, inSpace);

		// ---- Everything with depth, sorted back to front ----
		// Ground things sort by their base y: lower on screen = in front.
		// Flying Lanterns are above it all, so they're drawn after.
		const ground: Drawable[] = [];
		const air: Drawable[] = [];

		for (const o of map.obstacles) {
			// Skip anything well off screen (tall things poke up, so pad the top)
			if (o.x > visible.right || o.x + o.w < visible.left) continue;
			if (o.y - o.height > visible.bottom || o.y + o.h < visible.top) continue;
			ground.push({ baseY: o.y + o.h, draw: () => drawObstacle(ctx, o, this.time, inSpace) });
		}
		for (const b of this.batteries) {
			ground.push({ baseY: b.y, draw: () => drawBattery(ctx, b, env.hasGround, this.time) });
		}
		for (const t of cw.turrets) {
			ground.push({ baseY: t.y, draw: () => drawAutoTurret(ctx, t, this.time, inSpace) });
		}
		for (const d of this.dummies) {
			const x = lerp(d.prevX, d.x, alpha);
			const y = lerp(d.prevY, d.y, alpha);
			ground.push({
				baseY: y,
				draw: isEnemy(d)
					? () => drawEnemy(ctx, d, x, y, env.hasGround, this.time)
					: d.drift
						? () => drawSpaceRock(ctx, d, x, y, this.time)
						: () => drawDummy(ctx, d, x, y, env.hasGround, this.time, this.settings.reduceFlashing)
			});
		}
		if (this.director?.drawables) ground.push(...this.director.drawables(ctx, alpha, this.time));

		const overlays: (() => void)[] = [];
		const tags: (() => void)[] = [];
		for (const p of this.players) {
			const x = lerp(p.prevX, p.x, alpha);
			const y = lerp(p.prevY, p.y, alpha);
			const pose = this.poseFor(p);
			const list = p.altitude > 0.5 ? air : ground;
			// During Jet Strike the Lantern is drawn as the jet's pilot instead (below)
			if (p.dash?.kind !== 'jet') list.push({ baseY: y, draw: () => drawLantern(ctx, p.def, x, y, pose, this.time) });

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
				if (held === 'minigun' || held === 'cannon' || held === 'sniper' || held === 'shotgun' || held === 'rockets') {
					overlays.push(() => drawHeldConstruct(ctx, held, rx, ry, p.aimX, p.aimY, this.time));
				}
				if (p.charge > 0 && def.behavior === 'snipe') {
					// Laser sight to where the shot would stop (the first solid, unbreakable thing)
					const blockers = map.obstacles.filter((o) => o.kind !== 'wall' && o.hp === undefined);
					const { length } = castBeam(p.x + p.ringDX, p.y, p.aimX, p.aimY, blockers, def.range);
					overlays.push(() => drawLaserSight(ctx, rx, ry, p.aimX, p.aimY, length, p.charge, this.time));
				}
			}

			const who = this.aiSlots.has(p.slot) ? 'AI' : `P${p.slot + 1}`;
			const tag = this.showSlots ? `${who} · ${p.def.name}` : p.def.name;
			const lift = pose.hoverHeight * p.altitude * 1.35;
			tags.push(() => drawNameTag(ctx, tag, x, y, lift));
		}

		for (const list of [ground, air]) {
			list.sort((a, b) => a.baseY - b.baseY);
			for (const d of list) d.draw();
		}
		for (const o of overlays) o();

		// Jet Strike: the fighter jet wrapped around Hal
		for (const p of this.players) {
			if (p.dash?.kind !== 'jet') continue;
			const x = lerp(p.prevX, p.x, alpha);
			const y = lerp(p.prevY, p.y, alpha);
			const bodyY = y - this.poseFor(p).hoverHeight * 1.35 - 34;
			drawJet(ctx, x, bodyY, p.dash.dx, p.dash.dy, this.time, p.def);
		}
		// Fortress domes go over whoever is inside (they're see-through)
		for (const f of cw.fortresses) drawFortressFront(ctx, f, this.time, inSpace);

		// Chains: from the hand to the flying hook, or to whatever it caught
		for (const pr of cw.projectiles) {
			const x = lerp(pr.prevX, pr.x, alpha);
			const y = lerp(pr.prevY, pr.y, alpha);
			const lift = pr.lift;
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

		// Bubble shields around whoever they protect (a mission draws its own things' bubbles)
		for (const sh of cw.shields) {
			const t = sh.target;
			if (!isPlayer(t)) continue;
			const lift = this.poseFor(t).hoverHeight * t.altitude * 1.35;
			drawShield(ctx, sh, lerp(t.prevX, t.x, alpha), lerp(t.prevY, t.y, alpha), lift, FIGURE_HEIGHT, this.time, this.settings.reduceFlashing);
		}

		// Target markers: what each Lantern will hit, and who they're protecting
		for (const p of this.players) {
			for (const t of [p.attackTarget, p.protectTarget]) {
				if (!t) continue;
				const [tx, ty] = this.targetDrawPosition(t, alpha);
				drawReticle(ctx, t, tx, ty, sameTarget(t, p.lock), this.time);
			}
		}
		// Red Lantern projectiles, and Barbed Chains from the hand to the hook or the Lantern caught
		for (const s of cw.red.shots) {
			const x = lerp(s.prevX, s.x, alpha);
			const y = lerp(s.prevY, s.y, alpha);
			if (s.kind === 'hook') drawRedChain(ctx, ...this.redHand(s.owner, alpha), x, y - RED_HAND_LIFT, this.time);
			drawRedShot(ctx, s, x, y, RED_HAND_LIFT, this.time);
		}
		for (const bm of cw.red.beams) drawRedBeam(ctx, bm, ...this.redHand(bm.owner, alpha), this.time);
		for (const c of cw.red.cages) {
			const t = c.target;
			const x = lerp(t.prevX, t.x, alpha);
			const y = lerp(t.prevY, t.y, alpha);
			const top = y - this.poseFor(t).hoverHeight * t.altitude * 1.35 - FIGURE_HEIGHT;
			drawRedCage(ctx, c, x, y - this.poseFor(t).hoverHeight * t.altitude * 1.35, top, this.time);
		}
		drawFallingMeteors(ctx, cw.red.strikes, this.time);
		for (const c of cw.red.chains) {
			const t = c.target;
			const bodyY = lerp(t.prevY, t.y, alpha) - this.poseFor(t).hoverHeight * t.altitude * 1.35 - FIGURE_HEIGHT * 0.55;
			drawRedChain(ctx, ...this.redHand(c.owner, alpha), lerp(t.prevX, t.x, alpha), bodyY, this.time);
		}

		for (const e of cw.effects) {
			if (e.kind === 'number' && !this.settings.damageNumbers) continue;
			if (e.kind === 'slamMark') continue; // drawn on the ground, above
			if (e.kind === 'callout') {
				// Follow the Lantern who shouted it, above their head
				const o = e.owner;
				const cx = o ? lerp(o.prevX, o.x, alpha) : e.x;
				const cy = o ? lerp(o.prevY, o.y, alpha) - FIGURE_HEIGHT - this.poseFor(o).hoverHeight * o.altitude * 1.35 - 34 : e.y;
				drawCallout(ctx, e.text ?? '', cx, cy, e.age / e.life, e.hurt);
				continue;
			}
			if (e.kind === 'pop' && e.owner) {
				// A shield popping: centre it on the body it was protecting, same size as the bubble
				const o = e.owner;
				const bodyMid = this.poseFor(o).hoverHeight * o.altitude * 1.35 + FIGURE_HEIGHT * 0.5;
				drawEffect(ctx, { ...e, radius: FIGURE_HEIGHT * 0.66 }, bodyMid, this.time);
				continue;
			}
			drawEffect(ctx, e, e.lift ?? 0, this.time, inSpace);
		}
		if (this.nameTags) for (const t of tags) t();

		if (this.debug) this.drawDebug(ctx);
		ctx.restore();

		// ---- Screen space ----
		if (this.hud) drawHud(
			ctx,
			this.players.map((p, i) => ({
				name: p.def.name,
				slot: p.slot,
				level: this.profiles ? this.profiles[p.def.id].level : null,
				health: p.health,
				maxHealth: p.maxHealth,
				downed: p.downed,
				downTimer: p.downTimer,
				willpower: p.willpower,
				maxWillpower: p.maxWillpower,
				exhausted: p.exhausted,
				charging: p.charging,
				selected: p.selected,
				smart: p.smartRing ? { key: buttonLabel(this.inputs[i].bindings.construct[0] ?? ''), pick: p.smartPick } : null,
				slots: p.loadout.map((def, s) => ({
					...constructLabel(def, cw.space),
					key: shortLabel(this.inputs[i].bindings[SLOT_ACTIONS[s]]),
					cooldown: def.cooldown > 0 ? Math.min(1, p.cooldowns[s] / (def.cooldown * p.def.traits.cooldown)) : 0,
					affordable: canSpend(p, def.behavior === 'beam' ? 15 : costOf(p, def))
				})),
				shield: {
					key: shortLabel(this.inputs[i].bindings.shield),
					cooldown: Math.min(1, p.shieldCooldown / (BUBBLE_SHIELD.cooldown * p.def.traits.cooldown)),
					affordable: canSpend(p, BUBBLE_SHIELD.cost),
					active: cw.shields.some((sh) => sh.target === p)
				},
				targetLabel: this.targetLabel(p),
				surge: {
					fill: p.surge / 100,
					name: SIGNATURES[p.def.id].name,
					key: shortLabel(this.inputs[i].bindings.signature),
					active: p.dash !== null || cw.fortresses.some((f) => f.owner === p)
				}
			})),
			width,
			height,
			this.time
		);

		// Solo: a big notice while down. (Co-op shows it per player in M7.)
		if (this.downedNotice && this.players.length === 1 && this.players[0].downed) {
			drawDownedNotice(ctx, this.players[0].def.name, this.players[0].downTimer, width, height);
		}

		if (this.usesMouse && this.pointer.active && !this.paused) drawCrosshair(ctx, this.pointer.x, this.pointer.y, this.time);
	}

	/** An enemy's hand (or eye, or gun), where its chains and beams start. */
	private redHand(e: Enemy, alpha: number): [number, number] {
		return enemyMuzzle(e, lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha));
	}

	/** Where to draw a target marker, smoothed like everything else. */
	private targetDrawPosition(t: Target, alpha: number): [number, number] {
		if (t.kind === 'enemy') return [lerp(t.dummy.prevX, t.dummy.x, alpha), lerp(t.dummy.prevY, t.dummy.y, alpha)];
		if (t.kind === 'ally') return [lerp(t.player.prevX, t.player.x, alpha), lerp(t.player.prevY, t.player.y, alpha)];
		return targetPosition(t);
	}

	/** Short HUD text for what a Lantern is aiming at / protecting. */
	private targetLabel(p: Player): string {
		const name = (t: Target) =>
			t.kind === 'enemy'
				? isEnemy(t.dummy)
					? enemyLabel(t.dummy)
					: t.dummy.kind === 'spaceRock'
						? 'Asteroid'
						: 'Dummy'
				: t.kind === 'ally'
					? t.player.def.name
					: 'Crate';
		const parts: string[] = [];
		if (p.attackTarget) parts.push(`${sameTarget(p.attackTarget, p.lock) ? '🔒 ' : ''}${name(p.attackTarget)}`);
		if (p.protectTarget) parts.push(`🛡 ${name(p.protectTarget)}`);
		else if (!p.downed) {
			// Where Shift would put the bubble right now, when it isn't on yourself
			const shieldOn = chooseShieldTarget(p, this.constructs);
			if (shieldOn !== p) parts.push(`🛡 ${isPlayer(shieldOn) ? shieldOn.def.name : shieldOn.name}`);
		}
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
			if (!isStanding(d)) continue;
			ctx.strokeRect(d.x - DUMMY_HALF_W, d.y - DUMMY_HALF_H, DUMMY_HALF_W * 2, DUMMY_HALF_H * 2);
			if (!isEnemy(d)) continue;
			// AI state and attack range, for the enemy lab
			const b = d.brain;
			ctx.save();
			ctx.font = '600 10px ui-monospace, monospace';
			ctx.textAlign = 'center';
			ctx.fillStyle = '#ffd0d0';
			const doing = b.ability ? `${b.state} ${b.ability}` : b.state === 'move' ? b.goal : b.state;
			const eye = b.target ? (b.sees ? ' 👁' : ' ?') : '';
			ctx.fillText(`${enemyLabel(d)}: ${doing}${b.engaged ? ' ⚔' : ''}${eye}`, d.x, d.y + 16);
			const P = b.persona;
			const traits = `agg ${Math.round(P.aggression * 9)} · cau ${Math.round(P.caution * 9)} · pat ${Math.round(P.patience * 9)}`;
			ctx.fillStyle = 'rgba(255, 208, 208, 0.6)';
			ctx.fillText(b.rage > 0.05 ? `${traits} · rage ${Math.round(b.rage * 100)}%` : traits, d.x, d.y + 28);
			if (b.goal === 'cover' && b.state === 'move') {
				ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
				ctx.strokeRect(b.goalX - 6, b.goalY - 6, 12, 12);
			}
			// A line to who it's after
			if (b.target) {
				ctx.strokeStyle = 'rgba(255, 90, 90, 0.25)';
				ctx.setLineDash([3, 5]);
				ctx.beginPath();
				ctx.moveTo(d.x, d.y);
				ctx.lineTo(b.target.x, b.target.y);
				ctx.stroke();
			}
			ctx.restore();
		}
	}
}
