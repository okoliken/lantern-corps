import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { isStanding } from '../dummy';
import { damagePlayer } from '../combat';
import { IDLE } from '../input';
import { beginWindup } from '../enemies/enemies';
import { ENEMIES } from '../enemies/enemies';
import { EXTRAS, OPPONENTS, ROSTER, TIERS, buildSparringMap, isReady, opponentById, Sparring } from './sparring';

function setup(id: string, as: 'hal' | 'john' = 'hal') {
	const opponent = opponentById(id)!;
	const map = buildSparringMap(opponent);
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
		expect(ready.length).toBeGreaterThanOrEqual(15);
		// The League fight here the moment they exist, not when somebody remembers to switch them on
		for (const id of ['wonderwoman', 'flash', 'superman', 'hawkgirl', 'batman', 'tomar', 'guy', 'kyle', 'aquaman']) expect(isReady(opponentById(id)!)).toBe(true);
		for (const foe of ready) expect(ENEMIES[foe.kind!]).toBeTruthy();
	});

	it('the ones still being drawn are marked, not hidden', () => {
		const toCome = OPPONENTS.filter((o) => !isReady(o));
		// They still carry their roster entry, so the list reads complete
		for (const foe of toCome) expect(foe.tests.length).toBeGreaterThan(20);
		expect(toCome.map((o) => o.id)).toContain('jonn');
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

	it('Batman: fear toxin turns your every move the wrong way', () => {
		const { game, sparring, run } = setup('batman');
		run(3);
		const me = game.players[0];
		beginWindup(sparring.foe!, 'fearToxin', me);
		run(1, () => {
			me.invuln = 1;
		});
		expect(me.confused).toBeGreaterThan(0);
	});

	it("Batman: up close, the ring is off your hand - unless a bubble is up, and then the bubble goes", () => {
		const { game, sparring, run } = setup('batman');
		run(3);
		const me = game.players[0];
		const f = sparring.foe!;
		// Bubbled: it pops, and the ring stays
		game.constructs.shields.push({ owner: me, target: me, hp: 1000, maxHp: 1000, life: 30, maxLife: 30, ripple: 0 } as never);
		beginWindup(f, 'ringSteal', me);
		run(0.8, () => {
			me.x = me.prevX = f.x + f.dir * 40;
			me.y = me.prevY = f.y;
		});
		expect(game.constructs.shields.some((s) => s.target === me)).toBe(false);
		expect(me.branded).toBe(0);
		// No bubble: gone for a while
		f.brain.cooldowns.ringSteal = 0;
		beginWindup(f, 'ringSteal', me);
		run(0.8, () => {
			me.x = me.prevX = f.x + f.dir * 40;
			me.y = me.prevY = f.y;
			me.invuln = 1;
		});
		expect(me.branded).toBeGreaterThan(3);
	});

	it("Aquaman's fight is under water, and you are slow in it", () => {
		const wet = setup('aquaman');
		expect(wet.game.map.underwater).toBe(true);
		expect(wet.game.map.ground).toBe('sea');
		const dry = setup('sinestro');
		// Same stick, same second, on dry land and under water
		const top = (s: ReturnType<typeof setup>) => {
			s.run(3);
			const me = s.game.players[0];
			me.input = { read: () => ({ ...IDLE, moveX: 1 }) };
			let best = 0;
			s.run(1.5, () => {
				me.invuln = 1;
				best = Math.max(best, Math.abs(me.vx));
			});
			return best;
		};
		const dryTop = top(dry);
		const wetTop = top(wet);
		expect(dryTop).toBeGreaterThan(100);
		expect(wetTop).toBeLessThan(dryTop * 0.75);
	});

	it('Batman does not pull a Lantern about: he goes over you, and the kick lands from behind', () => {
		const { game, sparring, run } = setup('batman');
		run(3);
		const me = game.players[0];
		const f = sparring.foe!;
		expect(f.brain.kit).not.toContain('grapple');
		me.x = me.prevX = f.x + f.dir * 160;
		me.y = me.prevY = f.y;
		const sideBefore = Math.sign(f.x - me.x);
		let taken = 0;
		let last = me.health;
		beginWindup(f, 'batKick', me);
		run(0.9, () => {
			me.x = me.prevX = me.x; // he stands still; Batman does the moving
			if (me.health < last) taken += last - me.health;
			last = me.health;
		});
		expect(taken).toBeGreaterThan(0);
		expect(Math.sign(f.x - me.x)).toBe(-sideBefore);
	});

	it('the teachers are there to spar with too', () => {
		expect(EXTRAS.map((o) => o.id)).toContain('kilowog');
		expect(EXTRAS.every(isReady)).toBe(true);
	});
});
