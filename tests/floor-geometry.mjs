import assert from 'node:assert/strict';
import { floorPosition } from '../lib/floor-geometry.ts';
assert.deepEqual(floorPosition(100, 100, 40, 80, 0.8, 160, 100), {
  x: 150,
  y: 200,
});
assert.deepEqual(floorPosition(100, 100, -1000, -1000, 1, 160, 100), {
  x: 0,
  y: 0,
});
assert.deepEqual(floorPosition(100, 100, 2000, 2000, 1, 400, 300), {
  x: 600,
  y: 550,
});
assert.deepEqual(floorPosition(100, 100, 10, 0, 1, 160, 100), {
  x: 110,
  y: 100,
});
console.log(
  'PASS Floor movement accounts for zoom, grid snapping, keyboard steps and element dimensions',
);
