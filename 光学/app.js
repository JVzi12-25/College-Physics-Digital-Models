import {
  criticalAngle, doubleSlitFringeSpacing, doubleSlitIntensity, refract,
  singleSlitIntensity, singleSlitMinimaAngle, thinLens,
} from "./physics.js";
import { installRangeNumberInputs, syncRangeNumberInputs } from "./range-inputs.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const defaults = {
  refraction: { n1: 1, n2: 1.5, "incident-angle": 30 },
  lens: { "lens-kind": "converging", "focal-length": 20, "object-distance": 35, "object-height": 8 },
  "double-slit": { "double-wavelength": 550, "slit-separation": 0.5, "double-screen-distance": 1.5 },
  "single-slit": { "single-wavelength": 550, "slit-width": 20, "single-screen-distance": 1.5 },
};
const defaultViewRanges = { double: 5.5, single: 50 };
const viewRanges = { ...defaultViewRanges };
const comparisonCurves = { double: null, single: null };

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function line(ctx, x1, y1, x2, y2, color, width = 2, dash = []) {
  ctx.beginPath(); ctx.setLineDash(dash); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
}

function arrow(ctx, x1, y1, x2, y2, color, width = 2) {
  line(ctx, x1, y1, x2, y2, color, width);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 10 * Math.cos(angle - 0.45), y2 - 10 * Math.sin(angle - 0.45));
  ctx.lineTo(x2 - 10 * Math.cos(angle + 0.45), y2 - 10 * Math.sin(angle + 0.45));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function label(ctx, text, x, y, color = "#b8cdd2", size = 11, align = "left") {
  ctx.fillStyle = color; ctx.font = size + 'px "Microsoft YaHei UI", sans-serif';
  ctx.textAlign = align; ctx.fillText(text, x, y);
}

