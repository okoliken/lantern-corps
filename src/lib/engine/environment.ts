// Where a mission takes place.
//
//   space  -> always flying, no ground (so no shadow)
//   planet -> walking by default; take-off/landing comes in M2
//
// The glow isn't an environment rule: a Lantern glows whenever they're
// FLYING, in space or on a planet, and never while walking.

export type EnvironmentKind = 'space' | 'planet';

export interface EnvironmentRules {
	/** Lanterns can never touch down here. */
	alwaysFlying: boolean;
	/** There's a surface below, so flying Lanterns cast a shadow on it. */
	hasGround: boolean;
}

export const ENVIRONMENT_RULES: Record<EnvironmentKind, EnvironmentRules> = {
	space: { alwaysFlying: true, hasGround: false },
	planet: { alwaysFlying: false, hasGround: true }
};

export function isEnvironmentKind(value: unknown): value is EnvironmentKind {
	return value === 'space' || value === 'planet';
}
