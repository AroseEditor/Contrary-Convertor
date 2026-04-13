'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  currentFile: null,
  selectedFormat: null,
  converting: false,
  history: [],
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dropzone        = $('dropzone');
const fileInfoSection = $('file-info-section');
const fileTypeBadge   = $('file-type-badge');
const fileNameEl      = $('file-name');
const fileDetailsEl   = $('file-details');
const fileClearBtn    = $('file-clear-btn');
const sourceMeta      = $('source-meta');
const srcRes          = $('src-res');
const srcFps          = $('src-fps');
const srcBr           = $('src-br');
const formatSection   = $('format-section');
const formatChips     = $('format-chips');
const optionsSection  = $('options-section');
const optionsToggle   = $('options-toggle');
const optionsBody     = $('options-body');
const optImage        = $('opt-image');
const optVideo        = $('opt-video');
const optAudio        = $('opt-audio');
const qualitySlider   = $('opt-quality');
const qualityDisplay  = $('quality-display');
const qualitySliderRow = $('quality-slider-row');
const imgPresetSel    = $('opt-quality-preset-img');
const vidPresetSel    = $('opt-quality-preset-vid');
const optFix          = $('opt-fix');
const fixPlatformSel  = $('opt-fix-platform');
const convertSection  = $('convert-section');
const convertBtn      = $('convert-btn');
const progressSection = $('progress-section');
const progressBar     = $('progress-bar');
const progressLabel   = $('progress-label');
const progressPct     = $('progress-pct');
const cancelBtn       = $('cancel-btn');
const historyList     = $('history-list');
const historyClearBtn = $('history-clear-btn');

// ─── Window controls ──────────────────────────────────────────────────────────
$('btn-minimize').addEventListener('click', () => window.electronAPI.minimize());
$('btn-maximize').addEventListener('click', () => window.electronAPI.maximize());
$('btn-close').addEventListener('click',    () => window.electronAPI.close());

// ─── Clear history ────────────────────────────────────────────────────────────
historyClearBtn.addEventListener('click', () => {
  state.history = [];
  historyList.innerHTML = '<li class="history-empty">No conversions yet — drop a file to get started</li>';
});

// ─── Drag events ──────────────────────────────────────────────────────────────
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', (e) => { if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('drag-over'); });
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0].path);
});

// Click / keyboard browse
dropzone.addEventListener('click', async () => { if (!state.converting) { const p = await window.electronAPI.openFileDialog(); if (p) loadFile(p); } });
dropzone.addEventListener('keydown', async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const p = await window.electronAPI.openFileDialog(); if (p) loadFile(p); } });

fileClearBtn.addEventListener('click', (e) => { e.stopPropagation(); resetUI(); });

// ─── Load / detect file ───────────────────────────────────────────────────────
async function loadFile(filePath) {
  resetUI(false);
  try {
    const info = await window.electronAPI.detectFile(filePath);
    if (info.error) { showError('Could not read file: ' + info.error); return; }
    state.currentFile = info;
    renderFileInfo(info);
    renderFormatChips(info);
    applySourceDefaults(info);
    show(fileInfoSection); show(formatSection); show(convertSection);
  } catch (err) { showError('Detection failed: ' + err.message); }
}

// ─── Render file info ─────────────────────────────────────────────────────────
const CAT_COLORS = {
  image:'#ff7070', video:'#ff9a5a', audio:'#7bcffa',
  document:'#c0b0f8', data:'#6af8a0', spreadsheet:'#f8e060',
  archive:'#f8c660', web:'#60f8f8', text:'#f8f8f8',
};

