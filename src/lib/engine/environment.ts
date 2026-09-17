// Where a mission takes place. The environment decides how Lanterns behave
// and look:
//
//   space  -> always flying, green aura on, no ground shadow
//   planet -> on the ground (walking), no glow; take-off/landing comes in M2

export type EnvironmentKind = 'space' | 'planet';

export interface EnvironmentRules {
	/** Lanterns can never touch down here. */
	alwaysFlying: boolean;
	/** Draw the green aura and ring glow. */
	glow: boolean;
}

export const ENVIRONMENT_RULES: Record<EnvironmentKind, EnvironmentRules> = {
	space: { alwaysFlying: true, glow: true },
	planet: { alwaysFlying: false, glow: false }
};

export function isEnvironmentKind(value: unknown): value is EnvironmentKind {
	return value === 'space' || value === 'planet';
}
