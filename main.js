'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

// ─── Module state ─────────────────────────────────────────────────────────────
let MODULES_DIR = null;  // set inside app.whenReady after app.isPackaged is known
let mainWindow  = null;
let setupWindow = null;

// ─── Dynamic require helpers ──────────────────────────────────────────────────
// In development: require from project node_modules (normal)
// In production : require from user's %APPDATA%/contra-conv/cc-modules/node_modules
function r(name) {
  if (app.isPackaged && MODULES_DIR) {
    return require(path.join(MODULES_DIR, 'node_modules', name));
  }
  return require(name);
}

// For ESM-only packages (file-type v19)
async function rESM(name) {
  if (app.isPackaged && MODULES_DIR) {
    const p = path.join(MODULES_DIR, 'node_modules', name, 'index.js');
    return await import(pathToFileURL(p).href);
  }
  return await import(name);
}

// ─── Deps check ───────────────────────────────────────────────────────────────
function isDepsInstalled() {
  if (!app.isPackaged) return true;
  const marker = path.join(MODULES_DIR, '.cc-installed');
  if (!fs.existsSync(marker)) return false;
  try {
    return fs.readFileSync(marker, 'utf-8').trim() === app.getVersion();
  } catch { return false; }
}

function markDepsInstalled() {
  fs.writeFileSync(path.join(MODULES_DIR, '.cc-installed'), app.getVersion(), 'utf-8');
}

// ─── Setup window ─────────────────────────────────────────────────────────────
function createSetupWindow() {
  return new Promise((resolve) => {
    setupWindow = new BrowserWindow({
      width: 520, height: 320,
      resizable: false, frame: false,
      show: false,
      backgroundColor: '#0d0000',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'setup-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupWindow.loadFile(path.join(__dirname, 'renderer', 'setup.html'));
    setupWindow.webContents.on('did-finish-load', () => {
      setupWindow.show();
      resolve();
    });
  });
}

// ─── Find npm on the system ───────────────────────────────────────────────────
// Checks PATH first, then common Windows and macOS install locations.
function findNpm() {
  if (process.platform === 'win32') {
    const candidates = [
      // Explicit known locations (no PATH dependency)
      path.join(process.env.ProgramFiles  || 'C:\\Program Files',        'nodejs', 'npm.cmd'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'npm.cmd'),
      path.join(process.env.APPDATA       || '',  'npm', 'npm.cmd'),
      path.join(process.env.LOCALAPPDATA  || '',  'Programs', 'nodejs', 'npm.cmd'),
    ];
    for (const c of candidates) { if (fs.existsSync(c)) return c; }
    // Fall back to PATH
    try {
      const found = require('child_process')
        .execSync('where npm.cmd', { timeout: 3000, stdio: ['ignore','pipe','ignore'] })
        .toString().split('\n')[0].trim();
      if (found && fs.existsSync(found)) return found;
    } catch (_) {}
    return null;
  } else {
    // macOS / Linux — check PATH via which
    try {
      const found = require('child_process')
        .execSync('which npm', { timeout: 3000, stdio: ['ignore','pipe','ignore'] })
        .toString().trim();
      if (found) return found;
    } catch (_) {}
    // Common macOS paths (nvm, homebrew)
    for (const c of [
      '/usr/local/bin/npm',
      '/opt/homebrew/bin/npm',
      path.join(process.env.HOME || '', '.nvm', 'versions', 'node', 'current', 'bin', 'npm'),
    ]) { if (fs.existsSync(c)) return c; }
    return null;
  }
}

// ─── Install dependencies into MODULES_DIR ────────────────────────────────────
function installDependencies() {
  return new Promise((resolve, reject) => {
    const npmPath = findNpm();

    if (!npmPath) {
      // No npm/Node.js found — tell the user and open the download page
      const msg = 'Node.js is not installed on this machine.\n\n' +
        'Contrary Convertor needs Node.js to download its conversion libraries on first run.\n\n' +
        'Opening nodejs.org in your browser — install Node.js, then restart this app.';

      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('setup:error', msg);
      }
      // Open download page after short delay so UI updates first
      setTimeout(() => shell.openExternal('https://nodejs.org/en/download/'), 1500);
      reject(new Error(msg));
      return;
    }

    // Write minimal package.json
    const pkg = require('./package.json');
    fs.mkdirSync(MODULES_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(MODULES_DIR, 'package.json'),
      JSON.stringify({ name: 'cc-modules', version: pkg.version, dependencies: pkg.dependencies }, null, 2),
      'utf-8'
    );

    const child = spawn(npmPath, ['install', '--production', '--legacy-peer-deps'], {
      cwd: MODULES_DIR,
      shell: true,
      windowsHide: true,
    });

    const sendProgress = (line) => {
      if (setupWindow && !setupWindow.isDestroyed())
        setupWindow.webContents.send('setup:progress', line);
    };

    child.stdout.on('data', (d) => sendProgress(d.toString()));
    child.stderr.on('data', (d) => sendProgress(d.toString()));

    child.on('close', (code) => {
      if (code === 0) {
        markDepsInstalled();
        if (setupWindow && !setupWindow.isDestroyed())
          setupWindow.webContents.send('setup:complete');
        resolve();
      } else {
        reject(new Error(`npm install exited with code ${code}. Check your internet connection and try again.`));
      }
    });

    child.on('error', (err) => reject(err));
  });
}

// ─── Main window ──────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, height: 680,
    minWidth: 800, minHeight: 560,
    frame: false, transparent: false,
    backgroundColor: '#0d0000',
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
// --install-deps flag: NSIS calls us after file extraction to download deps
const installDepsMode = process.argv.includes('--install-deps');

app.whenReady().then(async () => {
  if (app.isPackaged) {
    MODULES_DIR = path.join(app.getPath('userData'), 'cc-modules');
    fs.mkdirSync(MODULES_DIR, { recursive: true });
  }

  // ── NSIS install-deps mode ──────────────────────────────────────────────────
  // Called by the NSIS installer after file extraction.
  // Shows the branded setup window, downloads deps, then exits cleanly.
  if (installDepsMode) {
    await createSetupWindow();
    try {
      await installDependencies();
      // Show "Done!" for a moment
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      try {
        const logPath = path.join(app.getPath('userData'), 'setup-error.log');
        fs.writeFileSync(logPath, `[${new Date().toISOString()}] ${err.message}\n${err.stack || ''}\n`, 'utf-8');
      } catch (_) {}
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('setup:error', err.message);
      }
      await new Promise(r => setTimeout(r, 10000));
    }
    app.exit(0);
    return;
  }

  // ── Normal launch ───────────────────────────────────────────────────────────
  // Fallback: if deps weren't installed by NSIS (manual install, update, etc.)
  if (!isDepsInstalled()) {
    await createSetupWindow();
    try {
      await installDependencies();
    } catch (err) {
      try {
        const logPath = path.join(app.getPath('userData'), 'setup-error.log');
        fs.writeFileSync(logPath, `[${new Date().toISOString()}] ${err.message}\n${err.stack || ''}\n`, 'utf-8');
      } catch (_) {}
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('setup:error', err.message);
      }
      await new Promise(r => setTimeout(r, 10000));
      app.quit();
      return;
    }
    await new Promise(r => setTimeout(r, 1500));
    if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.close();
      setupWindow = null;
    }
  }

  // Add user module path so require() resolves from there
  if (app.isPackaged && MODULES_DIR) {
    process.env.NODE_PATH = path.join(MODULES_DIR, 'node_modules');
    require('module')._initPaths();
  }

  createMainWindow();
});