function renderFileInfo(info) {
  fileTypeBadge.textContent = (info.ext || 'FILE').toUpperCase().slice(0, 6);
  fileTypeBadge.style.color = CAT_COLORS[info.category] || 'var(--red-300)';
  fileNameEl.textContent    = info.name;
  fileDetailsEl.textContent = `${info.mime || 'unknown'} · ${fmtBytes(info.size)}`;

  // Source media tags
  if (info.probe) {
    const p = info.probe;
    sourceMeta.style.display = 'flex';
    if (p.video) {
      srcRes.textContent = `${p.video.width}×${p.video.height}`;
      srcRes.style.display = 'inline-flex';
      if (p.video.fps) { srcFps.textContent = `${p.video.fps} fps`; srcFps.style.display = 'inline-flex'; }
      else srcFps.style.display = 'none';
    } else {
      srcRes.style.display = 'none';
      srcFps.style.display = 'none';
    }
    const br = (p.audio && p.audio.bitrate) || (p.video && p.video.bitrate) || p.bitrate;
    if (br) { srcBr.textContent = `${br} kbps`; srcBr.style.display = 'inline-flex'; }
    else srcBr.style.display = 'none';
  } else {
    sourceMeta.style.display = 'none';
  }
}

// ─── Apply source defaults ────────────────────────────────────────────────────
function applySourceDefaults(info) {
  if (!info.probe) return;
  const p = info.probe;

  if (p.video) {
    // Video resolution placeholders = source
    if (p.video.width)  $('opt-vid-width').placeholder  = `${p.video.width} (source)`;
    if (p.video.height) $('opt-vid-height').placeholder = `${p.video.height} (source)`;
    if (p.video.fps)    $('opt-framerate').placeholder  = `${p.video.fps} (source)`;
  }

  if (p.audio && p.audio.bitrate) {
    // Select closest bitrate option
    const src = p.audio.bitrate;
    const thresholds = [64, 128, 192, 256, 320];
    const closest = thresholds.reduce((a, b) => Math.abs(b - src) < Math.abs(a - src) ? b : a);
    const sel = $('opt-bitrate');
    const opt = [...sel.options].find(o => parseInt(o.value) >= closest);
    if (opt) sel.value = opt.value;
    else sel.value = '320k'; // max
  }
}

// ─── Format chips ─────────────────────────────────────────────────────────────
function renderFormatChips(info) {
  formatChips.innerHTML = '';
  state.selectedFormat = null;
  updateConvertBtn();

  if (!info.outputFormats || !info.outputFormats.length) {
    formatChips.innerHTML = '<span style="color:var(--text-faint);font-size:12px;">No conversions available for this file type.</span>';
    return;
  }

  info.outputFormats.forEach(fmt => {
    const chip = document.createElement('button');
    chip.className = 'format-chip';
    chip.textContent = fmt.toUpperCase();
    chip.dataset.format = fmt;
    chip.setAttribute('role', 'option');
    chip.setAttribute('aria-selected', 'false');
    chip.setAttribute('title', `Convert to ${fmt.toUpperCase()}`);
    chip.addEventListener('click', () => selectFormat(fmt, info.category, info.probe));
    formatChips.appendChild(chip);
  });

  // Add FIX chip for video/audio files
  if (info.category === 'video' || info.category === 'audio') {
    const fixChip = document.createElement('button');
    fixChip.className = 'format-chip format-chip-fix';
    fixChip.textContent = '🔧 FIX';
    fixChip.dataset.format = 'fix';
    fixChip.setAttribute('role', 'option');
    fixChip.setAttribute('aria-selected', 'false');
    fixChip.setAttribute('title', 'Fix compatibility for social media & mobile');
    fixChip.addEventListener('click', () => selectFormat('fix', info.category, info.probe));
    formatChips.appendChild(fixChip);
  }
}

function selectFormat(fmt, category, probe) {
  document.querySelectorAll('.format-chip').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-selected','false'); });
  const chip = [...formatChips.children].find(c => c.dataset && c.dataset.format === fmt);
  if (chip) { chip.classList.add('selected'); chip.setAttribute('aria-selected','true'); }
  state.selectedFormat = fmt;
  updateOptionsPanel(category, fmt, probe);
  updateConvertBtn();
}

// ─── Options panel ────────────────────────────────────────────────────────────
optionsToggle.addEventListener('click', () => {
  const open = optionsBody.classList.toggle('open');
  optionsToggle.setAttribute('aria-expanded', open);
});

