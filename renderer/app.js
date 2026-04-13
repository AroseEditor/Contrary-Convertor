'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  currentFile: null,
  selectedFormat: null,
  converting: false,
  downloading: false,
  downloadMode: false,
  threads: 4,
  ytdlpQuality: '1080',
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
const formatDropdown  = $('format-dropdown');
const formatToggle    = $('format-toggle');
const formatToggleText= $('format-toggle-text');
const formatMenu      = $('format-menu');
const formatSearch    = $('format-search');
const formatOptions   = $('format-options');
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

// Settings
const settingsOverlay = $('settings-overlay');
const settingsCloseBtn= $('settings-close-btn');
const settingsBtn     = $('btn-settings');
const threadSlider    = $('thread-slider');
const threadCount     = $('thread-count');
const githubLink      = $('github-link');

// Download mode
const downloadHint    = $('download-link-hint');
const downloadSection = $('download-section');
const downloadUrl     = $('download-url');
const downloadGoBtn   = $('download-go-btn');
const downloadBack    = $('download-back');
const dlProgressSection = $('download-progress-section');
const dlProgressBar   = $('dl-progress-bar');
const dlProgressLabel = $('dl-progress-label');
const dlSpeed         = $('dl-speed');
const dlProgressPct   = $('dl-progress-pct');
const dlDownloaded    = $('dl-downloaded');
const dlCancelBtn     = $('dl-cancel-btn');
const ytdlpQuality    = $('ytdlp-quality');
const downloadSource  = $('download-source');

// ─── Window controls ──────────────────────────────────────────────────────────
$('btn-minimize').addEventListener('click', () => window.electronAPI.minimize());
$('btn-maximize').addEventListener('click', () => window.electronAPI.maximize());
$('btn-close').addEventListener('click',    () => window.electronAPI.close());

// ─── Clear history ────────────────────────────────────────────────────────────
historyClearBtn.addEventListener('click', () => {
  state.history = [];
  historyList.innerHTML = '<li class="history-empty">No conversions yet — drop a file to get started</li>';
});

// ─── Settings panel ───────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', () => {
  settingsOverlay.classList.add('open');
});

settingsCloseBtn.addEventListener('click', () => {
  settingsOverlay.classList.remove('open');
});

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
});

threadSlider.addEventListener('input', () => {
  state.threads = parseInt(threadSlider.value);
  threadCount.textContent = threadSlider.value;
});

githubLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.openExternal('https://github.com/AroseEditor/');
});

ytdlpQuality.addEventListener('change', () => {
  state.ytdlpQuality = ytdlpQuality.value;
});

// ─── Download mode toggle ─────────────────────────────────────────────────────
downloadHint.addEventListener('click', () => {
  state.downloadMode = true;
  dropzone.style.display = 'none';
  downloadHint.style.display = 'none';
  show(downloadSection);
  downloadSource.innerHTML = '';
  downloadUrl.focus();
});

downloadUrl.addEventListener('input', () => {
  const url = downloadUrl.value.trim();
  downloadSource.innerHTML = url ? detectSourceHtml(url) : '';
});

downloadBack.addEventListener('click', () => {
  state.downloadMode = false;
  dropzone.style.display = '';
  downloadHint.style.display = '';
  hide(downloadSection);
  hide(dlProgressSection);
  downloadUrl.value = '';
});

// ─── Download handler ─────────────────────────────────────────────────────────
downloadGoBtn.addEventListener('click', startDownload);
downloadUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') startDownload(); });

