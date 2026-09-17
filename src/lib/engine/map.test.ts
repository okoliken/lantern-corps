import { describe, expect, it } from 'vitest';
import { buildPlanetTestMap, buildSpaceTestMap, seededRandom } from './map';
import { feetOverlap } from './player';

describe('test maps', () => {
	for (const build of [buildPlanetTestMap, buildSpaceTestMap]) {
		const map = build();

		describe(map.name, () => {
			it('has obstacles', () => {
				expect(map.obstacles.length).toBeGreaterThan(10);
			});

			it('keeps every obstacle inside the map', () => {
				for (const o of map.obstacles) {
					expect(o.x).toBeGreaterThanOrEqual(0);
					expect(o.y).toBeGreaterThanOrEqual(0);
					expect(o.x + o.w).toBeLessThanOrEqual(map.width);
					expect(o.y + o.h).toBeLessThanOrEqual(map.height);
				}
			});

			it('leaves the spawn point clear so players never start stuck', () => {
				for (let dx = -200; dx <= 200; dx += 20) {
					for (const o of map.obstacles) {
						expect(feetOverlap(map.spawn.x + dx, map.spawn.y, o)).toBe(false);
					}
				}
			});

			it('comes out the same every time', () => {
				expect(build()).toEqual(map);
			});
		});
	}

	it('space asteroids block flyers; planet obstacles do not', () => {
		expect(buildSpaceTestMap().obstacles.every((o) => o.blocksFlying)).toBe(true);
		expect(buildPlanetTestMap().obstacles.every((o) => !o.blocksFlying)).toBe(true);
	});
});

describe('seededRandom', () => {
	it('same seed, same sequence', () => {
		const a = seededRandom(42);
		const b = seededRandom(42);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});
});