app.on('window-all-closed', () => {
  // Don't quit if setup window is open (user closed it accidentally)
  if (setupWindow && !setupWindow.isDestroyed()) return;
  app.quit();
});
app.on('activate', () => { if (!mainWindow) createMainWindow(); });

// ─── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('win:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('win:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('win:close', () => mainWindow && mainWindow.close());

// ─── File dialog ──────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ─── Shell actions ────────────────────────────────────────────────────────────
ipcMain.handle('shell:open',       async (_e, p) => await shell.openPath(p));
ipcMain.handle('shell:showFolder', async (_e, p) => shell.showItemInFolder(p));

// ─── Category + format helpers ────────────────────────────────────────────────
function detectCategory(ext) {
  const maps = {
    image:       ['jpg','jpeg','png','webp','avif','gif','tiff','tif','bmp','svg','ico','heic'],
    video:       ['mp4','mov','avi','mkv','webm','flv','wmv','m4v'],
    audio:       ['mp3','wav','ogg','flac','aac','m4a','wma','opus'],
    document:    ['pdf','docx','doc','odt'],
    data:        ['json','csv','xml','yaml','yml','toml'],
    spreadsheet: ['xlsx','xls','ods'],
    archive:     ['zip','tar','gz'],
    web:         ['html','htm'],
    text:        ['txt','md','markdown'],
  };
  for (const [cat, exts] of Object.entries(maps)) {
    if (exts.includes(ext)) return cat;
  }
  return 'unknown';
}

