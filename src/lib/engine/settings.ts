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
	/** The construct button makes whatever the moment needs (constructs/smart.ts). */
	smartRing: boolean;
	/** Floating damage numbers. */
	damageNumbers: boolean;
	/** Tone down flashing and blinking effects. */
	reduceFlashing: boolean;
	/** The first-time controls card has been dismissed. */
	seenControls: boolean;
	/** Finished Kilowog's training once (missions stop suggesting it). */
	trained: boolean;
	/** Which round of new default keys these settings have (see ADDED_KEYS). */
	keysVersion: number;
	/** On-screen touch controls over the game: on any touch screen ('auto'), always, or never. */
	touchControls: TouchControlsMode;
}

export type TouchControlsMode = 'auto' | 'on' | 'off';
export const TOUCH_MODES: readonly TouchControlsMode[] = ['auto', 'on', 'off'];

/**
 * Keys added to the defaults after players may already have saved their
 * controls: each is added once to saved settings older than its version, if
 * the key isn't already doing something else in that layout.
 */
const ADDED_KEYS: { version: number; layout: LayoutName; action: (typeof ACTIONS)[number]; code: string }[] = [
	// Enter fires ring shots too (user, 2026-09-19)
	{ version: 1, layout: 'solo', action: 'shot', code: 'Enter' }
];
const KEYS_VERSION = Math.max(0, ...ADDED_KEYS.map((k) => k.version));

export const SETTINGS_KEY = 'lantern-corps:settings';

export function defaultSettings(): Settings {
	return {
		bindings: structuredClone(DEFAULT_BINDINGS),
		aimAssist: true,
		toggleShot: false,
		quickCast: true,
		smartRing: true,
		damageNumbers: true,
		reduceFlashing: false,
		seenControls: false,
		trained: false,
		keysVersion: KEYS_VERSION,
		touchControls: 'auto'
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

	for (const flag of ['aimAssist', 'toggleShot', 'quickCast', 'smartRing', 'damageNumbers', 'reduceFlashing', 'seenControls', 'trained'] as const) {
		if (typeof saved[flag] === 'boolean') settings[flag] = saved[flag];
	}

	if (TOUCH_MODES.includes(saved.touchControls as TouchControlsMode)) settings.touchControls = saved.touchControls as TouchControlsMode;

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
		// Keys added to the defaults since these were saved
		const had = typeof saved.keysVersion === 'number' ? saved.keysVersion : 0;
		for (const k of ADDED_KEYS) {
			if (k.version <= had) continue;
			const layout = settings.bindings[k.layout];
			if (!ACTIONS.some((a) => layout[a].includes(k.code))) layout[k.action] = [...layout[k.action], k.code];
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
