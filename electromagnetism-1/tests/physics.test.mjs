import test from 'node:test';
import assert from 'node:assert/strict';
import { K, EPSILON_0, ELEMENTARY_CHARGE, coulombForceOnFirst, electricFieldAt, electricPotentialAt, parallelPlateCapacitor, uniformChargedSphere, chargedCylindricalShell, infiniteChargedPlane, particleInUniformField, rcCircuit } from '../js/physics.js';

function near(actual, expected, relativeTolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= Math.max(Math.abs(expected) * relativeTolerance, 1e-12), `${actual} != ${expected}`);
}

test('库仑力遵循反平方律且同号相斥', () => {
  const a = coulombForceOnFirst(1e-9, 2e-9, { x: 0, y: 0 }, { x: 0.1, y: 0 });
  const b = coulombForceOnFirst(1e-9, 2e-9, { x: 0, y: 0 }, { x: 0.2, y: 0 });
  assert.ok(a.x < 0);
  near(a.magnitude / b.magnitude, 4);
  near(a.magnitude, K * 2e-18 / 0.01);
});

test('等量异号点电荷在中心的电势抵消、电场叠加', () => {
  const charges = [{ x: -0.1, y: 0, q: 1e-9 }, { x: 0.1, y: 0, q: -1e-9 }];
  const p = { x: 0, y: 0 };
  near(electricPotentialAt(charges, p), 0);
  const field = electricFieldAt(charges, p);
  near(field.x, 2 * K * 1e-9 / 0.01);
  near(field.y, 0);
});

test('理想平行板电容器量纲与能量关系', () => {
  const result = parallelPlateCapacitor({ voltage: 100, distance: 0.02, area: 0.04, relativePermittivity: 2 });
  near(result.capacitance, EPSILON_0 * 2 * 0.04 / 0.02);
  near(result.field, 5000);
  near(result.charge, result.capacitance * 100);
  near(result.energy, result.charge * 100 / 2);
});

test('均匀带电球体内部通量随高斯半径的三次方变化，外部保持不变', () => {
  const inside = uniformChargedSphere({ totalCharge: 8e-9, sphereRadius: 0.08, gaussianRadius: 0.04 });
  const surface = uniformChargedSphere({ totalCharge: 8e-9, sphereRadius: 0.08, gaussianRadius: 0.08 });
  const outside = uniformChargedSphere({ totalCharge: 8e-9, sphereRadius: 0.08, gaussianRadius: 0.16 });
  near(inside.enclosedCharge, 1e-9);
  near(inside.flux, 1e-9 / EPSILON_0);
  near(surface.flux, outside.flux);
  near(inside.field / surface.field, 0.5);
  near(surface.field / outside.field, 4);
});

test('无限长带电圆柱面内部电场为零，外部通量与高斯半径无关', () => {
  const inputs = { surfaceChargeDensity: 5e-9, shellRadius: 0.04, length: 0.2 };
  const inside = chargedCylindricalShell({ ...inputs, gaussianRadius: 0.02 });
  const edge = chargedCylindricalShell({ ...inputs, gaussianRadius: 0.04 });
  const nearOutside = chargedCylindricalShell({ ...inputs, gaussianRadius: 0.08 });
  const farOutside = chargedCylindricalShell({ ...inputs, gaussianRadius: 0.12 });
  near(inside.field, 0);
  near(inside.flux, 0);
  assert.equal(edge.field, null);
  near(nearOutside.flux, farOutside.flux);
  near(nearOutside.field / farOutside.field, 1.5);
  near(nearOutside.field * 2 * Math.PI * 0.08 * inputs.length, nearOutside.flux);
});

test('无限大带电平面两侧场强相等反向，通量只由包围电荷决定', () => {
  const a = infiniteChargedPlane({ surfaceChargeDensity: -4e-9, pillboxArea: 0.02, halfHeight: 0.01 });
  const b = infiniteChargedPlane({ surfaceChargeDensity: -4e-9, pillboxArea: 0.02, halfHeight: 0.1 });
  near(a.fieldAbove, -a.fieldBelow);
  near(a.fieldMagnitude, 4e-9 / (2 * EPSILON_0));
  near(a.flux, a.enclosedCharge / EPSILON_0);
  near(a.flux, b.flux);
  assert.ok(a.flux < 0);
});

test('电子向正极板偏转，出射与撞板状态均可计算', () => {
  const exit = particleInUniformField({ particle: 'electron', voltage: 30, gap: 0.04, speed: 1e7 });
  assert.equal(exit.hitPlate, false);
  assert.ok(exit.finalY > 0);
  near(exit.finalX, 0.12);
  const hit = particleInUniformField({ particle: 'electron', voltage: 300, gap: 0.04, speed: 1e7 });
  assert.equal(hit.hitPlate, true);
  near(hit.finalY, 0.02);
  assert.ok(hit.finalX < 0.12);
  near(hit.charge, -ELEMENTARY_CHARGE);
});

test('RC 充放电在一个时间常数处符合指数规律', () => {
  const charge = rcCircuit({ voltage: 10, resistance: 1000, capacitance: 0.001, time: 1, mode: 'charge' });
  const discharge = rcCircuit({ voltage: 10, resistance: 1000, capacitance: 0.001, time: 1, mode: 'discharge' });
  near(charge.tau, 1);
  near(charge.capacitorVoltage, 10 * (1 - Math.exp(-1)));
  near(discharge.capacitorVoltage, 10 * Math.exp(-1));
  near(charge.current, -discharge.current);
});
