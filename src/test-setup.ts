// Every test gets the same "random" numbers: enemy brains, hero moves and
// kits roll dice, and a test shouldn't pass or fail on a roll.

import { beforeEach } from 'vitest';
import { seededRandom } from './lib/engine/map';

beforeEach(() => {
	Math.random = seededRandom(20260919);
});
