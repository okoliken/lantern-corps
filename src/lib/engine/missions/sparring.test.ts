import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { isStanding } from '../dummy';
import { damagePlayer } from '../combat';
import { ENEMIES } from '../enemies/enemies';
import { EXTRAS, OPPONENTS, ROSTER, TIERS, buildSparringMap, isReady, opponentById, Sparring } from './sparring';

function setup(id: string, as: 'hal' | 'john' = 'hal') {
	const opponent = opponentById(id)!;
	const map = buildSparringMap();
	const game = new Game({ players: [{ lantern: as, keys: 'solo' }], map });
	game.setView({ width: 1400, height: 800 });
	// Hal vs. John: you fight the one you are not playing
	const kind = opponent.id === 'mirror' ? (as === 'hal' ? 'sparJohn' : 'sparHal') : opponent.kind!;
	const sparring = new Sparring(opponent, map, kind);
	game.director = sparring;
	const run = (seconds: number, each: () => void = () => {}) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	return { game, sparring, run };
}

describe('Sparring · One on One', () => {
	it('has every opponent from the roster, in four tiers', () => {
		expect(OPPONENTS.length).toBe(14);
		for (const tier of TIERS) expect(OPPONENTS.some((o) => o.tier === tier.id)).toBe(true);
		for (const foe of ROSTER) {
			expect(foe.tests.length).toBeGreaterThan(20);
			expect(TIERS.some((t) => t.id === foe.tier)).toBe(true);
			expect(opponentById(foe.id)).toBe(foe);
		}
	});

	it('nothing is locked: every opponent that has a figure can be fought straight away', () => {
		// The mode is not a ladder. If they are built, they are available.
		const ready = ROSTER.filter(isReady);
		expect(ready.length).toBeGreaterThanOrEqual(10);
		// The League fight here the moment they exist, not when somebody remembers to switch them on
		for (const id of ['wonderwoman', 'flash', 'superman', 'hawkgirl']) expect(isReady(opponentById(id)!)).toBe(true);
		for (const foe of ready) expect(ENEMIES[foe.kind!]).toBeTruthy();
	});

	it('the ones still being drawn are marked, not hidden', () => {
		const toCome = OPPONENTS.filter((o) => !isReady(o));
		// They still carry their roster entry, so the list reads complete
		for (const foe of toCome) expect(foe.tests.length).toBeGreaterThan(20);
		expect(toCome.map((o) => o.id)).toContain('batman');
	});

	it('the Corps fight in Corps green, and the League fight as themselves', () => {
		for (const foe of ROSTER.filter(isReady)) {
			const def = ENEMIES[foe.kind!];
			expect(def.faction).not.toBe('red');
			// Green Lanterns: Corps green. Everyone else fights in their own colours
			if (def.faction === 'corps') expect(def.tint).toBe('corps');
			else expect(def.tint).toBeUndefined();
		}
	});

	it('it is one on one: exactly one opponent, and nobody else', () => {
		const { game, sparring, run } = setup('arisia');
		run(3);
		expect(sparring.state).toBe('fighting');
		expect(sparring.foe).not.toBeNull();
		expect(game.enemies.filter(isStanding).length).toBe(1);
		expect(sparring.foe!.kind).toBe('sparArisia');
	});

	it('beating them wins it, and the clock is the score', () => {
		const { sparring, run } = setup('sinestro');
		run(3);
		const foe = sparring.foe!;
		run(2, () => {
			for (const p of [foe]) void p;
		});
		foe.hp = 0;
		foe.down = 1;
		run(0.1);
		expect(sparring.state).toBe('won');
		expect(sparring.elapsed).toBeGreaterThan(1);
	});

	it('going down loses it, and you stay down', () => {
		const { game, sparring, run } = setup('boodikka');
		run(3);
		const me = game.players[0];
		// Health regrows, so put them down properly rather than setting the flag
		damagePlayer(game.constructs, me, me.health + 10, me.x + 40, me.y, 0);
		run(0.1);
		expect(sparring.state).toBe('lost');
		expect(me.downTimer).toBeGreaterThan(0);
	});

	it('Hal vs. John puts you against the other one', () => {
		const asHal = setup('mirror', 'hal');
		asHal.run(3);
		expect(asHal.sparring.foe!.kind).toBe('sparJohn');

		const asJohn = setup('mirror', 'john');
		asJohn.run(3);
		expect(asJohn.sparring.foe!.kind).toBe('sparHal');
	});

	it('there is no battery in the ring: you fight on the charge you walked in with', () => {
		const { game } = setup('sinestro');
		// The real thing, not the flag: the Game reads the flag once, when built
		expect(game.batteries.length).toBe(0);
	});

	it('experience shows: Sinestro hits harder than Hal, and Hal harder than John', () => {
		const hal = setup('mirror', 'john');
		hal.run(3);
		const john = setup('mirror', 'hal');
		john.run(3);
		const sin = setup('sinestro');
		sin.run(3);
		expect(sin.sparring.foe!.brain.might).toBeGreaterThan(hal.sparring.foe!.brain.might);
		expect(hal.sparring.foe!.brain.might).toBeGreaterThan(john.sparring.foe!.brain.might);
		// And they are all a long way past a Rage Grunt
		expect(john.sparring.foe!.brain.might).toBeGreaterThan(2);
	});

	it('a pro comes for a camper', () => {
		const { game, sparring, run } = setup('sinestro');
		run(3);
		const me = game.players[0];
		const spot = { x: me.x, y: me.y };
		run(5, () => {
			me.x = me.prevX = spot.x;
			me.y = me.prevY = spot.y;
			me.invuln = 1;
		});
		expect(sparring.camping).toBeGreaterThan(0);
	});

	it('the teachers are there to spar with too', () => {
		expect(EXTRAS.map((o) => o.id)).toContain('kilowog');
		expect(EXTRAS.every(isReady)).toBe(true);
	});
});
