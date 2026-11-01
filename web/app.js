"use strict";

const input = document.querySelector("#imageInput");
const canvas = document.querySelector("#imageCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const heatmap = document.querySelector("#heatmapCanvas");
const heatCtx = heatmap.getContext("2d");
const undoButton = document.querySelector("#undoButton");
const resetButton = document.querySelector("#resetButton");
const analyzeButton = document.querySelector("#analyzeButton");
const downloadButton = document.querySelector("#downloadButton");
const instruction = document.querySelector("#instruction");
const results = document.querySelector("#results");

const MAX_DIMENSION = 1024;
let imageLoaded = false;
let imageName = "leaf-image";
let basePixels = null;
let points = [];
let lastReport = null;
let drawing = false;

input.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  imageName = file.name;
  const url = URL.createObjectURL(file);
  const loaded = new Image();
  loaded.onload = () => {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(loaded.naturalWidth, loaded.naturalHeight));
    canvas.width = Math.round(loaded.naturalWidth * scale);
    canvas.height = Math.round(loaded.naturalHeight * scale);
    ctx.drawImage(loaded, 0, 0, canvas.width, canvas.height);
    basePixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageLoaded = true;
    points = [];
    results.hidden = true;
    updateControls();
    instruction.textContent = "Trace once around one leaf without lifting your finger.";
    URL.revokeObjectURL(url);
  };
  loaded.src = url;
});

canvas.addEventListener("pointerdown", event => {
  if (!imageLoaded || !basePixels) return;
  event.preventDefault();
  points = [];
  drawing = true;
  results.hidden = true;
  canvas.setPointerCapture(event.pointerId);
  addTracePoint(event);
});

canvas.addEventListener("pointermove", event => {
  if (!drawing) return;
  event.preventDefault();
  addTracePoint(event);
});

function finishTrace(event) {
  if (!drawing) return;
  drawing = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  redrawOutline();
  updateControls();
}

canvas.addEventListener("pointerup", finishTrace);
canvas.addEventListener("pointercancel", finishTrace);

function addTracePoint(event) {
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
  const previous = points.at(-1);
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 8) return;
  points.push(point);
  redrawOutline();
  updateControls();
}

undoButton.addEventListener("click", () => { points.pop(); redrawOutline(); updateControls(); });
resetButton.addEventListener("click", () => { points = []; redrawOutline(); updateControls(); results.hidden = true; });
analyzeButton.addEventListener("click", analyze);
downloadButton.addEventListener("click", () => {
  if (!lastReport) return;
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${imageName.replace(/\.[^.]+$/, "")}_report.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

function updateControls() {
  undoButton.disabled = points.length === 0;
  resetButton.disabled = points.length === 0;
  analyzeButton.disabled = points.length < 3;
}

function redrawOutline() {
  if (!basePixels) return;
  ctx.putImageData(basePixels, 0, 0);
  if (!points.length) return;
  ctx.save();
  ctx.lineWidth = Math.max(2, canvas.width / 350);
  ctx.strokeStyle = "#ff4d35";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  if (points.length >= 3) ctx.closePath();
  ctx.stroke();
  points.forEach(point => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(4, canvas.width / 220), 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const crosses = ((a.y > y) !== (b.y > y)) &&
      (x < (b.x - a.x) * (y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return [hue, max === 0 ? 0 : delta / max, max];
}

function heatColor(value) {
  const t = Math.max(0, Math.min(1, value));
  return [Math.round(255 * t), Math.round(255 * (1 - Math.abs(2 * t - 1))), Math.round(255 * (1 - t))];
}

function analyze() {
  const source = basePixels.data;
  const output = new ImageData(canvas.width, canvas.height);
  let selected = 0, valid = 0, yellow = 0, severitySum = 0;
  const hues = [], saturations = [], brightnesses = [];

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4;
      if (!insidePolygon(x + .5, y + .5, points)) continue;
      selected++;
      const [hue, saturation, brightness] = rgbToHsv(source[offset], source[offset + 1], source[offset + 2]);
      if (saturation < .12 || brightness < .12 || brightness > .97) continue;
      valid++;
      if (hue >= 25 && hue < 95) yellow++;
      const severity = Math.max(0, Math.min(1, (95 - hue) / 40)) * saturation;
      severitySum += severity;
      hues.push(hue); saturations.push(saturation); brightnesses.push(brightness);
      const color = heatColor(severity);
      output.data[offset] = color[0]; output.data[offset + 1] = color[1]; output.data[offset + 2] = color[2]; output.data[offset + 3] = 225;
    }
  }

  if (!valid) {
    instruction.textContent = "No usable colored pixels found. Reset and select the leaf more closely.";
    return;
  }

  heatmap.width = canvas.width;
  heatmap.height = canvas.height;
  heatCtx.putImageData(basePixels, 0, 0);
  const overlay = document.createElement("canvas");
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  overlay.getContext("2d").putImageData(output, 0, 0);
  heatCtx.drawImage(overlay, 0, 0);

  lastReport = {
    image_name: imageName,
    analysis_width: canvas.width,
    analysis_height: canvas.height,
    selected_pixels: selected,
    valid_pixels: valid,
    yellowing_percent: round(yellow / valid * 100, 2),
    chlorosis_severity: round(severitySum / valid * 100, 2),
    median_hue_degrees: round(median(hues), 2),
    median_saturation: round(median(saturations), 4),
    median_brightness: round(median(brightnesses), 4),
    method: "Atav LeafColor browser baseline v0.1"
  };
  document.querySelector("#yellowPercent").textContent = `${lastReport.yellowing_percent}%`;
  document.querySelector("#severityScore").textContent = `${lastReport.chlorosis_severity}/100`;
  document.querySelector("#validPixels").textContent = valid.toLocaleString();
  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth" });
}

function median(values) {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
