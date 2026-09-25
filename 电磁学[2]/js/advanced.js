import {
  EPSILON_0,
  SPEED_OF_LIGHT,
  hysteresisStep,
  linearMagneticMedium,
  motionalEmfState,
  rotatingCoilState,
  seriesRlc,
  vacuumPlaneWave,
} from './physics.js';

const $ = (id) => document.getElementById(id);
const fmt = (value, digits = 2) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value);
const signed = (value, digits = 2) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmt(Math.abs(value), digits)}`;
const scientific = (value, digits = 2) => {
  if (!value) return '0';
  const [mantissa, exponent] = value.toExponential(digits).split('e');
  return `${mantissa} × 10${String(Number(exponent)).replaceAll('-', '⁻').replaceAll('0', '⁰').replaceAll('1', '¹').replaceAll('2', '²').replaceAll('3', '³').replaceAll('4', '⁴').replaceAll('5', '⁵').replaceAll('6', '⁶').replaceAll('7', '⁷').replaceAll('8', '⁸').replaceAll('9', '⁹')}`;
};
const quantity = (value, unit, digits = 2) => {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return `0 ${unit}`;
  const exponent = Math.max(-15, Math.min(3, Math.floor(Math.log10(Math.abs(value)) / 3) * 3));
  const prefix = ({ 3: 'k', 0: '', '-3': 'm', '-6': 'μ', '-9': 'n', '-12': 'p', '-15': 'f' })[exponent];
  return `${fmt(value / 10 ** exponent, digits)} ${prefix}${unit}`;
};
function metrics(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}
function background(ctx, width, height) {
  ctx.fillStyle = '#0c1a29'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#203648'; ctx.lineWidth = 1;
  for (let x = width / 2 % 32; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = height / 2 % 32; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
}
function text(ctx, value, x, y, color = '#c2d6df', align = 'left', size = 12, weight = '') {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px sans-serif`; ctx.textAlign = align; ctx.fillText(value, x, y); ctx.textAlign = 'left';
}
function arrow(ctx, x1, y1, x2, y2, color = '#88e5c9', width = 2, head = 8) {
  const angle = Math.atan2(y2 - y1, x2 - x1); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - 0.52), y2 - head * Math.sin(angle - 0.52));
  ctx.lineTo(x2 - head * Math.cos(angle + 0.52), y2 - head * Math.sin(angle + 0.52)); ctx.closePath(); ctx.fill();
}
function plot(ctx, rect, points, { color = '#88e5c9', xMin = -1, xMax = 1, yMin = -1, yMax = 1, width = 2, alpha = 1 } = {}) {
  const px = (x) => rect.x + (x - xMin) / (xMax - xMin) * rect.w;
  const py = (y) => rect.y + (1 - (y - yMin) / (yMax - yMin)) * rect.h;
  ctx.save(); ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(px(point.x), py(point.y)) : ctx.moveTo(px(point.x), py(point.y)));
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
  return { x: px, y: py };
}
function axes(ctx, rect, { xMin = -1, xMax = 1, yMin = -1, yMax = 1, title = '', xLabel = '', yLabel = '' } = {}) {
  ctx.save(); ctx.strokeStyle = '#345064'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
  for (let i = 0; i <= 4; i++) {
    const x = rect.x + rect.w * i / 4; const y = rect.y + rect.h * i / 4;
    ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.strokeStyle = '#8097a5';
  if (xMin <= 0 && xMax >= 0) { const x = rect.x + -xMin / (xMax - xMin) * rect.w; ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke(); }
  if (yMin <= 0 && yMax >= 0) { const y = rect.y + (1 - -yMin / (yMax - yMin)) * rect.h; ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke(); }
  ctx.restore(); if (title) text(ctx, title, rect.x, rect.y - 8, '#dceae9', 'left', 12, '700');
  if (xLabel) text(ctx, xLabel, rect.x + rect.w, rect.y + rect.h + 18, '#94aab7', 'right', 10);
  if (yLabel) text(ctx, yLabel, rect.x - 5, rect.y - 5, '#94aab7', 'right', 10);
}

const medium = { kind: 'diamagnetic', h: 500, m: 0, lastH: 0, history: [], frame: null, lastFrame: null, direction: 1 };
const coil = { turns: 40, b: 0.25, area: 25e-4, frequency: 0.5, angle: 0, cycles: 0, frame: null, lastFrame: null };
const rod = { direction: 1, b: 0.5, length: 0.5, velocity: 1, resistance: 2, position: 0.6, frame: null, lastFrame: null };
const rlc = { inductance: 0.1, capacitance: 10e-6, resistance: 40, voltage: 10, progress: 0, frame: null, lastFrame: null };
const wave = { frequency: 1e9, amplitude: 2, polarization: 0, phaseCycles: 0, frame: null, lastFrame: null };

function mediumModel() {
  if (medium.kind === 'ferromagnetic') return { susceptibility: null };
  return { susceptibility: medium.kind === 'diamagnetic' ? -1.7e-5 : 2.2e-5 };
}
function pauseMedium() { if (medium.frame !== null) cancelAnimationFrame(medium.frame); medium.frame = null; medium.lastFrame = null; $('medium-sweep').textContent = '▶ 扫描磁滞回线'; }
function drawMedium() {
  const view = metrics($('medium-canvas')); if (view.width < 2 || view.height < 2) return;
  const { ctx, width, height } = view; background(ctx, width, height);
  const ferromagnetic = medium.kind === 'ferromagnetic';
  $('medium-sweep').disabled = !ferromagnetic;
  let state;
  if (ferromagnetic) state = { magnetization: medium.m, magneticFluxDensity: 4 * Math.PI * 1e-7 * (medium.h + medium.m), magneticFieldStrength: medium.h };
  else state = linearMagneticMedium({ magneticFieldStrength: medium.h, susceptibility: mediumModel().susceptibility });

  const materialWidth = width * 0.32; const top = 45; const blockHeight = height * 0.42;
  ctx.fillStyle = '#172c3a'; ctx.strokeStyle = '#497064'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(18, top, Math.max(90, materialWidth - 35), blockHeight, 10); ctx.fill(); ctx.stroke();
  text(ctx, ferromagnetic ? '铁磁畴（示意）' : medium.kind === 'diamagnetic' ? '抗磁材料' : '顺磁材料', materialWidth / 2, top - 12, '#dceae9', 'center', 12, '700');
  const arrows = 5; const span = Math.max(35, materialWidth - 68); const yStep = blockHeight / (arrows + 1);
  const responseSign = ferromagnetic ? Math.sign(medium.m || medium.h) : Math.sign(state.magnetization || 1);
  for (let i = 1; i <= arrows; i++) {
    const y = top + yStep * i; const x = 31 + ((i % 2) * 13); const len = 16 + Math.min(1, Math.abs(state.magnetization) / (ferromagnetic ? 1.2e6 : 0.04)) * 18;
    const sign = medium.kind === 'diamagnetic' ? -Math.sign(medium.h || 1) : responseSign;
    arrow(ctx, sign > 0 ? x : x + len, y, sign > 0 ? x + len : x, y, medium.kind === 'diamagnetic' ? '#85bdf3' : '#88e5c9', 1.8, 6);
  }
  arrow(ctx, 24, top + blockHeight + 27, materialWidth - 20, top + blockHeight + 27, '#f5ce74', 1.8, 7);
  text(ctx, '外加 H', materialWidth / 2, top + blockHeight + 47, '#f5ce74', 'center', 11);

  const graph = { x: materialWidth + 42, y: 58, w: width - materialWidth - 73, h: height - 103 };
  const maxM = ferromagnetic ? 1.2e6 : Math.max(0.04, Math.abs(1500 * mediumModel().susceptibility) * 1.2);
  axes(ctx, graph, { xMin: -1500, xMax: 1500, yMin: -maxM, yMax: maxM, title: '磁化曲线 M(H)', xLabel: 'H / A·m⁻¹', yLabel: ferromagnetic ? 'M / A·m⁻¹' : 'M / A·m⁻¹' });
  if (ferromagnetic) {
    plot(ctx, graph, medium.history, { color: '#f1c768', xMin: -1500, xMax: 1500, yMin: -maxM, yMax: maxM, width: 2.5 });
    const curve = [];
    for (let h = -1500; h <= 1500; h += 12) curve.push({ x: h, y: 1.2e6 * Math.tanh((h - 150) / 350) });
    plot(ctx, graph, curve, { color: '#657783', xMin: -1500, xMax: 1500, yMin: -maxM, yMax: maxM, width: 1.2, alpha: 0.65 });
  } else {
    const curve = [];
    for (let h = -1500; h <= 1500; h += 15) curve.push({ x: h, y: mediumModel().susceptibility * h });
    plot(ctx, graph, curve, { color: medium.kind === 'diamagnetic' ? '#86baf0' : '#88e5c9', xMin: -1500, xMax: 1500, yMin: -maxM, yMax: maxM, width: 2.4 });
  }
  const pointMap = plot(ctx, graph, [{ x: medium.h, y: state.magnetization }], { color: '#f5ce74', xMin: -1500, xMax: 1500, yMin: -maxM, yMax: maxM, width: 0 });
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pointMap.x(medium.h), pointMap.y(state.magnetization), 5, 0, Math.PI * 2); ctx.fill();
  $('medium-h-value').textContent = `${signed(medium.h, 0)} A/m`;
  $('medium-m').textContent = `${quantity(state.magnetization, 'A/m', 3)}`;
  $('medium-b').textContent = `${fmt(state.magneticFluxDensity * 1e6, 5)} μT`;
  $('medium-b-vacuum').textContent = `${fmt((4 * Math.PI * 1e-7 * medium.h) * 1e6, 5)} μT`;
  $('medium-explanation').textContent = ferromagnetic
    ? '铁磁材料的 M 取决于磁场扫描历史；外场降至零后仍可保留剩磁，反向磁场达到矫顽力附近时磁化反转。'
    : medium.kind === 'diamagnetic'
      ? '抗磁材料的磁化方向与外场相反；这里以铋的弱场磁化率作例，磁化对 B 的改变量很小。'
      : '顺磁材料的磁化方向与外场相同；这里以铝的弱场磁化率作例，移去外场后不保留明显剩磁。';
}
function setMediumField(value) {
  const next = Number(value);
  if (medium.kind === 'ferromagnetic') {
    const state = hysteresisStep({ magneticFieldStrength: next, previousField: medium.lastH, magnetization: medium.m, saturation: 1.2e6, coerciveField: 150, width: 350 });
    medium.m = state.magnetization; medium.lastH = next;
    if (!medium.history.length || medium.history.at(-1).x !== next) medium.history.push({ x: next, y: medium.m });
    if (medium.history.length > 900) medium.history.shift();
  }
  medium.h = next; drawMedium();
}
$('medium-kind').addEventListener('change', (event) => { pauseMedium(); medium.kind = event.target.value; medium.m = 0; medium.lastH = medium.h; medium.history = [{ x: medium.h, y: medium.m }]; drawMedium(); });
$('medium-h').addEventListener('input', (event) => setMediumField(event.target.value));
$('medium-sweep').addEventListener('click', () => {
  if (medium.frame !== null) { pauseMedium(); return; }
  medium.h = -1500; medium.lastH = -1500; medium.m = -1.2e6; medium.history = [{ x: -1500, y: medium.m }]; medium.direction = 1; $('medium-h').value = '-1500';
  $('medium-sweep').textContent = 'Ⅱ 暂停';
  const tick = (timestamp) => {
    if (medium.lastFrame === null) medium.lastFrame = timestamp;
    const dt = Math.min(0.08, (timestamp - medium.lastFrame) / 1000); medium.lastFrame = timestamp;
    let next = medium.h + medium.direction * 1000 * dt;
    if (next >= 1500) { next = 1500; medium.direction = -1; }
    if (next <= -1500) { next = -1500; medium.direction = 1; }
    $('medium-h').value = String(next); setMediumField(next); medium.frame = requestAnimationFrame(tick);
  };
  medium.frame = requestAnimationFrame(tick);
});
$('medium-reset').addEventListener('click', () => { pauseMedium(); medium.m = 0; medium.h = 0; medium.lastH = 0; medium.history = [{ x: 0, y: 0 }]; $('medium-h').value = '0'; drawMedium(); });

