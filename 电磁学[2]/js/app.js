import {
  chargedParticleState,
  magneticFieldInsideSolenoid,
  magneticFieldOfWire,
  magneticFieldOnLoopAxis,
} from './physics.js';
import { initAdvancedModels } from './advanced.js';

const $ = (id) => document.getElementById(id);
const number = (value, digits = 2) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value);
const signed = (value, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), digits)}`;
const superscript = (value) => String(value).replaceAll('-', '⁻').replaceAll('0', '⁰').replaceAll('1', '¹').replaceAll('2', '²').replaceAll('3', '³').replaceAll('4', '⁴').replaceAll('5', '⁵').replaceAll('6', '⁶').replaceAll('7', '⁷').replaceAll('8', '⁸').replaceAll('9', '⁹');

function quantity(value, unit) {
  if (value === null || !Number.isFinite(value)) return '无定义';
  if (value === 0) return `0 ${unit}`;
  const exponent = Math.max(-15, Math.min(0, Math.floor(Math.log10(Math.abs(value)) / 3) * 3));
  const scale = 10 ** exponent;
  const prefix = ({ 0: '', '-3': 'm', '-6': 'µ', '-9': 'n', '-12': 'p', '-15': 'f' })[exponent];
  return `${number(value / scale, 2)} ${prefix}${unit}`;
}

function scientific(value, digits = 1) {
  if (value === 0) return '0';
  const [mantissa, exponent] = value.toExponential(digits).split('e');
  return `${mantissa} × 10${superscript(Number(exponent))}`;
}

function canvasMetrics(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawBackground(ctx, width, height) {
  ctx.fillStyle = '#0c1a29';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#203648';
  ctx.lineWidth = 1;
  const spacing = 32;
  for (let x = width / 2 % spacing; x < width; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = height / 2 % spacing; y < height; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
}

function arrow(ctx, from, to, color, width = 2, head = 8) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - 0.52), to.y - head * Math.sin(angle - 0.52));
  ctx.lineTo(to.x - head * Math.cos(angle + 0.52), to.y - head * Math.sin(angle + 0.52));
  ctx.closePath(); ctx.fill();
}

function label(ctx, text, x, y, color = '#c2d6df', align = 'left') {
  ctx.fillStyle = color; ctx.font = '12px sans-serif'; ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function currentMarker(ctx, x, y, symbol, color = '#f0c17d') {
  ctx.fillStyle = '#142938'; ctx.strokeStyle = color; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x, y - 1);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

const magneticCanvas = $('magnetic-canvas');
const magnetic = {
  geometry: 'wire', current: 5, radius: 0.1, turnsPerMeter: 800,
  wireProbe: { x: 0.1, y: 0.07 }, loopProbe: 0.14, solenoidProbe: { x: 0.5, y: 0.5 },
};

function probeScreen(view) {
  const { width, height } = view;
  if (magnetic.geometry === 'wire') {
    const scale = Math.min(width / 0.52, height / 0.42);
    return { x: width / 2 + magnetic.wireProbe.x * scale, y: height / 2 - magnetic.wireProbe.y * scale };
  }
  if (magnetic.geometry === 'loop') {
    const scale = Math.min(width / 1.65, height / 0.8);
    return { x: width / 2 + magnetic.loopProbe * scale, y: height / 2 };
  }
  return { x: width * magnetic.solenoidProbe.x, y: height * magnetic.solenoidProbe.y };
}

function drawProbe(ctx, point, fieldDirection = null) {
  ctx.save();
  ctx.shadowColor = '#f3f8f6'; ctx.shadowBlur = 10;
  ctx.strokeStyle = '#f6fbf9'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
  ctx.moveTo(point.x - 15, point.y); ctx.lineTo(point.x + 15, point.y);
  ctx.moveTo(point.x, point.y - 15); ctx.lineTo(point.x, point.y + 15); ctx.stroke();
  ctx.restore();
  if (fieldDirection && Math.hypot(fieldDirection.x, fieldDirection.y) > 0) {
    const magnitude = Math.hypot(fieldDirection.x, fieldDirection.y);
    arrow(ctx, point, { x: point.x + fieldDirection.x / magnitude * 34, y: point.y + fieldDirection.y / magnitude * 34 }, '#ffcf72', 2.5, 7);
  }
}

function drawWire(view) {
  const { ctx, width, height } = view;
  const cx = width / 2; const cy = height / 2;
  const maxRadius = Math.min(width, height) * 0.45;
  ctx.save(); ctx.strokeStyle = '#7ce0c3'; ctx.globalAlpha = magnetic.current === 0 ? 0.2 : 0.5; ctx.lineWidth = 1.7;
  for (let index = 1; index <= 6; index++) {
    const radius = maxRadius * index / 6;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    if (magnetic.current !== 0) {
      const angle = 0.55 + (index % 2) * 1.55;
      const endAngle = angle + Math.sign(magnetic.current) * 0.2;
      arrow(ctx,
        { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) },
        { x: cx + radius * Math.cos(endAngle), y: cy - radius * Math.sin(endAngle) },
        '#94f0d0', 1.7, 7);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#233d4c'; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7fe1c5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#dffaf0'; ctx.font = 'bold 25px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(magnetic.current > 0 ? '⊙' : magnetic.current < 0 ? '⊗' : '0', cx, cy - 1);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  label(ctx, magnetic.current > 0 ? 'I：垂直纸面向外' : magnetic.current < 0 ? 'I：垂直纸面向里' : 'I = 0', cx + 29, cy - 27, '#a9d7ce');
  const point = probeScreen(view);
  const dx = magnetic.wireProbe.x; const dy = magnetic.wireProbe.y; const r = Math.hypot(dx, dy);
  const sign = Math.sign(magnetic.current);
  const direction = r === 0 ? null : { x: -dy / r * sign, y: -dx / r * sign };
  drawProbe(ctx, point, direction);
  const distance = r;
  const field = magneticFieldOfWire({ current: magnetic.current, radius: distance });
  $('probe-position-label').textContent = '探针到导线距离 r';
  $('probe-position').textContent = quantity(distance, 'm');
  $('magnetic-strength').textContent = quantity(field, 'T');
  $('magnetic-direction').textContent = distance < 0.005 ? '探针接近理想细导线，模型场强趋于发散；请将探针移远。' : magnetic.current === 0 ? '电流为零，导线周围的磁场为零。' : `磁场沿以导线为中心的圆周切线方向；当前电流${magnetic.current > 0 ? '出纸面，磁场逆时针' : '入纸面，磁场顺时针'}。`;
}

function drawLoop(view) {
  const { ctx, width, height } = view;
  const cx = width / 2; const cy = height / 2;
  const scale = Math.min(width / 1.65, height / 0.8);
  const radiusPx = magnetic.radius * scale;
  const sign = Math.sign(magnetic.current);
  for (let index = 1; index <= 4 && magnetic.current !== 0; index++) {
    const span = radiusPx * (1.45 + index * 0.48) + 12;
    const rise = radiusPx * (0.9 + index * 0.28) + 9;
    ctx.save(); ctx.strokeStyle = '#7ce0c3'; ctx.globalAlpha = 0.28 + index * 0.08; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, cy, span, rise, 0, 0, Math.PI * 2); ctx.stroke();
    const angle = sign >= 0 ? -0.55 : 0.55;
    const start = { x: cx + span * Math.cos(angle), y: cy + rise * Math.sin(angle) };
    const endAngle = angle - (sign >= 0 ? 0.18 : -0.18);
    const end = { x: cx + span * Math.cos(endAngle), y: cy + rise * Math.sin(endAngle) };
    arrow(ctx, start, end, '#a2f1d6', 1.6, 7);
    ctx.restore();
  }
  ctx.strokeStyle = '#f1bb75'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(9, radiusPx * 0.22), Math.max(20, radiusPx), 0, 0, Math.PI * 2); ctx.stroke();
  const topCurrent = magnetic.current > 0 ? '⊙' : magnetic.current < 0 ? '⊗' : '0';
  const bottomCurrent = magnetic.current > 0 ? '⊗' : magnetic.current < 0 ? '⊙' : '0';
  currentMarker(ctx, cx, cy - radiusPx, topCurrent);
  currentMarker(ctx, cx, cy + radiusPx, bottomCurrent);
  label(ctx, magnetic.current === 0 ? 'I = 0' : '线圈电流方向', cx + radiusPx * 0.25 + 15, cy - radiusPx - 14, '#f1c378');
  ctx.strokeStyle = '#7895a5'; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(18, cy); ctx.lineTo(width - 18, cy); ctx.stroke(); ctx.setLineDash([]);
  const axisDirection = sign >= 0 ? 1 : -1;
  if (magnetic.current !== 0) arrow(ctx, { x: cx - 32 * axisDirection, y: cy }, { x: cx + 32 * axisDirection, y: cy }, '#86e8ca', 2.6, 8);
  label(ctx, '圆环轴线 x', width - 22, cy - 13, '#90aebe', 'right');
  const point = probeScreen(view);
  drawProbe(ctx, point, magnetic.current === 0 ? null : { x: axisDirection, y: 0 });
  const field = magneticFieldOnLoopAxis({ current: magnetic.current, radius: magnetic.radius, axialPosition: magnetic.loopProbe });
  $('probe-position-label').textContent = '探针轴向位置 x';
  $('probe-position').textContent = `${signed(magnetic.loopProbe, 2)} m`;
  $('magnetic-strength').textContent = quantity(field, 'T');
  $('magnetic-direction').textContent = magnetic.current === 0 ? '电流为零，圆环轴线上的磁场为零。' : `轴线上磁场沿圆环轴线${magnetic.current > 0 ? '正方向' : '负方向'}；拖动探针只能沿轴线移动。`;
}

function solenoidBounds(view) {
  return { left: view.width * 0.2, right: view.width * 0.8, top: view.height * 0.27, bottom: view.height * 0.73 };
}

function drawSolenoid(view) {
  const { ctx, width, height } = view;
  const box = solenoidBounds(view);
  const inside = magnetic.solenoidProbe.x >= 0.2 && magnetic.solenoidProbe.x <= 0.8 && magnetic.solenoidProbe.y >= 0.27 && magnetic.solenoidProbe.y <= 0.73;
  ctx.strokeStyle = '#e6b76f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(box.left, box.top); ctx.lineTo(box.right, box.top); ctx.moveTo(box.left, box.bottom); ctx.lineTo(box.right, box.bottom); ctx.stroke();
  const turns = Math.max(9, Math.min(22, Math.round(magnetic.turnsPerMeter / 90)));
  ctx.strokeStyle = '#f0c17d'; ctx.lineWidth = 1.35;
  for (let index = 0; index <= turns; index++) {
    const x = box.left + (box.right - box.left) * index / turns;
    ctx.beginPath(); ctx.ellipse(x, (box.top + box.bottom) / 2, 5, (box.bottom - box.top) / 2, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  }
  const topCurrent = magnetic.current > 0 ? '⊙' : magnetic.current < 0 ? '⊗' : '0';
  const bottomCurrent = magnetic.current > 0 ? '⊗' : magnetic.current < 0 ? '⊙' : '0';
  currentMarker(ctx, box.left + 10, box.top + 10, topCurrent);
  currentMarker(ctx, box.left + 10, box.bottom - 10, bottomCurrent);
  if (magnetic.current !== 0) {
    const sign = Math.sign(magnetic.current);
    ctx.save(); ctx.strokeStyle = '#81e1c3'; ctx.fillStyle = '#a7f1d7'; ctx.globalAlpha = 0.86;
    for (let index = 1; index <= 5; index++) {
      const y = box.top + (box.bottom - box.top) * index / 6;
      const from = sign > 0 ? { x: box.left + 18, y } : { x: box.right - 18, y };
      const to = sign > 0 ? { x: box.right - 18, y } : { x: box.left + 18, y };
      arrow(ctx, from, to, '#98efd2', 1.8, 7);
    }
    ctx.restore();
  }
  label(ctx, '理想长螺线管：内部近似均匀，外部近似为零', width / 2, box.top - 17, '#a9d7ce', 'center');
  const point = probeScreen(view);
  drawProbe(ctx, point, magnetic.current === 0 || !inside ? null : { x: Math.sign(magnetic.current), y: 0 });
  const field = magneticFieldInsideSolenoid({ current: magnetic.current, turnsPerMeter: magnetic.turnsPerMeter, inside });
  $('probe-position-label').textContent = '探针所在区域';
  $('probe-position').textContent = inside ? '螺线管内部' : '螺线管外部';
  $('magnetic-strength').textContent = quantity(field, 'T');
  $('magnetic-direction').textContent = magnetic.current === 0 ? '电流为零，螺线管内外磁场均为零。' : inside ? `内部磁场沿轴线${magnetic.current > 0 ? '正方向' : '负方向'}；理想模型忽略端部效应。` : '理想长螺线管模型取外部磁场为零；真实有限线圈端部附近存在漏磁场。';
}

function drawMagnetic() {
  const view = canvasMetrics(magneticCanvas);
  if (view.width <= 0 || view.height <= 0) return;
  drawBackground(view.ctx, view.width, view.height);
  $('current-value').textContent = `${signed(magnetic.current)} A`;
  $('loop-radius-value').textContent = `${number(magnetic.radius * 100, 1)} cm`;
  $('turn-density-value').textContent = `${number(magnetic.turnsPerMeter, 0)} 匝/m`;
  if (magnetic.geometry === 'wire') {
    $('magnetic-scene-title').textContent = '无限长直导线 · 横截面';
    $('magnetic-hint').textContent = '拖动白色探针';
    $('radius-control').hidden = true; $('turns-control').hidden = true;
    drawWire(view);
  } else if (magnetic.geometry === 'loop') {
    $('magnetic-scene-title').textContent = '圆形电流环 · 侧视与轴线';
    $('magnetic-hint').textContent = '探针仅沿轴线移动';
    $('radius-control').hidden = false; $('turns-control').hidden = true;
    drawLoop(view);
  } else {
    $('magnetic-scene-title').textContent = '理想长螺线管 · 侧视';
    $('magnetic-hint').textContent = '拖动探针比较管内外';
    $('radius-control').hidden = true; $('turns-control').hidden = false;
    drawSolenoid(view);
  }
}

$('source-geometry').addEventListener('change', (event) => { magnetic.geometry = event.target.value; drawMagnetic(); });
$('current').addEventListener('input', (event) => { magnetic.current = Number(event.target.value); drawMagnetic(); });
$('loop-radius').addEventListener('input', (event) => { magnetic.radius = Number(event.target.value) / 100; drawMagnetic(); });
$('turn-density').addEventListener('input', (event) => { magnetic.turnsPerMeter = Number(event.target.value); drawMagnetic(); });
$('magnetic-reset').addEventListener('click', () => {
  magnetic.wireProbe = { x: 0.1, y: 0.07 }; magnetic.loopProbe = 0.14; magnetic.solenoidProbe = { x: 0.5, y: 0.5 }; drawMagnetic();
});

function pointerPosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

let magneticDrag = false;
magneticCanvas.addEventListener('pointerdown', (event) => {
  const view = { width: magneticCanvas.clientWidth, height: magneticCanvas.clientHeight };
  const point = pointerPosition(event, magneticCanvas);
  const handle = probeScreen(view);
  magneticDrag = Math.hypot(point.x - handle.x, point.y - handle.y) < 28;
  if (magneticDrag) magneticCanvas.setPointerCapture(event.pointerId);
});
magneticCanvas.addEventListener('pointermove', (event) => {
  if (!magneticDrag) return;
  const point = pointerPosition(event, magneticCanvas);
  const width = magneticCanvas.clientWidth; const height = magneticCanvas.clientHeight;
  if (magnetic.geometry === 'wire') {
    const scale = Math.min(width / 0.52, height / 0.42);
    const x = (point.x - width / 2) / scale; const y = (height / 2 - point.y) / scale;
    const radius = Math.min(0.21, Math.hypot(x, y));
    const angle = Math.atan2(y, x);
    magnetic.wireProbe = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  } else if (magnetic.geometry === 'loop') {
    const scale = Math.min(width / 1.65, height / 0.8);
    magnetic.loopProbe = Math.max(-0.72, Math.min(0.72, (point.x - width / 2) / scale));
  } else {
    magnetic.solenoidProbe = { x: Math.max(0.04, Math.min(0.96, point.x / width)), y: Math.max(0.08, Math.min(0.92, point.y / height)) };
  }
  drawMagnetic();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) magneticCanvas.addEventListener(type, () => { magneticDrag = false; });

const particleCanvas = $('particle-canvas');
const particle = { kind: 'electron', magneticField: 0.25, speed: 2e6, angleDeg: 45, cycles: 0, animationFrame: null, lastFrame: null };

function particleSettings() {
  return {
    particle: particle.kind,
    magneticField: particle.magneticField,
    speed: particle.speed,
    angleDeg: particle.angleDeg,
  };
}

function project(position, scale) {
  return { x: scale * (position.x + 0.43 * position.y), y: -scale * (position.z + 0.43 * position.y) };
}

function drawParticle() {
  const view = canvasMetrics(particleCanvas);
  if (view.width <= 0 || view.height <= 0) return;
  const { ctx, width, height } = view;
  drawBackground(ctx, width, height);
  const fullPath = Array.from({ length: 241 }, (_, index) => chargedParticleState({ ...particleSettings(), cycles: 2 * index / 240 }));
  const projectedRaw = fullPath.map((state) => project(state.position, 1));
  const minX = Math.min(...projectedRaw.map((point) => point.x)); const maxX = Math.max(...projectedRaw.map((point) => point.x));
  const minY = Math.min(...projectedRaw.map((point) => point.y)); const maxY = Math.max(...projectedRaw.map((point) => point.y));
  const pathWidth = Math.max(1e-12, maxX - minX);
  const pathHeight = Math.max(1e-12, maxY - minY);
  const frameHeight = Math.max(pathHeight, pathWidth / 2.2);
  const scale = Math.min((width - 118) / pathWidth, (height - 104) / frameHeight);
  const origin = { x: 53 - minX * scale, y: (height - frameHeight * scale) / 2 - minY * scale };
  const screen = (position) => { const point = project(position, scale); return { x: origin.x + point.x, y: origin.y + point.y }; };
  const currentState = chargedParticleState({ ...particleSettings(), cycles: particle.cycles });

  const finiteRadius = Number.isFinite(currentState.radius) ? currentState.radius : 0;
  const axisReach = Math.max(Math.abs(fullPath.at(-1).position.x), finiteRadius * 2.5, 56 / scale);
  const axisStart = screen({ x: 0, y: 0, z: 0 });
  const axisEnd = screen({ x: axisReach, y: 0, z: 0 });
  if (particle.magneticField > 0) {
    arrow(ctx, axisStart, axisEnd, '#4f897e', 2, 8);
    label(ctx, 'B  磁场方向', Math.min(width - 92, axisEnd.x + 8), axisEnd.y - 9, '#80dec3');
  } else {
    label(ctx, 'B = 0', axisStart.x + 8, axisStart.y - 10, '#9aafba');
  }

  ctx.save(); ctx.strokeStyle = '#b08c50'; ctx.globalAlpha = 0.75; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(axisStart.x, axisStart.y); ctx.lineTo(axisEnd.x, axisEnd.y); ctx.stroke(); ctx.restore();

  ctx.beginPath();
  fullPath.forEach((state, index) => {
    const point = screen(state.position);
    if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = '#6c8290'; ctx.globalAlpha = 0.64; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;

  const activeCount = Math.max(1, Math.round(particle.cycles / 2 * (fullPath.length - 1)));
  ctx.beginPath();
  for (let index = 0; index <= activeCount; index++) {
    const point = screen(fullPath[index].position);
    if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = '#f1c768'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

  const particlePoint = screen(currentState.position);
  const velocityTip = screen({
    x: currentState.position.x + currentState.velocity.x * 0.018,
    y: currentState.position.y + currentState.velocity.y * 0.018,
    z: currentState.position.z + currentState.velocity.z * 0.018,
  });
  const vx = velocityTip.x - particlePoint.x; const vy = velocityTip.y - particlePoint.y; const velocityLength = Math.hypot(vx, vy) || 1;
  arrow(ctx, particlePoint, { x: particlePoint.x + vx / velocityLength * 44, y: particlePoint.y + vy / velocityLength * 44 }, '#7fe3c4', 2.2, 8);
  label(ctx, 'v', particlePoint.x + vx / velocityLength * 50, particlePoint.y + vy / velocityLength * 50, '#9bf0d5');
  if (currentState.forceMagnitude > 0) {
    const forceScreen = project(currentState.force, 1);
    const forceLength = Math.hypot(forceScreen.x, forceScreen.y) || 1;
    arrow(ctx, particlePoint, { x: particlePoint.x + forceScreen.x / forceLength * 38, y: particlePoint.y + forceScreen.y / forceLength * 38 }, '#ff8d85', 2.4, 8);
    label(ctx, 'F', particlePoint.x + forceScreen.x / forceLength * 43, particlePoint.y + forceScreen.y / forceLength * 43, '#ffaaa0');
  }
  ctx.save(); ctx.shadowColor = '#f3ca70'; ctx.shadowBlur = 16; ctx.fillStyle = particle.kind === 'electron' ? '#83bfff' : '#ff987d';
  ctx.beginPath(); ctx.arc(particlePoint.x, particlePoint.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#f4f8fa'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(particlePoint.x, particlePoint.y, 11, 0, Math.PI * 2); ctx.stroke();
  label(ctx, particle.kind === 'electron' ? 'e⁻' : 'p⁺', particlePoint.x + 13, particlePoint.y - 12, '#e5edf2');
  label(ctx, '起点', axisStart.x - 3, axisStart.y + 22, '#9aafba');

  const cycleText = `${number(particle.cycles, 2)} 周期`;
  $('particle-time-value').textContent = cycleText;
  $('particle-radius').textContent = currentState.radius === Infinity ? '无回旋半径（B = 0）' : quantity(currentState.radius, 'm');
  $('particle-period').textContent = currentState.period === Infinity ? '无回旋周期（B = 0）' : quantity(currentState.period, 's');
  $('particle-force').textContent = quantity(currentState.forceMagnitude, 'N');
  const angle = particle.angleDeg;
  $('particle-explanation').textContent = particle.magneticField === 0
    ? '磁场为零，洛伦兹力为零，粒子沿初速度方向做直线运动。'
    : angle === 0
      ? '速度平行于磁场，v × B = 0；粒子沿磁场方向做直线运动。'
      : angle === 90
        ? `速度垂直于磁场，粒子做圆周运动；此刻洛伦兹力提供向心力，粒子速率保持不变。`
        : `速度分解为平行与垂直磁场的分量，粒子沿磁场做螺旋运动；磁力始终垂直于速度，速率保持不变。`;
  $('particle-speed-value').textContent = `${scientific(particle.speed)} m/s`;
  $('particle-b-value').textContent = `${number(particle.magneticField, 2)} T`;
  $('particle-angle-value').textContent = `${number(particle.angleDeg, 0)}°`;
}

function pauseParticle() {
  if (particle.animationFrame !== null) cancelAnimationFrame(particle.animationFrame);
  particle.animationFrame = null; particle.lastFrame = null;
  $('particle-play').textContent = '▶ 播放';
  $('particle-play').setAttribute('aria-pressed', 'false');
}

function animateParticle(timestamp) {
  if (particle.lastFrame === null) particle.lastFrame = timestamp;
  const elapsed = Math.min(0.08, (timestamp - particle.lastFrame) / 1000);
  particle.lastFrame = timestamp;
  particle.cycles += elapsed * 0.32;
  if (particle.cycles >= 2) {
    particle.cycles = 2; $('particle-time').value = '2'; pauseParticle(); drawParticle(); return;
  }
  $('particle-time').value = String(particle.cycles);
  drawParticle();
  particle.animationFrame = requestAnimationFrame(animateParticle);
}

$('particle-play').addEventListener('click', () => {
  if (particle.animationFrame !== null) { pauseParticle(); return; }
  if (particle.cycles >= 2) { particle.cycles = 0; $('particle-time').value = '0'; drawParticle(); }
  $('particle-play').textContent = 'Ⅱ 暂停'; $('particle-play').setAttribute('aria-pressed', 'true');
  particle.animationFrame = requestAnimationFrame(animateParticle);
});
$('particle-step').addEventListener('click', () => {
  pauseParticle(); particle.cycles = Math.min(2, particle.cycles + 0.05); $('particle-time').value = String(particle.cycles); drawParticle();
});
$('particle-reset').addEventListener('click', () => {
  pauseParticle(); particle.cycles = 0; $('particle-time').value = '0'; drawParticle();
});
$('particle-time').addEventListener('input', (event) => {
  pauseParticle(); particle.cycles = Number(event.target.value); drawParticle();
});
$('particle-kind').addEventListener('change', (event) => { particle.kind = event.target.value; drawParticle(); });
$('particle-b').addEventListener('input', (event) => { particle.magneticField = Number(event.target.value); drawParticle(); });
$('particle-speed').addEventListener('input', (event) => { particle.speed = Number(event.target.value); drawParticle(); });
$('particle-angle').addEventListener('input', (event) => { particle.angleDeg = Number(event.target.value); drawParticle(); });

const tabs = [...document.querySelectorAll('.model-nav .nav-tab')];
const modelNav = document.querySelector('.model-nav');
const panels = [...document.querySelectorAll('.model-panel')];
const advancedModels = initAdvancedModels();
function selectModel(tab) {
  const target = tab.dataset.target;
  if (tab.classList.contains('is-active')) return;
  pauseParticle();
  advancedModels.pauseAll();
  tabs.forEach((item) => { item.classList.toggle('is-active', item === tab); item.removeAttribute('aria-current'); });
  tab.setAttribute('aria-current', 'page');
  panels.forEach((panel) => { panel.hidden = panel.id !== target; panel.classList.toggle('is-active', panel.id === target); });
  const navRect = modelNav.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  modelNav.scrollTo({ left: modelNav.scrollLeft + tabRect.left - navRect.left - (modelNav.clientWidth - tabRect.width) / 2, behavior: 'smooth' });
  if (target === 'current-field') drawMagnetic();
  else if (target === 'charged-particle') drawParticle();
  else advancedModels.draw(target);
}
tabs.forEach((tab) => tab.addEventListener('click', () => selectModel(tab)));

const resizeObserver = new ResizeObserver(() => {
  const active = document.querySelector('.model-panel.is-active');
  if (active?.id === 'current-field') drawMagnetic();
  if (active?.id === 'charged-particle') drawParticle();
  if (active && !['current-field', 'charged-particle'].includes(active.id)) advancedModels.draw(active.id);
});
document.querySelectorAll('.canvas-card').forEach((card) => resizeObserver.observe(card));
drawMagnetic();
drawParticle();