async function startDownload() {
  const url = downloadUrl.value.trim();
  if (!url || state.downloading) return;

  // Ask where to save
  const savePath = await window.electronAPI.selectDownloadFolder();
  if (!savePath) return;

  state.downloading = true;
  show(dlProgressSection);
  dlProgressBar.style.width = '0%';
  dlProgressLabel.textContent = 'Starting download…';
  dlSpeed.textContent = '0 MB/s';
  dlProgressPct.textContent = '0%';
  dlDownloaded.textContent = '0 MB / ?';

  window.electronAPI.onDownloadProgress(({ percent, speed, downloaded, total, message }) => {
    const pct = Math.min(Math.max(percent || 0, 0), 100);
    dlProgressBar.style.width = pct + '%';
    dlProgressPct.textContent = Math.round(pct) + '%';
    dlProgressLabel.textContent = message || 'Downloading…';
    if (speed !== undefined) dlSpeed.textContent = (speed / (1024 * 1024)).toFixed(1) + ' MB/s';
    if (downloaded !== undefined && total !== undefined) {
      dlDownloaded.textContent = fmtBytes(downloaded) + ' / ' + fmtBytes(total);
    } else if (downloaded !== undefined) {
      dlDownloaded.textContent = fmtBytes(downloaded);
    }
  });

  try {
    const result = await window.electronAPI.downloadUrl({ url, savePath, threads: state.threads, quality: state.ytdlpQuality });
    if (result.error) {
      dlProgressLabel.textContent = '⚠ ' + result.error.slice(0, 80);
      dlSpeed.textContent = 'Error';
      addHistory({ status: 'error', error: result.error, inputName: url.slice(0, 50), outputName: '—' });
    } else {
      dlProgressBar.style.width = '100%';
      dlProgressPct.textContent = '100%';
      dlProgressLabel.textContent = 'Download complete!';
      dlSpeed.textContent = 'Done';
      const outName = result.filePath.split(/[\\/]/).pop();
      addHistory({
        status: 'success',
        inputName: url.length > 50 ? url.slice(0, 47) + '…' : url,
        outputName: outName,
        outputPath: result.filePath,
        sizeBefore: 0,
        sizeAfter: result.fileSize,
      });
      setTimeout(() => hide(dlProgressSection), 3000);
    }
  } catch (err) {
    dlProgressLabel.textContent = '⚠ ' + err.message;
    dlSpeed.textContent = 'Error';
  }

  state.downloading = false;
  window.electronAPI.removeDownloadListener();
}

dlCancelBtn.addEventListener('click', () => {
  window.electronAPI.cancelDownload();
  state.downloading = false;
  hide(dlProgressSection);
  dlProgressLabel.textContent = 'Cancelled';
  window.electronAPI.removeDownloadListener();
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
    populateDropdown(info);
    applySourceDefaults(info);
    show(fileInfoSection); show(formatSection); show(convertSection);
  } catch (err) { showError('Detection failed: ' + err.message); }
}

// ─── Render file info ─────────────────────────────────────────────────────────
function renderFileInfo(info) {
  fileTypeBadge.textContent = info.ext.toUpperCase().slice(0, 5);
  fileNameEl.textContent = info.name;
  const sizeMB = (info.size / (1024 * 1024)).toFixed(1);
  fileDetailsEl.textContent = `${info.mime} · ${sizeMB} MB`;
  dropzone.classList.add('file-loaded');

  // Source media info
  if (info.probe && (info.probe.video || info.probe.audio)) {
    sourceMeta.style.display = 'flex';
    if (info.probe.video) {
      srcRes.textContent = `${info.probe.video.width}×${info.probe.video.height}`;
      srcFps.textContent = info.probe.video.fps ? `${info.probe.video.fps} fps` : '';
      srcBr.textContent = info.probe.bitrate ? `${info.probe.bitrate} kbps` : '';
    } else if (info.probe.audio) {
      srcRes.textContent = info.probe.audio.codec || '';
      srcFps.textContent = `${info.probe.audio.sampleRate || '?'} Hz`;
      srcBr.textContent = info.probe.audio.bitrate ? `${info.probe.audio.bitrate} kbps` : '';
    }
  } else {
    sourceMeta.style.display = 'none';
  }
}

