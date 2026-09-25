export const MU_0 = 4 * Math.PI * 1e-7;
export const ELEMENTARY_CHARGE = 1.602176634e-19;
export const ELECTRON_MASS = 9.1093837139e-31;
export const PROTON_MASS = 1.67262192595e-27;

export function magneticFieldOfWire({ current, radius }) {
  if (radius <= 0) return null;
  return MU_0 * Math.abs(current) / (2 * Math.PI * radius);
}

export function magneticFieldOnLoopAxis({ current, radius, axialPosition }) {
  if (radius <= 0) return null;
  return MU_0 * Math.abs(current) * radius ** 2 / (2 * (radius ** 2 + axialPosition ** 2) ** 1.5);
}

export function magneticFieldInsideSolenoid({ current, turnsPerMeter, inside }) {
  if (turnsPerMeter < 0) return null;
  return inside ? MU_0 * Math.abs(current) * turnsPerMeter : 0;
}

export function chargedParticleState({ particle, magneticField, speed, angleDeg, cycles }) {
  const charge = particle === 'electron' ? -ELEMENTARY_CHARGE : particle === 'proton' ? ELEMENTARY_CHARGE : null;
  const mass = particle === 'electron' ? ELECTRON_MASS : particle === 'proton' ? PROTON_MASS : null;
  if (charge === null || mass === null || magneticField < 0 || speed < 0) return null;

  const angle = angleDeg * Math.PI / 180;
  const parallelSpeed = speed * Math.cos(angle);
  const perpendicularSpeed = speed * Math.sin(angle);
  const angularFrequency = charge * magneticField / mass;
  const angularFrequencyMagnitude = Math.abs(angularFrequency);
  const period = angularFrequencyMagnitude === 0 ? Infinity : 2 * Math.PI / angularFrequencyMagnitude;
  const radius = angularFrequencyMagnitude === 0 ? Infinity : perpendicularSpeed / angularFrequencyMagnitude;
  const phase = cycles * 2 * Math.PI;
  const time = Number.isFinite(period) ? cycles * period : cycles * 2e-8;
  const signedPhase = angularFrequency === 0 ? 0 : Math.sign(angularFrequency) * phase;
  const position = angularFrequencyMagnitude === 0
    ? { x: parallelSpeed * time, y: perpendicularSpeed * time, z: 0 }
    : {
      x: parallelSpeed * time,
      y: perpendicularSpeed / angularFrequency * Math.sin(signedPhase),
      z: perpendicularSpeed / angularFrequency * (Math.cos(signedPhase) - 1),
    };
  const velocity = angularFrequencyMagnitude === 0
    ? { x: parallelSpeed, y: perpendicularSpeed, z: 0 }
    : { x: parallelSpeed, y: perpendicularSpeed * Math.cos(signedPhase), z: -perpendicularSpeed * Math.sin(signedPhase) };
  const force = {
    x: 0,
    y: charge * magneticField * velocity.z,
    z: -charge * magneticField * velocity.y,
  };

  return {
    charge, mass, parallelSpeed, perpendicularSpeed, angularFrequency,
    angularFrequencyMagnitude, period, radius, time, phase, position, velocity,
    force, forceMagnitude: Math.hypot(force.x, force.y, force.z),
  };
}

export const EPSILON_0 = 8.8541878128e-12;
export const SPEED_OF_LIGHT = 1 / Math.sqrt(MU_0 * EPSILON_0);

export function linearMagneticMedium({ magneticFieldStrength, susceptibility }) {
  if (![magneticFieldStrength, susceptibility].every(Number.isFinite) || susceptibility <= -1) return null;
  const magnetization = susceptibility * magneticFieldStrength;
  return {
    magneticFieldStrength,
    susceptibility,
    magnetization,
    magneticFluxDensity: MU_0 * (magneticFieldStrength + magnetization),
    vacuumFluxDensity: MU_0 * magneticFieldStrength,
  };
}

export function hysteresisStep({ magneticFieldStrength, previousField, magnetization, saturation, coerciveField, width }) {
  if (![magneticFieldStrength, previousField, magnetization, saturation, coerciveField, width].every(Number.isFinite) || width <= 0) return null;
  const delta = magneticFieldStrength - previousField;
  const direction = delta === 0 ? 1 : Math.sign(delta);
  const target = saturation * Math.tanh((magneticFieldStrength - direction * coerciveField) / width);
  const updated = magnetization + (target - magnetization) * (1 - Math.exp(-Math.abs(delta) / width));
  return { magneticFieldStrength, magnetization: updated, magneticFluxDensity: MU_0 * (magneticFieldStrength + updated), direction };
}