function pauseCoil() { if (coil.frame !== null) cancelAnimationFrame(coil.frame); coil.frame = null; coil.lastFrame = null; $('coil-play').textContent = '▶ 播放'; }
function coilState(cycles = coil.cycles) { return rotatingCoilState({ turns: coil.turns, magneticField: coil.b, area: coil.area, frequency: coil.frequency, initialAngleDeg: coil.angle, cycles }); }
function drawCoil() {
  const view = metrics($('induction-canvas')); if (view.width < 2 || view.height < 2) return;
  const { ctx, width, height } = view; background(ctx, width, height);
  const cx = Math.max(80, width * 0.17); const cy = height * 0.47; const state = coilState();
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const x = cx + i * 23; const y = cy + j * 23;
    if (Math.hypot(x - cx, y - cy) < 14) continue;
    ctx.strokeStyle = '#50716d'; ctx.fillStyle = '#50716d'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
    if ((i + j) % 2) { ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x - 2, y + 2); ctx.stroke(); }
  }
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = '#f1c768'; ctx.lineWidth = 3;
  const visible = Math.max(4, 29 * Math.abs(Math.cos(state.angle)));
  ctx.beginPath(); ctx.ellipse(0, 0, 56, visible, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  arrow(ctx, cx, cy, cx + 48 * Math.cos(state.angle), cy - 48 * Math.sin(state.angle), '#88e5c9', 2.2, 7);
  text(ctx, 'n', cx + 54 * Math.cos(state.angle), cy - 54 * Math.sin(state.angle), '#aaf2dd', 'center', 12, '700');
  text(ctx, `θ = ${fmt((state.angle * 180 / Math.PI + 360) % 360, 0)}°`, cx, cy + 83, '#c2d6df', 'center', 11);
  text(ctx, 'B ⊗', cx, cy - 83, '#90b1b0', 'center', 12);
  const graphX = width * 0.35; const graphW = width - graphX - 27; const graphH = Math.max(48, (height - 82) / 2 - 14);
  const rect1 = { x: graphX, y: 44, w: graphW, h: graphH }; const rect2 = { x: graphX, y: 54 + graphH, w: graphW, h: graphH };
  const fluxAmplitude = Math.max(1e-15, coil.turns * coil.b * coil.area);
  const emfAmplitude = Math.max(1e-15, fluxAmplitude * 2 * Math.PI * coil.frequency);
  axes(ctx, rect1, { xMin: 0, xMax: 2, yMin: -1.15, yMax: 1.15, title: '磁通链 / 峰值', xLabel: '旋转周期', yLabel: 'NΦ / NΦ₀' });
  axes(ctx, rect2, { xMin: 0, xMax: 2, yMin: -1.15, yMax: 1.15, title: '感应电动势 / 峰值', xLabel: '旋转周期', yLabel: 'ε / ε₀' });
  const fluxPoints = []; const emfPoints = [];
  for (let i = 0; i <= 180; i++) {
    const cycles = i * 2 / 180; const sample = coilState(cycles);
    fluxPoints.push({ x: cycles, y: sample.fluxLinkage / fluxAmplitude }); emfPoints.push({ x: cycles, y: sample.emf / emfAmplitude });
  }
  const mapFlux = plot(ctx, rect1, fluxPoints, { color: '#f5ce74', xMin: 0, xMax: 2, yMin: -1.15, yMax: 1.15, width: 2 });
  const mapEmf = plot(ctx, rect2, emfPoints, { color: '#88e5c9', xMin: 0, xMax: 2, yMin: -1.15, yMax: 1.15, width: 2 });
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mapFlux.x(coil.cycles), mapFlux.y(state.fluxLinkage / fluxAmplitude), 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mapEmf.x(coil.cycles), mapEmf.y(state.emf / emfAmplitude), 4, 0, Math.PI * 2); ctx.fill();
  $('coil-turns-value').textContent = `${fmt(coil.turns, 0)} 匝`; $('coil-b-value').textContent = `${fmt(coil.b, 2)} T`;
  $('coil-area-value').textContent = `${fmt(coil.area * 1e4, 0)} cm²`; $('coil-frequency-value').textContent = `${fmt(coil.frequency, 2)} Hz`;
  $('coil-angle-value').textContent = `${fmt(coil.angle, 0)}°`; $('coil-time-value').textContent = `${fmt(state.time, 2)} s`;
  $('coil-time').value = String(coil.cycles);
  $('coil-flux').textContent = quantity(state.fluxLinkage, 'Wb', 3); $('coil-emf').textContent = quantity(state.emf, 'V', 3);
  $('coil-explanation').textContent = state.emf === 0
    ? '此刻磁通链位于极值或磁场为零，因此瞬时感应电动势为零。'
    : `ε 的符号由所选法线确定；当前磁通链${state.emf > 0 ? '正在减小' : '正在增加'}，感应电动势方向依楞次定律反抗磁通变化。`;
}
function advanceCoil(timestamp) {
  if (coil.lastFrame === null) coil.lastFrame = timestamp;
  coil.cycles += Math.min(0.08, (timestamp - coil.lastFrame) / 1000) * 0.35; coil.lastFrame = timestamp;
  if (coil.cycles >= 2) { coil.cycles = 2; pauseCoil(); drawCoil(); return; }
  drawCoil(); coil.frame = requestAnimationFrame(advanceCoil);
}
$('coil-play').addEventListener('click', () => { if (coil.frame !== null) return pauseCoil(); if (coil.cycles >= 2) coil.cycles = 0; $('coil-play').textContent = 'Ⅱ 暂停'; coil.frame = requestAnimationFrame(advanceCoil); });
$('coil-step').addEventListener('click', () => { pauseCoil(); coil.cycles = Math.min(2, coil.cycles + 0.05); drawCoil(); });
$('coil-reset').addEventListener('click', () => { pauseCoil(); coil.cycles = 0; drawCoil(); });
$('coil-time').addEventListener('input', (event) => { pauseCoil(); coil.cycles = Number(event.target.value); drawCoil(); });
for (const [id, key, convert = Number] of [['coil-turns', 'turns'], ['coil-b', 'b'], ['coil-area', 'area', (v) => Number(v) * 1e-4], ['coil-frequency', 'frequency'], ['coil-angle', 'angle']]) {
  $(id).addEventListener('input', (event) => { pauseCoil(); coil[key] = convert(event.target.value); drawCoil(); });
}