function getMimeFromExt(ext) {
  const m = { jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',
    gif:'image/gif',pdf:'application/pdf',mp4:'video/mp4',mp3:'audio/mpeg',
    json:'application/json',csv:'text/csv',html:'text/html',txt:'text/plain',
    xml:'application/xml',yaml:'application/yaml',zip:'application/zip' };
  return m[ext] || 'application/octet-stream';
}

function getOutputFormats(category, ext) {
  const fmt = {
    image:       ['jpg','png','webp','avif','gif','tiff','bmp','ico'],
    video:       ['mp4','webm','mov','avi','mkv','gif','mp3'],
    audio:       ['mp3','wav','ogg','flac','aac','opus'],
    document:    { pdf:['txt','html'], docx:['pdf','html','txt'], doc:['pdf','html','txt'], odt:['pdf','html','txt'] },
    data:        ['json','csv','xml','yaml'],
    spreadsheet: ['csv','json','xlsx'],
    archive:     ['zip','tar'],
    web:         ['pdf','png'],
    text:        ['pdf','html'],
  };
  if (category === 'document') return fmt.document[ext] || fmt.document.docx;
  return (fmt[category] || []).filter(f => f !== ext);
}

// ─── ffprobe helper ───────────────────────────────────────────────────────────
function probeMedia(filePath) {
  return new Promise((resolve) => {
    try {
      const ffmpeg     = r('fluent-ffmpeg');
      const ffmpegBin  = r('ffmpeg-static');
      ffmpeg.setFfmpegPath(ffmpegBin);
      ffmpeg.ffprobe(filePath, (err, meta) => {
        if (err) { resolve(null); return; }
        const vs = meta.streams.find(s => s.codec_type === 'video');
        const as = meta.streams.find(s => s.codec_type === 'audio');

        // Parse fractional framerate "num/den"
        let fps = null;
        if (vs && vs.r_frame_rate) {
          const parts = vs.r_frame_rate.split('/');
          if (parts.length === 2 && parseInt(parts[1]) !== 0) {
            fps = Math.round((parseInt(parts[0]) / parseInt(parts[1])) * 1000) / 1000;
          }
        }

        resolve({
          duration: meta.format.duration ? Math.round(meta.format.duration) : null,
          bitrate:  meta.format.bit_rate  ? Math.round(parseInt(meta.format.bit_rate) / 1000) : null,
          video: vs ? {
            codec:  vs.codec_name,
            width:  vs.width,
            height: vs.height,
            fps,
            bitrate: vs.bit_rate ? Math.round(parseInt(vs.bit_rate) / 1000) : null,
          } : null,
          audio: as ? {
            codec:      as.codec_name,
            sampleRate: as.sample_rate,
            channels:   as.channels,
            bitrate:    as.bit_rate ? Math.round(parseInt(as.bit_rate) / 1000) : null,
          } : null,
        });
      });
    } catch (e) { resolve(null); }
  });
}

// ─── File detection ───────────────────────────────────────────────────────────
ipcMain.handle('file:detect', async (_event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    const ext  = path.extname(filePath).toLowerCase().slice(1);
    const name = path.basename(filePath);

    let mimeType = null; let detectedExt = null;
    try {
      const buf = Buffer.alloc(4100);
      const fd  = fs.openSync(filePath, 'r');
      fs.readSync(fd, buf, 0, 4100, 0);
      fs.closeSync(fd);
      const { fileTypeFromBuffer } = await rESM('file-type');
      const res = await fileTypeFromBuffer(buf);
      if (res) { mimeType = res.mime; detectedExt = res.ext; }
    } catch (_) { /* fall through */ }

    const finalExt = detectedExt || ext;
    const category = detectCategory(finalExt);

    // Probe media files for source settings
    let probe = null;
    if (category === 'video' || category === 'audio') {
      probe = await probeMedia(filePath);
    }

    return {
      path: filePath, name,
      ext: finalExt,
      size: stat.size,
      mime: mimeType || getMimeFromExt(ext),
      category,
      outputFormats: getOutputFormats(category, finalExt),
      probe,
    };
  } catch (err) { return { error: err.message }; }
});

