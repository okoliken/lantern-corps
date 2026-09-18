// Player settings: key bindings and accessibility options.
// Plain data plus load/save helpers. The pause menu edits these; the Game
// reads them when it starts.

import { ACTIONS, DEFAULT_BINDINGS, type Bindings, type LayoutName } from './input';

export interface Settings {
	bindings: Record<LayoutName, Bindings>;
	/** Mouse aim gently snaps to an enemy near the crosshair. */
	aimAssist: boolean;
	/** Tap the shot button to start/stop shooting instead of holding it. */
	toggleShot: boolean;
	/** Construct keys use the construct straight away (not just pick it). */
	quickCast: boolean;
	/** Floating damage numbers. */
	damageNumbers: boolean;
	/** Tone down flashing and blinking effects. */
	reduceFlashing: boolean;
	/** The first-time controls card has been dismissed. */
	seenControls: boolean;
}

export const SETTINGS_KEY = 'lantern-corps:settings';

export function defaultSettings(): Settings {
	return {
		bindings: structuredClone(DEFAULT_BINDINGS),
		aimAssist: true,
		toggleShot: false,
		quickCast: true,
		damageNumbers: true,
		reduceFlashing: false,
		seenControls: false
	};
}

/**
 * Turn whatever was saved (possibly from an older version, possibly broken)
 * into valid settings. Anything missing or wrong falls back to the default,
 * so a new action added later still gets its default keys.
 */
export function parseSettings(raw: unknown): Settings {
	const settings = defaultSettings();
	if (!raw || typeof raw !== 'object') return settings;
	const saved = raw as Partial<Record<keyof Settings, unknown>>;

	for (const flag of ['aimAssist', 'toggleShot', 'quickCast', 'damageNumbers', 'reduceFlashing', 'seenControls'] as const) {
		if (typeof saved[flag] === 'boolean') settings[flag] = saved[flag];
	}

	const bindings = saved.bindings as Partial<Record<LayoutName, Partial<Record<string, unknown>>>> | undefined;
	if (bindings && typeof bindings === 'object') {
		for (const layout of Object.keys(settings.bindings) as LayoutName[]) {
			for (const action of ACTIONS) {
				const codes = bindings[layout]?.[action];
				if (Array.isArray(codes) && codes.every((c) => typeof c === 'string')) {
					settings.bindings[layout][action] = codes;
				}
			}
		}
	}
	return settings;
}

/** Read settings from storage. Storage can be missing or throw (private mode), so never trust it. */
export function loadSettings(storage: Pick<Storage, 'getItem'> | undefined): Settings {
	try {
		const text = storage?.getItem(SETTINGS_KEY);
		return parseSettings(text ? JSON.parse(text) : null);
	} catch {
		return defaultSettings();
	}
}

export function saveSettings(storage: Pick<Storage, 'setItem'> | undefined, settings: Settings) {
	try {
		storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
	} catch {
		// Storage full or blocked: settings just won't persist this time.
	}
}

/**
 * Bind `code` to `action` as its main button. If another action in the same
 * layout already uses that code, it's taken away from there, so one button
 * never does two things.
 */
export function rebind(b: Bindings, action: (typeof ACTIONS)[number], code: string): Bindings {
	const next = structuredClone(b);
	for (const a of ACTIONS) next[a] = next[a].filter((c) => c !== code);
	next[action] = [code, ...next[action]].slice(0, 2);
	return next;
}