function backdrop(ctx, w, h) {
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#101d2a"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(132,183,190,.07)"; ctx.lineWidth = 1;
  for (let x = 24; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 18; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function spectrumColor(lambdaNm, alpha = 1) {
  const hue = clamp((750 - lambdaNm) * 275 / 370, 0, 275);
  return `hsla(${hue}, 92%, 68%, ${alpha})`;
}

function chooseMillimeterStep(rangeMm) {
  const roughStep = rangeMm * 2 / 6;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

function readWaveParameters(mode) {
  const isDouble = mode === "double";
  const lambdaNm = Number($(isDouble ? "#double-wavelength" : "#single-wavelength").value);
  const slitValue = Number($(isDouble ? "#slit-separation" : "#slit-width").value);
  return {
    isDouble,
    lambdaNm,
    lambda: lambdaNm * 1e-9,
    slitValue,
    slitSize: slitValue * (isDouble ? 1e-3 : 1e-6),
    screenDistance: Number($(isDouble ? "#double-screen-distance" : "#single-screen-distance").value),
  };
}

function updateViewReadout(mode) {
  const input = $(`#${mode}-view-range`);
  if (!input) return;
  const mm = Number(input.value);
  viewRanges[mode] = mm;
  $(`#${mode}-view-range-value`).textContent = `±${mm.toFixed(mode === "double" ? 1 : 0)} mm`;
  $(`#${mode}-view-status`).textContent = `固定屏幕视野：−${mm.toFixed(mode === "double" ? 1 : 0)} 至 +${mm.toFixed(mode === "double" ? 1 : 0)} mm`;
}

function getIntensity(mode, y, parameters) {
  return mode === "double"
    ? doubleSlitIntensity(y, parameters.lambda, parameters.slitSize, parameters.screenDistance)
    : singleSlitIntensity(y, parameters.lambda, parameters.slitSize, parameters.screenDistance);
}

function traceIntensityCurve(ctx, mode, parameters, rangeMeters, plot, color, dashed = false) {
  const plotWidth = plot.right - plot.left;
  const featureSpacing = parameters.lambda * parameters.screenDistance / parameters.slitSize;
  const cycles = 2 * rangeMeters / Math.max(featureSpacing, 1e-12);
  const samples = Math.min(6400, Math.max(360, Math.ceil(cycles * 8)));
  ctx.beginPath();
  for (let index = 0; index <= samples; index++) {
    const fraction = index / samples;
    const y = (fraction - 0.5) * 2 * rangeMeters;
    const intensity = getIntensity(mode, y, parameters);
    const x = plot.left + fraction * plotWidth;
    const screenY = plot.bottom - intensity * (plot.bottom - plot.top);
    if (index === 0) ctx.moveTo(x, screenY); else ctx.lineTo(x, screenY);
  }
  ctx.setLineDash(dashed ? [5, 4] : []);
  ctx.strokeStyle = color;
  ctx.lineWidth = dashed ? 1.8 : 2.3;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPhysicalMarkers(ctx, mode, parameters, rangeMeters, plot, canvasHeight) {
  const rangeMm = rangeMeters * 1000;
  const plotWidth = plot.right - plot.left;
  const toX = (y) => plot.left + ((y / rangeMeters + 1) / 2) * plotWidth;
  const marker = (y, text, color) => {
    if (Math.abs(y) > rangeMeters) return;
    const x = toX(y);
    line(ctx, x, plot.bottom - 4, x, plot.bottom + 3, color, 1.2);
    if (text) label(ctx, text, x, canvasHeight - 23, color, 8, "center");
  };

  if (mode === "double") {
    const fringeSpacing = doubleSlitFringeSpacing(parameters.lambda, parameters.slitSize, parameters.screenDistance);
    const spacingPx = fringeSpacing / (2 * rangeMeters) * plotWidth;
    const maxOrder = Math.min(16, Math.floor(rangeMeters / fringeSpacing));
    if (spacingPx >= 19) {
      for (let order = -maxOrder; order <= maxOrder; order++) {
        const ratio = order * parameters.lambda / parameters.slitSize;
        if (Math.abs(ratio) >= 1) continue;
        const y = parameters.screenDistance * Math.tan(Math.asin(ratio));
        marker(y, Math.abs(order) === 1 ? `m=${order}` : "", order === 0 ? "#8ce2ff" : "rgba(140,226,255,.72)");
      }
    }
  } else {
    const range = Math.min(parameters.slitSize / parameters.lambda, 8);
    const maxOrder = Math.floor(range);
    for (let order = 1; order <= maxOrder; order++) {
      const angle = Math.asin(order * parameters.lambda / parameters.slitSize);
      const y = parameters.screenDistance * Math.tan(angle);
      marker(-y, order === 1 ? "m=−1" : "", "rgba(140,226,255,.72)");
      marker(y, order === 1 ? "m=1" : "", "rgba(140,226,255,.72)");
    }
  }
  label(ctx, `±${rangeMm.toFixed(mode === "double" ? 1 : 0)} mm`, plot.right, canvasHeight - 23, "#8faab1", 8, "right");
}

function renderRefraction() {
  const sized = canvasContext($("#refraction-canvas")); if (!sized) return;
  const { ctx, w, h } = sized;
  backdrop(ctx, w, h);
  const n1 = Number($("#n1").value), n2 = Number($("#n2").value), theta = Number($("#incident-angle").value);
  const result = refract(n1, n2, theta), x = w * 0.52, cy = h * 0.53;
  ctx.fillStyle = "rgba(86,168,209,.09)"; ctx.fillRect(x, 0, w - x, h);
  line(ctx, x, 12, x, h - 12, "#8baeb0", 2);
  line(ctx, 16, cy, w - 16, cy, "rgba(214,236,230,.58)", 1, [6, 5]);
  label(ctx, "n₁ = " + n1.toFixed(2), 26, 28, "#c8e3e3", 12);
  label(ctx, "n₂ = " + n2.toFixed(2), w - 25, 28, "#c8e3e3", 12, "right");
  label(ctx, "介质 1", 26, h - 20, "#91abb4", 11);
  label(ctx, "介质 2", w - 25, h - 20, "#91abb4", 11, "right");
  label(ctx, "法线", x + 9, cy - 10, "#91abb4", 10);
  const rayLength = Math.min(w * 0.34, h * 0.54), rad = theta * Math.PI / 180;
  arrow(ctx, x - rayLength * Math.cos(rad), cy - rayLength * Math.sin(rad), x, cy, "#7edcff", 3);
  arrow(ctx, x, cy, x - rayLength * Math.cos(rad), cy + rayLength * Math.sin(rad), "#f4d477", 2);
  label(ctx, "θ₁ " + theta + "°", x - 62, cy - 45, "#bdefff", 11, "right");
  label(ctx, "反射 " + theta + "°", x - 74, cy + 57, "#f4d477", 10, "right");
  if (result.reflected) label(ctx, "全反射：无折射光线", x + 18, cy + 36, "#ffc781", 12);
  else {
    const refRad = result.theta2 * Math.PI / 180;
    arrow(ctx, x, cy, x + rayLength * Math.cos(refRad), cy + rayLength * Math.sin(refRad), "#f58cb7", 3);
    label(ctx, "θ₂ " + result.theta2.toFixed(1) + "°", x + 70, cy + 62, "#ffc0d7", 11);
  }
  ctx.beginPath(); ctx.arc(x, cy, 29, 0, rad, false);
  ctx.strokeStyle = "#7edcff"; ctx.lineWidth = 1.3; ctx.stroke();
}

function renderLens() {
  const sized = canvasContext($("#lens-canvas")); if (!sized) return;
  const { ctx, w, h } = sized; backdrop(ctx, w, h);
  const converging = $("#lens-kind").value === "converging";
  const focalAbs = Number($("#focal-length").value), f = converging ? focalAbs : -focalAbs;
  const so = Number($("#object-distance").value), ho = Number($("#object-height").value);
  const result = thinLens(f, so), si = result.imageDistance;
  const cx = w * 0.51, cy = h * 0.56;
  const shownImageDistance = Number.isFinite(si) ? Math.min(Math.abs(si), Math.max(50, so * 1.4)) : so * 1.4;
  const ppcm = Math.min((w * 0.42) / (so + shownImageDistance + 2 * focalAbs + 8), (h * 0.38) / Math.max(ho, 12));
  const p = Math.max(0.75, ppcm), objectX = cx - so * p;
  const imageX = cx + (Number.isFinite(si) ? si : shownImageDistance) * p;
  const objectY = ho * p, imageY = Number.isFinite(result.magnification) ? result.magnification * objectY : 0;
  const focusLeft = cx - focalAbs * p, focusRight = cx + focalAbs * p;
  line(ctx, 18, cy, w - 18, cy, "rgba(214,236,230,.62)", 1.2);
  line(ctx, cx, 28, cx, h - 26, "#a2d9d4", 4);
  line(ctx, focusLeft, cy - 7, focusLeft, cy + 7, "#9bb5be", 1.5);
  line(ctx, focusRight, cy - 7, focusRight, cy + 7, "#9bb5be", 1.5);
  label(ctx, converging ? "F" : "F（虚焦点）", focusLeft, cy + 23, "#a9c1c8", 9, "center");
  label(ctx, "F′", focusRight, cy + 23, "#a9c1c8", 9, "center");
  label(ctx, converging ? "凸透镜" : "凹透镜", cx, 22, "#c5e5df", 11, "center");
  const topY = cy - objectY;
  arrow(ctx, objectX, cy, objectX, topY, "#f4d477", 3);
  label(ctx, "物", objectX, cy + 20, "#f4d477", 10, "center");
  const clampedImageX = Math.max(15, Math.min(w - 15, imageX));
  const clampedImageY = Math.max(30, Math.min(h - 30, cy - imageY));
  const rayAtRight = topY + (objectY / f) * (w - cx) / p;
  line(ctx, objectX, topY, cx, topY, "#7edcff", 1.8);
  line(ctx, cx, topY, w - 12, Math.max(18, Math.min(h - 18, rayAtRight)), "#7edcff", 1.8);
  line(ctx, objectX, topY, cx, cy, "#77d5bf", 1.5);
  const centerRayY = cy + (cy - topY) * (w - cx) / Math.max(1, cx - objectX);
  line(ctx, cx, cy, w - 12, Math.max(18, Math.min(h - 18, centerRayY)), "#77d5bf", 1.5);
  if (Number.isFinite(si) && si < 0) line(ctx, cx, topY, clampedImageX, clampedImageY, "#f58cb7", 1.5, [5, 5]);
  if (Number.isFinite(si) && Math.abs(si) <= Math.max(50, so * 1.4)) {
    arrow(ctx, clampedImageX, cy, clampedImageX, clampedImageY, "#f58cb7", 3);
    label(ctx, result.kind === "real" ? "实像" : "虚像", clampedImageX, cy + 20, "#ffc0d7", 10, "center");
  } else label(ctx, Number.isFinite(si) ? "像在视野外" : "像在无穷远", w - 18, 42, "#ffc0d7", 10, "right");
  label(ctx, "主光线", 26, h - 16, "#91abb4", 10);
}

function drawWaveExperiment(canvasId, mode) {
  const sized = canvasContext($(canvasId)); if (!sized) return;
  const { ctx, w, h } = sized; backdrop(ctx, w, h);
  const parameters = readWaveParameters(mode);
  const { isDouble, lambdaNm, lambda, slitValue, slitSize, screenDistance } = parameters;
  const visibleRange = (viewRanges[mode] || defaultViewRanges[mode]) / 1000;
  const cy = h * 0.52, slitX = w * 0.15;
  const distanceProgress = (Math.log10(screenDistance) + 1) / 2;
  const screenX = w * (0.43 + 0.08 * distanceProgress);
  const plotLeft = Math.max(w * 0.61, screenX + 44), plotRight = w - 20;
  const plotTop = Math.max(68, h * 0.2), plotBottom = h * 0.75;
  const screenTop = 57, screenBottom = h - 27, screenCenter = (screenTop + screenBottom) / 2;
  const screenHalf = (screenBottom - screenTop) / 2;
  const waveColor = spectrumColor(lambdaNm);
  const waveColorSoft = spectrumColor(lambdaNm, 0.3);
  const meterRange = visibleRange;
  const plot = { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom };

  updateViewReadout(mode);
  label(ctx, isDouble ? "相干光源" : "单色平面波", 18, 24, "#a9c8cd", 10);
  label(ctx, "观察屏", screenX, 24, "#a9c8cd", 10, "center");
  label(ctx, "归一化强度 I/I₀", (plotLeft + plotRight) / 2, 24, "#a9c8cd", 10, "center");

  const dimensionY = 45;
  arrow(ctx, slitX + 9, dimensionY, screenX - 8, dimensionY, "rgba(161,202,210,.62)", 1);
  arrow(ctx, screenX - 8, dimensionY, slitX + 9, dimensionY, "rgba(161,202,210,.62)", 1);
  label(ctx, `L = ${screenDistance.toFixed(1)} m`, (slitX + screenX) / 2, dimensionY - 5, "#b9ced2", 9, "center");

  if (isDouble) {
    const slitGap = clamp(h * 0.06 * (slitValue / 0.5), h * 0.018, h * 0.32);
    const openingHeight = clamp(h * 0.018, 5, 9);
    const sources = [cy - slitGap / 2, cy + slitGap / 2];
    ctx.fillStyle = "#314b56"; ctx.fillRect(slitX - 4, cy - h * 0.34, 8, h * 0.68);
    for (const originY of sources) {
      ctx.clearRect(slitX - 5, originY - openingHeight / 2, 10, openingHeight);
      ctx.fillStyle = waveColor; ctx.fillRect(slitX - 2, originY - openingHeight / 2, 4, openingHeight);
    }
    const ringPitch = clamp(25 * (lambdaNm / 550), 14, 46);
    ctx.save(); ctx.shadowColor = waveColor; ctx.shadowBlur = 7;
    for (const originY of sources) {
      for (let radius = ringPitch; radius <= h * 0.31; radius += ringPitch) {
        ctx.beginPath(); ctx.arc(slitX, originY, radius, -Math.PI / 2, Math.PI / 2);
        ctx.strokeStyle = waveColorSoft; ctx.lineWidth = 1.1; ctx.stroke();
      }
    }
    ctx.restore();
    label(ctx, `d = ${slitValue.toFixed(2)} mm · 示意放大`, slitX + 12, cy + slitGap / 2 + 17, "#b9ced2", 9);
  } else {
    const ringPitch = clamp(25 * (lambdaNm / 550), 14, 46);
    for (let x = 30; x < slitX - 12; x += ringPitch) line(ctx, x, cy - h * 0.32, x, cy + h * 0.32, waveColorSoft, 1);
    const openingHeight = clamp(h * 0.042 * (slitValue / 20), 5, h * 0.34);
    ctx.fillStyle = "#314b56";
    ctx.fillRect(slitX - 4, screenTop - 2, 8, Math.max(0, cy - openingHeight / 2 - screenTop + 2));
    ctx.fillRect(slitX - 4, cy + openingHeight / 2, 8, Math.max(0, screenBottom - cy - openingHeight / 2));
    ctx.save(); ctx.shadowColor = waveColor; ctx.shadowBlur = 8;
    ctx.fillStyle = waveColor; ctx.fillRect(slitX - 2, cy - openingHeight / 2, 4, openingHeight);
    ctx.restore();
    const sourceCount = clamp(Math.round(openingHeight / 12), 3, 7);
    const maxRadius = Math.min(h * 0.29, screenX - slitX - 16);
    for (let source = 0; source < sourceCount; source++) {
      const fraction = sourceCount === 1 ? 0.5 : source / (sourceCount - 1);
      const originY = cy + (fraction - 0.5) * openingHeight;
      for (let radius = ringPitch; radius <= maxRadius; radius += ringPitch) {
        ctx.beginPath(); ctx.arc(slitX, originY, radius, -Math.PI / 2, Math.PI / 2);
        ctx.strokeStyle = spectrumColor(lambdaNm, 0.12); ctx.lineWidth = 0.9; ctx.stroke();
      }
    }
    label(ctx, `a = ${slitValue} μm · 示意放大`, slitX + 12, cy + openingHeight / 2 + 17, "#b9ced2", 9);
  }

  line(ctx, screenX, screenTop, screenX, screenBottom, "#9eb9c0", 2.2);
  const featureSpacing = lambda * screenDistance / slitSize;
  const pixelHeight = 1.6;
  const subSamples = clamp(Math.ceil((pixelHeight * visibleRange / screenHalf) / Math.max(featureSpacing, 1e-12) * 5), 4, 24);
  for (let py = screenTop; py < screenBottom; py += pixelHeight) {
    let intensity = 0;
    for (let sample = 0; sample < subSamples; sample++) {
      const sampleY = py + (sample + 0.5) * pixelHeight / subSamples;
      const y = ((screenCenter - sampleY) / screenHalf) * visibleRange;
      intensity += getIntensity(mode, y, parameters);
    }
    intensity /= subSamples;
    ctx.fillStyle = spectrumColor(lambdaNm, 0.1 + 0.9 * intensity);
    ctx.fillRect(screenX + 5, py, 12, pixelHeight + 0.25);
  }
  for (const y of [-visibleRange, 0, visibleRange]) {
    const screenY = screenCenter - y / visibleRange * screenHalf;
    line(ctx, screenX - 3, screenY, screenX + 3, screenY, y === 0 ? "#e4f7f9" : "#9eb9c0", y === 0 ? 1.5 : 1);
  }
  label(ctx, "y = 0", screenX + 21, screenCenter + 4, "#c1d2d4", 9);

  line(ctx, plotLeft, plotBottom, plotRight, plotBottom, "#78949e", 1);
  line(ctx, plotLeft, plotTop, plotLeft, plotBottom, "#78949e", 1);
  const gridSteps = [0, 0.5, 1];
  for (const value of gridSteps) {
    const y = plotBottom - value * (plotBottom - plotTop);
    line(ctx, plotLeft, y, plotRight, y, value === 0.5 ? "rgba(130,159,169,.22)" : "rgba(130,159,169,.12)", 1, value === 0.5 ? [3, 4] : []);
    label(ctx, value.toFixed(value === 0 ? 0 : 1), plotLeft - 7, y + 3, "#96adb4", 8, "right");
  }

  const viewRangeMm = visibleRange * 1000;
  const tickStep = chooseMillimeterStep(viewRangeMm);
  const decimals = Math.max(0, -Math.floor(Math.log10(tickStep)));
  for (let yMm = Math.ceil(-viewRangeMm / tickStep) * tickStep; yMm <= viewRangeMm + tickStep * 1e-6; yMm += tickStep) {
    const x = plotLeft + ((yMm + viewRangeMm) / (2 * viewRangeMm)) * (plotRight - plotLeft);
    const isCenter = Math.abs(yMm) < tickStep * 1e-6;
    if (!isCenter) line(ctx, x, plotTop, x, plotBottom, "rgba(130,159,169,.11)", 1);
    line(ctx, x, plotBottom, x, plotBottom + (isCenter ? 6 : 4), isCenter ? "#a8dce1" : "#78949e", 1);
    label(ctx, yMm.toFixed(decimals), x, plotBottom + 16, isCenter ? "#d2e8eb" : "#8faab1", 8, "center");
  }

  const comparison = comparisonCurves[mode];
  if (comparison) traceIntensityCurve(ctx, mode, comparison, meterRange, plot, "#b58aff", true);
  traceIntensityCurve(ctx, mode, parameters, meterRange, plot, "#84e2c5");
  drawPhysicalMarkers(ctx, mode, parameters, meterRange, plot, h);
  label(ctx, "屏上位置 y（mm）", (plotLeft + plotRight) / 2, h - 7, "#8faab1", 8, "center");

  const compareButton = $(`[data-compare-curve="${mode}"]`);
  const compareLegend = $(`#${mode}-comparison-legend`);
  if (compareButton) {
    compareButton.setAttribute("aria-pressed", String(Boolean(comparison)));
    compareButton.textContent = comparison ? "清除对照曲线" : "保存当前曲线作对照";
  }
  if (compareLegend) compareLegend.hidden = !comparison;
}

function updateRefraction() {
  const n1 = Number($("#n1").value), n2 = Number($("#n2").value), theta = Number($("#incident-angle").value);
  $("#n1-value").value = n1.toFixed(2); $("#n2-value").value = n2.toFixed(2); $("#incident-angle-value").value = theta + "°";
  const result = refract(n1, n2, theta), critical = criticalAngle(n1, n2);
  $("#critical-angle").textContent = critical === null ? "不存在" : critical.toFixed(1) + "°";
  $("#refracted-angle").textContent = result.reflected ? "无折射光" : result.theta2.toFixed(1) + "°";
  $("#refraction-status").textContent = result.reflected
    ? "θ₁ 已超过临界角 " + critical.toFixed(1) + "°，发生全反射。"
    : Math.abs(n1 - n2) < 1e-9 ? "两侧折射率相同，光线不偏折。"
      : n2 > n1 ? "光线进入折射率更大的介质，向法线偏折。"
        : "光线进入折射率较小的介质，远离法线偏折；超过临界角将发生全反射。";
  renderRefraction();
}

function updateLens() {
  const kind = $("#lens-kind").value, focalAbs = Number($("#focal-length").value);
  const so = Number($("#object-distance").value), ho = Number($("#object-height").value);
  const result = thinLens(kind === "converging" ? focalAbs : -focalAbs, so);
  $("#focal-length-value").value = focalAbs + " cm"; $("#object-distance-value").value = so + " cm"; $("#object-height-value").value = ho + " cm";
  $("#image-distance").textContent = Number.isFinite(result.imageDistance) ? result.imageDistance.toFixed(1) + " cm" : "∞";
  $("#magnification").textContent = Number.isFinite(result.magnification)
    ? result.magnification.toFixed(2) + " · " + (result.kind === "real" ? "倒立实像" : "正立虚像") : "像在无穷远";
  $("#lens-status").textContent = result.kind === "infinity"
    ? "物体位于凸透镜焦平面，出射光平行，像距趋于无穷远。"
    : result.kind === "real" ? "像位于透镜另一侧，像高约 " + Math.abs(result.magnification * ho).toFixed(1) + " cm。"
      : "像与物体位于透镜同侧，像高约 " + Math.abs(result.magnification * ho).toFixed(1) + " cm。";
  renderLens();
}

function updateDoubleSlit() {
  const lambdaNm = Number($("#double-wavelength").value), separationMm = Number($("#slit-separation").value);
  const distance = Number($("#double-screen-distance").value);
  const spacing = doubleSlitFringeSpacing(lambdaNm * 1e-9, separationMm * 1e-3, distance);
  $("#double-wavelength-value").value = lambdaNm + " nm"; $("#slit-separation-value").value = separationMm.toFixed(2) + " mm";
  $("#double-screen-distance-value").value = distance.toFixed(1) + " m";
  $("#fringe-spacing").textContent = (spacing * 1000).toFixed(2) + " mm";
  drawWaveExperiment("#double-slit-canvas", "double");
}

function updateSingleSlit() {
  const lambdaNm = Number($("#single-wavelength").value), widthMicrometers = Number($("#slit-width").value);
  const distance = Number($("#single-screen-distance").value), lambda = lambdaNm * 1e-9, width = widthMicrometers * 1e-6;
  const angle = singleSlitMinimaAngle(1, lambda, width);
  $("#single-wavelength-value").value = lambdaNm + " nm"; $("#slit-width-value").value = widthMicrometers + " μm";
  $("#single-screen-distance-value").value = distance.toFixed(1) + " m";
  $("#central-width").textContent = (2 * lambda * distance / width * 1000).toFixed(1) + " mm";
  $("#first-minimum").textContent = angle.toFixed(2) + "°";
  drawWaveExperiment("#single-slit-canvas", "single");
}

const updateByPanel = { refraction: updateRefraction, lens: updateLens, "double-slit": updateDoubleSlit, "single-slit": updateSingleSlit };

$$(".nav-tab[data-target]").forEach((button) => button.addEventListener("click", () => {
  const target = button.dataset.target;
  $$(".nav-tab[data-target]").forEach((tab) => {
    const selected = tab === button; tab.classList.toggle("is-active", selected);
    if (selected) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
  });
  $$(".model-panel").forEach((panel) => {
    const selected = panel.id === target; panel.hidden = !selected; panel.classList.toggle("is-active", selected);
  });
  updateByPanel[target]();
}));

$$("input[type=range],select").forEach((control) => {
  const refreshPanel = () => {
    const panel = control.closest(".model-panel");
    if (panel && !panel.hidden) {
      if (control.dataset.viewRange) updateViewReadout(control.dataset.viewRange);
      updateByPanel[panel.id]();
    }
  };
  control.addEventListener("input", refreshPanel);
  control.addEventListener("change", refreshPanel);
});

$$("[data-fit-view]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.fitView;
  const parameters = readWaveParameters(mode);
  let rangeMm;
  if (mode === "double") {
    rangeMm = doubleSlitFringeSpacing(parameters.lambda, parameters.slitSize, parameters.screenDistance) * 1000 * 3.3;
  } else {
    const angle = singleSlitMinimaAngle(1, parameters.lambda, parameters.slitSize);
    const firstMinimum = angle === null ? Infinity : parameters.screenDistance * Math.tan(angle * Math.PI / 180);
    rangeMm = firstMinimum * 1000 * 2.3;
  }
  const rangeControl = $(`#${mode}-view-range`);
  rangeControl.value = String(clamp(rangeMm, Number(rangeControl.min), Number(rangeControl.max)));
  updateViewReadout(mode);
  updateByPanel[mode === "double" ? "double-slit" : "single-slit"]();
  syncRangeNumberInputs();
}));

$$("[data-compare-curve]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.compareCurve;
  comparisonCurves[mode] = comparisonCurves[mode] ? null : readWaveParameters(mode);
  updateByPanel[mode === "double" ? "double-slit" : "single-slit"]();
}));

$$("[data-reset]").forEach((button) => button.addEventListener("click", () => {
  const panel = button.dataset.reset;
  Object.entries(defaults[panel]).forEach(([id, value]) => { $("#" + id).value = value; });
  if (panel === "double-slit" || panel === "single-slit") {
    const mode = panel === "double-slit" ? "double" : "single";
    viewRanges[mode] = defaultViewRanges[mode];
    $(`#${mode}-view-range`).value = String(defaultViewRanges[mode]);
    comparisonCurves[mode] = null;
  }
  updateByPanel[panel]();
  syncRangeNumberInputs();
}));

let resizeFrame = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const active = $(".model-panel.is-active");
    if (active) updateByPanel[active.id]();
  });
});

updateRefraction();
installRangeNumberInputs();
