import test from "node:test";
import assert from "node:assert/strict";
import {
  criticalAngle, doubleSlitFringeSpacing, doubleSlitIntensity, refract,
  singleSlitIntensity, singleSlitMinimaAngle, thinLens,
} from "../physics.js";

function near(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("Snell 定律与全反射边界", () => {
  near(refract(1, 1, 42).theta2, 42);
  near(refract(1, 1.5, 30).theta2, Math.asin(1 / 3) * 180 / Math.PI);
  const critical = criticalAngle(1.5, 1);
  near(refract(1.5, 1, critical).theta2, 90);
  assert.equal(refract(1.5, 1, critical + 1).reflected, true);
  assert.equal(criticalAngle(1, 1.5), null);
});

test("薄透镜实像、虚像与焦平面", () => {
  const real = thinLens(20, 40);
  near(real.imageDistance, 40);
  near(real.magnification, -1);
  assert.equal(real.kind, "real");
  const virtual = thinLens(-20, 20);
  near(virtual.imageDistance, -10);
  near(virtual.magnification, 0.5);
  assert.equal(virtual.kind, "virtual");
  assert.equal(thinLens(20, 20).kind, "infinity");
});

test("双缝中央亮纹、首个暗纹与条纹间距", () => {
  const lambda = 550e-9, d = 0.5e-3, screen = 1.5;
  near(doubleSlitIntensity(0, lambda, d, screen), 1);
  const firstDark = screen * Math.tan(Math.asin(lambda / (2 * d)));
  near(doubleSlitIntensity(firstDark, lambda, d, screen), 0);
  near(doubleSlitFringeSpacing(lambda, d, screen), 1.65e-3);
});

test("单缝中央极大与第一级暗纹", () => {
  const lambda = 550e-9, width = 20e-6, screen = 1.5;
  near(singleSlitIntensity(0, lambda, width, screen), 1);
  const firstAngle = singleSlitMinimaAngle(1, lambda, width);
  near(firstAngle, Math.asin(lambda / width) * 180 / Math.PI);
  const firstDark = screen * Math.tan(firstAngle * Math.PI / 180);
  near(singleSlitIntensity(firstDark, lambda, width, screen), 0);
});
