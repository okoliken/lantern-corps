// Builds a mission by id: its map, who's in the party, its director, and the
// story scene that plays after a win. Mission data (briefings) is in
// $lib/story/missions.ts; each mission's rules in $lib/engine/missions/.

import { Game, type GameOptions } from '$lib/engine/game';
import type { MissionDirector } from '$lib/engine/missions/mission';
import { SafePassage, buildBeltMap } from '$lib/engine/missions/safePassage';
import { SilentOutpost, buildOutpostMap } from '$lib/engine/missions/silentOutpost';
import { ColonyUnderFire, buildColonyMap } from '$lib/engine/missions/colonyUnderFire';
import { InterceptorMission, buildFrontierMap } from '$lib/engine/missions/interceptor';
import { PrisonMoon, buildPrisonMap } from '$lib/engine/missions/prisonMoon';
import { RazerBoss, buildRazerMap } from '$lib/engine/missions/razerBoss';
import { OaLanding } from '$lib/engine/scenes/oaLanding';
import type { DialogueScene } from '$lib/engine/scenes/scene';
import { CONFESSION, JOHN_CALLED, JOHN_CHOSEN, OA_LANDING, SUMMONED, THE_SIGNAL } from '$lib/story/scenes';
import { JohnChosen } from '$lib/engine/scenes/johnChosen';
import { CallToArms, buildCentralCityMap } from '$lib/engine/missions/callToArms';
import { SummonedTrial, buildTrialMap } from '$lib/engine/missions/summoned';
import { GuardiansShame, buildVaultMap } from '$lib/engine/missions/guardiansShame';
import { Confession } from '$lib/engine/scenes/confession';
import { Sleepers, buildDetroitMap } from '$lib/engine/missions/sleepers';
import { TheSignal } from '$lib/engine/scenes/theSignal';
import { Summoned } from '$lib/engine/scenes/summoned';

export interface MissionRun {
	game: Game;
	director: MissionDirector;
	/** The story scene after a win, if there is one. */
	outro: (() => DialogueScene) | null;
	/** A story scene before the fight starts, if there is one. */
	intro?: () => DialogueScene;
}

type Options = Pick<GameOptions, 'settings' | 'profiles' | 'onProgress' | 'zoom'>;

export function buildMission(id: string, options: Options): MissionRun {
	switch (id) {
		case 'sleepers': {
			// John starts alone: the League arrives as the fight goes on
			const map = buildDetroitMap();
			const game = new Game({ ...options, players: [{ lantern: 'john', keys: 'solo' }], map });
			const director = new Sleepers();
			game.director = director;
			return { game, director, outro: null, intro: () => new TheSignal(THE_SIGNAL) };
		}
		case 'the-guardians-shame': {
			const map = buildVaultMap();
			const game = new Game({
				...options,
				players: [
					{ lantern: 'hal', keys: 'solo' },
					{ lantern: 'kilowog', keys: 'p2', ai: true },
					{ lantern: 'razer', keys: 'p2', ai: true }
				],
				map
			});
			const director = new GuardiansShame();
			game.director = director;
			return { game, director, outro: null, intro: () => new Confession(CONFESSION) };
		}
		case 'summoned': {
			const map = buildTrialMap();
			const game = new Game({ ...options, players: [{ lantern: 'john', keys: 'solo' }], map });
			const director = new SummonedTrial();
			game.director = director;
			return { game, director, outro: null, intro: () => new Summoned(SUMMONED) };
		}
		case 'call-to-arms': {
			const map = buildCentralCityMap();
			const game = new Game({
				...options,
				players: [
					{ lantern: 'john', keys: 'solo' },
					{ lantern: 'flash', keys: 'p2', ai: true },
					{ lantern: 'hawkgirl', keys: 'p2', ai: true }
				],
				map
			});
			// The Flash and Hawkgirl are already in the fight up the street
			const [, flash, hawkgirl] = game.players;
			flash.x = flash.prevX = 1350;
			flash.y = flash.prevY = 1120;
			hawkgirl.x = hawkgirl.prevX = 1420;
			hawkgirl.y = hawkgirl.prevY = 960;
			hawkgirl.flying = true;
			hawkgirl.altitude = 1;
			const director = new CallToArms();
			game.director = director;
			return { game, director, outro: null, intro: () => new JohnChosen(JOHN_CALLED) };
		}
		case 'razer': {
			const map = buildRazerMap();
			const game = new Game({
				...options,
				players: [
					{ lantern: 'hal', keys: 'solo' },
					{ lantern: 'kilowog', keys: 'p2', ai: true }
				],
				map
			});
			const director = new RazerBoss();
			game.director = director;
			return { game, director, outro: null };
		}
		case 'prison-moon': {
			const map = buildPrisonMap();
			const game = new Game({
				...options,
				players: [
					{ lantern: 'hal', keys: 'solo' },
					{ lantern: 'kilowog', keys: 'p2', ai: true }
				],
				map
			});
			const director = new PrisonMoon(map);
			game.director = director;
			return { game, director, outro: null };
		}
		case 'the-interceptor': {
			const map = buildFrontierMap();
			const game = new Game({
				...options,
				players: [
					{ lantern: 'hal', keys: 'solo' },
					{ lantern: 'kilowog', keys: 'p2', ai: true }
				],
				map
			});
			const director = new InterceptorMission();
			game.director = director;
			return { game, director, outro: null };
		}
		case 'colony-under-fire': {
			const map = buildColonyMap();
			const game = new Game({ ...options, players: [{ lantern: 'john', keys: 'solo' }], map });
			const director = new ColonyUnderFire();
			game.director = director;
			return { game, director, outro: null };
		}
		case 'silent-outpost': {
			const map = buildOutpostMap();
			const game = new Game({
				...options,
				players: [
					{ lantern: 'hal', keys: 'solo' },
					{ lantern: 'kilowog', keys: 'p2', ai: true }
				],
				map
			});
			const director = new SilentOutpost();
			game.director = director;
			return { game, director, outro: () => new JohnChosen(JOHN_CHOSEN) };
		}
		case 'safe-passage':
		default: {
			const map = buildBeltMap();
			const game = new Game({ ...options, players: [{ lantern: 'hal', keys: 'solo' }], map });
			game.dummies.length = 0;
			const director = new SafePassage(map);
			game.director = director;
			return {
				game,
				director,
				outro: () => new OaLanding(OA_LANDING, director.ship.hull / director.ship.maxHull)
			};
		}
	}
}
