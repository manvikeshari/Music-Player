/* app.js – Aura Music Player */
'use strict';

/* ── STATE ── */
const state = {
  songs:         [],        // { id, name, artist, duration, blob } objects from DB
  filtered:      [],        // after search filter
  currentIndex:  -1,
  isPlaying:     false,
  isLooping:     false,
  isShuffling:   false,
  currentBlobURL: null,
  audioCtx:      null,
  analyser:      null,
  source:        null,
};

/* ── DOM ── */
const $  = id => document.getElementById(id);
const el = {
  splash:        $('splash'),
  app:           $('app'),
  viewPlayer:    $('view-player'),
  viewLibrary:   $('view-library'),
  audio:         $('audioPlayer'),
  vinyl:         $('vinyl'),
  vinylWrap:     $('vinylWrap'),
  needleArm:     $('needleArm'),
  auroraRing:    $('auroraRing'),
  vinylTitle:    $('vinylTitle'),
  playerBgBlur:  $('playerBgBlur'),
  trackTitle:    $('trackTitle'),
  trackArtist:   $('trackArtist'),
  timeElapsed:   $('timeElapsed'),
  timeDuration:  $('timeDuration'),
  progressBar:   $('progressBar'),
  progressFill:  $('progressFill'),
  progressThumb: $('progressThumb'),
  btnPlayPause:  $('btnPlayPause'),
  btnPrev:       $('btnPrev'),
  btnNext:       $('btnNext'),
  btnLoop:       $('btnLoop'),
  btnShuffle:    $('btnShuffle'),
  btnImport:     $('btnImport'),
  btnOpenLib:    $('btnOpenLibrary'),
  btnCloseLib:   $('btnCloseLibrary'),
  fileInput:     $('fileInput'),
  libList:       $('libList'),
  emptyState:    $('emptyState'),
  songCount:     $('songCount'),
  searchInput:   $('searchInput'),
  visualizer:    $('visualizer'),
  toast:         $('toast'),
};

/* ── INIT ── */
async function init() {
  await loadLibrary();
  renderLibrary();
  bindEvents();
  setupMediaSession();
  setupVisualizer();
  registerServiceWorker();

  // hide splash
  setTimeout(() => {
    el.splash.classList.add('fade-out');
    el.app.classList.remove('hidden');
    setTimeout(() => el.splash.remove(), 600);
  }, 1000);
}

/* ── DB / LIBRARY ── */
async function loadLibrary() {
  state.songs    = await DB.getAllSongs();
  state.filtered = [...state.songs];
}

