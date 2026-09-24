export const K = 8.9875517923e9;
export const EPSILON_0 = 8.8541878128e-12;
export const MIN_RADIUS = 0.01;
export const ELEMENTARY_CHARGE = 1.602176634e-19;
export const ELECTRON_MASS = 9.1093837139e-31;
export const PROTON_MASS = 1.67262192595e-27;

export function coulombForceOnFirst(q1, q2, first, second) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const r = Math.hypot(dx, dy);
  if (r < MIN_RADIUS) return null;
  const factor = K * q1 * q2 / (r ** 3);
  return { x: factor * dx, y: factor * dy, magnitude: Math.abs(K * q1 * q2) / (r ** 2), distance: r };
}

export function electricFieldAt(charges, point) {
  let x = 0;
  let y = 0;
  for (const charge of charges) {
    const dx = point.x - charge.x;
    const dy = point.y - charge.y;
    const r = Math.hypot(dx, dy);
    if (r < MIN_RADIUS) return null;
    const factor = K * charge.q / (r ** 3);
    x += factor * dx;
    y += factor * dy;
  }
  return { x, y, magnitude: Math.hypot(x, y) };
}

export function electricPotentialAt(charges, point) {
  let value = 0;
  for (const charge of charges) {
    const r = Math.hypot(point.x - charge.x, point.y - charge.y);
    if (r < MIN_RADIUS) return null;
    value += K * charge.q / r;
  }
  return value;
}

export function parallelPlateCapacitor({ voltage, distance, area, relativePermittivity }) {
  if (distance <= 0 || area <= 0 || relativePermittivity < 1) return null;
  const capacitance = EPSILON_0 * relativePermittivity * area / distance;
  return {
    capacitance,
    charge: capacitance * voltage,
    field: voltage / distance,
    energy: 0.5 * capacitance * voltage ** 2,
  };
}

export function uniformChargedSphere({ totalCharge, sphereRadius, gaussianRadius }) {
  if (sphereRadius <= 0 || gaussianRadius < 0) return null;
  const fraction = Math.min(1, (gaussianRadius / sphereRadius) ** 3);
  const enclosedCharge = totalCharge * fraction;
  return {
    enclosedCharge,
    flux: enclosedCharge / EPSILON_0,
    field: gaussianRadius === 0 ? 0 : K * enclosedCharge / gaussianRadius ** 2,
  };
}

export function chargedCylindricalShell({ surfaceChargeDensity, shellRadius, gaussianRadius, length }) {
  if (shellRadius <= 0 || gaussianRadius <= 0 || length <= 0) return null;
  const surface = Math.abs(gaussianRadius - shellRadius) < 1e-12;
  if (surface && surfaceChargeDensity !== 0) return { region: 'surface', enclosedCharge: null, field: null, flux: null };
  if (gaussianRadius < shellRadius || surface) return { region: 'inside', enclosedCharge: 0, field: 0, flux: 0 };
  const enclosedCharge = surfaceChargeDensity * 2 * Math.PI * shellRadius * length;
  return {
    region: 'outside',
    enclosedCharge,
    field: surfaceChargeDensity * shellRadius / (EPSILON_0 * gaussianRadius),
    flux: enclosedCharge / EPSILON_0,
  };
}

export function infiniteChargedPlane({ surfaceChargeDensity, pillboxArea, halfHeight }) {
  if (pillboxArea <= 0 || halfHeight <= 0) return null;
  const enclosedCharge = surfaceChargeDensity * pillboxArea;
  const fieldAbove = surfaceChargeDensity / (2 * EPSILON_0);
  return {
    enclosedCharge,
    flux: enclosedCharge / EPSILON_0,
    fieldAbove,
    fieldBelow: -fieldAbove,
    fieldMagnitude: Math.abs(fieldAbove),
  };
}

export function particleInUniformField({ particle, voltage, gap, speed, length = 0.12 }) {
  if (gap <= 0 || speed <= 0 || length <= 0 || voltage < 0) return null;
  const charge = particle === 'electron' ? -ELEMENTARY_CHARGE : particle === 'proton' ? ELEMENTARY_CHARGE : null;
  const mass = particle === 'electron' ? ELECTRON_MASS : particle === 'proton' ? PROTON_MASS : null;
  if (charge === null) return null;
  const field = -voltage / gap;
  const acceleration = charge * field / mass;
  const exitTime = length / speed;
  const impactTime = acceleration === 0 ? Infinity : Math.sqrt(gap / Math.abs(acceleration));
  const hitPlate = impactTime < exitTime;
  const duration = Math.min(impactTime, exitTime);
  return {
    charge,
    mass,
    field,
    acceleration,
    duration,
    hitPlate,
    finalX: speed * duration,
    finalY: 0.5 * acceleration * duration ** 2,
    finalVy: acceleration * duration,
    positionAt(time) {
      const t = Math.max(0, Math.min(duration, time));
      return { x: speed * t, y: 0.5 * acceleration * t ** 2 };
    },
  };
}

export function rcCircuit({ voltage, resistance, capacitance, time, mode }) {
  if (voltage < 0 || resistance <= 0 || capacitance <= 0 || time < 0 || !['charge', 'discharge'].includes(mode)) return null;
  const tau = resistance * capacitance;
  const decay = Math.exp(-time / tau);
  const capacitorVoltage = mode === 'charge' ? voltage * (1 - decay) : voltage * decay;
  const current = (mode === 'charge' ? 1 : -1) * voltage / resistance * decay;
  return {
    tau,
    capacitorVoltage,
    charge: capacitance * capacitorVoltage,
    current,
    normalizedVoltage: voltage === 0 ? 0 : capacitorVoltage / voltage,
    normalizedCurrent: voltage === 0 ? 0 : Math.abs(current * resistance / voltage),
  };
}
