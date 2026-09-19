import { describe, expect, it } from 'vitest';
import { LANTERNS } from '../lanterns';
import { createDummy } from '../dummy';
import { createEnemy } from '../enemies/enemies';
import { IDLE, type Intent } from '../input';
import { createPlayer, type Player } from '../player';
import { chooseShieldTarget, pickConstruct } from './smart';
import { createConstructWorld, updateConstructWorld, updatePlayerConstructs, type ConstructWorld, type Protectable } from './system';

const DT = 1 / 60;

function setup(id: 'hal' | 'john', targets: [number, number][]) {
	const p = createPlayer(0, LANTERNS[id], { read: () => IDLE }, 0, 0);
	const w = createConstructWorld([], targets.map(([x, y]) => createEnemy('rageGrunt', x, y)));
	w.players = [p];
	return { p, w };
}

const picked = (p: Player, w: ConstructWorld) => {
	const pick = pickConstruct(p, w);
	return pick ? p.loadout[pick.slot].behavior : null;
};

describe('smart ring', () => {
	it('goes melee on an enemy right next to you', () => {
		const { p, w } = setup('hal', [[50, 0]]);
		expect(['slash', 'smash']).toContain(picked(p, w));
	});

	it('fires missiles at a pack further off', () => {
		const { p, w } = setup('john', [[420, 0], [450, 30], [440, -30]]);
		expect(['volley', 'lances', 'heavy']).toContain(picked(p, w));
	});

	it('sends the locomotive through a line of enemies', () => {
		const { p, w } = setup('hal', [[250, 0], [330, 10], [410, -10]]);
		expect(picked(p, w)).toBe('ram');
	});

	it('snipes a lone enemy far away', () => {
		const { p, w } = setup('john', [[500, 0]]);
		expect(picked(p, w)).toBe('snipe');
	});

	it('suits up in Power Armor when John is badly hurt', () => {
		const { p, w } = setup('john', [[500, 0]]);
		p.health = p.maxHealth * 0.3;
		expect(picked(p, w)).toBe('armor');
	});

	it('only picks what you can afford', () => {
		const { p, w } = setup('hal', [[300, 0], [330, 30], [320, -30]]);
		p.willpower = 5;
		const pick = pickConstruct(p, w);
		if (pick) expect(p.loadout[pick.slot].cost).toBeLessThanOrEqual(5);
	});

	it('holding the construct button keeps making the right thing', () => {
		const { p, w } = setup('hal', [[50, 0]]);
		p.smartRing = true;
		const hold: Intent = { ...IDLE, construct: true, constructPressed: true };
		const hp = w.dummies[0].hp;
		for (let i = 0; i < 120; i++) {
			updatePlayerConstructs(p, i === 0 ? hold : { ...hold, constructPressed: false }, DT, w);
			updateConstructWorld(w, DT);
		}
		expect(w.dummies[0].hp).toBeLessThan(hp);
	});

	it('a number key still picks by hand', () => {
		const { p, w } = setup('hal', [[50, 0]]);
		p.smartRing = true;
		updatePlayerConstructs(p, { ...IDLE, select: 6, construct: true, constructPressed: true }, DT, w);
		expect(p.selected).toBe(6);
	});
});

describe('smart ring is steady, not a dice roll', () => {
	it('holding the button against one enemy up close keeps to one or two constructs', () => {
		const { p, w } = setup('hal', [[60, 0]]);
		p.smartRing = true;
		p.willpower = p.maxWillpower = 1000;
		const used = new Set<number>();
		for (let i = 0; i < 4 * 60; i++) {
			const before = p.cooldowns.map((c) => c);
			updatePlayerConstructs(p, { ...IDLE, construct: true, constructPressed: i === 0 }, DT, w);
			updateConstructWorld(w, DT);
			// Anything that just went on cooldown was used this tick
			p.cooldowns.forEach((c, slot) => {
				if (c > before[slot] + 0.01) used.add(slot);
			});
			// Keep the enemy standing and in place
			const e = w.dummies[0];
			e.hp = e.maxHp;
			e.x = 60;
			e.y = 0;
		}
		expect(used.size).toBeGreaterThan(0);
		expect(used.size).toBeLessThanOrEqual(2);
	});
});

describe('smart shield', () => {
	it('goes on yourself when nothing else is in danger', () => {
		const { p, w } = setup('hal', []);
		expect(chooseShieldTarget(p, w)).toBe(p);
	});

	it('goes on a ship that is about to be hit', () => {
		const { p, w } = setup('hal', []);
		const ship: Protectable = { x: 200, y: 0, name: 'Ship', radius: 90, lift: 40, threat: 2 };
		w.protectables.push(ship);
		expect(chooseShieldTarget(p, w)).toBe(ship);
	});

	it('goes on a partner an enemy is winding up on', () => {
		const { p, w } = setup('hal', [[400, 0]]);
		const partner = createPlayer(1, LANTERNS.john, { read: () => IDLE }, 250, 0);
		w.players.push(partner);
		const e = w.dummies[0] as ReturnType<typeof createEnemy>;
		e.brain.target = partner;
		e.brain.state = 'windup';
		expect(chooseShieldTarget(p, w)).toBe(partner);
	});

	it('picks a ship under fire over a partner in a brawl next to it', () => {
		const { p, w } = setup('hal', [[400, 0], [420, 30]]);
		const partner = createPlayer(1, LANTERNS.kilowog, { read: () => IDLE }, 250, 0);
		w.players.push(partner);
		for (const d of w.dummies) {
			const e = d as ReturnType<typeof createEnemy>;
			e.brain.target = partner;
			e.brain.state = 'windup';
		}
		const ship: Protectable = { x: 220, y: 0, name: 'Ship', radius: 130, lift: 44, threat: 0.8 };
		w.protectables.push(ship);
		expect(chooseShieldTarget(p, w)).toBe(ship);
		// Nothing coming for the ship: the partner gets it
		ship.threat = 0;
		expect(chooseShieldTarget(p, w)).toBe(partner);
	});

	it('leaves things too far away', () => {
		const { p, w } = setup('hal', []);
		w.protectables.push({ x: 3000, y: 0, name: 'Ship', radius: 90, lift: 40, threat: 2 });
		expect(chooseShieldTarget(p, w)).toBe(p);
	});
});