export function rotatingCoilState({ turns, magneticField, area, frequency, initialAngleDeg, cycles }) {
  if (![turns, magneticField, area, frequency, initialAngleDeg, cycles].every(Number.isFinite) || turns < 0 || area < 0 || frequency < 0) return null;
  const angularFrequency = 2 * Math.PI * frequency;
  const angle = initialAngleDeg * Math.PI / 180 + 2 * Math.PI * cycles;
  const fluxPerTurn = magneticField * area * Math.cos(angle);
  const fluxLinkage = turns * fluxPerTurn;
  const emf = turns * magneticField * area * angularFrequency * Math.sin(angle);
  return { angle, angularFrequency, time: frequency === 0 ? 0 : cycles / frequency, fluxPerTurn, fluxLinkage, emf };
}

export function motionalEmfState({ magneticField, length, velocity, resistance }) {
  if (![magneticField, length, velocity, resistance].every(Number.isFinite) || length < 0 || resistance <= 0) return null;
  const emf = magneticField * length * velocity;
  const current = emf / resistance;
  const magneticForce = -(magneticField ** 2) * (length ** 2) * velocity / resistance;
  const mechanicalPower = -magneticForce * velocity;
  const joulePower = current ** 2 * resistance;
  return { emf, current, magneticForce, mechanicalPower, joulePower };
}

export function seriesRlc({ inductance, capacitance, resistance, initialVoltage, time }) {
  if (![inductance, capacitance, resistance, initialVoltage, time].every(Number.isFinite) || inductance <= 0 || capacitance <= 0 || resistance < 0 || time < 0) return null;
  const alpha = resistance / (2 * inductance);
  const naturalFrequency = 1 / Math.sqrt(inductance * capacitance);
  const initialCharge = capacitance * initialVoltage;
  let charge; let current; let regime; let dampedFrequency = 0;
  const delta = naturalFrequency ** 2 - alpha ** 2;
  if (delta > naturalFrequency ** 2 * 1e-12) {
    regime = '欠阻尼'; dampedFrequency = Math.sqrt(delta);
    const decay = Math.exp(-alpha * time);
    charge = initialCharge * decay * (Math.cos(dampedFrequency * time) + alpha / dampedFrequency * Math.sin(dampedFrequency * time));
    current = -initialCharge * decay * naturalFrequency ** 2 / dampedFrequency * Math.sin(dampedFrequency * time);
  } else if (delta >= -(naturalFrequency ** 2) * 1e-12) {
    regime = '临界阻尼';
    const decay = Math.exp(-alpha * time);
    charge = initialCharge * (1 + alpha * time) * decay;
    current = -initialCharge * alpha ** 2 * time * decay;
  } else {
    regime = '过阻尼';
    const root = Math.sqrt(-delta);
    const r1 = -(naturalFrequency ** 2) / (alpha + root); const r2 = -alpha - root;
    const a = -initialCharge * r2 / (r1 - r2); const b = initialCharge * r1 / (r1 - r2);
    charge = a * Math.exp(r1 * time) + b * Math.exp(r2 * time);
    current = a * r1 * Math.exp(r1 * time) + b * r2 * Math.exp(r2 * time);
  }
  const capacitorEnergy = charge ** 2 / (2 * capacitance);
  const inductorEnergy = inductance * current ** 2 / 2;
  const initialEnergy = capacitance * initialVoltage ** 2 / 2;
  return { charge, current, capacitorEnergy, inductorEnergy, dissipatedEnergy: Math.max(0, initialEnergy - capacitorEnergy - inductorEnergy), initialCharge, initialEnergy, alpha, naturalFrequency, dampedFrequency, criticalResistance: 2 * Math.sqrt(inductance / capacitance), regime };
}

export function vacuumPlaneWave({ frequency, electricAmplitude, phaseCycles, polarizationDeg }) {
  if (![frequency, electricAmplitude, phaseCycles, polarizationDeg].every(Number.isFinite) || frequency <= 0 || electricAmplitude < 0) return null;
  const wavelength = SPEED_OF_LIGHT / frequency;
  const magneticAmplitude = electricAmplitude / SPEED_OF_LIGHT;
  const averageIntensity = 0.5 * EPSILON_0 * SPEED_OF_LIGHT * electricAmplitude ** 2;
  const angle = polarizationDeg * Math.PI / 180;
  return { frequency, electricAmplitude, magneticAmplitude, wavelength, angularFrequency: 2 * Math.PI * frequency, waveNumber: 2 * Math.PI / wavelength, phase: 2 * Math.PI * phaseCycles, averageIntensity, electricDirection: { y: Math.cos(angle), z: Math.sin(angle) }, magneticDirection: { y: -Math.sin(angle), z: Math.cos(angle) } };
}
