import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from './input';
import { SETTINGS_KEY, defaultSettings, loadSettings, parseSettings, rebind, saveSettings } from './settings';

describe('settings', () => {
	it('uses defaults when nothing is saved', () => {
		expect(loadSettings(undefined)).toEqual(defaultSettings());
	});

	it('survives broken saved data', () => {
		const storage = { getItem: () => '{not json' };
		expect(loadSettings(storage)).toEqual(defaultSettings());
	});

	it('survives storage that throws (private browsing)', () => {
		const storage = {
			getItem: () => {
				throw new Error('blocked');
			}
		};
		expect(loadSettings(storage)).toEqual(defaultSettings());
	});

	it('saves and loads round-trip', () => {
		const data = new Map<string, string>();
		const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
		const s = defaultSettings();
		s.aimAssist = false;
		s.bindings.solo.shield = ['KeyV'];
		saveSettings(storage, s);
		expect(data.has(SETTINGS_KEY)).toBe(true);
		expect(loadSettings(storage)).toEqual(s);
	});

	it('keeps defaults for anything missing from an older save', () => {
		const parsed = parseSettings({ aimAssist: false, bindings: { solo: { shot: ['KeyP'] } } });
		expect(parsed.aimAssist).toBe(false);
		expect(parsed.bindings.solo.shot).toEqual(['KeyP']);
		expect(parsed.bindings.solo.shield).toEqual(DEFAULT_BINDINGS.solo.shield);
		expect(parsed.bindings.p2).toEqual(DEFAULT_BINDINGS.p2);
	});

	it('ignores values of the wrong type', () => {
		const parsed = parseSettings({ aimAssist: 'yes', bindings: { solo: { shot: [1, 2] } } });
		expect(parsed.aimAssist).toBe(true);
		expect(parsed.bindings.solo.shot).toEqual(DEFAULT_BINDINGS.solo.shot);
	});
});

describe('rebind', () => {
	it('makes the new button the main one for that action', () => {
		const b = rebind(DEFAULT_BINDINGS.solo, 'shield', 'KeyV');
		expect(b.shield[0]).toBe('KeyV');
	});

	it('takes the button away from any other action, so one button never does two things', () => {
		const b = rebind(DEFAULT_BINDINGS.solo, 'shield', 'Space');
		expect(b.shield).toContain('Space');
		expect(b.fly).not.toContain('Space');
	});

	it('does not change the original bindings', () => {
		rebind(DEFAULT_BINDINGS.solo, 'shield', 'KeyV');
		expect(DEFAULT_BINDINGS.solo.shield).not.toContain('KeyV');
	});
});