// ─── Conversion dispatcher ────────────────────────────────────────────────────
ipcMain.handle('file:convert', async (event, { filePath, outputFormat, options }) => {
  const ext        = path.extname(filePath).toLowerCase().slice(1);
  const dir        = path.dirname(filePath);
  const base       = path.basename(filePath, path.extname(filePath));

  // Fix mode: output suffix is _fixed, always mp4
  const isFix      = outputFormat === 'fix';
  const outExt     = isFix ? 'mp4' : outputFormat;
  const outputPath = path.join(dir, `${base}_${isFix ? 'fixed' : 'converted'}.${outExt}`);

  const emit = (pct, msg) => event.sender.send('convert:progress', { percent: pct, message: msg });

  try {
    emit(0, 'Starting…');

    if (isFix) {
      await fixForPlatform(filePath, outputPath, options, emit);
    } else {
      const category = detectCategory(ext);
      switch (category) {
        case 'image':                   await convertImage(filePath, outputPath, outputFormat, options, emit); break;
        case 'video':                   await convertVideo(filePath, outputPath, outputFormat, options, emit); break;
        case 'audio':                   await convertAudio(filePath, outputPath, outputFormat, options, emit); break;
        case 'document':                await convertDocument(filePath, outputPath, outputFormat, options, emit); break;
        case 'data': case 'spreadsheet':await convertData(filePath, outputPath, outputFormat, options, emit); break;
        case 'archive':                 await convertArchive(filePath, outputPath, outputFormat, options, emit); break;
        case 'web': case 'text':        await convertWeb(filePath, outputPath, outputFormat, options, emit); break;
        default: throw new Error(`Unsupported file category: ${category}`);
      }
    }

    emit(100, 'Done!');
    const stat = fs.statSync(outputPath);
    return { success: true, outputPath, outputSize: stat.size };
  } catch (err) {
    event.sender.send('convert:error', { message: err.message });
    return { error: err.message };
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  CONVERTERS
// ═════════════════════════════════════════════════════════════════════════════

// ── Quality preset maps ───────────────────────────────────────────────────────
const QUALITY_PRESETS = {
  lossless: { jpegQ: 100, webpLossless: true,  avifLossless: true,  videoCrf: 0,  gifColors: 256 },
  high:     { jpegQ: 90,  webpLossless: false, avifLossless: false, videoCrf: 16, gifColors: 256 },
  medium:   { jpegQ: 75,  webpLossless: false, avifLossless: false, videoCrf: 23, gifColors: 192 },
  low:      { jpegQ: 55,  webpLossless: false, avifLossless: false, videoCrf: 28, gifColors: 128 },
  verylow:  { jpegQ: 30,  webpLossless: false, avifLossless: false, videoCrf: 35, gifColors: 64  },
};

// ── Platform fix specs ────────────────────────────────────────────────────────
// Each platform defines maximum-safe encoding parameters.
const PLATFORM_SPECS = {
  whatsapp:  { maxW: 1920, maxH: 1080, maxFps: 30,  crf: 23, vBitrate: '5M',   aBitrate: '128k', aRate: 44100, profile: 'main',     level: '4.0' },
  instagram: { maxW: 1920, maxH: 1080, maxFps: 30,  crf: 20, vBitrate: '8M',   aBitrate: '192k', aRate: 44100, profile: 'high',     level: '4.1' },
  youtube:   { maxW: 3840, maxH: 2160, maxFps: 60,  crf: 18, vBitrate: '20M',  aBitrate: '320k', aRate: 48000, profile: 'high',     level: '5.1' },
  discord:   { maxW: 1920, maxH: 1080, maxFps: 30,  crf: 23, vBitrate: '8M',   aBitrate: '192k', aRate: 48000, profile: 'main',     level: '4.0' },
  mobile:    { maxW: 1280, maxH: 720,  maxFps: 30,  crf: 23, vBitrate: '3M',   aBitrate: '128k', aRate: 44100, profile: 'baseline', level: '3.1' },
};

async function fixForPlatform(input, output, options, emit) {
  const platform = options.fixPlatform || 'whatsapp';
  const spec     = PLATFORM_SPECS[platform];
  if (!spec) throw new Error('Unknown platform: ' + platform);

  emit(5, 'Fixing for ' + platform + '...');

  return new Promise((resolve, reject) => {
    const ffmpeg    = r('fluent-ffmpeg');
    const ffmpegBin = r('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegBin);

    // Scale: cap to platform max, preserve aspect, ensure even dims for H.264
    var vfParts = [
      "scale='min(" + spec.maxW + ",iw)':'min(" + spec.maxH + ",ih)':force_original_aspect_ratio=decrease",
      "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "fps=" + spec.maxFps
    ];

    var bufsize = (parseInt(spec.vBitrate) * 2) + 'M';

    const cmd = ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-pix_fmt',   'yuv420p',
        '-profile:v', spec.profile,
        '-level:v',   spec.level,
        '-crf',       String(spec.crf),
        '-maxrate',   spec.vBitrate,
        '-bufsize',   bufsize,
        '-b:a',       spec.aBitrate,
        '-ar',        String(spec.aRate),
        '-ac',        '2',
        '-movflags',  '+faststart',
        '-vf',        vfParts.join(',')
      ])
      .format('mp4');

    cmd
      .on('start', function() { emit(10, 'Re-encoding for ' + platform + '...'); })
      .on('progress', function(info) {
        if (info.percent) emit(Math.min(Math.round(info.percent), 95), Math.round(info.percent) + '%');
      })
      .on('error', reject)
      .on('end', resolve)
      .save(output);
  });
}

// ── Image ─────────────────────────────────────────────────────────────────────
async function convertImage(input, output, format, options, emit) {
  const sharp = r('sharp');
  emit(10, 'Loading image…');

  let pipe = sharp(input);

  // Resize only if explicitly requested
  const w = options.width  ? parseInt(options.width)  : null;
  const h = options.height ? parseInt(options.height) : null;
  if (w || h) pipe = pipe.resize(w, h, { fit: 'inside', withoutEnlargement: true });

  // Resolve quality preset (slider value is 1-100, also used as fallback)
  const preset  = QUALITY_PRESETS[options.qualityPreset] || QUALITY_PRESETS.lossless;
  const quality = options.quality != null ? parseInt(options.quality) : preset.jpegQ;

  emit(40, 'Processing…');

  const fmtMap = {
    jpg:  () => pipe.jpeg({ quality, mozjpeg: true }).toFile(output),
    jpeg: () => pipe.jpeg({ quality, mozjpeg: true }).toFile(output),
    png:  () => pipe.png({ compressionLevel: preset.jpegQ >= 90 ? 0 : 6, adaptiveFiltering: false }).toFile(output),
    webp: () => pipe.webp(preset.webpLossless ? { lossless: true } : { quality }).toFile(output),
    avif: () => pipe.avif(preset.avifLossless ? { lossless: true } : { quality }).toFile(output),
    gif:  () => pipe.gif({ colors: preset.gifColors, dither: 1.0 }).toFile(output),
    tiff: () => pipe.tiff(preset.jpegQ >= 90 ? { compression: 'lzw' } : { quality, compression: 'jpeg' }).toFile(output),
    bmp:  () => pipe.bmp().toFile(output),
    ico:  async () => {
      const tmp = output + '.tmp.png';
      await pipe.resize(256, 256, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } }).png().toFile(tmp);
      fs.renameSync(tmp, output);
    },
  };

  emit(60, 'Converting…');
  const fn = fmtMap[format];
  if (!fn) throw new Error(`Unsupported image format: ${format}`);
  await fn();
  emit(90, 'Finalizing…');
}

