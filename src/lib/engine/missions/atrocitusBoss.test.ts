import { describe, expect, it } from 'vitest';
import { isStanding } from '../dummy';
import { Game } from '../game';
import type { LanternId } from '../lanterns';
import { BLOOD_OATH, LAST_LIGHT } from '../../story/scenes';
import { BloodOath } from '../scenes/bloodOath';
import { LastLight } from '../scenes/lastLight';
import { AtrocitusBoss, BOOK_AT, PAGE, RAGE_AT, WARD_BREAKERS, WARD_TAKES, buildFinaleMap } from './atrocitusBoss';

function setup(me: LanternId = 'hal') {
	const game = new Game({
		players: [
			{ lantern: me, keys: 'solo' },
			{ lantern: me === 'hal' ? 'john' : 'hal', keys: 'p2', ai: true },
			{ lantern: 'arisia', keys: 'p2', ai: true },
			{ lantern: 'razer', keys: 'p2', ai: true }
		],
		map: buildFinaleMap()
	});
	game.setView({ width: 1400, height: 800 });
	const mission = new AtrocitusBoss();
	game.director = mission;
	const safe = () => {
		for (const p of game.players) p.invuln = 1;
	};
	const run = (seconds: number, each: () => void = safe) => {
		for (let i = 0; i < Math.round(seconds * 60); i++) {
			game.update(1 / 60);
			each();
		}
	};
	/** Everyone well away from him (so only the test hurts him). */
	const away = () => {
		safe();
		for (const p of game.players) {
			p.x = p.prevX = 200;
			p.y = p.prevY = 1850;
		}
	};
	const hurtTo = (share: number) => {
		const a = mission.atrocitus!;
		a.hp = a.brain.lastHp = Math.floor(a.maxHp * share) - 1;
		(mission as unknown as { held: number }).held = a.hp;
	};
	return { game, mission, run, safe, away, hurtTo };
}

describe('Act 3, the finale: Atrocitus', () => {
	it('you choose Hal or John; Arisia and Razer start the fight, and Kilowog, Katma and Boodikka come from Oa', () => {
		const { game, mission, run } = setup('john');
		run(3.1);
		expect(mission.atrocitus).not.toBeNull();
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'hal', 'arisia', 'razer']);
		run(21);
		expect(game.players.map((p) => p.def.id)).toEqual(['john', 'hal', 'arisia', 'razer', 'kilowog', 'katma', 'boodikka']);
	});

	it('his Blood Oath turns most of one Lantern’s attack', () => {
		const { game, mission, run, away } = setup();
		run(3.1);
		const a = mission.atrocitus!;
		run(0.1, away);
		const before = a.hp;
		a.hp -= 1000;
		a.brain.grudge = game.players[0];
		a.brain.grudgeAgo = 0;
		run(1 / 60, away);
		expect(before - a.hp).toBeCloseTo(1000 * WARD_TAKES, 0);
		expect(mission.wardDown).toBe(0);
	});

	it('enough Lanterns hitting him at once breaks it, and then he feels everything', () => {
		const { game, mission, run, away } = setup();
		run(3.1);
		const a = mission.atrocitus!;
		run(0.1, away);
		const lanterns = game.players.slice(0, WARD_BREAKERS);
		for (const p of lanterns) {
			a.brain.grudge = p;
			a.brain.grudgeAgo = 0;
			run(2 / 60, away);
		}
		expect(mission.wardDown).toBeGreaterThan(0);
		expect(mission.wardBreaks).toBe(1);
		const before = a.hp;
		a.hp -= 1000;
		run(1 / 60, away);
		expect(before - a.hp).toBeGreaterThan(900);
	});

	it('at 60% he opens the Book: Dex-Starr is back, and a page quiets every ring near him', () => {
		const { game, mission, run, away, hurtTo } = setup();
		run(3.1);
		hurtTo(BOOK_AT);
		run(0.1, away);
		expect(mission.phase).toBe('book');
		expect(game.enemies.some((e) => e.kind === 'dexStarr')).toBe(true);
		const a = mission.atrocitus!;
		const me = game.players[0];
		let quiet = false;
		run(PAGE.every, () => {
			for (const p of game.players) p.invuln = 1;
			me.x = a.x + 150;
			me.y = a.y;
			if (me.branded > 0) quiet = true;
		});
		expect(quiet).toBe(true);
	});

	it('at 25% the rage takes him, and when he falls every Red Lantern drops', () => {
		const { game, mission, run, away, hurtTo } = setup();
		run(3.1);
		hurtTo(BOOK_AT);
		run(0.1, away);
		hurtTo(RAGE_AT);
		run(0.1, away);
		expect(mission.phase).toBe('rage');
		const a = mission.atrocitus!;
		a.hp = 0;
		a.down = 1;
		run(0.2, away);
		expect(mission.phase).toBe('fallen');
		expect(game.enemies.filter(isStanding).length).toBe(0);
		run(90, away);
		expect(mission.state).toBe('won');
	});

	it('opens with his oath, and ends back on Oa', () => {
		expect(BLOOD_OATH.some((l) => l.who === 'atrocitus')).toBe(true);
		expect(new BloodOath(BLOOD_OATH).done).toBe(false);
		expect(LAST_LIGHT[LAST_LIGHT.length - 1].text).toContain("Green Lantern’s light");
		expect(new LastLight(LAST_LIGHT).done).toBe(false);
	});
});