function renderLibrary() {
  const songs = state.filtered;
  el.songCount.textContent = `${state.songs.length} song${state.songs.length !== 1 ? 's' : ''}`;

  if (!songs.length) {
    el.libList.innerHTML = '';
    el.libList.appendChild(el.emptyState);
    el.emptyState.style.display = 'flex';
    return;
  }

  el.emptyState.style.display = 'none';

  // diff render — only rebuild if list has changed
  el.libList.innerHTML = '';

  songs.forEach((song, i) => {
    const row     = document.createElement('div');
    row.className = 'song-row' + (state.currentIndex === state.songs.indexOf(song) ? ' playing' : '');
    row.dataset.id = song.id;

    const isCurrentlyPlaying = state.songs.indexOf(song) === state.currentIndex;

    row.innerHTML = `
      <span class="song-num">${isCurrentlyPlaying && state.isPlaying
        ? `<div class="eq-bars">
            <div class="eq-bar"></div>
            <div class="eq-bar"></div>
            <div class="eq-bar"></div>
           </div>`
        : i + 1}</span>
      <div class="song-thumb">
        ${isCurrentlyPlaying
          ? `<div class="eq-bars" style="margin:auto">
               <div class="eq-bar"></div>
               <div class="eq-bar"></div>
               <div class="eq-bar"></div>
             </div>`
          : `<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`}
      </div>
      <div class="song-meta">
        <strong>${escHtml(song.name)}</strong>
        <span>${escHtml(song.artist || 'Unknown Artist')}</span>
      </div>
      <span class="song-dur">${formatTime(song.duration || 0)}</span>
      <button class="btn-delete" data-id="${song.id}" aria-label="Delete song">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;

    row.addEventListener('click', e => {
      if (e.target.closest('.btn-delete')) return;
      const globalIndex = state.songs.indexOf(song);
      playSong(globalIndex);
      showView('player');
    });

    el.libList.appendChild(row);
  });
}

/* ── IMPORT ── */
el.btnImport.addEventListener('click', () => el.fileInput.click());
el.fileInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  showLoading(`Importing ${files.length} song${files.length > 1 ? 's' : ''}…`);

  let added = 0;
  for (const file of files) {
    try {
      const duration = await getAudioDuration(file);
      const artist   = extractArtist(file.name);
      const name     = extractTitle(file.name);
      const blob     = file;

      await DB.addSong({ name, artist, duration, blob, size: file.size });
      added++;
    } catch(err) {
      console.warn('Import error for', file.name, err);
    }
  }

  hideLoading();
  await loadLibrary();
  renderLibrary();
  showToast(`${added} song${added !== 1 ? 's' : ''} added to library`);
  el.fileInput.value = '';
});

/* ── DELETE ── */
el.libList.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  e.stopPropagation();

  const id = parseInt(btn.dataset.id);
  const songIndex = state.songs.findIndex(s => s.id === id);

  // if deleting the current song, stop
  if (songIndex === state.currentIndex) {
    el.audio.pause();
    el.audio.src = '';
    if (state.currentBlobURL) { URL.revokeObjectURL(state.currentBlobURL); state.currentBlobURL = null; }
    state.isPlaying   = false;
    state.currentIndex = -1;
    setPlayingUI(false);
    el.trackTitle.textContent  = 'No song selected';
    el.trackArtist.textContent = 'Import songs to begin';
    el.vinylTitle.textContent  = '–';
  } else if (songIndex < state.currentIndex) {
    state.currentIndex--;
  }

  await DB.deleteSong(id);
  await loadLibrary();
  renderLibrary();
  showToast('Song removed');
});

/* ── PLAYBACK ── */
async function playSong(index) {
  if (index < 0 || index >= state.songs.length) return;

  const song = state.songs[index];
  state.currentIndex = index;

  // revoke old URL
  if (state.currentBlobURL) URL.revokeObjectURL(state.currentBlobURL);

  // create blob URL from stored blob
  const blob = song.blob instanceof Blob ? song.blob : new Blob([song.blob], { type: 'audio/*' });
  state.currentBlobURL = URL.createObjectURL(blob);

  el.audio.src  = state.currentBlobURL;
  el.audio.loop = state.isLooping;
  el.audio.load();

  try {
    await el.audio.play();
    state.isPlaying = true;
    setPlayingUI(true);
  } catch(err) {
    console.warn('Playback error:', err);
  }

  updateTrackInfo(song);
  updateMediaSession(song);
  renderLibrary(); // update eq bars
}

function updateTrackInfo(song) {
  el.trackTitle.textContent  = song.name;
  el.trackArtist.textContent = song.artist || 'Unknown Artist';
  el.vinylTitle.textContent  = song.name;

  // randomise bg aurora color per song
  const hue1 = (song.id * 67) % 360;
  const hue2 = (hue1 + 140) % 360;
  el.playerBgBlur.style.background = `
    radial-gradient(ellipse at 30% 40%, hsl(${hue1},70%,35%) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 70%, hsl(${hue2},80%,40%) 0%, transparent 50%)
  `;
}

function setPlayingUI(playing) {
  el.vinyl.classList.toggle('playing', playing);
  el.auroraRing.classList.toggle('playing', playing);
  el.needleArm.classList.toggle('playing', playing);
  el.btnPlayPause.querySelector('.icon-play').classList.toggle('hidden', playing);
  el.btnPlayPause.querySelector('.icon-pause').classList.toggle('hidden', !playing);
}

/* play/pause */
el.btnPlayPause.addEventListener('click', async () => {
  if (state.currentIndex === -1) {
    if (state.songs.length) await playSong(0);
    return;
  }
  if (el.audio.paused) {
    await el.audio.play();
    state.isPlaying = true;
    setPlayingUI(true);
  } else {
    el.audio.pause();
    state.isPlaying = false;
    setPlayingUI(false);
  }
  renderLibrary();
});

/* prev / next */
el.btnPrev.addEventListener('click', () => {
  if (el.audio.currentTime > 3) { el.audio.currentTime = 0; return; }
  const n = state.songs.length;
  if (!n) return;
  let idx = state.isShuffling
    ? Math.floor(Math.random() * n)
    : (state.currentIndex - 1 + n) % n;
  playSong(idx);
});

el.btnNext.addEventListener('click', () => skipNext());

function skipNext(auto = false) {
  const n = state.songs.length;
  if (!n) return;
  if (state.isLooping && auto) { el.audio.currentTime = 0; el.audio.play(); return; }
  const idx = state.isShuffling
    ? Math.floor(Math.random() * n)
    : (state.currentIndex + 1) % n;
  playSong(idx);
}

el.audio.addEventListener('ended', () => {
  if (state.isLooping) { el.audio.play(); return; }
  skipNext(true);
});

/* loop */
el.btnLoop.addEventListener('click', () => {
  state.isLooping = !state.isLooping;
  el.audio.loop   = state.isLooping;
  el.btnLoop.classList.toggle('active', state.isLooping);
  showToast(state.isLooping ? 'Loop on' : 'Loop off');
});

/* shuffle */
el.btnShuffle.addEventListener('click', () => {
  state.isShuffling = !state.isShuffling;
  el.btnShuffle.classList.toggle('active', state.isShuffling);
  showToast(state.isShuffling ? 'Shuffle on' : 'Shuffle off');
});

/* ── PROGRESS ── */
el.audio.addEventListener('timeupdate', () => {
  const { currentTime, duration } = el.audio;
  if (!duration) return;
  const pct = (currentTime / duration) * 100;
  el.progressFill.style.width = pct + '%';
  el.progressThumb.style.left  = pct + '%';
  el.timeElapsed.textContent   = formatTime(currentTime);
  el.timeDuration.textContent  = formatTime(duration);
});

el.audio.addEventListener('loadedmetadata', () => {
  el.timeDuration.textContent = formatTime(el.audio.duration);
});

/* scrub */
let scrubbing = false;

function scrubTo(e) {
  const rect = el.progressBar.getBoundingClientRect();
  const x    = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const pct  = Math.max(0, Math.min(1, x / rect.width));
  if (el.audio.duration) {
    el.audio.currentTime = pct * el.audio.duration;
  }
}

el.progressBar.addEventListener('mousedown',  e => { scrubbing = true; scrubTo(e); });
el.progressBar.addEventListener('touchstart', e => { scrubbing = true; scrubTo(e); }, { passive: true });
document.addEventListener('mousemove',  e => scrubbing && scrubTo(e));
document.addEventListener('touchmove',  e => scrubbing && scrubTo(e), { passive: true });
document.addEventListener('mouseup',   () => scrubbing = false);
document.addEventListener('touchend',  () => scrubbing = false);

/* ── VIEWS ── */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + name).classList.add('active');
}

el.btnOpenLib.addEventListener('click',  () => { renderLibrary(); showView('library'); });
el.btnCloseLib.addEventListener('click', () => showView('player'));

/* ── SEARCH ── */
el.searchInput.addEventListener('input', () => {
  const q = el.searchInput.value.trim().toLowerCase();
  state.filtered = q
    ? state.songs.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q))
    : [...state.songs];
  renderLibrary();
});

/* ── MEDIA SESSION API ── */
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play',          () => { el.audio.play(); state.isPlaying = true; setPlayingUI(true); });
  navigator.mediaSession.setActionHandler('pause',         () => { el.audio.pause(); state.isPlaying = false; setPlayingUI(false); });
  navigator.mediaSession.setActionHandler('previoustrack', () => el.btnPrev.click());
  navigator.mediaSession.setActionHandler('nexttrack',     () => skipNext());
  navigator.mediaSession.setActionHandler('seekto', e => {
    if (el.audio.duration) el.audio.currentTime = e.seekTime;
  });
}

function updateMediaSession(song) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title:  song.name,
    artist: song.artist || 'Unknown Artist',
    album:  'Aura Music',
    artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
  });
}

/* ── VISUALIZER ── */
function setupVisualizer() {
  const canvas  = el.visualizer;
  const ctx     = canvas.getContext('2d');
  let rafID;

  function resize() {
    canvas.width  = canvas.offsetWidth  * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }
  resize();
  window.addEventListener('resize', resize);

  el.audio.addEventListener('play', () => {
    if (!state.audioCtx) initAudioContext();
    drawVisualizer(ctx, canvas);
  });
  el.audio.addEventListener('pause', () => cancelAnimationFrame(rafID));
  el.audio.addEventListener('ended', () => cancelAnimationFrame(rafID));

  function drawVisualizer(ctx, canvas) {
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    ctx.clearRect(0, 0, W, H);

    if (state.analyser) {
      const bufLen = state.analyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      state.analyser.getByteFrequencyData(data);

      const barCount = 48;
      const gap      = 2;
      const barW     = (W - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const val     = data[Math.floor(i * bufLen / barCount / 2)] / 255;
        const barH    = Math.max(3, val * H * 0.9);
        const x       = i * (barW + gap);
        const y       = (H - barH) / 2;

        // gradient per bar
        const grad    = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0,   '#9B59F5');
        grad.addColorStop(.5,  '#00D4FF');
        grad.addColorStop(1,   '#9B59F5');

        ctx.fillStyle   = grad;
        ctx.globalAlpha = .85;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // fallback idle animation
      const barCount = 48;
      const gap = 2;
      const barW = (W - gap * (barCount - 1)) / barCount;
      const t = Date.now() / 600;
      for (let i = 0; i < barCount; i++) {
        const val  = (Math.sin(t + i * .3) * .5 + .5) * .3 + .05;
        const barH = val * H;
        const x    = i * (barW + gap);
        const y    = (H - barH) / 2;
        ctx.fillStyle   = 'rgba(123,47,190,0.4)';
        ctx.globalAlpha = .6;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    rafID = requestAnimationFrame(() => drawVisualizer(ctx, canvas));
  }
}

function initAudioContext() {
  try {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 256;

    if (!state.source) {
      state.source = state.audioCtx.createMediaElementSource(el.audio);
      state.source.connect(state.analyser);
      state.analyser.connect(state.audioCtx.destination);
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
  } catch(e) {
    console.warn('AudioContext init failed:', e);
  }
}

/* ── SERVICE WORKER ── */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  }
}

/* ── HELPERS ── */
function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function extractTitle(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
}

function extractArtist(filename) {
  // Try "Artist - Title" pattern
  const match = filename.match(/^(.+?)\s*[-–]\s*(.+?)\.\w+$/);
  return match ? match[1].trim() : 'Unknown Artist';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function getAudioDuration(file) {
  return new Promise(resolve => {
    const url  = URL.createObjectURL(file);
    const a    = new Audio();
    a.preload  = 'metadata';
    a.src      = url;
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(a.duration); };
    a.onerror  = () => { URL.revokeObjectURL(url); resolve(0); };
  });
}

/* toast */
let toastTimer;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2500);
}

/* loading overlay */
let loadingEl = null;
function showLoading(msg) {
  if (loadingEl) return;
  loadingEl = document.createElement('div');
  loadingEl.className = 'loading-overlay';
  loadingEl.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${escHtml(msg)}</div>`;
  document.body.appendChild(loadingEl);
}
function hideLoading() {
  if (loadingEl) { loadingEl.remove(); loadingEl = null; }
}

/* bind misc events */
function bindEvents() {
  // keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); el.btnPlayPause.click(); }
    if (e.code === 'ArrowRight') skipNext();
    if (e.code === 'ArrowLeft')  el.btnPrev.click();
    if (e.key  === 'l' || e.key === 'L') el.btnLoop.click();
  });
}

/* ── BOOT ── */
init().catch(console.error);
