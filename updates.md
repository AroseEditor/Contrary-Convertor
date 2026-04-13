# Contrary Convertor — Updates (April 13, 2026)

## 🎨 UI Overhaul — Hacker Theme
- Complete redesign with **red + black gradient** aesthetic
- **CRT scanline overlay** with animated scroll effect
- **Glitch animation** on logo text
- **Matrix binary text** background in dropzone
- **Monospace typography** (`Share Tech Mono`) across all UI
- Pulsing red glow on logo hexagon

## 📂 Searchable Format Dropdown
- Replaced format selection chips with a **single searchable dropdown**
- Formats grouped by category: Image, Video, Audio, Data/Config, 3D, Extraction, Fix
- Type to filter, scroll to browse — keyboard navigation support

## 🔧 New Conversion Formats

### Fonts
- **TTF ↔ OTF** conversion via opentype.js
- Font metadata extraction (family, glyphs, version, designer, license)

### Dev / Config
- **JSON ↔ YAML ↔ TOML ↔ .env** bidirectional conversion
- Auto-flattening for nested objects → .env keys

### 3D Models
- **OBJ → GLB** (via obj2gltf)
- **GLB → OBJ** (custom mesh parser with vertex + face extraction)
- **FBX → GLB** (via fbx2gltf binary, if available)

### Game Archives
- **.pak** — Unreal Engine 4 (v1–v4) and UE5 (v11+) extraction
- **.rpf** — Rockstar RAGE (GTA V / RDR2) best-effort extraction
- **.wad** — Doom IWAD/PWAD lump extraction
- **.obb** — Android OBB (ZIP-based) extraction

### Text / OCR Extraction
- **Extract text** from PDF, DOCX, XLSX, HTML, and any text file
- **OCR from images** — JPG, PNG, WebP, BMP, TIFF via Tesseract.js
- **Extract images from PDF** — renders each page as PNG
- **Extract fonts from PDF** — lists font names + extracts embedded TTF/OTF files

### PDF Improvements
- PDF → TXT now uses pdf-parse for actual text extraction (with pdf-lib fallback)

## ⚙️ Settings Panel
- **Gear icon** (⚙) in top-right titlebar
- Slide-in panel showing:
  - **Developer**: Ayush.ue5
  - **GitHub**: github.com/AroseEditor/ (hyperlink, opens in browser)
  - **Download Threads** slider (1–16 parallel connections)
  - **yt-dlp Quality** preset (Best/Lossless, 1080p, 720p, 480p, 360p, Audio Only)

## ⬇️ URL Download Mode
- **"Want to download a link?"** clickable text below dropzone
- Switches UI to **URL input bar** — paste any link and download
- **Source detection** — shows badges identifying the source (YouTube, Instagram, Telegram, etc.), download method (yt-dlp / Direct), and quality preset
- Supported sources via **yt-dlp** (auto-downloaded on first use):
  - YouTube, Instagram, TikTok, Twitter/X, Facebook, Telegram, Twitch, Reddit, Vimeo, SoundCloud
- **Direct link downloads** — multi-threaded with configurable parallel connections
- **Progress display** — real-time percent, MB/s speed, downloaded/total bytes
- **Cancel** button to abort any download
- Quality presets applied to yt-dlp: lossless, 1080p, 720p, 480p, 360p, audio-only
- Output format: MP4 for video, MP3 for audio-only

## 🏗️ Build & Packaging
- GitHub Actions workflow for macOS builds (DMG)
- Linux AppImage build support
- All new dependencies added to package.json