function pauseRod() { if (rod.frame !== null) cancelAnimationFrame(rod.frame); rod.frame = null; rod.lastFrame = null; $('rod-play').textContent = '▶ 播放'; }
function drawRod() {
  const view = metrics($('motional-canvas')); if (view.width < 2 || view.height < 2) return;
  const { ctx, width, height } = view; background(ctx, width, height);
  const x1 = 42; const x2 = width - 30; const railTop = height * 0.32; const railBottom = height * 0.72;
  ctx.strokeStyle = '#8bb0b4'; ctx.lineWidth = 5;
  for (const y of [railTop, railBottom]) { ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }
  for (let x = x1 + 20; x < x2; x += 36) for (let y = railTop + 23; y < railBottom - 4; y += 36) {
    ctx.strokeStyle = '#52736f'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
    if (rod.direction > 0) { ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fillStyle = '#52736f'; ctx.fill(); }
  }
  const rodX = x1 + (rod.position - 0.1) / 1.4 * (x2 - x1);
  const halfLength = Math.min((railBottom - railTop) * 0.43, 48 + rod.length * 26);
  ctx.strokeStyle = '#f1c768'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(rodX, (railTop + railBottom) / 2 - halfLength); ctx.lineTo(rodX, (railTop + railBottom) / 2 + halfLength); ctx.stroke();
  ctx.lineCap = 'butt'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(rodX, railTop, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(rodX, railBottom, 4, 0, Math.PI * 2); ctx.fill();
  const state = motionalEmfState({ magneticField: rod.direction * rod.b, length: rod.length, velocity: rod.velocity, resistance: rod.resistance });
  const topPositive = state.emf >= 0; text(ctx, topPositive ? '＋' : '−', rodX + 11, railTop + 4, topPositive ? '#ffaaa0' : '#9bc9ef', 'left', 13, '700'); text(ctx, topPositive ? '−' : '＋', rodX + 11, railBottom + 4, topPositive ? '#9bc9ef' : '#ffaaa0', 'left', 13, '700');
  if (Math.abs(state.current) > 0) arrow(ctx, rodX, state.current > 0 ? railBottom - 13 : railTop + 13, rodX, state.current > 0 ? railTop + 13 : railBottom - 13, '#ffb090', 2, 7);
  if (Math.abs(rod.velocity) > 0.01) arrow(ctx, rodX, railTop - 30, rodX + Math.sign(rod.velocity) * 54, railTop - 30, '#88e5c9', 2, 8);
  text(ctx, `v ${signed(rod.velocity, 2)} m/s`, rodX, railTop - 42, '#aaf2dd', 'center', 11);
  arrow(ctx, x1 + 4, railBottom + 34, x1 + 112, railBottom + 34, '#d3e2e5', 1.5, 7); text(ctx, 'x', x1 + 118, railBottom + 38, '#c2d6df');
  text(ctx, `ε ${signed(state.emf, 3)} V`, width - 34, 28, '#f5ce74', 'right', 12, '700');
  $('rod-b-value').textContent = `${fmt(rod.b, 2)} T`; $('rod-length-value').textContent = `${fmt(rod.length, 2)} m`;
  $('rod-velocity-value').textContent = `${signed(rod.velocity, 2)} m/s`; $('rod-resistance-value').textContent = `${fmt(rod.resistance, 1)} Ω`;
  $('rod-position-value').textContent = `${fmt(rod.position, 2)} m`; $('rod-position').value = String(rod.position);
  $('rod-current').textContent = quantity(state.current, 'A', 3); $('rod-force').textContent = quantity(state.magneticForce, 'N', 3);
  $('rod-power').textContent = `${quantity(state.mechanicalPower, 'W', 3)} = ${quantity(state.joulePower, 'W', 3)}`;
  $('rod-explanation').textContent = rod.velocity === 0 || rod.b === 0
    ? '导体棒相对磁场静止或磁场为零，磁通不变，因此没有动生电动势。'
    : `运动电荷受 qv × B 作用形成电势差；外力维持匀速，机械输入功率与电阻焦耳热相等。电流方向为${state.current > 0 ? '正向' : '反向'}（按图示约定）。`;
}
function advanceRod(timestamp) {
  if (rod.lastFrame === null) rod.lastFrame = timestamp;
  const dt = Math.min(0.08, (timestamp - rod.lastFrame) / 1000); rod.lastFrame = timestamp;
  rod.position += rod.velocity * dt;
  if (rod.position <= 0.1 || rod.position >= 1.5 || rod.velocity === 0) { rod.position = Math.max(0.1, Math.min(1.5, rod.position)); pauseRod(); drawRod(); return; }
  drawRod(); rod.frame = requestAnimationFrame(advanceRod);
}
$('rod-play').addEventListener('click', () => { if (rod.frame !== null) return pauseRod(); if (rod.velocity === 0) return; $('rod-play').textContent = 'Ⅱ 暂停'; rod.frame = requestAnimationFrame(advanceRod); });
$('rod-reset').addEventListener('click', () => { pauseRod(); rod.position = 0.6; drawRod(); });
$('rod-field-direction').addEventListener('change', (event) => { rod.direction = Number(event.target.value); drawRod(); });
for (const [id, key] of [['rod-b', 'b'], ['rod-length', 'length'], ['rod-velocity', 'velocity'], ['rod-resistance', 'resistance'], ['rod-position', 'position']]) {
  $(id).addEventListener('input', (event) => { if (key === 'position') pauseRod(); rod[key] = Number(event.target.value); drawRod(); });
}

function rlcTimeMax() {
  const probe = seriesRlc({ inductance: rlc.inductance, capacitance: rlc.capacitance, resistance: rlc.resistance, initialVoltage: rlc.voltage, time: 0 });
  if (probe.regime === '欠阻尼') return 8 * 2 * Math.PI / probe.dampedFrequency;
  if (probe.regime === '临界阻尼') return 8 / Math.max(probe.alpha, 1e-9);
  const slowRate = probe.naturalFrequency ** 2 / (probe.alpha + Math.sqrt(probe.alpha ** 2 - probe.naturalFrequency ** 2));
  return 8 / Math.max(slowRate, 1e-9);
}
function pauseRlc() { if (rlc.frame !== null) cancelAnimationFrame(rlc.frame); rlc.frame = null; rlc.lastFrame = null; $('rlc-play').textContent = '▶ 播放'; }
function drawRlc() {
  const view = metrics($('rlc-canvas')); if (view.width < 2 || view.height < 2) return;
  const { ctx, width, height } = view; background(ctx, width, height);
  const railY = height * 0.26; const left = width * 0.12; const right = width * 0.84;
  ctx.strokeStyle = '#8faab6'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(left, railY); ctx.lineTo(left + 42, railY); ctx.stroke();
  const capX = left + 48; ctx.beginPath(); ctx.moveTo(capX, railY - 18); ctx.lineTo(capX, railY + 18); ctx.moveTo(capX + 10, railY - 18); ctx.lineTo(capX + 10, railY + 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(capX + 10, railY); ctx.lineTo(capX + 42, railY); ctx.stroke();
  const resistorStart = capX + 42; const resistorEnd = resistorStart + Math.max(45, width * 0.13);
  ctx.beginPath(); ctx.moveTo(resistorStart, railY);
  for (let i = 0; i <= 6; i++) ctx.lineTo(resistorStart + (resistorEnd - resistorStart) * i / 6, railY + (i % 2 ? -9 : 9));
  ctx.lineTo(resistorEnd + 8, railY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(resistorEnd + 8, railY); ctx.lineTo(right - 48, railY); ctx.stroke();
  const coilStart = right - 48; ctx.beginPath(); ctx.moveTo(coilStart, railY);
  for (let i = 0; i < 4; i++) ctx.arc(coilStart + 10 + i * 20, railY, 10, Math.PI, 0, false);
  ctx.stroke(); ctx.beginPath(); ctx.moveTo(right + 32, railY); ctx.lineTo(right + 32, height * 0.40); ctx.lineTo(left, height * 0.40); ctx.lineTo(left, railY); ctx.stroke();
  text(ctx, 'C', capX + 5, railY + 35, '#d5e5ea', 'center', 11, '700'); text(ctx, 'R', (resistorStart + resistorEnd) / 2, railY + 34, '#d5e5ea', 'center', 11, '700'); text(ctx, 'L', coilStart + 34, railY + 34, '#d5e5ea', 'center', 11, '700');
  arrow(ctx, left + 22, railY - 13, left + 65, railY - 13, '#88e5c9', 1.7, 6); text(ctx, 'i(t)', left + 44, railY - 22, '#aaf2dd', 'center', 10);

  const tMax = rlcTimeMax(); const t = rlc.progress * tMax; const state = seriesRlc({ inductance: rlc.inductance, capacitance: rlc.capacitance, resistance: rlc.resistance, initialVoltage: rlc.voltage, time: t });
  const chartX = 42; const chartW = width - 72; const chartH = Math.max(38, (height - height * 0.42 - 40) / 2 - 13);
  const chargeRect = { x: chartX, y: height * 0.46, w: chartW, h: chartH };
  const energyRect = { x: chartX, y: height * 0.46 + chartH + 31, w: chartW, h: chartH };
  axes(ctx, chargeRect, { xMin: 0, xMax: tMax, yMin: -1.15, yMax: 1.15, title: '电荷与电流（归一化）', xLabel: 't / s', yLabel: 'q/q₀，i/(q₀ω₀)' });
  axes(ctx, energyRect, { xMin: 0, xMax: tMax, yMin: 0, yMax: 1.05, title: '能量占初始总能量的比例', xLabel: 't / s', yLabel: 'U/U₀' });
  const qCurve = []; const iCurve = []; const capCurve = []; const indCurve = []; const dissCurve = [];
  for (let i = 0; i <= 160; i++) {
    const sampleTime = tMax * i / 160; const sample = seriesRlc({ inductance: rlc.inductance, capacitance: rlc.capacitance, resistance: rlc.resistance, initialVoltage: rlc.voltage, time: sampleTime });
    qCurve.push({ x: sampleTime, y: sample.charge / (sample.initialCharge || 1) });
    iCurve.push({ x: sampleTime, y: sample.current / ((sample.initialCharge || 1) * sample.naturalFrequency) });
    capCurve.push({ x: sampleTime, y: sample.capacitorEnergy / (sample.initialEnergy || 1) });
    indCurve.push({ x: sampleTime, y: sample.inductorEnergy / (sample.initialEnergy || 1) });
    dissCurve.push({ x: sampleTime, y: sample.dissipatedEnergy / (sample.initialEnergy || 1) });
  }
  const qMap = plot(ctx, chargeRect, qCurve, { color: '#f5ce74', xMin: 0, xMax: tMax, yMin: -1.15, yMax: 1.15, width: 2 });
  plot(ctx, chargeRect, iCurve, { color: '#88e5c9', xMin: 0, xMax: tMax, yMin: -1.15, yMax: 1.15, width: 1.8 });
  plot(ctx, energyRect, capCurve, { color: '#f5ce74', xMin: 0, xMax: tMax, yMin: 0, yMax: 1.05, width: 2 });
  plot(ctx, energyRect, indCurve, { color: '#88e5c9', xMin: 0, xMax: tMax, yMin: 0, yMax: 1.05, width: 2 });
  plot(ctx, energyRect, dissCurve, { color: '#ff8d85', xMin: 0, xMax: tMax, yMin: 0, yMax: 1.05, width: 2 });
  for (const rect of [chargeRect, energyRect]) { const x = rect.x + rlc.progress * rect.w; ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke(); ctx.globalAlpha = 1; }

  const fieldEl = $('rlc-l'); fieldEl.value = String(rlc.inductance * 1000); $('rlc-c').value = String(rlc.capacitance * 1e6); $('rlc-r').value = String(rlc.resistance); $('rlc-voltage').value = String(rlc.voltage); $('rlc-time').value = String(rlc.progress);
  $('rlc-l-value').textContent = `${fmt(rlc.inductance * 1000, 0)} mH`; $('rlc-c-value').textContent = `${fmt(rlc.capacitance * 1e6, 0)} μF`;
  $('rlc-r-value').textContent = `${fmt(rlc.resistance, 0)} Ω`; $('rlc-voltage-value').textContent = `${fmt(rlc.voltage, 0)} V`;
  $('rlc-time-value').textContent = `${quantity(t, 's', 3)} / ${quantity(tMax, 's', 3)}`;
  $('rlc-regime').textContent = `${state.regime} · Rc ${fmt(state.criticalResistance, 1)} Ω`;
  $('rlc-charge-current').textContent = `${quantity(state.charge, 'C', 2)} / ${quantity(state.current, 'A', 2)}`;
  $('rlc-energy').textContent = `${quantity(state.capacitorEnergy, 'J', 2)} + ${quantity(state.inductorEnergy, 'J', 2)} + ${quantity(state.dissipatedEnergy, 'J', 2)}`;
  $('rlc-explanation').textContent = state.regime === '欠阻尼'
    ? '电荷和电流振荡，电容电场能与电感磁场能交替变化；电阻使振幅逐渐衰减。'
    : state.regime === '临界阻尼'
      ? '系统以不发生振荡的最快方式回到平衡；R 等于临界电阻。'
      : '阻尼较强，电荷不发生往复振荡而缓慢衰减；总能量逐步转化为电阻热。';
}
function advanceRlc(timestamp) {
  if (rlc.lastFrame === null) rlc.lastFrame = timestamp;
  rlc.progress += Math.min(0.08, (timestamp - rlc.lastFrame) / 1000) * 0.2; rlc.lastFrame = timestamp;
  if (rlc.progress >= 1) { rlc.progress = 1; pauseRlc(); drawRlc(); return; }
  drawRlc(); rlc.frame = requestAnimationFrame(advanceRlc);
}
$('rlc-play').addEventListener('click', () => { if (rlc.frame !== null) return pauseRlc(); if (rlc.progress >= 1) rlc.progress = 0; $('rlc-play').textContent = 'Ⅱ 暂停'; rlc.frame = requestAnimationFrame(advanceRlc); });
$('rlc-step').addEventListener('click', () => { pauseRlc(); rlc.progress = Math.min(1, rlc.progress + 0.02); drawRlc(); });
$('rlc-reset').addEventListener('click', () => { pauseRlc(); rlc.progress = 0; drawRlc(); });
$('rlc-time').addEventListener('input', (event) => { pauseRlc(); rlc.progress = Number(event.target.value); drawRlc(); });
for (const [id, key, scale = 1] of [['rlc-l', 'inductance', 1e-3], ['rlc-c', 'capacitance', 1e-6], ['rlc-r', 'resistance'], ['rlc-voltage', 'voltage']]) {
  $(id).addEventListener('input', (event) => { pauseRlc(); rlc[key] = Number(event.target.value) * scale; drawRlc(); });
}

function pauseWave() { if (wave.frame !== null) cancelAnimationFrame(wave.frame); wave.frame = null; wave.lastFrame = null; $('wave-play').textContent = '▶ 播放'; }
function waveState() { return vacuumPlaneWave({ frequency: wave.frequency, electricAmplitude: wave.amplitude, phaseCycles: wave.phaseCycles, polarizationDeg: wave.polarization }); }
function drawWave() {
  const view = metrics($('wave-canvas')); if (view.width < 2 || view.height < 2) return;
  const { ctx, width, height } = view; background(ctx, width, height); const state = waveState();
  const insetW = Math.max(66, width * 0.2); const chartX = insetW + 18; const chartW = width - chartX - 22;
  const y1 = height * 0.31; const y2 = height * 0.72; const amp = Math.min(height * 0.14, 48);
  ctx.strokeStyle = '#395568'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(chartX, y1); ctx.lineTo(width - 18, y1); ctx.moveTo(chartX, y2); ctx.lineTo(width - 18, y2); ctx.stroke();
  text(ctx, 'E / E₀', chartX, y1 - amp - 8, '#dceae9', 'left', 11, '700'); text(ctx, 'cB / E₀', chartX, y2 - amp - 8, '#dceae9', 'left', 11, '700');
  const e = []; const b = [];
  for (let i = 0; i <= 180; i++) {
    const u = i / 180; const phase = 4 * Math.PI * u - state.phase;
    e.push({ x: u, y: Math.cos(phase) }); b.push({ x: u, y: Math.cos(phase) });
  }
  for (const points of [e, b]) {
    ctx.beginPath(); points.forEach((p, i) => { const x = chartX + p.x * chartW; const y = (points === e ? y1 : y2) - p.y * amp; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = points === e ? '#83bfff' : '#88e5c9'; ctx.lineWidth = 2.4; ctx.stroke();
  }
  const markX = chartX + ((wave.phaseCycles % 1) * chartW); ctx.strokeStyle = '#f5ce74'; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(markX, y1 - amp - 4); ctx.lineTo(markX, y2 + amp + 7); ctx.stroke(); ctx.setLineDash([]);
  text(ctx, `相位 ${fmt(wave.phaseCycles, 2)} 周期`, chartX, height - 12, '#9bb0bd');
  const cx = insetW / 2 + 6; const cy = height * 0.49; const radius = Math.min(32, height * 0.13); const angle = wave.polarization * Math.PI / 180;
  ctx.strokeStyle = '#526d7a'; ctx.lineWidth = 1; ctx.strokeRect(cx - radius, cy - radius, radius * 2, radius * 2);
  arrow(ctx, cx, cy, cx + Math.sin(angle) * radius * 0.82, cy - Math.cos(angle) * radius * 0.82, '#83bfff', 2.5, 7);
  arrow(ctx, cx, cy, cx + Math.cos(angle) * radius * 0.82, cy + Math.sin(angle) * radius * 0.82, '#88e5c9', 2.5, 7);
  text(ctx, 'E', cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius - 4, '#a5d7ff', 'center', 11, '700');
  text(ctx, 'B', cx + Math.cos(angle) * radius + 2, cy + Math.sin(angle) * radius + 7, '#aaf2dd', 'center', 11, '700');
  arrow(ctx, cx - radius, cy + radius + 21, cx + radius, cy + radius + 21, '#f5ce74', 1.7, 6); text(ctx, 'k', cx, cy + radius + 36, '#f5ce74', 'center', 10);
  $('wave-frequency-value').textContent = `${fmt(wave.frequency / 1e9, 2)} GHz`; $('wave-e0-value').textContent = `${fmt(wave.amplitude, 1)} V/m`;
  $('wave-polarization-value').textContent = `${fmt(wave.polarization, 0)}°`; $('wave-phase-value').textContent = `${fmt(wave.phaseCycles, 2)} 周期`; $('wave-phase').value = String(wave.phaseCycles);
  $('wave-lambda-speed').textContent = `${quantity(state.wavelength, 'm', 3)} / ${quantity(SPEED_OF_LIGHT, 'm/s', 0)}`;
  $('wave-b0').textContent = quantity(state.magneticAmplitude, 'T', 3); $('wave-intensity').textContent = quantity(state.averageIntensity, 'W/m²', 3);
  $('wave-explanation').textContent = `E 与 B 同相，E₀/B₀ = ${quantity(SPEED_OF_LIGHT, 'm/s', 0)}；能流方向沿 +x，偏振角只改变横向场方向。`;
}
function advanceWave(timestamp) {
  if (wave.lastFrame === null) wave.lastFrame = timestamp;
  wave.phaseCycles += Math.min(0.08, (timestamp - wave.lastFrame) / 1000) * 0.35; wave.lastFrame = timestamp;
  if (wave.phaseCycles >= 2) { wave.phaseCycles = 2; pauseWave(); drawWave(); return; }
  drawWave(); wave.frame = requestAnimationFrame(advanceWave);
}
$('wave-play').addEventListener('click', () => { if (wave.frame !== null) return pauseWave(); if (wave.phaseCycles >= 2) wave.phaseCycles = 0; $('wave-play').textContent = 'Ⅱ 暂停'; wave.frame = requestAnimationFrame(advanceWave); });
$('wave-step').addEventListener('click', () => { pauseWave(); wave.phaseCycles = Math.min(2, wave.phaseCycles + 0.05); drawWave(); });
$('wave-reset').addEventListener('click', () => { pauseWave(); wave.phaseCycles = 0; drawWave(); });
$('wave-phase').addEventListener('input', (event) => { pauseWave(); wave.phaseCycles = Number(event.target.value); drawWave(); });
for (const [id, key, scale = 1] of [['wave-frequency', 'frequency', 1e9], ['wave-e0', 'amplitude'], ['wave-polarization', 'polarization']]) {
  $(id).addEventListener('input', (event) => { wave[key] = Number(event.target.value) * scale; drawWave(); });
}

const drawers = { 'magnetic-medium': drawMedium, induction: drawCoil, 'motional-emf': drawRod, 'rlc-oscillation': drawRlc, 'em-wave': drawWave };
export function initAdvancedModels() {
  return {
    draw: (id) => drawers[id]?.(),
    pauseAll: () => { pauseMedium(); pauseCoil(); pauseRod(); pauseRlc(); pauseWave(); },
  };
}
