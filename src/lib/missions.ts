// Builds a mission by id: its map, who's in the party, its director, and the
// story scene that plays after a win. Mission data (briefings) is in
// $lib/story/missions.ts; each mission's rules in $lib/engine/missions/.

import { Game, type GameOptions } from '$lib/engine/game';
import type { MissionDirector } from '$lib/engine/missions/mission';
import { SafePassage, buildBeltMap } from '$lib/engine/missions/safePassage';
import { OaLanding } from '$lib/engine/scenes/oaLanding';
import { OA_LANDING } from '$lib/story/scenes';

export interface MissionRun {
	game: Game;
	director: MissionDirector;
	/** The story scene after a win, if there is one. */
	outro: (() => OaLanding) | null;
}

type Options = Pick<GameOptions, 'settings' | 'profiles' | 'onProgress'>;

export function buildMission(id: string, options: Options): MissionRun {
	switch (id) {
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
