import { coulombForceOnFirst, electricFieldAt, electricPotentialAt, parallelPlateCapacitor, uniformChargedSphere, chargedCylindricalShell, infiniteChargedPlane, particleInUniformField, rcCircuit } from './physics.js';

const $ = (id) => document.getElementById(id);
const number = (value, digits = 2) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value);
const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}`;

function quantity(value, unit) {
  if (value === null || !Number.isFinite(value)) return '未定义';
  if (value === 0) return `0 ${unit}`;
  const abs = Math.abs(value);
  const prefix = abs >= 1 ? ['', 1] : abs >= 1e-3 ? ['m', 1e3] : abs >= 1e-6 ? ['µ', 1e6] : abs >= 1e-9 ? ['n', 1e9] : ['p', 1e12];
  return `${number(value * prefix[1])} ${prefix[0]}${unit}`;
}

function dimensions(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height, scale: rect.width / 0.5 };
}

function canvasView(canvas) {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height, scale: rect.width / 0.5 };
}

function toScreen(point, view) {
  return { x: view.width / 2 + point.x * view.scale, y: view.height / 2 - point.y * view.scale };
}

function toWorld(point, view) {
  return { x: (point.x - view.width / 2) / view.scale, y: (view.height / 2 - point.y) / view.scale };
}

function pointerOnCanvas(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function clampPoint(point, view) {
  return { x: Math.max(-0.23, Math.min(0.23, point.x)), y: Math.max((-view.height / 2 + 25) / view.scale, Math.min((view.height / 2 - 25) / view.scale, point.y)) };
}

function canvasBackground(view) {
  const { ctx, width, height, scale } = view;
  ctx.fillStyle = '#0c1a29';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#203648';
  ctx.lineWidth = 1;
  for (let x = width / 2 % (scale * 0.05); x < width; x += scale * 0.05) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = height / 2 % (scale * 0.05); y < height; y += scale * 0.05) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.strokeStyle = '#426072';
  ctx.beginPath(); ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  ctx.fillStyle = '#7e9aac'; ctx.font = '11px sans-serif'; ctx.fillText('0', width / 2 + 7, height / 2 - 8);
}

function arrow(ctx, from, to, color, width = 2) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = 8;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(to.x, to.y); ctx.lineTo(to.x - head * Math.cos(angle - 0.55), to.y - head * Math.sin(angle - 0.55)); ctx.lineTo(to.x - head * Math.cos(angle + 0.55), to.y - head * Math.sin(angle + 0.55)); ctx.closePath(); ctx.fill();
}

function chargeSymbol(ctx, point, q, label, selected = false) {
  const color = q > 0 ? '#ff8c7f' : q < 0 ? '#6db8ef' : '#a6b5c3';
  ctx.save();
  if (selected) { ctx.strokeStyle = '#effff9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(point.x, point.y, 22, 0, Math.PI * 2); ctx.stroke(); }
  ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(point.x, point.y, 17, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#102030'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(q > 0 ? '+' : q < 0 ? '−' : '0', point.x, point.y - 1);
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#c7dce2'; ctx.font = '12px sans-serif';
  ctx.fillText(label, point.x, point.y + 36); ctx.textAlign = 'left';
}

const coulomb = { q1: 5, q2: -5, first: { x: -0.08, y: 0 }, second: { x: 0.08, y: 0 }, drag: null };
const coulombCanvas = $('coulomb-canvas');

function drawCoulomb() {
  const view = dimensions(coulombCanvas);
  const { ctx } = view;
  canvasBackground(view);
  const a = toScreen(coulomb.first, view);
  const b = toScreen(coulomb.second, view);
  ctx.setLineDash([5, 6]); ctx.strokeStyle = '#7894a6'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
  const force = coulombForceOnFirst(coulomb.q1 * 1e-9, coulomb.q2 * 1e-9, coulomb.first, coulomb.second);
  if (force && force.magnitude > 0) {
    const length = Math.max(35, Math.min(78, 40 + 12 * Math.log10(1 + force.magnitude * 1e5)));
    const norm = Math.hypot(force.x, force.y);
    const dx = force.x / norm * length;
    const dy = -force.y / norm * length;
    arrow(ctx, { x: a.x + dx * 0.32, y: a.y + dy * 0.32 }, { x: a.x + dx, y: a.y + dy }, '#8ce8c9', 3);
    arrow(ctx, { x: b.x - dx * 0.32, y: b.y - dy * 0.32 }, { x: b.x - dx, y: b.y - dy }, '#e1d188', 3);
  }
  chargeSymbol(ctx, a, coulomb.q1, 'q₁');
  chargeSymbol(ctx, b, coulomb.q2, 'q₂');
  $('q1-value').textContent = `${signed(coulomb.q1)} nC`;
  $('q2-value').textContent = `${signed(coulomb.q2)} nC`;
  $('coulomb-distance').textContent = `${number(Math.hypot(coulomb.first.x - coulomb.second.x, coulomb.first.y - coulomb.second.y) * 100, 1)} cm`;
  $('coulomb-force').textContent = force ? quantity(force.magnitude, 'N') : '未定义';
  $('coulomb-direction').textContent = !force ? '电荷过近；将它们分开以查看点电荷模型结果。' : force.magnitude === 0 ? '至少一个电荷量为 0，因此静电力为 0。' : coulomb.q1 * coulomb.q2 > 0 ? '同号电荷相斥；两侧箭头表示各自的受力方向。' : '异号电荷相吸；两侧箭头表示各自的受力方向。';
}

function bindDrag(canvas, hitTest, move) {
  let dragging = null;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = hitTest(pointerOnCanvas(event, canvas));
    if (dragging !== null) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragging !== null) move(dragging, pointerOnCanvas(event, canvas));
  });
  canvas.addEventListener('pointerup', () => { dragging = null; });
  canvas.addEventListener('pointercancel', () => { dragging = null; });
}

bindDrag(coulombCanvas, (pointer) => {
  const view = canvasView(coulombCanvas);
  const points = [toScreen(coulomb.first, view), toScreen(coulomb.second, view)];
  const distances = points.map((point) => Math.hypot(pointer.x - point.x, pointer.y - point.y));
  const index = distances.indexOf(Math.min(...distances));
  return distances[index] < 28 ? index : null;
}, (index, pointer) => {
  const view = canvasView(coulombCanvas);
  const position = clampPoint(toWorld(pointer, view), view);
  if (index === 0) coulomb.first = position; else coulomb.second = position;
  drawCoulomb();
});

$('q1').addEventListener('input', (event) => { coulomb.q1 = Number(event.target.value); drawCoulomb(); });
$('q2').addEventListener('input', (event) => { coulomb.q2 = Number(event.target.value); drawCoulomb(); });
$('coulomb-reset').addEventListener('click', () => { coulomb.first = { x: -0.08, y: 0 }; coulomb.second = { x: 0.08, y: 0 }; drawCoulomb(); });

const fieldCanvas = $('field-canvas');
const defaultCharges = () => [{ x: -0.08, y: 0, q: 5e-9 }, { x: 0.08, y: 0, q: -5e-9 }];
const field = { charges: defaultCharges(), selected: 0, probe: { x: 0, y: 0.09 } };

function contours(view) {
  const { ctx, width, height } = view;
  const step = 22;
  const nx = Math.ceil(width / step);
  const ny = Math.ceil(height / step);
  const values = [];
  for (let row = 0; row <= ny; row++) {
    const cells = [];
    for (let col = 0; col <= nx; col++) cells.push(electricPotentialAt(field.charges, toWorld({ x: col * step, y: row * step }, view)));
    values.push(cells);
  }
  for (const level of [-1600, -1000, -600, -350, -150, 0, 150, 350, 600, 1000, 1600]) {
    ctx.strokeStyle = level === 0 ? '#f1d591' : level > 0 ? '#b79774' : '#6895b8';
    ctx.globalAlpha = level === 0 ? 0.82 : 0.52;
    ctx.lineWidth = level === 0 ? 1.7 : 1;
    ctx.beginPath();
    for (let row = 0; row < ny; row++) for (let col = 0; col < nx; col++) {
      const v = [values[row][col], values[row][col + 1], values[row + 1][col + 1], values[row + 1][col]];
      if (v.some((item) => item === null)) continue;
      const p = [{ x: col * step, y: row * step }, { x: (col + 1) * step, y: row * step }, { x: (col + 1) * step, y: (row + 1) * step }, { x: col * step, y: (row + 1) * step }];
      const crossings = [];
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        if ((v[edge] < level) !== (v[next] < level)) {
          const t = (level - v[edge]) / (v[next] - v[edge]);
          crossings.push({ x: p[edge].x + t * (p[next].x - p[edge].x), y: p[edge].y + t * (p[next].y - p[edge].y) });
        }
      }
      for (let i = 0; i + 1 < crossings.length; i += 2) { ctx.moveTo(crossings[i].x, crossings[i].y); ctx.lineTo(crossings[i + 1].x, crossings[i + 1].y); }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function fieldVectors(view) {
  const { ctx, width, height } = view;
  for (let y = 33; y < height - 15; y += 53) for (let x = 31; x < width - 15; x += 53) {
    const value = electricFieldAt(field.charges, toWorld({ x, y }, view));
    if (!value || value.magnitude < 1) continue;
    const length = Math.min(18, 10 + 2 * Math.log10(value.magnitude + 1));
    const dx = value.x / value.magnitude * length;
    const dy = -value.y / value.magnitude * length;
    arrow(ctx, { x: x - dx / 2, y: y - dy / 2 }, { x: x + dx / 2, y: y + dy / 2 }, '#80d8bd', 1.35);
  }
}

function drawField() {
  const view = dimensions(fieldCanvas);
  const { ctx } = view;
  canvasBackground(view);
  if ($('show-contours').checked) contours(view);
  if ($('show-vectors').checked) fieldVectors(view);
  field.charges.forEach((charge, index) => chargeSymbol(ctx, toScreen(charge, view), charge.q, `q${index + 1}`, index === field.selected));
  const probe = toScreen(field.probe, view);
  ctx.strokeStyle = '#f6fbf9'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(probe.x, probe.y, 11, 0, Math.PI * 2); ctx.moveTo(probe.x - 17, probe.y); ctx.lineTo(probe.x + 17, probe.y); ctx.moveTo(probe.x, probe.y - 17); ctx.lineTo(probe.x, probe.y + 17); ctx.stroke();
  ctx.fillStyle = '#e3f2ef'; ctx.font = '11px sans-serif'; ctx.fillText('探针', probe.x + 18, probe.y - 15);
  const e = electricFieldAt(field.charges, field.probe);
  const potential = electricPotentialAt(field.charges, field.probe);
  $('field-magnitude').textContent = e ? `${number(e.magnitude)} N/C` : '未定义';
  $('field-potential').textContent = potential === null ? '未定义' : `${number(potential)} V`;
  const selected = field.charges[field.selected];
  $('selected-label').textContent = selected ? `选中电荷 q${field.selected + 1}` : '选中电荷';
  $('field-charge').value = selected ? String(Math.round(selected.q * 1e9)) : '0';
  $('field-charge-value').textContent = selected ? `${signed(Math.round(selected.q * 1e9))} nC` : '—';
  $('field-charge').disabled = !selected;
  $('remove-charge').disabled = !selected;
  $('field-description').textContent = !e ? '探针过于靠近电荷；请将探针移开。' : '电场方向为正试探电荷所受力的方向；沿等势线移动时电势保持不变。';
}

bindDrag(fieldCanvas, (pointer) => {
  const view = canvasView(fieldCanvas);
  const probe = toScreen(field.probe, view);
  if (Math.hypot(pointer.x - probe.x, pointer.y - probe.y) < 23) return 'probe';
  for (let index = field.charges.length - 1; index >= 0; index--) {
    const point = toScreen(field.charges[index], view);
    if (Math.hypot(pointer.x - point.x, pointer.y - point.y) < 25) { field.selected = index; drawField(); return index; }
  }
  return null;
}, (target, pointer) => {
  const view = canvasView(fieldCanvas);
  const position = clampPoint(toWorld(pointer, view), view);
  if (target === 'probe') field.probe = position; else field.charges[target] = { ...field.charges[target], ...position };
  drawField();
});

for (const [id, sign] of [['add-positive', 1], ['add-negative', -1]]) {
  $(id).addEventListener('click', () => {
    if (field.charges.length >= 6) { $('field-description').textContent = '为保持图形清晰，最多可放置 6 个电荷。'; return; }
    const index = field.charges.length;
    field.charges.push({ x: -0.15 + (index % 4) * 0.1, y: index % 2 ? -0.08 : 0.08, q: sign * 5e-9 });
    field.selected = field.charges.length - 1;
    drawField();
  });
}
$('field-charge').addEventListener('input', (event) => { field.charges[field.selected].q = Number(event.target.value) * 1e-9; drawField(); });
$('remove-charge').addEventListener('click', () => { field.charges.splice(field.selected, 1); field.selected = Math.min(field.selected, field.charges.length - 1); drawField(); });
$('field-reset').addEventListener('click', () => { field.charges = defaultCharges(); field.selected = 0; field.probe = { x: 0, y: 0.09 }; drawField(); });
$('show-vectors').addEventListener('change', drawField);
$('show-contours').addEventListener('change', drawField);

const capacitorCanvas = $('capacitor-canvas');
function drawCapacitor() {
  const view = dimensions(capacitorCanvas);
  const { ctx, width, height } = view;
  canvasBackground(view);
  const voltage = Number($('voltage').value);
  const distanceCm = Number($('distance').value);
  const areaCm2 = Number($('area').value);
  const relativePermittivity = Number($('permittivity').value);
  const result = parallelPlateCapacitor({ voltage, distance: distanceCm / 100, area: areaCm2 / 1e4, relativePermittivity });
  $('voltage-value').textContent = `${voltage} V`;
  $('distance-value').textContent = `${distanceCm.toFixed(1)} cm`;
  $('area-value').textContent = `${areaCm2} cm²`;
  $('permittivity-value').textContent = relativePermittivity.toFixed(1);
  $('capacitance').textContent = quantity(result.capacitance, 'F');
  $('capacitor-charge').textContent = quantity(result.charge, 'C');
  $('capacitor-field').textContent = `${number(result.field)} V/m`;
  $('capacitor-energy').textContent = quantity(result.energy, 'J');
  const separation = Math.min(width * 0.38, width * (0.13 + 0.023 * distanceCm));
  const plateHeight = Math.min(height * 0.74, height * (0.31 + areaCm2 / 2300));
  const x1 = width / 2 - separation / 2;
  const x2 = width / 2 + separation / 2;
  const top = (height - plateHeight) / 2;
  if (relativePermittivity > 1) {
    ctx.fillStyle = `rgba(123, 221, 190, ${Math.min(0.25, 0.025 * relativePermittivity)})`;
    ctx.fillRect(x1 + 7, top, x2 - x1 - 14, plateHeight);
    ctx.fillStyle = '#aad9c6'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`电介质 εᵣ = ${relativePermittivity.toFixed(1)}`, width / 2, top + plateHeight + 28);
  }
  if (voltage > 0) {
    const count = Math.max(3, Math.min(9, Math.round(3 + voltage / 80)));
    for (let i = 1; i <= count; i++) {
      const y = top + plateHeight * i / (count + 1);
      arrow(ctx, { x: x1 + 15, y }, { x: x2 - 15, y }, '#81dbbf', 1.7);
    }
  }
  ctx.shadowBlur = 16; ctx.shadowColor = '#ff8c7f'; ctx.fillStyle = '#ff8c7f'; ctx.fillRect(x1 - 8, top, 16, plateHeight);
  ctx.shadowColor = '#6db8ef'; ctx.fillStyle = '#6db8ef'; ctx.fillRect(x2 - 8, top, 16, plateHeight); ctx.shadowBlur = 0;
  ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#ffafa7'; ctx.fillText(voltage > 0 ? '+' : '0', x1 - 24, height / 2 + 7);
  ctx.fillStyle = '#a6d8fa'; ctx.fillText(voltage > 0 ? '−' : '0', x2 + 24, height / 2 + 7);
  ctx.fillStyle = '#d5e9e8'; ctx.font = '13px sans-serif';
  ctx.fillText(`d = ${distanceCm.toFixed(1)} cm`, width / 2, Math.max(23, top - 15));
  ctx.fillText(voltage === 0 ? 'U = 0，板间无电场' : `E = ${number(result.field)} V/m`, width / 2, Math.min(height - 20, top + plateHeight + (relativePermittivity > 1 ? 52 : 28)));
  ctx.textAlign = 'left';
}
for (const id of ['voltage', 'distance', 'area', 'permittivity']) $(id).addEventListener('input', drawCapacitor);

const gaussCanvas = $('gauss-canvas');
function drawGauss() {
  const view = dimensions(gaussCanvas);
  const { ctx, width, height } = view;
  ctx.fillStyle = '#0c1a29'; ctx.fillRect(0, 0, width, height);
  const qNc = Number($('gauss-charge').value);
  const sphereCm = Number($('sphere-radius').value);
  const gaussianCm = Number($('gaussian-radius').value);
  const result = uniformChargedSphere({ totalCharge: qNc * 1e-9, sphereRadius: sphereCm / 100, gaussianRadius: gaussianCm / 100 });
  $('gauss-charge-value').textContent = `${signed(qNc)} nC`;
  $('sphere-radius-value').textContent = `${sphereCm.toFixed(1)} cm`;
  $('gaussian-radius-value').textContent = `${gaussianCm.toFixed(1)} cm`;
  $('gauss-enclosed').textContent = quantity(result.enclosedCharge, 'C');
  $('gauss-field').textContent = `${number(Math.abs(result.field))} N/C`;
  $('gauss-flux').textContent = `${number(result.flux)} N·m²/C`;
  $('gauss-description').textContent = qNc === 0 ? '总电荷为零，电场与电通量都为零。' : gaussianCm < sphereCm ? '高斯面位于球体内部；包围电荷随 r³ 增加。' : '高斯面已包围全部电荷；继续增大半径时，通量保持不变，表面电场减弱。';
  const center = { x: width / 2, y: height / 2 };
  const scale = Math.min(width, height) * 0.39 / 15;
  const spherePx = sphereCm * scale;
  const gaussianPx = gaussianCm * scale;
  const sphereColor = qNc >= 0 ? '#ff8c7f' : '#6db8ef';
  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, spherePx);
  gradient.addColorStop(0, qNc >= 0 ? '#ff8c7f55' : '#6db8ef55');
  gradient.addColorStop(1, qNc >= 0 ? '#ff8c7f13' : '#6db8ef13');
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(center.x, center.y, spherePx, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = sphereColor; ctx.globalAlpha = 0.82; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(center.x, center.y, spherePx, 0, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
  for (let index = 0; index < 38; index++) {
    const angle = index * 2.39996;
    const radius = spherePx * Math.sqrt((index + 0.5) / 38) * 0.88;
    ctx.fillStyle = sphereColor; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.arc(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle), 2.4, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([8, 6]); ctx.strokeStyle = '#f5ce74'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(center.x, center.y, gaussianPx, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
  if (qNc !== 0) for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI / 6;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const outward = qNc > 0;
    const fromRadius = outward ? gaussianPx + 3 : gaussianPx + 21;
    const toRadius = outward ? gaussianPx + 21 : gaussianPx + 3;
    arrow(ctx, { x: center.x + ux * fromRadius, y: center.y + uy * fromRadius }, { x: center.x + ux * toRadius, y: center.y + uy * toRadius }, '#8ee4c9', 1.6);
  }
  ctx.fillStyle = '#cbdde5'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`R = ${sphereCm.toFixed(1)} cm`, center.x, Math.max(20, center.y - spherePx - 10));
  ctx.fillStyle = '#f5ce74'; ctx.fillText(`r = ${gaussianCm.toFixed(1)} cm`, center.x, Math.min(height - 15, center.y + gaussianPx + 36));
  ctx.textAlign = 'left';
}
for (const id of ['gauss-charge', 'sphere-radius', 'gaussian-radius']) $(id).addEventListener('input', drawGauss);

const cylinderCanvas = $('cylinder-canvas');
const cylinderSideCanvas = $('cylinder-side-canvas');
function drawCylinder() {
  const view = dimensions(cylinderCanvas);
  const { ctx, width, height } = view;
  ctx.fillStyle = '#0c1a29'; ctx.fillRect(0, 0, width, height);
  const sigma = Number($('cylinder-sigma').value);
  const radiusCm = Number($('cylinder-radius').value);
  const gaussianCm = Number($('cylinder-gaussian-radius').value);
  const lengthCm = Number($('cylinder-length').value);
  const result = chargedCylindricalShell({
    surfaceChargeDensity: sigma * 1e-9,
    shellRadius: radiusCm / 100,
    gaussianRadius: gaussianCm / 100,
    length: lengthCm / 100,
  });
  $('cylinder-sigma-value').textContent = `${signed(sigma)} nC/m²`;
  $('cylinder-radius-value').textContent = `${radiusCm.toFixed(1)} cm`;
  $('cylinder-gaussian-radius-value').textContent = `${gaussianCm.toFixed(1)} cm`;
  $('cylinder-length-value').textContent = `${lengthCm} cm`;
  $('cylinder-enclosed').textContent = quantity(result.enclosedCharge, 'C');
  $('cylinder-field').textContent = result.field === null ? '未定义' : `${number(Math.abs(result.field))} N/C`;
  $('cylinder-flux').textContent = result.flux === null ? '未定义' : `${number(result.flux)} N·m²/C`;
  $('cylinder-description').textContent = sigma === 0
    ? '圆柱面不带电，电场与电通量均为零。'
    : result.region === 'surface'
      ? '高斯面恰好与理想带电面重合；面两侧电场发生跳变，此处不定义单一电场值。'
      : result.region === 'inside'
        ? '高斯柱位于圆柱壳内部，未包围电荷；由对称性可得内部电场为零。'
        : '高斯柱包围长度 L 内的全部圆柱面电荷；增大 r 会减弱该处电场，但通量不变；增大 L 会同比增大包围电荷和通量，不改变电场。';

  const center = { x: width / 2, y: height / 2 };
  const scale = Math.min(width, height) * 0.39 / 12;
  const shellPx = radiusCm * scale;
  const gaussianPx = gaussianCm * scale;
  const shellColor = sigma > 0 ? '#ff8c7f' : sigma < 0 ? '#6db8ef' : '#a6b5c3';
  ctx.fillStyle = sigma > 0 ? '#ff8c7f12' : sigma < 0 ? '#6db8ef12' : '#a6b5c30a';
  ctx.beginPath(); ctx.arc(center.x, center.y, shellPx, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = shellColor; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(center.x, center.y, shellPx, 0, 2 * Math.PI); ctx.stroke();
  ctx.fillStyle = shellColor; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI / 6;
    ctx.fillText(sigma > 0 ? '+' : sigma < 0 ? '−' : '0', center.x + shellPx * Math.cos(angle), center.y + shellPx * Math.sin(angle));
  }
  ctx.textBaseline = 'alphabetic';
  ctx.setLineDash([8, 6]); ctx.strokeStyle = '#f5ce74'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(center.x, center.y, gaussianPx, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
  if (sigma !== 0) for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4 + Math.PI / 8;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const inner = shellPx + 11, outer = shellPx + 29;
    const from = sigma > 0 ? inner : outer;
    const to = sigma > 0 ? outer : inner;
    arrow(ctx, { x: center.x + ux * from, y: center.y + uy * from }, { x: center.x + ux * to, y: center.y + uy * to }, '#8ee4c9', 1.7);
  }
  ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = '#b8d1da'; ctx.fillText(`L = ${lengthCm} cm（轴向）`, 16, 22);
  ctx.fillStyle = shellColor; ctx.fillText(`R = ${radiusCm.toFixed(1)} cm`, 16, 41);
  ctx.fillStyle = '#f5ce74'; ctx.fillText(`r = ${gaussianCm.toFixed(1)} cm`, 16, 60);
  drawCylinderSide({ sigma, radiusCm, gaussianCm, lengthCm });
}

function drawCylinderSide({ sigma, radiusCm, gaussianCm, lengthCm }) {
  const { ctx, width, height } = dimensions(cylinderSideCanvas);
  const middle = height / 2;
  const radiusScale = Math.min(height * 0.34, width * 0.24) / 12;
  const shellHalfHeight = radiusCm * radiusScale;
  const gaussianHalfHeight = gaussianCm * radiusScale;
  const gaussianLength = width * (0.3 + (lengthCm - 5) / 25 * 0.5);
  const left = (width - gaussianLength) / 2;
  const right = width - left;
  const shellColor = sigma > 0 ? '#ff8c7f' : sigma < 0 ? '#6db8ef' : '#a6b5c3';

  ctx.fillStyle = '#0c1a29'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#456072'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(0, middle); ctx.lineTo(width, middle); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = sigma > 0 ? '#ff8c7f15' : sigma < 0 ? '#6db8ef15' : '#a6b5c30b';
  ctx.fillRect(0, middle - shellHalfHeight, width, shellHalfHeight * 2);
  ctx.shadowColor = shellColor; ctx.shadowBlur = 9; ctx.strokeStyle = shellColor; ctx.lineWidth = 3;
  for (const y of [middle - shellHalfHeight, middle + shellHalfHeight]) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = shellColor; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let x = 28; x < width - 10; x += 48) {
    const mark = sigma > 0 ? '+' : sigma < 0 ? '−' : '0';
    ctx.fillText(mark, x, middle - shellHalfHeight - 12);
    ctx.fillText(mark, x, middle + shellHalfHeight + 12);
  }
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#f5ce7410';
  ctx.fillRect(left, middle - gaussianHalfHeight, gaussianLength, gaussianHalfHeight * 2);
  ctx.strokeStyle = '#f5ce74'; ctx.lineWidth = 2.3; ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(left, middle - gaussianHalfHeight); ctx.lineTo(right, middle - gaussianHalfHeight);
  ctx.moveTo(left, middle + gaussianHalfHeight); ctx.lineTo(right, middle + gaussianHalfHeight);
  ctx.stroke();
  const capWidth = Math.min(12, gaussianLength * 0.07);
  for (const x of [left, right]) {
    ctx.beginPath(); ctx.ellipse(x, middle, capWidth, gaussianHalfHeight, 0, 0, 2 * Math.PI); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (sigma !== 0) for (const x of [width * 0.28, width * 0.5, width * 0.72]) {
    const inner = shellHalfHeight + 13;
    const outer = shellHalfHeight + 31;
    arrow(ctx,
      { x, y: middle - (sigma > 0 ? inner : outer) },
      { x, y: middle - (sigma > 0 ? outer : inner) }, '#8ee4c9', 1.7);
    arrow(ctx,
      { x, y: middle + (sigma > 0 ? inner : outer) },
      { x, y: middle + (sigma > 0 ? outer : inner) }, '#8ee4c9', 1.7);
  }

  const dimensionY = Math.min(middle + Math.max(shellHalfHeight, gaussianHalfHeight) + 25, height - 28);
  ctx.strokeStyle = '#b7ced7'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, dimensionY - 5); ctx.lineTo(left, dimensionY + 5);
  ctx.moveTo(right, dimensionY - 5); ctx.lineTo(right, dimensionY + 5);
  ctx.moveTo(left, dimensionY); ctx.lineTo(right, dimensionY);
  ctx.stroke();
  ctx.fillStyle = '#d8e8eb'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`高斯柱长度 L = ${lengthCm} cm`, width / 2, dimensionY + 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = shellColor; ctx.fillText(`实线 R = ${radiusCm.toFixed(1)} cm`, 12, 20);
  ctx.fillStyle = '#f5ce74'; ctx.fillText(`虚线 r = ${gaussianCm.toFixed(1)} cm`, 12, 39);
  ctx.fillStyle = '#91a9b8'; ctx.textAlign = 'right'; ctx.fillText('端盖 Φ = 0', width - 12, 20);
  ctx.textAlign = 'left';
}
for (const id of ['cylinder-sigma', 'cylinder-radius', 'cylinder-gaussian-radius', 'cylinder-length']) $(id).addEventListener('input', drawCylinder);

const planeCanvas = $('plane-canvas');
function drawPlane() {
  const view = dimensions(planeCanvas);
  const { ctx, width, height } = view;
  ctx.fillStyle = '#0c1a29'; ctx.fillRect(0, 0, width, height);
  const sigma = Number($('plane-sigma').value);
  const areaCm2 = Number($('plane-area').value);
  const halfHeightCm = Number($('plane-half-height').value);
  const result = infiniteChargedPlane({ surfaceChargeDensity: sigma * 1e-9, pillboxArea: areaCm2 / 1e4, halfHeight: halfHeightCm / 100 });
  $('plane-sigma-value').textContent = `${signed(sigma)} nC/m²`;
  $('plane-area-value').textContent = `${areaCm2} cm²`;
  $('plane-half-height-value').textContent = `${halfHeightCm.toFixed(1)} cm`;
  $('plane-field').textContent = `${number(result.fieldMagnitude)} N/C`;
  $('plane-enclosed').textContent = quantity(result.enclosedCharge, 'C');
  $('plane-direction').textContent = sigma > 0 ? '上：向上 / 下：向下' : sigma < 0 ? '上：向下 / 下：向上' : '两侧均无电场';
  $('plane-flux').textContent = `${number(result.flux)} N·m²/C`;
  $('plane-description').textContent = sigma === 0
    ? '平面不带电，两侧电场与总电通量均为零。'
    : '改变柱盒半高 h 不影响电场或通量；增大端盖面积 A 只会同比增大包围电荷和总通量。';

  const middle = height / 2;
  const boxHalfWidth = width * (0.18 + 0.00024 * areaCm2);
  const boxHalfHeight = 18 + (halfHeightCm - 1) / 9 * Math.min(height * 0.27, 90);
  const left = width / 2 - boxHalfWidth, right = width / 2 + boxHalfWidth;
  ctx.fillStyle = '#f5ce7413'; ctx.fillRect(left, middle - boxHalfHeight, right - left, 2 * boxHalfHeight);
  ctx.strokeStyle = '#f5ce74'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]);
  ctx.strokeRect(left, middle - boxHalfHeight, right - left, 2 * boxHalfHeight); ctx.setLineDash([]);
  if (sigma !== 0) for (const x of [left + boxHalfWidth * 0.5, left + boxHalfWidth, left + boxHalfWidth * 1.5]) {
    const upperFrom = sigma > 0 ? middle - 7 : middle - boxHalfHeight + 5;
    const upperTo = sigma > 0 ? middle - boxHalfHeight + 5 : middle - 7;
    const lowerFrom = sigma > 0 ? middle + 7 : middle + boxHalfHeight - 5;
    const lowerTo = sigma > 0 ? middle + boxHalfHeight - 5 : middle + 7;
    arrow(ctx, { x, y: upperFrom }, { x, y: upperTo }, '#8ee4c9', 1.8);
    arrow(ctx, { x, y: lowerFrom }, { x, y: lowerTo }, '#8ee4c9', 1.8);
  }
  const planeColor = sigma > 0 ? '#ff8c7f' : sigma < 0 ? '#6db8ef' : '#a6b5c3';
  ctx.shadowColor = planeColor; ctx.shadowBlur = 12; ctx.strokeStyle = planeColor; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(width * 0.06, middle); ctx.lineTo(width * 0.94, middle); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = planeColor; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let x = width * 0.1; x <= width * 0.91; x += Math.max(32, width * 0.09)) ctx.fillText(sigma > 0 ? '+' : sigma < 0 ? '−' : '0', x, middle - 17);
  ctx.textBaseline = 'alphabetic'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f5ce74'; ctx.fillText(`A = ${areaCm2} cm²`, Math.max(10, left), Math.max(18, middle - boxHalfHeight - 9));
  ctx.fillText(`h = ${halfHeightCm.toFixed(1)} cm`, Math.min(width - 100, right + 8), middle - boxHalfHeight / 2);
}
for (const id of ['plane-sigma', 'plane-area', 'plane-half-height']) $(id).addEventListener('input', drawPlane);

const gaussDrawers = { 'gauss-sphere': drawGauss, 'gauss-cylinder': drawCylinder, 'gauss-plane': drawPlane };
function drawActiveGauss() {
  const active = document.querySelector('.gauss-geometry.is-active');
  if (active) gaussDrawers[active.id]();
}
document.querySelectorAll('.geometry-tab').forEach((tab) => tab.addEventListener('click', () => {
  const target = tab.dataset.gaussTarget;
  document.querySelectorAll('.geometry-tab').forEach((item) => {
    item.classList.toggle('is-active', item === tab);
    item.setAttribute('aria-pressed', String(item === tab));
  });
  document.querySelectorAll('.gauss-geometry').forEach((geometry) => {
    geometry.hidden = geometry.id !== target;
    geometry.classList.toggle('is-active', geometry.id === target);
  });
  drawActiveGauss();
}));

const particleCanvas = $('particle-canvas');
let particleAnimationFrame = null;
function drawParticle(progress = 1) {
  const view = dimensions(particleCanvas);
  const { ctx, width, height } = view;
  ctx.fillStyle = '#0c1a29'; ctx.fillRect(0, 0, width, height);
  const particle = $('particle-type').value;
  const voltage = Number($('particle-voltage').value);
  const gapCm = Number($('particle-gap').value);
  const speedMillions = Number($('particle-speed').value);
  const model = particleInUniformField({ particle, voltage, gap: gapCm / 100, speed: speedMillions * 1e6 });
  $('particle-voltage-value').textContent = `${voltage} V`;
  $('particle-gap-value').textContent = `${gapCm.toFixed(1)} cm`;
  $('particle-speed-value').textContent = `${speedMillions} × 10⁶ m/s`;
  $('particle-field').textContent = `${number(Math.abs(model.field))} V/m`;
  $('particle-time').textContent = quantity(model.duration, 's');
  $('particle-deflection').textContent = `${number(Math.abs(model.finalY) * 1000)} mm`;
  $('particle-outcome').textContent = model.hitPlate ? `粒子在离入口 ${number(model.finalX * 100, 1)} cm 处撞上${model.finalY > 0 ? '上' : '下'}极板。` : `粒子从右端射出，向${model.finalY > 0 ? '上' : model.finalY < 0 ? '下' : '前'}偏移 ${number(Math.abs(model.finalY) * 1000)} mm。`;
  const left = 44, right = width - 24, middle = height / 2;
  const gapPx = Math.min(height * 0.65, 70 + (gapCm - 2) * height * 0.038);
  const upper = middle - gapPx / 2, lower = middle + gapPx / 2;
  ctx.fillStyle = '#ff8c7f'; ctx.shadowColor = '#ff8c7f'; ctx.shadowBlur = 12; ctx.fillRect(left, upper - 7, right - left, 10);
  ctx.fillStyle = '#6db8ef'; ctx.shadowColor = '#6db8ef'; ctx.fillRect(left, lower - 3, right - left, 10); ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffc1b8'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('+', right - 15, upper - 14);
  ctx.fillStyle = '#afd9f6'; ctx.fillText('−', right - 15, lower + 29);
  if (voltage > 0) for (let x = left + 28; x < right - 5; x += Math.max(45, (right - left) / 7)) arrow(ctx, { x, y: upper + 15 }, { x, y: lower - 15 }, '#77d8bc', 1.4);
  const at = (time) => {
    const position = model.positionAt(time);
    return { x: left + position.x / 0.12 * (right - left), y: middle - position.y / (gapCm / 100) * gapPx };
  };
  ctx.strokeStyle = particle === 'electron' ? '#f5d17f' : '#a9d8fb'; ctx.lineWidth = 2.8;
  ctx.beginPath();
  for (let index = 0; index <= 80; index++) {
    const point = at(model.duration * index / 80);
    if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  const dot = at(model.duration * progress);
  ctx.fillStyle = particle === 'electron' ? '#f5d17f' : '#a9d8fb'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.arc(dot.x, dot.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#aec6d1'; ctx.font = '11px sans-serif'; ctx.fillText('入口', left, Math.min(height - 13, middle + gapPx / 2 + 29));
}
function stopParticleAnimation() {
  if (particleAnimationFrame !== null) cancelAnimationFrame(particleAnimationFrame);
  particleAnimationFrame = null;
}
for (const id of ['particle-type', 'particle-voltage', 'particle-gap', 'particle-speed']) $(id).addEventListener(id === 'particle-type' ? 'change' : 'input', () => { stopParticleAnimation(); drawParticle(); });
$('particle-play').addEventListener('click', () => {
  stopParticleAnimation();
  const started = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / 1800);
    drawParticle(progress);
    if (progress < 1) particleAnimationFrame = requestAnimationFrame(tick); else particleAnimationFrame = null;
  };
  particleAnimationFrame = requestAnimationFrame(tick);
});

const rcCanvas = $('rc-canvas');
function drawRc() {
  const view = dimensions(rcCanvas);
  const { ctx, width, height } = view;
  ctx.fillStyle = '#0c1a29'; ctx.fillRect(0, 0, width, height);
  const mode = $('rc-mode').value;
  const voltage = Number($('rc-voltage').value);
  const resistanceK = Number($('rc-resistance').value);
  const capacitanceMicro = Number($('rc-capacitance').value);
  const time = Number($('rc-time').value);
  const args = { voltage, resistance: resistanceK * 1e3, capacitance: capacitanceMicro * 1e-6, time, mode };
  const result = rcCircuit(args);
  $('rc-voltage-value').textContent = `${voltage} V`;
  $('rc-resistance-value').textContent = `${resistanceK} kΩ`;
  $('rc-capacitance-value').textContent = `${capacitanceMicro} µF`;
  $('rc-time-value').textContent = `${time.toFixed(1)} s`;
  $('rc-tau').textContent = `${number(result.tau, 3)} s`;
  $('rc-capacitor-voltage').textContent = `${number(result.capacitorVoltage)} V`;
  $('rc-charge').textContent = quantity(result.charge, 'C');
  $('rc-current').textContent = quantity(result.current, 'A');
  const left = 48, right = width - 22, top = 29, bottom = height - 43;
  ctx.strokeStyle = '#2b4758'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = bottom - i / 4 * (bottom - top);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
  }
  for (let i = 0; i <= 5; i++) {
    const x = left + i / 5 * (right - left);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  ctx.fillStyle = '#95acb9'; ctx.font = '11px sans-serif';
  ctx.fillText('1.0', 9, top + 4); ctx.fillText('0.5', 9, (top + bottom) / 2 + 4); ctx.fillText('0', 29, bottom + 4);
  ctx.fillText('0 s', left - 9, bottom + 23); ctx.fillText('5 s', (left + right) / 2 - 10, bottom + 23); ctx.fillText('10 s', right - 23, bottom + 23);
  const graphPoint = (t, normalized) => ({ x: left + t / 10 * (right - left), y: bottom - normalized * (bottom - top) });
  for (const [key, color, dashed] of [['normalizedVoltage', '#ff9a89', false], ['normalizedCurrent', '#89dfc3', true]]) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.6; ctx.setLineDash(dashed ? [6, 5] : []); ctx.beginPath();
    for (let index = 0; index <= 160; index++) {
      const t = index / 16;
      const state = rcCircuit({ ...args, time: t });
      const point = graphPoint(t, state[key]);
      if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  const markerX = left + time / 10 * (right - left);
  ctx.strokeStyle = '#f3d487'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(markerX, top); ctx.lineTo(markerX, bottom); ctx.stroke(); ctx.setLineDash([]);
  for (const [key, color] of [['normalizedVoltage', '#ff9a89'], ['normalizedCurrent', '#89dfc3']]) {
    const point = graphPoint(time, result[key]);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill();
  }
}
for (const id of ['rc-voltage', 'rc-resistance', 'rc-capacitance', 'rc-time']) $(id).addEventListener('input', drawRc);
$('rc-mode').addEventListener('change', drawRc);

const redraw = { coulomb: drawCoulomb, field: drawField, capacitor: drawCapacitor, gauss: drawActiveGauss, particle: drawParticle, rc: drawRc };
const modelNav = document.querySelector('.model-nav');
const modelTabs = [...modelNav.querySelectorAll('.nav-tab')];
const modelPanels = [...document.querySelectorAll('.model-panel')];

function selectModel(tab) {
  const target = tab.dataset.target;
  if (tab.classList.contains('is-active')) return;
  stopParticleAnimation();
  modelTabs.forEach((item) => { item.classList.toggle('is-active', item === tab); item.removeAttribute('aria-current'); });
  tab.setAttribute('aria-current', 'page');
  modelPanels.forEach((panel) => { panel.hidden = panel.id !== target; panel.classList.toggle('is-active', panel.id === target); });
  const navRect = modelNav.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  modelNav.scrollTo({ left: modelNav.scrollLeft + tabRect.left - navRect.left - (modelNav.clientWidth - tabRect.width) / 2, behavior: 'smooth' });
  redraw[target]();
}

modelTabs.forEach((tab) => tab.addEventListener('click', () => selectModel(tab)));

let navDrag = null;
let suppressNavClick = false;
modelNav.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  navDrag = { x: event.clientX, scrollLeft: modelNav.scrollLeft };
  suppressNavClick = false;
});
modelNav.addEventListener('pointermove', (event) => {
  if (!navDrag) return;
  const distance = event.clientX - navDrag.x;
  if (Math.abs(distance) > 5) {
    suppressNavClick = true;
    modelNav.classList.add('is-dragging');
  }
  if (suppressNavClick) modelNav.scrollLeft = navDrag.scrollLeft - distance;
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  modelNav.addEventListener(type, () => { navDrag = null; modelNav.classList.remove('is-dragging'); });
}
modelNav.addEventListener('click', (event) => {
  if (!suppressNavClick) return;
  event.preventDefault();
  event.stopPropagation();
  suppressNavClick = false;
}, true);

let panelTouch = null;
modelPanels.forEach((panel) => {
  panel.addEventListener('touchstart', (event) => {
    panelTouch = null;
    if (event.touches.length !== 1 || event.target.closest('button, input, select, textarea, a, canvas, .geometry-nav')) return;
    panelTouch = { panel, x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  panel.addEventListener('touchend', (event) => {
    if (!panelTouch || panelTouch.panel !== panel || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - panelTouch.x;
    const dy = event.changedTouches[0].clientY - panelTouch.y;
    panelTouch = null;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    const index = modelTabs.findIndex((tab) => tab.classList.contains('is-active'));
    const next = modelTabs[index + (dx < 0 ? 1 : -1)];
    if (next) selectModel(next);
  }, { passive: true });
  panel.addEventListener('touchcancel', () => { panelTouch = null; }, { passive: true });
});
const resizeObserver = new ResizeObserver(() => { const active = document.querySelector('.model-panel.is-active'); if (active) redraw[active.id](); });
document.querySelectorAll('.canvas-card').forEach((card) => resizeObserver.observe(card));
drawCoulomb();
