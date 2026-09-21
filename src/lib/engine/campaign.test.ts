import { describe, expect, it } from 'vitest';
import { before, complete, isOpen, newCampaign, next, parseCampaign } from './campaign';

const ORDER = ['one', 'two', 'three'];

describe('the campaign', () => {
	it('only the first mission is open at the start', () => {
		const c = newCampaign();
		expect(ORDER.map((id) => isOpen(c, ORDER, id))).toEqual([true, false, false]);
	});

	it('finishing a mission opens the next, and only the next', () => {
		const c = newCampaign();
		complete(c, 'one', 2);
		expect(ORDER.map((id) => isOpen(c, ORDER, id))).toEqual([true, true, false]);
		complete(c, 'two', 1);
		expect(isOpen(c, ORDER, 'three')).toBe(true);
	});

	it('keeps the best stars, and a win is always at least one', () => {
		const c = newCampaign();
		complete(c, 'one', 3);
		complete(c, 'one', 1);
		expect(c.done.one).toBe(3);
		complete(c, 'two', 0);
		expect(c.done.two).toBe(1);
	});

	it('anything not in the story (training, sparring) is always open', () => {
		expect(isOpen(newCampaign(), ORDER, 'training')).toBe(true);
	});

	it('knows the missions either side', () => {
		expect(before(ORDER, 'two')).toBe('one');
		expect(before(ORDER, 'one')).toBeNull();
		expect(next(ORDER, 'two')).toBe('three');
		expect(next(ORDER, 'three')).toBeNull();
	});

	it('survives a broken save', () => {
		expect(parseCampaign(null)).toEqual({ done: {} });
		expect(parseCampaign({ done: { one: 9, two: 'x', three: 2 } })).toEqual({ done: { one: 3, three: 2 } });
	});
});
