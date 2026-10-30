// John's Armory: the military constructs he can swap in, and picking a kit.

import { afterEach, describe, expect, it } from 'vitest';
import { DUMMY_HP, createDummy, updateDummy, type Dummy } from '../dummy';
import { IDLE, type Intent } from '../input';
import { LANTERNS } from '../lanterns';
import { createPlayer, type Player } from '../player';
import { MAX_WILLPOWER } from '../willpower';
import { ARMORY, CONSTRUCTS, KIT_SIZE, LOADOUTS, kitOf, setKit, type ConstructId } from './defs';
import { createConstructWorld, updateConstructWorld, updatePlayerConstructs, type ConstructWorld } from './system';

const DT = 1 / 60;
const FIRE: Intent = { ...IDLE, construct: true, constructPressed: true };

/** John at (0, 0) aiming right, with the given construct in hand. */
function setup(construct: ConstructId, dummies: Dummy[] = []) {
	const p = createPlayer(0, LANTERNS.john, { read: () => IDLE }, 0, 0);
	p.loadout = [...p.loadout];
	p.loadout[0] = CONSTRUCTS[construct];
	p.selected = 0;
	return { p, w: createConstructWorld([], dummies) };
}

function run(p: Player, w: ConstructWorld, intent: Intent, seconds: number) {
	for (let i = 0; i < Math.round(seconds * 60); i++) {
		updatePlayerConstructs(p, intent, DT, w);
		updateConstructWorld(w, DT);
		for (const d of w.dummies) updateDummy(d, DT, w.obstacles);
	}
}

function press(p: Player, w: ConstructWorld, seconds = 1) {
	run(p, w, FIRE, DT);
	run(p, w, IDLE, seconds);
}

afterEach(() => setKit('john', null));

describe("John's Armory", () => {
	it('he carries his usual ten until a kit is picked; a picked kit is what he takes into a fight', () => {
		expect(kitOf('john')).toEqual(LOADOUTS.john);
		const kit = ARMORY.john!.slice(5, 5 + KIT_SIZE);
		setKit('john', kit);
		expect(kitOf('john')).toEqual(kit);
		const p = createPlayer(0, LANTERNS.john, { read: () => IDLE }, 0, 0);
		expect(p.loadout.map((c) => c.id)).toEqual(kit);
	});

	it('a bad kit (too short, repeats, something not in his armory) is ignored', () => {
		setKit('john', ['tank', 'mortar']);
		expect(kitOf('john')).toEqual(LOADOUTS.john);
		setKit('john', Array(KIT_SIZE).fill('tank'));
		expect(kitOf('john')).toEqual(LOADOUTS.john);
		setKit('john', [...LOADOUTS.john.slice(0, 9), 'glove']);
		expect(kitOf('john')).toEqual(LOADOUTS.john);
	});

	it('Battle Tank rolls through a line of them, then fires its main gun', () => {
		const ds = [createDummy(150, 0), createDummy(300, 0)];
		const far = createDummy(820, 0);
		const { p, w } = setup('tank', [...ds, far]);
		press(p, w, 0.6);
		expect(ds.every((d) => d.hp < DUMMY_HP)).toBe(true);
		// Rolled out to its range: the shell goes on from there
		run(p, w, IDLE, 1.5);
		expect(far.hp).toBeLessThan(DUMMY_HP);
	});

	it('Mortar Barrage: several shells, landing one after another round the mark', () => {
		const d = createDummy(300, 0);
		const { p, w } = setup('mortar', [d]);
		p.aimReach = 300;
		run(p, w, FIRE, DT);
		expect(w.pillarStrikes).toHaveLength(CONSTRUCTS.mortar.count);
		const times = w.pillarStrikes.map((s) => s.time);
		expect(new Set(times).size).toBe(times.length);
		run(p, w, IDLE, 2);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});

	it('Attack Helicopter rides on his wing like the Wingman and shoots what he is fighting', () => {
		const d = createDummy(320, 0);
		const { p, w } = setup('gunship', [d]);
		press(p, w, 0.1);
		const heli = w.turrets.filter((t) => t.def.id === 'gunship');
		expect(heli).toHaveLength(1);
		expect(heli[0].follow).toBeTruthy();
		run(p, w, IDLE, 2.5);
		expect(d.hp).toBeLessThan(DUMMY_HP);
		// Calling another replaces it
		p.cooldowns[p.selected] = 0;
		p.willpower = MAX_WILLPOWER;
		press(p, w, 0.1);
		expect(w.turrets.filter((t) => t.def.behavior === 'wingman')).toHaveLength(1);
	});

	it('Claymores: three laid in a line ahead of him', () => {
		const { p, w } = setup('claymores');
		press(p, w, 0.1);
		const laid = w.traps.filter((t) => t.look === 'claymore');
		expect(laid).toHaveLength(3);
		expect(laid.every((t) => t.x > 0)).toBe(true);
	});

	it('Sentry Gun: a turret that fires faster than an Auto-Turret', () => {
		const d = createDummy(250, 0);
		const { p, w } = setup('sentry', [d]);
		press(p, w, 0.1);
		const gun = w.turrets.find((t) => t.def.id === 'sentry');
		expect(gun).toBeTruthy();
		run(p, w, IDLE, 1);
		expect(gun!.cooldown).toBeLessThan(0.2);
		expect(d.hp).toBeLessThan(DUMMY_HP);
	});
});
