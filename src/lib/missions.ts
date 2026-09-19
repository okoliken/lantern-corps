// Builds a mission by id: its map, who's in the party, its director, and the
// story scene that plays after a win. Mission data (briefings) is in
// $lib/story/missions.ts; each mission's rules in $lib/engine/missions/.

import { Game, type GameOptions } from '$lib/engine/game';
import type { MissionDirector } from '$lib/engine/missions/mission';
import { SafePassage, buildBeltMap } from '$lib/engine/missions/safePassage';
import { SilentOutpost, buildOutpostMap } from '$lib/engine/missions/silentOutpost';
import { ColonyUnderFire, buildColonyMap } from '$lib/engine/missions/colonyUnderFire';
import { InterceptorMission, buildFrontierMap } from '$lib/engine/missions/interceptor';
import { OaLanding } from '$lib/engine/scenes/oaLanding';
import type { DialogueScene } from '$lib/engine/scenes/scene';
import { JOHN_CHOSEN, OA_LANDING } from '$lib/story/scenes';
import { JohnChosen } from '$lib/engine/scenes/johnChosen';

export interface MissionRun {
	game: Game;
	director: MissionDirector;
	/** The story scene after a win, if there is one. */
	outro: (() => DialogueScene) | null;
}

type Options = Pick<GameOptions, 'settings' | 'profiles' | 'onProgress'>;

export function buildMission(id: string, options: Options): MissionRun {
	switch (id) {
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
