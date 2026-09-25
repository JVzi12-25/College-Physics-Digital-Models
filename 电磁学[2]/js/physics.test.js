import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EPSILON_0,
  MU_0,
  SPEED_OF_LIGHT,
  hysteresisStep,
  linearMagneticMedium,
  motionalEmfState,
  rotatingCoilState,
  seriesRlc,
  vacuumPlaneWave,
} from './physics.js';

const closeTo = (actual, expected, tolerance = Math.abs(expected) * 1e-10 + 1e-14) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be close to ${expected}`);
};

test('linear magnetic media use M = χH and B = μ₀(H + M)', () => {
  const dia = linearMagneticMedium({ magneticFieldStrength: 500, susceptibility: -1.7e-5 });
  const para = linearMagneticMedium({ magneticFieldStrength: 500, susceptibility: 2.2e-5 });
  closeTo(dia.magnetization, -0.0085);
  closeTo(para.magnetization, 0.011);
  closeTo(dia.magneticFluxDensity, MU_0 * (500 - 0.0085));
  assert.ok(dia.magneticFluxDensity < dia.vacuumFluxDensity);
  assert.ok(para.magneticFluxDensity > para.vacuumFluxDensity);
});

test('a rotating coil obeys Faraday sign and quarter-cycle extrema', () => {
  const options = { turns: 40, magneticField: 0.25, area: 0.0025, frequency: 0.5, initialAngleDeg: 0 };
  const atStart = rotatingCoilState({ ...options, cycles: 0 });
  const quarter = rotatingCoilState({ ...options, cycles: 0.25 });
  const threeQuarter = rotatingCoilState({ ...options, cycles: 0.75 });
  closeTo(atStart.fluxLinkage, options.turns * options.magneticField * options.area);
  closeTo(atStart.emf, 0);
  closeTo(quarter.fluxLinkage, 0, 1e-14);
  closeTo(quarter.emf, options.turns * options.magneticField * options.area * 2 * Math.PI * options.frequency);
  assert.ok(threeQuarter.emf < 0);
});

test('motional emf reverses with velocity and mechanical power becomes Joule heat', () => {
  const state = motionalEmfState({ magneticField: 0.5, length: 0.5, velocity: 1, resistance: 2 });
  const reversed = motionalEmfState({ magneticField: 0.5, length: 0.5, velocity: -1, resistance: 2 });
  closeTo(state.emf, 0.25);
  closeTo(state.current, 0.125);
  closeTo(state.magneticForce, -0.03125);
  closeTo(state.mechanicalPower, state.joulePower);
  closeTo(reversed.emf, -state.emf);
  assert.ok(reversed.magneticForce > 0);
});

test('RLC solutions cover all damping regimes and conserve or dissipate energy correctly', () => {
  const args = { inductance: 0.1, capacitance: 1e-5, initialVoltage: 10 };
  const under = seriesRlc({ ...args, resistance: 0, time: 0.001 });
  const critical = seriesRlc({ ...args, resistance: 200, time: 0.001 });
  const over = seriesRlc({ ...args, resistance: 400, time: 0.001 });
  assert.equal(under.regime, '欠阻尼'); assert.equal(critical.regime, '临界阻尼'); assert.equal(over.regime, '过阻尼');
  for (const state of [under, critical, over]) {
    closeTo(state.capacitorEnergy + state.inductorEnergy + state.dissipatedEnergy, state.initialEnergy);
  }
  const idealEnergy = seriesRlc({ ...args, resistance: 0, time: 0.0015 });
  closeTo(idealEnergy.capacitorEnergy + idealEnergy.inductorEnergy, idealEnergy.initialEnergy);
  const laterLoss = seriesRlc({ ...args, resistance: 40, time: 0.008 });
  assert.ok(laterLoss.dissipatedEnergy > 0);
});

test('ferromagnetic magnetization depends on the field path', () => {
  const positiveBranch = hysteresisStep({ magneticFieldStrength: 1000, previousField: -1000, magnetization: -1.2e6, saturation: 1.2e6, coerciveField: 150, width: 350 });
  const descendingBranch = hysteresisStep({ magneticFieldStrength: 0, previousField: 1000, magnetization: positiveBranch.magnetization, saturation: 1.2e6, coerciveField: 150, width: 350 });
  const resetPath = hysteresisStep({ magneticFieldStrength: 0, previousField: 0, magnetization: 0, saturation: 1.2e6, coerciveField: 150, width: 350 });
  assert.ok(descendingBranch.magnetization > 0.1 * 1.2e6);
  closeTo(resetPath.magnetization, 0);
});

test('vacuum plane waves satisfy c = λf = E₀/B₀ and the average Poynting intensity', () => {
  const wave = vacuumPlaneWave({ frequency: 1e9, electricAmplitude: 2, phaseCycles: 0, polarizationDeg: 30 });
  closeTo(SPEED_OF_LIGHT, 1 / Math.sqrt(MU_0 * EPSILON_0));
  closeTo(wave.wavelength * wave.frequency, SPEED_OF_LIGHT);
  closeTo(wave.electricAmplitude / wave.magneticAmplitude, SPEED_OF_LIGHT);
  closeTo(wave.averageIntensity, 0.5 * EPSILON_0 * SPEED_OF_LIGHT * 4);
});