function updateOptionsPanel(category, format, probe) {
  show(optionsSection);
  optImage.style.display = 'none';
  optVideo.style.display = 'none';
  optAudio.style.display = 'none';
  optFix.style.display   = 'none';

  const audioOnlyFmt = ['mp3','wav','ogg','flac','aac','opus'];

  if (format === 'fix') {
    // Fix mode — only show platform selection
    optFix.style.display = 'flex';
  } else if (category === 'image') {
    optImage.style.display = 'flex';
    imgPresetSel.value = 'lossless';
    qualitySliderRow.style.display = 'none';
  } else if (category === 'video') {
    if (audioOnlyFmt.includes(format)) {
      optAudio.style.display = 'flex';
      $('audio-lossless-hint').style.display = (format === 'flac' || format === 'wav') ? 'block' : 'none';
    } else {
      optVideo.style.display = 'flex';
      vidPresetSel.value = 'lossless';
    }
  } else if (category === 'audio') {
    optAudio.style.display = 'flex';
    $('audio-lossless-hint').style.display = (format === 'flac' || format === 'wav') ? 'block' : 'none';
  } else {
    hide(optionsSection);
  }
}

// ─── Quality preset dropdowns ─────────────────────────────────────────────────
const PRESET_QUALITY_MAP = { lossless: 100, high: 90, medium: 75, low: 55, verylow: 30 };

imgPresetSel.addEventListener('change', () => {
  const p = imgPresetSel.value;
  if (p === 'lossless') {
    qualitySliderRow.style.display = 'none';
    qualitySlider.value = 100;
    qualityDisplay.textContent = '100%';
    qualitySlider.style.setProperty('--pct', '100%');
  } else {
    qualitySliderRow.style.display = 'flex';
    const v = PRESET_QUALITY_MAP[p] || 75;
    qualitySlider.value = v;
    qualityDisplay.textContent = v + '%';
    qualitySlider.style.setProperty('--pct', v + '%');
  }
});

qualitySlider.addEventListener('input', () => {
  const v = qualitySlider.value;
  qualityDisplay.textContent = v + '%';
  qualitySlider.style.setProperty('--pct', v + '%');
});

// ─── Gather options ───────────────────────────────────────────────────────────
function gatherOptions() {
  // Determine which quality preset is active based on visible panel
  let qualityPreset = 'lossless';
  if (optImage.style.display !== 'none') qualityPreset = imgPresetSel.value;
  else if (optVideo.style.display !== 'none') qualityPreset = vidPresetSel.value;

  return {
    qualityPreset,
    quality:      parseInt(qualitySlider.value) || 100,
    width:        $('opt-width').value       || null,
    height:       $('opt-height').value      || null,
    bitrate:      $('opt-bitrate').value     || '320k',
    vidWidth:     $('opt-vid-width').value   || null,
    vidHeight:    $('opt-vid-height').value  || null,
    framerate:    $('opt-framerate').value   || null,
    fixPlatform:  fixPlatformSel.value       || 'whatsapp',
    sourceBitrate: (state.currentFile && state.currentFile.probe && state.currentFile.probe.audio)
      ? state.currentFile.probe.audio.bitrate : null,
  };
}

// ─── Convert ─────────────────────────────────────────────────────────────────
convertBtn.addEventListener('click', async () => {
  if (!state.currentFile || !state.selectedFormat || state.converting) return;
  state.converting = true;
  convertBtn.disabled = true;
  show(progressSection);
  setProgress(0, 'Starting…');

  window.electronAPI.removeProgressListener();
  window.electronAPI.onProgress(({ percent, message }) => setProgress(percent, message));
  window.electronAPI.onError(({ message }) => {
    state.converting = false;
    convertBtn.disabled = false;
    hide(progressSection);
    addHistoryItem({ status:'error', inputName: state.currentFile.name, outputName:'—', error: message });
    showError(message);
  });

  try {
    const result = await window.electronAPI.convertFile({
      filePath: state.currentFile.path,
      outputFormat: state.selectedFormat,
      options: gatherOptions(),
    });

    state.converting = false;
    convertBtn.disabled = false;

    if (result.error) {
      hide(progressSection);
      showError(result.error);
      addHistoryItem({ status:'error', inputName: state.currentFile.name, outputName:'—', error: result.error });
    } else {
      setProgress(100, 'Done!');
      flashSuccess();
      addHistoryItem({
        status: 'success',
        inputName:  state.currentFile.name,
        outputName: result.outputPath.split(/[\\/]/).pop(),
        outputPath: result.outputPath,
        sizeBefore: state.currentFile.size,
        sizeAfter:  result.outputSize,
      });
      setTimeout(() => hide(progressSection), 2000);
    }
  } catch (err) {
    state.converting = false;
    convertBtn.disabled = false;
    hide(progressSection);
    showError(err.message);
  }
});