function applySourceDefaults(p) {
  if (!p.probe) return;
  if (p.probe.video) {
    if (p.probe.video.width)  $('opt-vid-width').placeholder  = `${p.probe.video.width} (source)`;
    if (p.probe.video.height) $('opt-vid-height').placeholder = `${p.probe.video.height} (source)`;
    if (p.probe.video.fps)    $('opt-framerate').placeholder  = `${p.probe.video.fps} (source)`;
  }
  if (p.probe.audio && p.probe.audio.bitrate) {
    const src = p.probe.audio.bitrate;
    const thresholds = [64, 128, 192, 256, 320];
    const closest = thresholds.reduce((a, b) => Math.abs(b - src) < Math.abs(a - src) ? b : a);
    const sel = $('opt-bitrate');
    const opt = [...sel.options].find(o => parseInt(o.value) >= closest);
    if (opt) sel.value = opt.value;
    else sel.value = '320k';
  }
}

// ─── Format descriptions for dropdown ─────────────────────────────────────────
const FORMAT_DESC = {
  // Image
  jpg:  'JPEG image', png:  'Lossless image', webp: 'Web image', avif: 'AV1 image',
  gif:  'Animated image', tiff: 'TIFF image', bmp:  'Bitmap image', ico:  'Icon file',
  // Video
  mp4:  'H.264 video', webm: 'VP9 video', mov:  'QuickTime', avi:  'Legacy video',
  mkv:  'Matroska video',
  // Audio
  mp3:  'MPEG audio', wav:  'Lossless PCM', ogg:  'Vorbis audio', flac: 'Lossless audio',
  aac:  'AAC audio', opus: 'Opus audio',
  // Document
  txt:  'Plain text', html: 'Web page', pdf:  'PDF document',
  // Data
  json: 'JSON data', csv:  'CSV spreadsheet', xml:  'XML data', yaml: 'YAML config',
  xlsx: 'Excel sheet',
  // Config
  toml: 'TOML config', env:  'Dotenv file',
  // 3D
  glb:  'glTF binary', obj:  'Wavefront OBJ', fbx:  'FBX model',
  // Special
  fix:         'Platform compatibility fix',
  'extract-text':   'Extract text content',
  'extract-images': 'Extract images from PDF',
  'extract-fonts':  'Extract embedded fonts',
  'extract':        'Extract archive contents',
};

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function populateDropdown(info) {
  formatOptions.innerHTML = '';
  state.selectedFormat = null;
  formatToggleText.textContent = 'Select output format…';
  formatToggleText.classList.remove('has-value');
  updateConvertBtn();

  if (!info.outputFormats || !info.outputFormats.length) {
    formatOptions.innerHTML = '<li class="format-option-divider">No conversions available</li>';
    return;
  }

  // Group formats by type
  const groups = {};
  info.outputFormats.forEach(fmt => {
    let group = 'Conversion';
    if (fmt.startsWith('extract')) group = 'Extraction';
    else if (fmt === 'fix') group = 'Fix';
    else if (['json','yaml','csv','xml','toml','env','xlsx'].includes(fmt)) group = 'Data / Config';
    else if (['glb','obj','fbx'].includes(fmt)) group = '3D Models';
    else if (['mp4','webm','mov','avi','mkv','gif'].includes(fmt)) group = 'Video';
    else if (['mp3','wav','ogg','flac','aac','opus'].includes(fmt)) group = 'Audio';
    else if (['jpg','png','webp','avif','tiff','bmp','ico'].includes(fmt)) group = 'Image';
    else if (['txt','html','pdf'].includes(fmt)) group = 'Document';
    if (!groups[group]) groups[group] = [];
    groups[group].push(fmt);
  });

  // Render groups
  for (const [groupName, fmts] of Object.entries(groups)) {
    const divider = document.createElement('li');
    divider.className = 'format-option-divider';
    divider.textContent = groupName;
    formatOptions.appendChild(divider);

    fmts.forEach(fmt => {
      const li = document.createElement('li');
      li.className = 'format-option';
      li.dataset.format = fmt;
      li.dataset.search = `${fmt} ${FORMAT_DESC[fmt] || ''} ${groupName}`.toLowerCase();
      li.innerHTML = `
        <span class="format-option-label">${fmt.toUpperCase()}</span>
        <span class="format-option-desc">${FORMAT_DESC[fmt] || ''}</span>
      `;
      li.addEventListener('click', () => selectFormat(fmt, info.category, info.probe));
      formatOptions.appendChild(li);
    });
  }
}

