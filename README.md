# ◈ Contrary Convertor

> Local-first file conversion. 50+ formats. Zero uploads. Zero limits.

![License](https://img.shields.io/badge/license-MIT-red)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/built%20with-Electron-47848F)

Contrary Convertor is a free, open-source desktop app that converts files locally — no cloud, no subscriptions, no file size caps. Drop in a file, pick your output format, convert. That's it.

## Features

- 🖼️ **Images** — JPG, PNG, WebP, AVIF, GIF, TIFF, BMP, ICO, SVG
- 🎬 **Video** — MP4, WebM, MOV, AVI, MKV, GIF, and audio extraction
- 🎵 **Audio** — MP3, WAV, FLAC, OGG, AAC, Opus
- 📄 **Documents** — PDF ↔ DOCX, HTML → PDF, Markdown → HTML/PDF
- 📊 **Data** — JSON ↔ CSV ↔ XML ↔ YAML, XLSX ↔ CSV/JSON
- 🗜️ **Archives** — ZIP, TAR, GZ (compress & extract)
- 🌐 **Web** — HTML → PDF, HTML → PNG screenshot
- 🔍 **Smart detection** — reads magic bytes, not just file extensions
- ⚡ **100% local** — your files never leave your machine

## Installation

### Download a release
→ [Releases page](../../releases) — grab the `.dmg`, `.exe`, or `.AppImage`

### Run from source
```bash
git clone https://github.com/AroseEditor/contrary-convertor.git
cd contrary-convertor
npm install
npm start
```

## Building

```bash
npm run build
```

Output goes to `dist/`. Supports Windows (NSIS installer). You can also use the Bat to make setup.

## Tech Stack

- [Electron](https://electronjs.org) — desktop shell
- [sharp](https://sharp.pixelplumbing.com) — image processing
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) + [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) — video/audio
- [mammoth](https://github.com/mwilliamson/mammoth.js) — DOCX conversion
- [pdf-lib](https://pdf-lib.js.org) — PDF manipulation
- [file-type](https://github.com/sindresorhus/file-type) — magic byte detection
- [puppeteer](https://pptr.dev) — HTML to PDF/PNG

## 🖼️ AI Background Removal
- Drop any image → select **"REMOVE-BG — AI background removal"** from the format dropdown
- **Auto-detects** subjects using on-device AI (ONNX/WASM via @imgly/background-removal-node)
- **Paint/Erase mask editor** with canvas overlay:
  - 🖌️ **Brush** — paint over areas to keep
  - 🧹 **Eraser** — erase areas from mask
  - Adjustable **brush size** slider (5–80px)
  - Crosshair cursor when painting on canvas
- **Apply & Save** button — loading animation while processing
- Saves as `originalname_removedbg.png` (transparent PNG)
- AI model downloads ~50MB on first use (cached after)

## Contributing

PRs welcome! Please open an issue first for major changes.

1. Fork the repo
2. Create your branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add: my feature'`)
4. Push (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

MIT © [Arose Editor](https://github.com/AroseEditor)**
If you liked my work you can support me by paying me on UPI ( dm me on discord ayush.ue5 )
**
