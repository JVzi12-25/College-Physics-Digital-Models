import { electricFieldAt, MIN_RADIUS } from './physics.js';

const SEED_RADIUS = MIN_RADIUS * 1.25;
const STOP_RADIUS = MIN_RADIUS * 1.3;

function inside(point, bounds) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.bottom && point.y <= bounds.top;
}

function clipToBounds(from, to, bounds) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let fraction = 1;
  if (to.x < bounds.left) fraction = Math.min(fraction, (bounds.left - from.x) / dx);
  if (to.x > bounds.right) fraction = Math.min(fraction, (bounds.right - from.x) / dx);
  if (to.y < bounds.bottom) fraction = Math.min(fraction, (bounds.bottom - from.y) / dy);
  if (to.y > bounds.top) fraction = Math.min(fraction, (bounds.top - from.y) / dy);
  return { x: from.x + dx * fraction, y: from.y + dy * fraction };
}

export function traceElectricFieldLines(charges, bounds, density = 14) {
  if (bounds.left >= bounds.right || bounds.bottom >= bounds.top) return [];
  const active = charges.filter((charge) => Number.isFinite(charge.x) && Number.isFinite(charge.y) && Number.isFinite(charge.q) && charge.q !== 0);
  if (active.length === 0) return [];

  const requested = active.map((charge) => Math.max(3, Math.min(28, Math.round(density * Math.abs(charge.q) / 5e-9))));
  const scale = Math.min(1, 96 / requested.reduce((sum, count) => sum + count, 0));
  const step = Math.max(0.0015, Math.min(0.004, (bounds.top - bounds.bottom) / 110));
  const directionAt = (point, sign) => {
    const field = electricFieldAt(active, point);
    if (!field || !Number.isFinite(field.magnitude) || field.magnitude < 1e-7) return null;
    return { x: sign * field.x / field.magnitude, y: sign * field.y / field.magnitude };
  };
  const lines = [];

  active.forEach((source, sourceIndex) => {
    const sign = Math.sign(source.q);
    const count = Math.max(3, Math.round(requested[sourceIndex] * scale));
    for (let index = 0; index < count; index += 1) {
      const angle = 2 * Math.PI * (index / count + sourceIndex * 0.073);
      let point = { x: source.x + SEED_RADIUS * Math.cos(angle), y: source.y + SEED_RADIUS * Math.sin(angle) };
      if (!inside(point, bounds)) continue;
      const points = [point];
      let reachedBoundary = false;

      for (let stepIndex = 0; stepIndex < 350; stepIndex += 1) {
        const initial = directionAt(point, sign);
        if (!initial) break;
        const middle = { x: point.x + initial.x * step / 2, y: point.y + initial.y * step / 2 };
        const midpoint = directionAt(middle, sign);
        if (!midpoint) break;
        const next = { x: point.x + midpoint.x * step, y: point.y + midpoint.y * step };
        if (!inside(next, bounds)) {
          points.push(clipToBounds(point, next, bounds));
          reachedBoundary = true;
          break;
        }
        points.push(next);
        point = next;
        if (active.some((charge) => charge !== source && Math.hypot(point.x - charge.x, point.y - charge.y) <= STOP_RADIUS)) break;
      }

      // Reverse-traced negative lines represent field entering the visible area.
      // Paths that reach a positive charge are already covered by positive seeds.
      if (points.length >= 4 && (sign > 0 || reachedBoundary)) {
        lines.push(sign > 0 ? points : points.reverse());
      }
    }
  });

  return lines;
}