// Toggle dropdown
formatToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = formatDropdown.classList.toggle('open');
  if (isOpen) {
    formatSearch.value = '';
    filterDropdown('');
    setTimeout(() => formatSearch.focus(), 50);
  }
});

// Search filter
formatSearch.addEventListener('input', () => filterDropdown(formatSearch.value));

function filterDropdown(query) {
  const q = query.toLowerCase().trim();
  formatOptions.querySelectorAll('.format-option').forEach(opt => {
    opt.classList.toggle('hidden', q && !opt.dataset.search.includes(q));
  });
  // Hide dividers with no visible children after them
  formatOptions.querySelectorAll('.format-option-divider').forEach(div => {
    let next = div.nextElementSibling;
    let hasVisible = false;
    while (next && !next.classList.contains('format-option-divider')) {
      if (!next.classList.contains('hidden')) hasVisible = true;
      next = next.nextElementSibling;
    }
    div.style.display = hasVisible ? '' : 'none';
  });
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!formatDropdown.contains(e.target)) {
    formatDropdown.classList.remove('open');
  }
});

// Keyboard nav
formatSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    formatDropdown.classList.remove('open');
  } else if (e.key === 'Enter') {
    const visible = [...formatOptions.querySelectorAll('.format-option:not(.hidden)')];
    if (visible.length === 1) visible[0].click();
  }
});

