'use strict';

const bar      = document.getElementById('setup-bar');
const track    = document.getElementById('setup-track');
const pctEl    = document.getElementById('setup-pct');
const stageEl  = document.getElementById('setup-stage');
const logEl    = document.getElementById('setup-log');

const STAGES = [
  { pct: 3,  label: 'Preparing environment…' },
  { pct: 18, label: 'Installing image processing (sharp)…' },
  { pct: 38, label: 'Installing media converter (ffmpeg)…' },
  { pct: 55, label: 'Installing document tools…' },
  { pct: 70, label: 'Installing data utilities…' },
  { pct: 85, label: 'Finalizing dependencies…' },
  { pct: 97, label: 'Almost there…' },
];

function setProgress(pct, label) {
  const clamped = Math.max(0, Math.min(100, pct));
  bar.style.width = clamped + '%';
  track.setAttribute('aria-valuenow', clamped);
  pctEl.textContent = Math.round(clamped) + '%';
  if (label) stageEl.textContent = label;
}

// Animate through fake stages while npm runs in background
let stageIdx = 0;
const STAGE_INTERVAL = 22000; // ~22 s per stage — total ~2.5 min
function advanceStage() {
  if (stageIdx >= STAGES.length) return;
  const s = STAGES[stageIdx++];
  setProgress(s.pct, s.label);
  if (stageIdx < STAGES.length) setTimeout(advanceStage, STAGE_INTERVAL);
}
advanceStage();

window.setupAPI.onStage((data) => {
  stageEl.textContent = data;
});

window.setupAPI.onProgress((line) => {
  // Show last meaningful npm output line
  const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
  if (clean && !clean.startsWith('npm warn') && !clean.startsWith('npm timing')) {
    logEl.textContent = clean.length > 80 ? clean.slice(0, 80) + '…' : clean;
  }
});

window.setupAPI.onComplete(() => {
  setProgress(100, 'Done! Launching app…');
  logEl.textContent = 'All dependencies installed successfully.';
});

window.setupAPI.onError((msg) => {
  stageEl.textContent = '⚠ Setup Failed';
  logEl.style.color = '#ff4d4d';
  logEl.textContent = msg;
  bar.style.background = '#6b0000';
});
