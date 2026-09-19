// Maps: the size of a level, where players start, and what's in the way.
// These are test maps for M2. Mission maps come in M6.

import type { EnvironmentKind } from './environment';
import type { GroundStyle } from './draw/world';
import type { Solid } from './physics';

/** 'wall' is an Energy Wall construct, 'redWall' a Red Lantern's Rage Wall; the rest are part of the map. */
export type ObstacleKind = 'building' | 'rock' | 'crate' | 'asteroid' | 'wall' | 'redWall' | 'cell';

export interface Obstacle extends Solid {
	kind: ObstacleKind;
	/** How tall it's drawn, in px. Purely visual: collision uses the footprint. */
	height: number;
	/** Per-obstacle random number, so each one looks a little different. */
	seed: number;
	/** Breakable things have health; constructs wear it down. No hp = unbreakable. */
	hp?: number;
	/** Full health, for drawing damage. */
	maxHp?: number;
	/** Construct walls fade away: seconds left... */
	life?: number;
	/** ...out of this many. */
	maxLife?: number;
	/** Crates can be dragged by the Chain. */
	movable?: boolean;
	/** Only a footprint: something the mission draws itself (a tower, a shelter dome) is solid here. */
	hidden?: boolean;
}

/** How much beam a crate can take. */
export const CRATE_HP = 60;

export interface GameMap {
	name: string;
	environment: EnvironmentKind;
	width: number;
	height: number;
	spawn: { x: number; y: number };
	/** Where the Lantern battery stands. */
	battery: { x: number; y: number };
	/** How the surface looks on a planet (default dust). */
	ground?: GroundStyle;
	/** Training dummies to practise constructs on (test maps only). */
	dummies: { x: number; y: number }[];
	obstacles: Obstacle[];
}

/** The battery sits just above where players start, inside the clear spawn zone. */
const batteryFor = (spawn: { x: number; y: number }) => ({ x: spawn.x, y: spawn.y - 110 });

/** A row of training dummies just below spawn, inside the clear zone. */
const dummiesFor = (spawn: { x: number; y: number }) =>
	[-190, 0, 190].map((dx) => ({ x: spawn.x + dx, y: spawn.y + 140 }));

/**
 * Small seeded random generator (mulberry32). Same seed = same numbers,
 * so a "random" map comes out identical every time it loads.
 */
export function seededRandom(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const overlaps = (a: Solid, b: Solid, gap: number) =>
	a.x - gap < b.x + b.w && a.x + a.w + gap > b.x && a.y - gap < b.y + b.h && a.y + a.h + gap > b.y;

/** Try to place a piece where it doesn't touch anything else or the spawn area. */
function place(
	list: Obstacle[],
	spawn: { x: number; y: number },
	candidate: Obstacle,
	gap: number
): boolean {
	const spawnZone: Solid = { x: spawn.x - 220, y: spawn.y - 160, w: 440, h: 320, blocksFlying: false };
	if (overlaps(candidate, spawnZone, 0)) return false;
	if (list.some((o) => overlaps(candidate, o, gap))) return false;
	list.push(candidate);
	return true;
}

/** A city-edge test map: blocks of buildings on a street grid, plus rocks and crates. */
export function buildPlanetTestMap(): GameMap {
	const rand = seededRandom(2814);
	const width = 3000;
	const height = 2000;
	const spawn = { x: width / 2, y: height / 2 };
	const obstacles: Obstacle[] = [];

	// Buildings: one per city block, leaving streets between them
	for (let col = 0; col < 6; col++) {
		for (let row = 0; row < 4; row++) {
			const w = 170 + rand() * 110;
			const h = 110 + rand() * 90;
			const x = 120 + col * 480 + rand() * (380 - w);
			const y = 160 + row * 460 + rand() * (300 - h);
			place(obstacles, spawn, { kind: 'building', x, y, w, h, height: 90 + rand() * 90, blocksFlying: false, seed: rand() }, 40);
		}
	}

	// Scatter rocks and crates in the open spaces
	for (let i = 0; i < 120; i++) {
		const crate = rand() < 0.4;
		const size = crate ? 34 + rand() * 10 : 30 + rand() * 50;
		place(
			obstacles,
			spawn,
			{
				kind: crate ? 'crate' : 'rock',
				x: 40 + rand() * (width - 80 - size),
				y: 40 + rand() * (height - 80 - size),
				w: size,
				h: size * (crate ? 0.7 : 0.55),
				height: crate ? 28 : 12 + size * 0.2,
				blocksFlying: false,
				seed: rand(),
				hp: crate ? CRATE_HP : undefined,
				maxHp: crate ? CRATE_HP : undefined,
				movable: crate || undefined
			},
			30
		);
	}

	return { name: 'Coast City Outskirts', environment: 'planet', width, height, spawn, battery: batteryFor(spawn), dummies: dummiesFor(spawn), obstacles };
}

/** An asteroid field. Asteroids are big enough to block flyers, which is everyone in space. */
export function buildSpaceTestMap(): GameMap {
	const rand = seededRandom(7);
	const width = 3200;
	const height = 2200;
	const spawn = { x: width / 2, y: height / 2 };
	const obstacles: Obstacle[] = [];

	for (let i = 0; i < 90 && obstacles.length < 34; i++) {
		const size = 60 + rand() ** 2 * 190; // mostly small, a few huge
		place(
			obstacles,
			spawn,
			{
				kind: 'asteroid',
				x: 60 + rand() * (width - 120 - size),
				y: 60 + rand() * (height - 120 - size),
				w: size,
				h: size * 0.6,
				height: size * 0.45,
				blocksFlying: true,
				seed: rand()
			},
			90
		);
	}

	return {
		name: 'Asteroid Belt, Sector 2814',
		environment: 'space',
		width,
		height,
		spawn,
		battery: batteryFor(spawn),
		dummies: dummiesFor(spawn),
		obstacles
	};
}

export function buildTestMap(environment: EnvironmentKind): GameMap {
	return environment === 'space' ? buildSpaceTestMap() : buildPlanetTestMap();
}