function selectFormat(fmt, category, probe) {
  // Update dropdown display
  formatOptions.querySelectorAll('.format-option').forEach(o => o.classList.remove('selected'));
  const opt = formatOptions.querySelector(`[data-format="${fmt}"]`);
  if (opt) opt.classList.add('selected');

  formatToggleText.textContent = `${fmt.toUpperCase()} — ${FORMAT_DESC[fmt] || fmt}`;
  formatToggleText.classList.add('has-value');
  formatDropdown.classList.remove('open');

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
    optFix.style.display = 'flex';
  } else if (format.startsWith('extract')) {
    // No special options for extraction
    hide(optionsSection);
  } else if (['json','yaml','csv','xml','toml','env','xlsx'].includes(format)) {
    // No special options for data/config conversion
    hide(optionsSection);
  } else if (['glb','obj','fbx'].includes(format)) {
    // No special options for 3D
    hide(optionsSection);
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

// Quality preset → slider
if (imgPresetSel) {
  imgPresetSel.addEventListener('change', () => {
    qualitySliderRow.style.display = imgPresetSel.value === 'custom' ? 'flex' : 'none';
  });
}
if (qualitySlider) {
  qualitySlider.addEventListener('input', () => { qualityDisplay.textContent = qualitySlider.value; });
}

// ─── Convert ──────────────────────────────────────────────────────────────────
convertBtn.addEventListener('click', async () => {
  if (!state.currentFile || !state.selectedFormat || state.converting) return;
  state.converting = true;
  updateConvertBtn();
  show(progressSection);
  setProgress(0, 'Starting…');

  const options = gatherOptions();

  window.electronAPI.onProgress(({ percent, message }) => setProgress(percent, message));

  try {
    const result = await window.electronAPI.convertFile({
      filePath: state.currentFile.path,
      outputFormat: state.selectedFormat,
      options,
    });

    if (result.error) {
      showError(result.error);
      addHistory({ status: 'error', error: result.error,
        inputName: state.currentFile.name,
        outputName: '—', sizeBefore: state.currentFile.size });
    } else {
      setProgress(100, 'Done!');
      flashSuccess();
      const outName = result.outputPath.split(/[\\/]/).pop();
      addHistory({
        status: 'success',
        inputName: state.currentFile.name,
        outputName: outName,
        outputPath: result.outputPath,
        sizeBefore: state.currentFile.size,
        sizeAfter: result.outputSize,
      });
      setTimeout(() => hide(progressSection), 2000);
    }
  } catch (err) {
    showError(err.message);
  }

  state.converting = false;
  updateConvertBtn();
  window.electronAPI.removeProgressListener();
});

function gatherOptions() {
  const o = {};
  // Image
  o.width  = $('opt-img-width').value || null;
  o.height = $('opt-img-height').value || null;
  o.qualityPreset = imgPresetSel.value;
  o.quality = qualitySlider.value;
  // Video
  o.vidWidth  = $('opt-vid-width').value || null;
  o.vidHeight = $('opt-vid-height').value || null;
  o.framerate = $('opt-framerate').value || null;
  o.qualityPreset = vidPresetSel.value || imgPresetSel.value;
  // Audio
  o.bitrate = $('opt-bitrate').value;
  if (state.currentFile && state.currentFile.probe && state.currentFile.probe.audio) {
    o.sourceBitrate = state.currentFile.probe.audio.bitrate;
  }
  // Fix
  o.fixPlatform = fixPlatformSel.value;
  return o;
}

// ─── History ──────────────────────────────────────────────────────────────────
function addHistory(item) {
  state.history.unshift(item);
  if (state.history.length > 10) state.history.pop();

  // Remove empty message
  const empty = historyList.querySelector('.history-empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.className = 'history-item';

  const icon = item.status === 'success'
    ? `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 5.5L4 7.5L8 3"/></svg>`
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
  formatOptions.innerHTML = '';
  formatToggleText.textContent = 'Select output format…';
  formatToggleText.classList.remove('has-value');
  formatDropdown.classList.remove('open');
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

function detectSourceHtml(url) {
  const sources = [
    { pattern: /youtube\.com|youtu\.be/i,   name: 'YouTube',   method: 'yt-dlp' },
    { pattern: /instagram\.com/i,           name: 'Instagram', method: 'yt-dlp' },
    { pattern: /t\.me|telegram\./i,         name: 'Telegram',  method: 'yt-dlp' },
    { pattern: /tiktok\.com/i,              name: 'TikTok',    method: 'yt-dlp' },
    { pattern: /twitter\.com|x\.com/i,      name: 'Twitter/X', method: 'yt-dlp' },
    { pattern: /facebook\.com|fb\.watch/i,  name: 'Facebook',  method: 'yt-dlp' },
    { pattern: /twitch\.tv/i,               name: 'Twitch',    method: 'yt-dlp' },
    { pattern: /reddit\.com/i,              name: 'Reddit',    method: 'yt-dlp' },
    { pattern: /vimeo\.com/i,               name: 'Vimeo',     method: 'yt-dlp' },
    { pattern: /soundcloud\.com/i,          name: 'SoundCloud', method: 'yt-dlp' },
  ];

  const match = sources.find(s => s.pattern.test(url));
  let html = '';

  if (match) {
    html += `<span class="download-source-tag">${match.name}</span>`;
    html += `<span class="download-source-tag">via ${match.method}</span>`;
    const q = state.ytdlpQuality;
    const qLabel = q === 'best' ? 'Lossless' : q === 'audio' ? 'Audio Only' : q + 'p';
    html += `<span class="download-source-tag">${qLabel}</span>`;
  } else {
    // Detect file type from extension
    try {
      const u = new URL(url);
      const ext = u.pathname.split('.').pop().toLowerCase();
      const types = {
        mp4: 'Video', mkv: 'Video', avi: 'Video', mov: 'Video', webm: 'Video',
        mp3: 'Audio', flac: 'Audio', wav: 'Audio', ogg: 'Audio', aac: 'Audio',
        jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', webp: 'Image', svg: 'Image',
        zip: 'Archive', rar: 'Archive', '7z': 'Archive', tar: 'Archive',
        pdf: 'Document', exe: 'Executable', apk: 'Android App',
      };
      const type = types[ext];
      html += `<span class="download-source-tag">Direct Link</span>`;
      if (type) html += `<span class="download-source-tag">${type}</span>`;
      if (ext) html += `<span class="download-source-tag">.${ext}</span>`;
    } catch {
      html += `<span class="download-source-tag">Direct Link</span>`;
    }
    html += `<span class="download-source-tag">${state.threads} thread${state.threads > 1 ? 's' : ''}</span>`;
  }

  return html;
}