// ── Video ─────────────────────────────────────────────────────────────────────
// Strategy:
//   1. Same codec family + container supports stream copy → -c copy (truly lossless)
//   2. Otherwise use lossless re-encode: H.264 CRF 0, VP9 lossless, etc.
//   Framerate: use source fps unless overridden by user
//   Resolution: use source unless overridden by user
async function convertVideo(input, output, format, options, emit) {
  return new Promise((resolve, reject) => {
    const ffmpeg    = r('fluent-ffmpeg');
    const ffmpegBin = r('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegBin);
    emit(5, 'Initialising ffmpeg…');

    // Containers that support stream-copy of H.264+AAC
    const COPY_CONTAINERS = new Set(['mp4','mkv','mov','m4v']);

    // Determine if we can stream-copy (container-only change)
    const canCopy   = COPY_CONTAINERS.has(format) && format !== 'gif' && format !== 'mp3';
    const userW     = options.vidWidth  ? parseInt(options.vidWidth)  : null;
    const userH     = options.vidHeight ? parseInt(options.vidHeight) : null;
    const userFps   = options.framerate ? parseFloat(options.framerate) : null;
    const resizeReq = !!(userW || userH || userFps);

    let cmd = ffmpeg(input);

    // Resolve CRF from quality preset before if-else chain
    const vPreset = QUALITY_PRESETS[options.qualityPreset] || QUALITY_PRESETS.lossless;
    const crf     = vPreset.videoCrf;
    const encPreset = crf === 0 ? 'ultrafast' : (crf <= 16 ? 'slow' : 'medium');

    if (format === 'mp3') {
      // Extract audio at highest quality
      cmd = cmd.noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('320k')
        .outputOptions(['-q:a', '0']);

    } else if (format === 'gif') {
      const fps   = userFps || 24;
      const scale = (userW && userH) ? `scale=${userW}:${userH}` : (userW ? `scale=${userW}:-1` : 'scale=480:-1');
      cmd = cmd.noAudio()
        .outputOptions(['-vf', `fps=${fps},${scale}:flags=lanczos`, '-loop', '0'])
        .format('gif');

    } else if (canCopy && !resizeReq && crf === 0) {
      // Pure container remux — zero re-encoding, truly lossless
      cmd = cmd.outputOptions(['-c', 'copy']);

    } else if (format === 'mp4' || format === 'mkv' || format === 'mov') {
      cmd = cmd.videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-crf', String(crf), '-preset', encPreset]);
      if (userW || userH) cmd = cmd.size(userW && userH ? `${userW}x${userH}` : (userW ? `${userW}x?` : `?x${userH}`));
      if (userFps) cmd = cmd.fps(userFps);

    } else if (format === 'webm') {
      const webmOpts = crf === 0
        ? ['-lossless', '1', '-b:v', '0']
        : ['-b:v', '0', '-crf', String(crf)];
      cmd = cmd.videoCodec('libvpx-vp9')
        .audioCodec('libopus')
        .outputOptions(webmOpts);
      if (userW || userH) cmd = cmd.size(userW && userH ? `${userW}x${userH}` : (userW ? `${userW}x?` : `?x${userH}`));
      if (userFps) cmd = cmd.fps(userFps);

    } else if (format === 'avi') {
      cmd = cmd.videoCodec('libxvid')
        .audioCodec('libmp3lame')
        .outputOptions(['-q:v', String(Math.max(1, Math.round(crf / 5))), '-q:a', '0']);
      if (userW || userH) cmd = cmd.size(userW && userH ? `${userW}x${userH}` : (userW ? `${userW}x?` : `?x${userH}`));
      if (userFps) cmd = cmd.fps(userFps);
    }

    cmd
      .on('start', () => emit(10, 'Processing video…'))
      .on('progress', (info) => {
        if (info.percent) emit(Math.min(Math.round(info.percent), 95), `${Math.round(info.percent)}%`);
      })
      .on('error', reject)
      .on('end', resolve)
      .save(output);
  });
}

// ── Audio ─────────────────────────────────────────────────────────────────────
// Lossless: FLAC, WAV (24-bit PCM); highest quality for lossy (MP3 320k q:a 0, AAC 320k)
// Source bitrate used unless overridden
async function convertAudio(input, output, format, options, emit) {
  return new Promise((resolve, reject) => {
    const ffmpeg    = r('fluent-ffmpeg');
    const ffmpegBin = r('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegBin);
    emit(5, 'Initialising audio conversion…');

    // Use source bitrate from probe if available, else best quality
    const srcBitrateK = options.sourceBitrate || null;
    const userBitrate = options.bitrate || (srcBitrateK ? `${srcBitrateK}k` : null);

    const codecMap = {
      flac: { codec: 'flac',        bitrate: null,                          extra: [] },
      wav:  { codec: 'pcm_s24le',   bitrate: null,                          extra: [] },
      ogg:  { codec: 'libvorbis',   bitrate: userBitrate || '320k',         extra: ['-q:a','10'] },
      aac:  { codec: 'aac',         bitrate: userBitrate || '320k',         extra: [] },
      opus: { codec: 'libopus',     bitrate: userBitrate || '320k',         extra: [] },
      mp3:  { codec: 'libmp3lame',  bitrate: userBitrate || '320k',         extra: ['-q:a','0'] },
    };

    const cfg = codecMap[format];
    if (!cfg) { reject(new Error(`Unsupported audio format: ${format}`)); return; }

    let cmd = ffmpeg(input).audioCodec(cfg.codec).noVideo();
    if (cfg.bitrate) cmd = cmd.audioBitrate(cfg.bitrate);
    if (cfg.extra.length) cmd = cmd.outputOptions(cfg.extra);

    cmd
      .on('start', () => emit(10, 'Processing audio…'))
      .on('progress', (info) => {
        if (info.percent) emit(Math.min(Math.round(info.percent), 95), `${Math.round(info.percent)}%`);
      })
      .on('error', reject)
      .on('end', resolve)
      .save(output);
  });
}

// ── Document ──────────────────────────────────────────────────────────────────
async function convertDocument(input, output, format, options, emit) {
  const ext = path.extname(input).toLowerCase().slice(1);
  emit(10, 'Loading document…');

  if ((ext === 'docx' || ext === 'doc') && format === 'html') {
    const mammoth = r('mammoth');
    emit(40, 'Converting DOCX → HTML…');
    const res = await mammoth.convertToHtml({ path: input });
    fs.writeFileSync(output, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body>${res.value}</body></html>`, 'utf-8');

  } else if ((ext === 'docx' || ext === 'doc') && format === 'txt') {
    const mammoth = r('mammoth');
    emit(40, 'Extracting text…');
    const res = await mammoth.extractRawText({ path: input });
    fs.writeFileSync(output, res.value, 'utf-8');

  } else if ((ext === 'docx' || ext === 'doc') && format === 'pdf') {
    const mammoth = r('mammoth');
    emit(30, 'Converting DOCX → HTML…');
    const { value } = await mammoth.convertToHtml({ path: input });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6;}</style></head><body>${value}</body></html>`;
    emit(60, 'Rendering PDF…');
    await htmlToPdf(html, output);

  } else if (ext === 'pdf' && format === 'txt') {
    emit(40, 'Extracting PDF content…');
    const { PDFDocument } = r('pdf-lib');
    const data = fs.readFileSync(input);
    const doc  = await PDFDocument.load(data);
    fs.writeFileSync(output, `PDF — ${doc.getPageCount()} page(s)\nFile: ${path.basename(input)}\n`, 'utf-8');

  } else if (ext === 'pdf' && format === 'html') {
    emit(40, 'Converting PDF → HTML…');
    const { PDFDocument } = r('pdf-lib');
    const doc  = await PDFDocument.load(fs.readFileSync(input));
    fs.writeFileSync(output, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${path.basename(input)}</title></head><body><h1>${path.basename(input)}</h1><p>${doc.getPageCount()} page(s)</p></body></html>`, 'utf-8');

  } else {
    throw new Error(`Conversion from ${ext} to ${format} is not supported.`);
  }
  emit(90, 'Finalizing…');
}

// ── Data / Spreadsheet ────────────────────────────────────────────────────────
async function convertData(input, output, format, options, emit) {
  const ext     = path.extname(input).toLowerCase().slice(1);
  const content = fs.readFileSync(input, 'utf-8');
  emit(20, 'Parsing input…');

  let data;
  if (ext === 'json') {
    data = JSON.parse(content);
  } else if (ext === 'yaml' || ext === 'yml') {
    data = r('js-yaml').load(content);
  } else if (ext === 'csv') {
    // NODE_PATH is set at startup; csv-parse/sync resolves from the right node_modules
    const { parse } = require('csv-parse/sync');
    data = parse(content, { columns: true, skip_empty_lines: true });
  } else if (ext === 'xml') {
    data = new (r('fast-xml-parser').XMLParser)({ ignoreAttributes: false }).parse(content);
  } else if (['xlsx','xls','ods'].includes(ext)) {
    const XLSX = r('xlsx');
    const wb   = XLSX.readFile(input);
    data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  } else {
    throw new Error(`Cannot parse input format: ${ext}`);
  }

  emit(60, `Writing ${format.toUpperCase()}…`);

  if (format === 'json') {
    fs.writeFileSync(output, JSON.stringify(data, null, 2), 'utf-8');
  } else if (format === 'yaml') {
    fs.writeFileSync(output, r('js-yaml').dump(data), 'utf-8');
  } else if (format === 'csv') {
    const { stringify } = require('csv-stringify/sync');
    fs.writeFileSync(output, stringify(Array.isArray(data) ? data : [data], { header: true }), 'utf-8');
  } else if (format === 'xml') {
    const b = new (r('fast-xml-parser').XMLBuilder)({ ignoreAttributes: false, format: true });
    fs.writeFileSync(output, '<?xml version="1.0" encoding="UTF-8"?>\n' + b.build({ root: Array.isArray(data) ? { item: data } : data }), 'utf-8');
  } else if (format === 'xlsx') {
    const XLSX = r('xlsx');
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Array.isArray(data) ? data : [data]), 'Sheet1');
    XLSX.writeFile(wb, output);
  } else {
    throw new Error(`Unsupported output format: ${format}`);
  }
  emit(90, 'Finalizing…');
}

// ── Archive ───────────────────────────────────────────────────────────────────
async function convertArchive(input, output, format, options, emit) {
  const ext = path.extname(input).toLowerCase().slice(1);
  emit(10, 'Preparing…');

  if (ext === 'zip') {
    const StreamZip = r('node-stream-zip');
    const zip       = new StreamZip.async({ file: input });
    const entries   = await zip.entries();
    const total     = Object.keys(entries).length;
    let done        = 0;

    if (format === 'tar') {
      const archiver   = r('archiver');
      const outStream  = fs.createWriteStream(output);
      const archive    = archiver('tar', { gzip: true });
      const extractDir = output + '_tmp';
      fs.mkdirSync(extractDir, { recursive: true });

      for (const entry of Object.values(entries)) {
        if (!entry.isDirectory) {
          const ep = path.join(extractDir, entry.name);
          fs.mkdirSync(path.dirname(ep), { recursive: true });
          await zip.extract(entry.name, ep);
        }
        emit(Math.min(Math.round((++done / total) * 50) + 5, 55), `Extracting ${done}/${total}…`);
      }
      await zip.close();

      await new Promise((res, rej) => {
        outStream.on('close', res);
        archive.on('error', rej);
        archive.pipe(outStream);
        archive.directory(extractDir, false);
        archive.finalize();
      });
      fs.rmSync(extractDir, { recursive: true, force: true });

    } else {
      // Extract to folder
      const outDir = output;
      fs.mkdirSync(outDir, { recursive: true });
      for (const entry of Object.values(entries)) {
        if (!entry.isDirectory) {
          const ep = path.join(outDir, entry.name);
          fs.mkdirSync(path.dirname(ep), { recursive: true });
          await zip.extract(entry.name, ep);
        }
        emit(Math.min(Math.round((++done / total) * 90) + 5, 95), `Extracting ${done}/${total}…`);
      }
      await zip.close();
    }
  } else {
    throw new Error('Only ZIP input is supported for archive conversion.');
  }
  emit(90, 'Finalizing…');
}

// ── Web / Text ────────────────────────────────────────────────────────────────
async function convertWeb(input, output, format, options, emit) {
  const ext     = path.extname(input).toLowerCase().slice(1);
  const content = fs.readFileSync(input, 'utf-8');
  emit(15, 'Loading source…');

  if ((ext === 'html' || ext === 'htm') && format === 'pdf') {
    emit(40, 'Rendering PDF…');
    await htmlToPdf(content, output);

  } else if ((ext === 'html' || ext === 'htm') && format === 'png') {
    emit(40, 'Taking screenshot…');
    await htmlToScreenshot(input, output);

  } else if ((ext === 'md' || ext === 'markdown') && format === 'html') {
    emit(40, 'Converting Markdown → HTML…');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.7;}code{background:#f0f0f0;padding:2px 4px;border-radius:3px;}</style></head><body>${mdToHtml(content)}</body></html>`;
    fs.writeFileSync(output, html, 'utf-8');

  } else if ((ext === 'md' || ext === 'markdown') && format === 'pdf') {
    emit(30, 'Converting Markdown → HTML…');
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.7;}</style></head><body>${mdToHtml(content)}</body></html>`;
    emit(60, 'Rendering PDF…');
    await htmlToPdf(full, output);

  } else if (ext === 'txt' && format === 'pdf') {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre style="font-family:monospace;white-space:pre-wrap;line-height:1.6;">${escHtml(content)}</pre></body></html>`;
    emit(60, 'Rendering PDF…');
    await htmlToPdf(html, output);

  } else if (ext === 'txt' && format === 'html') {
    fs.writeFileSync(output, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre>${escHtml(content)}</pre></body></html>`, 'utf-8');

  } else {
    throw new Error(`Conversion from ${ext} to ${format} is not supported.`);
  }
  emit(90, 'Finalizing…');
}

// ─── Shared utilities ─────────────────────────────────────────────────────────
async function htmlToPdf(htmlContent, outputPath) {
  try {
    const puppeteer = r('puppeteer');
    const browser   = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page      = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true,
      margin: { top:'20mm', bottom:'20mm', left:'15mm', right:'15mm' } });
    await browser.close();
  } catch (e) {
    // Fallback: pdf-lib basic
    const { PDFDocument, StandardFonts, rgb } = r('pdf-lib');
    const doc  = await PDFDocument.create();
    const pg   = doc.addPage([595,842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const text = htmlContent.replace(/<[^>]*>/g,'').slice(0,2000);
    pg.drawText(text, { x:50, y:792, size:11, font, color:rgb(0,0,0), maxWidth:495, lineHeight:16 });
    fs.writeFileSync(outputPath, await doc.save());
  }
}

async function htmlToScreenshot(inputPath, outputPath) {
  const puppeteer = r('puppeteer');
  const browser   = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page      = await browser.newPage();
  await page.setViewport({ width:1280, height:800 });
  await page.goto(`file://${inputPath}`, { waitUntil:'networkidle0' });
  await page.screenshot({ path: outputPath, fullPage:true });
  await browser.close();
}

function mdToHtml(md) {
  return md
    .replace(/^### (.+)/gm,'<h3>$1</h3>')
    .replace(/^## (.+)/gm,'<h2>$1</h2>')
    .replace(/^# (.+)/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2">$1</a>')
    .replace(/^- (.+)/gm,'<li>$1</li>')
    .replace(/\n\n/g,'</p><p>')
    .replace(/^(?!<[hplico])(.+)/gm,'<p>$1</p>');
}

function escHtml(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
