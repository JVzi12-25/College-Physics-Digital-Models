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
  const isDouble = mode === "double";
  const lambda = Number($(isDouble ? "#double-wavelength" : "#single-wavelength").value) * 1e-9;
  const slitSize = Number($(isDouble ? "#slit-separation" : "#slit-width").value) * (isDouble ? 1e-3 : 1e-6);
  const screenDistance = Number($(isDouble ? "#double-screen-distance" : "#single-screen-distance").value);
  const fringeSpacing = isDouble ? doubleSlitFringeSpacing(lambda, slitSize, screenDistance) : null;
  const minimumAngle = isDouble ? 0 : singleSlitMinimaAngle(1, lambda, slitSize) * Math.PI / 180;
  const firstNull = isDouble ? fringeSpacing / 2 : screenDistance * Math.tan(minimumAngle);
  const visibleRange = isDouble ? Math.max(fringeSpacing * 3.3, 0.003) : Math.max(firstNull * 2.5, 0.002);
  const cy = h * 0.51, slitX = w * 0.16, screenX = w * 0.49;
  const metersToPixels = (h - 64) / (2 * visibleRange);
  const plotLeft = w * 0.61, plotRight = w - 20, plotTop = h * 0.2, plotBottom = h * 0.8;
  label(ctx, isDouble ? "相干光源" : "单色平面波", 18, 24, "#a9c8cd", 10);
  label(ctx, "观察屏", screenX, 24, "#a9c8cd", 10, "center");
  label(ctx, "归一化强度 I/I₀", (plotLeft + plotRight) / 2, 24, "#a9c8cd", 10, "center");
  if (isDouble) {
    const slitGap = Math.max(13, Math.min(25, h * 0.08));
    ctx.fillStyle = "#2f4d58"; ctx.fillRect(slitX - 4, cy - h * 0.35, 8, h * 0.7);
    ctx.clearRect(slitX - 5, cy - slitGap / 2 - 3, 10, 6); ctx.clearRect(slitX - 5, cy + slitGap / 2 - 3, 10, 6);
    ctx.fillStyle = "#8ce2ff"; ctx.fillRect(slitX - 2, cy - slitGap / 2 - 2, 4, 4); ctx.fillRect(slitX - 2, cy + slitGap / 2 - 2, 4, 4);
    for (const originY of [cy - slitGap / 2, cy + slitGap / 2]) for (const radius of [24, 45, 66, 87]) {
      ctx.beginPath(); ctx.arc(slitX, originY, radius, -Math.PI / 2, Math.PI / 2);
      ctx.strokeStyle = "rgba(126,220,255,.15)"; ctx.lineWidth = 1; ctx.stroke();
    }
  } else {
    for (let x = 30; x < slitX - 12; x += 18) line(ctx, x, cy - h * 0.32, x, cy + h * 0.32, "rgba(126,220,255,.22)", 1);
    const openingHalf = Math.max(6, firstNull * metersToPixels * 0.9);
    ctx.fillStyle = "#2f4d58";
    ctx.fillRect(slitX - 4, 22, 8, Math.max(0, cy - openingHalf - 22));
    ctx.fillRect(slitX - 4, Math.min(h - 22, cy + openingHalf), 8, Math.max(0, h - 22 - (cy + openingHalf)));
    ctx.fillStyle = "#8ce2ff"; ctx.fillRect(slitX - 2, cy - openingHalf, 4, openingHalf * 2);
    for (const radius of [28, 50, 72, 94]) {
      ctx.beginPath(); ctx.arc(slitX, cy, radius, -Math.PI / 2, Math.PI / 2);
      ctx.strokeStyle = "rgba(126,220,255,.13)"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  const screenTop = 40, screenBottom = h - 24;
  line(ctx, screenX, screenTop, screenX, screenBottom, "#9eb9c0", 3);
  for (let py = screenTop; py < screenBottom; py += 2) {
    const y = ((cy - py) / ((screenBottom - screenTop) / 2)) * visibleRange;
    const intensity = isDouble ? doubleSlitIntensity(y, lambda, slitSize, screenDistance) : singleSlitIntensity(y, lambda, slitSize, screenDistance);
    ctx.fillStyle = "rgba(142,222,255," + (0.08 + 0.92 * intensity) + ")";
    ctx.fillRect(screenX + 5, py, 16, 2.2);
  }
  label(ctx, "y = 0", screenX + 26, cy + 4, "#c1d2d4", 9);
  line(ctx, plotLeft, plotBottom, plotRight, plotBottom, "#78949e", 1);
  line(ctx, (plotLeft + plotRight) / 2, plotTop, (plotLeft + plotRight) / 2, plotBottom, "rgba(130,159,169,.42)", 1, [4, 4]);
  line(ctx, plotLeft, plotTop, plotLeft, plotBottom, "#78949e", 1);
  label(ctx, "1", plotLeft - 7, plotTop + 4, "#96adb4", 9, "right");
  label(ctx, "0", plotLeft - 7, plotBottom + 3, "#96adb4", 9, "right");
  ctx.beginPath();
  const samples = 260;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, y = (t - 0.5) * 2 * visibleRange;
    const value = isDouble ? doubleSlitIntensity(y, lambda, slitSize, screenDistance) : singleSlitIntensity(y, lambda, slitSize, screenDistance);
    const px = plotLeft + t * (plotRight - plotLeft), py = plotBottom - value * (plotBottom - plotTop);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = "#84e2c5"; ctx.lineWidth = 2.2; ctx.stroke();
  label(ctx, "屏上范围 ±" + (visibleRange * 1000).toFixed(1) + " mm", (plotLeft + plotRight) / 2, h - 8, "#8faab1", 9, "center");
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
    if (panel && !panel.hidden) updateByPanel[panel.id]();
  };
  control.addEventListener("input", refreshPanel);
  control.addEventListener("change", refreshPanel);
});

$$("[data-reset]").forEach((button) => button.addEventListener("click", () => {
  const panel = button.dataset.reset;
  Object.entries(defaults[panel]).forEach(([id, value]) => { $("#" + id).value = value; });
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
