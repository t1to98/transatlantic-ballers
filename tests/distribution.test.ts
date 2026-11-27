import assert from 'node:assert/strict';
import test from 'node:test';
import { quartiles, stackDots } from '../src/lib/distribution.ts';

test('the middle band and median use actual production, including tied teams and an outlier', () => {
  assert.deepEqual(quartiles([0, 2, 2, 3, 3, 3, 5, 5, 5, 6, 7, 50]), {
    low: 0, q1: 2.75, median: 4, q3: 5.25, high: 50
  });
  assert.deepEqual(quartiles([0]), { low: 0, q1: 0, median: 0, q3: 0, high: 0 });
  assert.equal(quartiles([]), null);
});

test('nearby dots stack separately, then re-use a lane once there is room', () => {
  assert.deepEqual(stackDots([0, 0, 2, 16, 50], 15), [0, -15, 15, 0, 0]);
  assert.equal(new Set(stackDots(Array(12).fill(50), 15)).size, 12);
});
