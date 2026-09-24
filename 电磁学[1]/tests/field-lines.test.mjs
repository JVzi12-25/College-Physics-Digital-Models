import test from 'node:test';
import assert from 'node:assert/strict';
import { electricPotentialAt } from '../js/physics.js';
import { traceElectricFieldLines } from '../js/field-lines.js';

const bounds = { left: -0.25, right: 0.25, bottom: -0.15, top: 0.15 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('单个正电荷的场线从电荷附近向外延伸，电势沿线下降', () => {
  const charges = [{ x: 0, y: 0, q: 5e-9 }];
  const lines = traceElectricFieldLines(charges, bounds);
  assert.ok(lines.length >= 10);
  for (const line of lines) {
    assert.ok(distance(line[0], charges[0]) < 0.014);
    assert.ok(distance(line.at(-1), charges[0]) > distance(line[0], charges[0]));
    assert.ok(electricPotentialAt(charges, line[0]) > electricPotentialAt(charges, line.at(-1)));
    assert.ok(line.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  }
});

test('单个负电荷的场线箭头方向指向电荷', () => {
  const charges = [{ x: 0, y: 0, q: -5e-9 }];
  const lines = traceElectricFieldLines(charges, bounds);
  assert.ok(lines.length >= 10);
  for (const line of lines) {
    assert.ok(distance(line.at(-1), charges[0]) < 0.014);
    assert.ok(electricPotentialAt(charges, line[0]) > electricPotentialAt(charges, line.at(-1)));
  }
});

test('异号电荷间有场线连接，密度控制与零电荷均有效', () => {
  const charges = [{ x: -0.08, y: 0, q: 5e-9 }, { x: 0.08, y: 0, q: -5e-9 }];
  const sparse = traceElectricFieldLines(charges, bounds, 6);
  const dense = traceElectricFieldLines(charges, bounds, 24);
  assert.ok(dense.length > sparse.length);
  assert.ok(dense.some((line) => distance(line.at(-1), charges[1]) < 0.016));
  assert.deepEqual(traceElectricFieldLines([{ x: 0, y: 0, q: 0 }], bounds), []);
});

test('等量异号电荷还显示从画布边界进入负电荷的场线', () => {
  const charges = [{ x: -0.08, y: 0, q: 5e-9 }, { x: 0.08, y: 0, q: -5e-9 }];
  const lines = traceElectricFieldLines(charges, bounds);
  const incoming = lines.filter((line) => {
    const start = line[0];
    const atBoundary = Math.abs(start.x - bounds.left) < 1e-8 || Math.abs(start.x - bounds.right) < 1e-8
      || Math.abs(start.y - bounds.bottom) < 1e-8 || Math.abs(start.y - bounds.top) < 1e-8;
    return atBoundary && distance(line.at(-1), charges[1]) < 0.014;
  });
  assert.ok(incoming.length >= 2);
  for (const line of incoming) {
    assert.ok(electricPotentialAt(charges, line[0]) > electricPotentialAt(charges, line.at(-1)));
  }
});
