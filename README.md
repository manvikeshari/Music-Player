# 🎵 Aura Music Player – Setup Guide

A beautiful, offline-first Progressive Web App music player.

---

## File Structure

```
music-player/
├── index.html       ← App shell & HTML
├── style.css        ← All styles (dark glassmorphism theme)
├── app.js           ← Player logic, MediaSession, visualizer
├── db.js            ← IndexedDB wrapper for persistent library
├── sw.js            ← Service Worker (offline caching)
├── manifest.json    ← PWA manifest (install prompt)
└── icons/
    ├── icon-192.png ← App icon (192×192)
    └── icon-512.png ← App icon (512×512)
```

---

## How to Run

### Option A — Local development server (recommended)

PWAs require HTTPS or localhost. The easiest way:

**Using Python (no install needed):**
```bash
cd music-player
python3 -m http.server 8080
```
Then open: `http://localhost:8080`

**Using Node.js / npx:**
```bash
npx serve music-player
```

**Using VS Code:**
Install the "Live Server" extension → right-click `index.html` → Open with Live Server.

---

### Option B — Deploy to the web (for real install prompt)

Upload all files to any static hosting service:

| Service | How |
|---------|-----|
| **Netlify** | Drag the `music-player/` folder onto netlify.com/drop |
| **Vercel**  | `npx vercel` inside the folder |
| **GitHub Pages** | Push to a repo → Settings → Pages → root |
| **Cloudflare Pages** | Connect repo or upload folder |

All these provide free HTTPS, which is required for the install prompt and Service Worker.

---

## Installing on Your Phone

1. Open the deployed URL in **Chrome** (Android) or **Safari** (iOS).
2. **Android/Chrome:** A banner appears — tap "Add to Home Screen." Or tap the ⋮ menu → "Install App."
3. **iOS/Safari:** Tap the share icon (□↑) → "Add to Home Screen."
4. The app icon appears on your home screen and opens fullscreen, exactly like a native app.

---

## Features

| Feature | Details |
|---------|---------|
| 📁 Import | Tap **+** to import `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, etc. |
| 💾 Persistent Library | Songs stored in IndexedDB — survive app restarts |
| 🎵 Background Playback | Audio continues when phone is locked |
| 🔒 Lock Screen Controls | Play/Pause/Next/Prev on lock screen via MediaSession API |
| 🔁 Loop | Single-song repeat |
| 🔀 Shuffle | Random next song |
| 📊 Visualizer | Real-time frequency bars at the bottom |
| 🗑️ Delete | Trash icon on each song in the library |
| 🔍 Search | Filter your library instantly |
| ⌨️ Keyboard | Space=Play/Pause, →=Next, ←=Prev, L=Loop |
| 📶 Offline | Works fully offline after first load |

---

## Notes

- **Large libraries (100+ songs):** IndexedDB stores the actual audio blobs, so available disk space is the only real limit.
- **iOS Safari:** Background audio works when the phone is locked. The `playsinline` behaviour on iOS means audio keeps playing when the screen turns off.
- **CORS / file:// protocol:** The app will NOT work if you just double-click `index.html`. You must use a local server or deploy it (see above).
