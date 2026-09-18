import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { IDLE } from '../input';
import { ColonyUnderFire, buildColonyMap } from './colonyUnderFire';

function setup() {
	const map = buildColonyMap();
	const game = new Game({ players: [{ lantern: 'john', keys: 'solo' }], map });
	game.setView({ width: 1400, height: 800 });
	const mission = new ColonyUnderFire();
	game.director = mission;
	const john = game.players[0];
	const run = (seconds: number, each?: () => void) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each?.();
		}
	};
	const safe = () => (john.invuln = 1);
	const clear = () => {
		for (const e of game.enemies) {
			e.hp = 0;
			e.down = 1;
		}
		run(0.1, safe);
	};
	/** Walk John (teleporting) to a spot, with any following colonists right behind. */
	const go = (x: number, y: number) => {
		john.x = x;
		john.y = y;
		for (const g of mission.groups) {
			if (g.state === 'following') {
				g.x = x + 60;
				g.y = y;
			}
		}
		run(0.1, safe);
	};
	return { game, mission, john, run, safe, clear, go };
}

describe('Mission 3: Colony Under Fire', () => {
	it('John goes in alone and plays it', () => {
		const { game, mission } = setup();
		expect(game.players.length).toBe(1);
		expect(game.players[0].def.id).toBe('john');
		expect(mission.backup.usesLeft).toBe(2);
	});

	it('colonists come out when John reaches their shelter, follow him, and board a shuttle', () => {
		const { mission, run, safe, clear, go } = setup();
		run(3.1);
		const g = mission.groups[0];
		go(g.shelter.x, g.shelter.y + 60);
		expect(g.state).toBe('following');
		clear();
		// Walk back to the pad; they follow
		for (let i = 0; i < 8; i++) {
			go(g.x - 150, g.y + (mission.shuttles[g.shuttle].y - g.y) * 0.3);
		}
		go(mission.shuttles[g.shuttle].x + 40, mission.shuttles[g.shuttle].y);
		run(2, safe);
		expect(g.state).toBe('saved');
		expect(mission.saved).toBe(1);
	});

	it("fire landing on colonists hurts them, unless they're shielded", () => {
		const { game, mission, john, run, safe, go } = setup();
		run(3.1);
		const g = mission.groups[0];
		go(g.shelter.x, g.shelter.y + 60);
		const hp = g.hp;
		// Stand still and let a barrage land
		run(5, () => {
			safe();
			g.x = g.shelter.x;
			g.y = g.shelter.y + 60;
			john.x = g.x;
			john.y = g.y;
		});
		expect(g.hp).toBeLessThan(hp);
		// With a bubble on them it doesn't get through
		const before = g.hp;
		game.constructs.shields.push({ owner: john, target: g.prot, hp: 9999, maxHp: 9999, life: 20, maxLife: 20, ripple: 0 });
		run(5, () => {
			safe();
			g.x = g.shelter.x;
			g.y = g.shelter.y + 60;
		});
		expect(g.hp).toBe(before);
	});

	it('Shift puts the shield on the colonists when fire is coming for them', () => {
		const { game, mission, john, run, safe, go } = setup();
		run(3.1);
		const g = mission.groups[0];
		go(g.shelter.x, g.shelter.y + 60);
		run(3.6, safe); // the first barrage is on its way
		expect(g.prot.threat).toBeGreaterThan(0);
		john.input = { read: () => ({ ...IDLE, shield: true }) };
		run(1 / 60);
		expect(game.constructs.shields.some((s) => s.target === g.prot)).toBe(true);
	});

	it('B calls Hal in for a while; then he leaves', () => {
		const { game, mission, john, run, safe } = setup();
		run(3.1);
		john.input = { read: () => ({ ...IDLE, backup: true }) };
		run(1 / 60);
		john.input = { read: () => IDLE };
		expect(game.players.length).toBe(2);
		expect(game.players[1].def.id).toBe('hal');
		expect(mission.backup.usesLeft).toBe(1);
		run(45, safe);
		expect(game.players.length).toBe(1);
		expect(mission.backup.partner).toBeNull();
	});

	it('all colonists out: Zox attacks the last shuttle; holding out until launch wins', () => {
		const { mission, run, safe, clear } = setup();
		run(3.1);
		for (const g of mission.groups) g.state = 'saved';
		run(0.1, safe);
		expect(mission.phase).toBe('launch');
		clear();
		run(52, () => {
			safe();
			mission.shuttles[2].hull = 420;
		});
		expect(mission.state).toBe('won');
		expect(mission.stars).toBe(3);
	});

	it('losing two groups of colonists loses the mission', () => {
		const { mission, run, safe, go } = setup();
		run(3.1);
		for (const i of [0, 1]) {
			const g = mission.groups[i];
			go(g.shelter.x, g.shelter.y + 60);
			g.hp = 1;
			run(6, () => {
				safe();
				g.x = g.shelter.x;
				g.y = g.shelter.y + 60;
			});
		}
		expect(mission.state).toBe('lost');
		expect(mission.failReason).toBe('colonists');
	});
});