cancelBtn.addEventListener('click', () => {
  state.converting = false;
  convertBtn.disabled = false;
  hide(progressSection);
  window.electronAPI.removeProgressListener();
});

// ─── History ──────────────────────────────────────────────────────────────────
function addHistoryItem(item) {
  const empty = historyList.querySelector('.history-empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.className = 'history-item';

  const icon = item.status === 'success'
    ? `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="1.5,5 3.8,7.5 8.5,2.5"/></svg>`
    : `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="1.5" y1="1.5" x2="8.5" y2="8.5"/><line x1="8.5" y1="1.5" x2="1.5" y2="8.5"/></svg>`;

  const detail = item.status === 'success' && item.sizeAfter && item.sizeBefore
    ? `${fmtBytes(item.sizeBefore)} → ${fmtBytes(item.sizeAfter)}`
    : (item.error ? item.error.slice(0, 60) : '');

  li.innerHTML = `
    <div class="history-status ${item.status}">${icon}</div>
    <div class="history-names">
      <div class="history-conversion">${esc(item.inputName || '?')} → <strong>${esc(item.outputName || '?')}</strong></div>
      <div class="history-meta">${detail}</div>
    </div>
    ${item.status === 'success' && item.outputPath ? `
    <div class="history-actions">
      <button class="history-action-btn" data-path="${esc(item.outputPath)}" data-action="open">Open</button>
      <button class="history-action-btn" data-path="${esc(item.outputPath)}" data-action="folder">Folder</button>
    </div>` : ''}
  `;

  li.querySelectorAll('.history-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.action === 'open') window.electronAPI.openFile(btn.dataset.path);
      else window.electronAPI.showInFolder(btn.dataset.path);
    });
  });

  historyList.prepend(li);
  while (historyList.children.length > 10) historyList.removeChild(historyList.lastChild);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function show(el) { el.classList.add('visible'); }
function hide(el) { el.classList.remove('visible'); }

function updateConvertBtn() {
  convertBtn.disabled = !(state.currentFile && state.selectedFormat && !state.converting);
}

function resetUI(clearFile = true) {
  if (clearFile) { state.currentFile = null; state.selectedFormat = null; }
  state.converting = false;
  dropzone.classList.remove('drag-over','file-loaded','success-flash');
  hide(fileInfoSection); hide(formatSection); hide(optionsSection); hide(progressSection);
  optionsBody.classList.remove('open');
  formatChips.innerHTML = '';
  setProgress(0, 'Converting…');
  updateConvertBtn();
  window.electronAPI.removeProgressListener();
}

function showError(msg) {
  console.error('[CC]', msg);
  progressLabel.textContent = '⚠ ' + msg.slice(0, 80);
  progressPct.textContent = 'Error';
  show(progressSection);
  setTimeout(() => hide(progressSection), 5000);
}

function setProgress(pct, msg) {
  const c = Math.min(Math.max(pct, 0), 100);
  progressBar.style.width = c + '%';
  progressLabel.textContent = msg || 'Converting…';
  progressPct.textContent = Math.round(c) + '%';
}

function flashSuccess() {
  dropzone.classList.add('success-flash');
  setTimeout(() => dropzone.classList.remove('success-flash'), 1600);
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Prevent native browser drop nav ─────────────────────────────────────────
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop',     e => e.preventDefault());
