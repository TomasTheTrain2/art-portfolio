const MEDIUM_LABELS = {
  photography: 'Photography',
  painting: 'Painting',
  drawing: 'Drawing & Illustration',
  digital: 'Digital Art',
  'graphic-design': 'Graphic Design',
};

// Homepage collage always picks 3-6 tiles so it reliably fills the space
// with multiple pieces.
const COLLAGE_MIN_TILES = 3;
const COLLAGE_MAX_TILES = 6;
const COLLAGE_NARROW_BREAKPOINT = 700;
const FALLBACK_IMAGE_ASPECT = 4 / 3;
const FALLBACK_VIDEO_ASPECT = 16 / 9;
const MEDIA_LOAD_TIMEOUT_MS = 8000;

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i;

document.addEventListener('DOMContentLoaded', () => {
  loadPortfolioData().then((data) => {
    if (!data) return;
    renderHomeCollage(data);
    renderMediumGrids(data);
    renderWritingList(data);
    initTabs();
    initLightbox();
  });
});

async function loadPortfolioData() {
  try {
    const res = await fetch('data/portfolio.json');
    if (!res.ok) throw new Error('Failed to load portfolio data: ' + res.status);
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function isVideoFile(path) {
  return VIDEO_EXT_RE.test(path || '');
}

function mediaTag(entry) {
  const src = escapeHtml(entry.file);
  if (isVideoFile(entry.file)) {
    return `<video src="${src}" muted playsinline preload="metadata"></video>`;
  }
  return `<img src="${src}" alt="${escapeHtml(entry.title)}">`;
}

function metaFor(entry) {
  const label = entry.section === 'films'
    ? 'Films'
    : (MEDIUM_LABELS[entry.medium] || 'Visual Art');
  return [label, entry.year].filter(Boolean).join(' · ');
}

function tileHtml(entry) {
  const meta = metaFor(entry);
  return `
    <button type="button" class="collage-item" data-title="${escapeHtml(entry.title)}" data-meta="${escapeHtml(meta)}" data-file="${escapeHtml(entry.file)}">
      ${mediaTag(entry)}
      <span class="collage-caption">
        <span class="cap-title">${escapeHtml(entry.title)}</span>
        <span class="cap-meta">${escapeHtml(meta)}</span>
      </span>
    </button>
  `;
}

// Populates every .collage-grid[data-medium] present on the page — this
// covers both films.html (a single grid, medium="films") and
// visual-art.html (one grid per medium tab) with one pass.
function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
}

function renderMediumGrids(data) {
  const grids = document.querySelectorAll('.collage-grid[data-medium]');
  grids.forEach((grid) => {
    const medium = grid.dataset.medium;
    const items = medium === 'films'
      ? data.filter((e) => e.section === 'films')
      : data.filter((e) => e.section === 'visual-art' && e.medium === medium);
    grid.innerHTML = items.sort(byOrder).map(tileHtml).join('');
  });
}

function renderWritingList(data) {
  const list = document.getElementById('writingList');
  if (!list) return;

  const items = data.filter((e) => e.section === 'writing').sort(byOrder);
  list.innerHTML = items.map((entry) => {
    const ext = (entry.file.split('.').pop() || '').toUpperCase();
    const metaParts = [ext, entry.year].filter(Boolean);
    const metaHtml = metaParts.map((p) => `<span>${escapeHtml(p)}</span>`).join('');

    return `
      <article class="writing-entry">
        <a href="${escapeHtml(entry.file)}" target="_blank" rel="noopener">
          <h3>${escapeHtml(entry.title)}</h3>
        </a>
        <p class="description">${escapeHtml(entry.description || '')}</p>
        <div class="entry-meta">${metaHtml}</div>
      </article>
    `;
  }).join('');
}

// Resolves an entry's real aspect ratio by letting the browser load it
// (images) or read its metadata (video), so the collage layout can size
// each tile to its true shape instead of cropping to a fixed cell. Always
// resolves — a load/timeout failure just falls back to a plausible ratio
// rather than blocking the whole collage from rendering.
function loadAspectRatio(entry) {
  return new Promise((resolve) => {
    let done = false;
    function finish(aspect, mediaEl) {
      if (done) return;
      done = true;
      resolve({ entry, aspect, mediaEl });
    }

    if (isVideoFile(entry.file)) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.addEventListener('loadedmetadata', () => {
        const aspect = video.videoWidth && video.videoHeight
          ? video.videoWidth / video.videoHeight
          : FALLBACK_VIDEO_ASPECT;
        finish(aspect, video);
      });
      video.addEventListener('error', () => finish(FALLBACK_VIDEO_ASPECT, video));
      setTimeout(() => finish(FALLBACK_VIDEO_ASPECT, video), MEDIA_LOAD_TIMEOUT_MS);
      video.src = entry.file;
    } else {
      const img = new Image();
      img.addEventListener('load', () => {
        const aspect = img.naturalWidth && img.naturalHeight
          ? img.naturalWidth / img.naturalHeight
          : FALLBACK_IMAGE_ASPECT;
        finish(aspect, img);
      });
      img.addEventListener('error', () => finish(FALLBACK_IMAGE_ASPECT, img));
      setTimeout(() => finish(FALLBACK_IMAGE_ASPECT, img), MEDIA_LOAD_TIMEOUT_MS);
      img.src = entry.file;
    }
  });
}

// Every way to split `n` indices into non-empty groups (rows) — the Bell
// numbers, so 203 groupings at most for the 6 tiles the collage ever holds.
// Grouping isn't restricted to adjacent picks: which images end up sharing
// a row is exactly the lever that determines how much total row height a
// grouping produces, so considering every grouping (not just contiguous
// runs of the shuffle order) is what finds a good height match.
function allGroupings(n) {
  const results = [];
  function helper(i, groups) {
    if (i === n) {
      results.push(groups.map((g) => g.slice()));
      return;
    }
    for (const g of groups) {
      g.push(i);
      helper(i + 1, groups);
      g.pop();
    }
    groups.push([i]);
    helper(i + 1, groups);
    groups.pop();
  }
  helper(0, []);
  return results;
}

// For each grouping, computes the row heights that make every row's tiles
// exactly fill `containerW` — this is the standard "justified gallery"
// math: a row of tiles with aspect ratios a_i, given height h, has total
// width h * sum(a_i), so solving for a target width W gives h = W / sum(a_i).
// Among groupings whose total height fits within containerH (no scroll),
// picks the one that fills it most fully. If none fit — only possible with
// unusually extreme aspect ratios — falls back to the shortest grouping
// and reports a uniform scale-down so it still fits without cropping.
function pickCollageGrouping(aspects, containerW, containerH) {
  let bestFit = null;
  let globalMin = null;

  for (const groups of allGroupings(aspects.length)) {
    let totalH = 0;
    const rowHeights = groups.map((indices) => {
      const sumAspect = indices.reduce((sum, i) => sum + aspects[i], 0);
      const h = containerW / sumAspect;
      totalH += h;
      return h;
    });

    const candidate = { groups, rowHeights, totalH };
    if (totalH <= containerH && (!bestFit || totalH > bestFit.totalH)) {
      bestFit = candidate;
    }
    if (!globalMin || totalH < globalMin.totalH) {
      globalMin = candidate;
    }
  }

  const chosen = bestFit || globalMin;
  const scale = bestFit ? 1 : containerH / chosen.totalH;
  return { groups: chosen.groups, rowHeights: chosen.rowHeights, scale };
}

// Builds the final pixel geometry for each row/tile. Each row's tiles get
// integer widths that sum exactly to the row's own width (the last tile
// absorbs any rounding remainder) so nothing leaves a sub-pixel gap.
function buildCollageLayout(aspects, containerW, containerH) {
  const { groups, rowHeights, scale } = pickCollageGrouping(aspects, containerW, containerH);
  const rowTargetWidth = Math.round(containerW * scale);

  return groups.map((indices, i) => {
    const rowHeight = rowHeights[i] * scale;
    const widths = indices.map((idx) => Math.round(aspects[idx] * rowHeight));
    const remainder = rowTargetWidth - widths.reduce((a, b) => a + b, 0);
    widths[widths.length - 1] += remainder;
    return { indices, height: Math.round(rowHeight), widths };
  });
}

function combinations(arr, k) {
  const results = [];
  function helper(start, combo) {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}

// With a wide viewport and only 3-6 images, a single justified row is often
// the tallest grouping that still fits — leaving the rest of the viewport
// height unused. Which subset of the loaded candidates (and how many of
// them) is shown turns out to matter as much as how they're grouped into
// rows, so this tries every subset size from 3 up to however many were
// loaded, and every subset of that size, scoring each by how much of
// containerH its best grouping fills. Cheap: at most a few thousand tiny
// evaluations for 6 candidates, and it only runs on page load and resize.
function pickBestCollageSelection(loaded, containerW, containerH) {
  const n = loaded.length;
  const allIndices = loaded.map((_, i) => i);
  const minCount = Math.min(COLLAGE_MIN_TILES, n);

  let best = null;
  for (let k = minCount; k <= n; k++) {
    for (const indices of combinations(allIndices, k)) {
      const aspects = indices.map((i) => loaded[i].aspect);
      const { rowHeights, scale } = pickCollageGrouping(aspects, containerW, containerH);
      const totalH = rowHeights.reduce((a, b) => a + b, 0) * scale;
      const fits = scale === 1;
      const better = !best
        || (fits && !best.fits)
        || (fits === best.fits && totalH > best.totalH);
      if (better) best = { indices, totalH, fits };
    }
  }

  return best.indices.map((i) => loaded[i]);
}

function buildCollageTile(entry, mediaEl, width) {
  const a = document.createElement('a');
  a.className = 'collage-item home-tile';
  a.href = entry.section === 'films' ? 'films.html' : 'visual-art.html';
  if (width != null) a.style.width = width + 'px';

  if (mediaEl.tagName === 'IMG') mediaEl.alt = entry.title || '';
  a.appendChild(mediaEl);

  const meta = metaFor(entry);
  const caption = document.createElement('span');
  caption.className = 'collage-caption';
  caption.innerHTML = `
    <span class="cap-title">${escapeHtml(entry.title)}</span>
    <span class="cap-meta">${escapeHtml(meta)}</span>
  `;
  a.appendChild(caption);
  return a;
}

// Below COLLAGE_NARROW_BREAKPOINT a justified multi-column layout doesn't
// have room to work with, so tiles stack full-width at their natural
// height instead — still zero cropping, just no fixed-viewport-height
// constraint (the section is allowed to scroll like any other page content).
function renderNarrowCollage(grid, loaded) {
  grid.className = 'home-collage home-collage-narrow';
  grid.innerHTML = '';
  loaded.forEach(({ entry, mediaEl }) => {
    grid.appendChild(buildCollageTile(entry, mediaEl, null));
  });
}

function renderCollageLayout(grid, loaded) {
  if (window.innerWidth <= COLLAGE_NARROW_BREAKPOINT) {
    renderNarrowCollage(grid, loaded);
    return;
  }

  const header = document.querySelector('.site-header');
  const navH = header ? header.offsetHeight : 0;
  const containerW = document.documentElement.clientWidth;
  const containerH = window.innerHeight - navH;

  const selected = pickBestCollageSelection(loaded, containerW, containerH);
  const aspects = selected.map((l) => l.aspect);
  const rows = buildCollageLayout(aspects, containerW, containerH);

  grid.className = 'home-collage';
  grid.innerHTML = '';
  rows.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'collage-row';
    rowEl.style.height = row.height + 'px';
    row.indices.forEach((idx, i) => {
      const { entry, mediaEl } = selected[idx];
      rowEl.appendChild(buildCollageTile(entry, mediaEl, row.widths[i]));
    });
    grid.appendChild(rowEl);
  });
}

async function renderHomeCollage(data) {
  const grid = document.getElementById('homeCollage');
  if (!grid) return;

  const pool = data.filter((e) => e.section === 'films' || e.section === 'visual-art');
  if (!pool.length) return;

  // Loads up to COLLAGE_MAX_TILES candidates; renderCollageLayout then picks
  // whichever subset (3 to however many loaded) and grouping best fills the
  // viewport, so the fetched pool is a ceiling, not the final tile count.
  const candidateCount = Math.min(COLLAGE_MAX_TILES, pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const candidates = shuffled.slice(0, candidateCount);

  const loaded = await Promise.all(candidates.map(loadAspectRatio));
  renderCollageLayout(grid, loaded);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderCollageLayout(grid, loaded), 150);
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;

      tabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      document.querySelectorAll('.collage-grid').forEach((grid) => {
        const isTarget = grid.dataset.medium === target;
        grid.classList.toggle('is-active', isTarget);
        grid.hidden = !isTarget;
      });
    });
  });
}

function initLightbox() {
  // Scoped to <button> tiles only, so the homepage's <a> preview links
  // (which navigate to films.html/visual-art.html) never trigger it.
  const items = document.querySelectorAll('button.collage-item');
  if (!items.length) return;

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.hidden = true;
  lightbox.innerHTML = `
    <div class="lightbox-scrim" data-action="close"></div>
    <button type="button" class="lightbox-close" data-action="close" aria-label="Close">&times;</button>
    <button type="button" class="lightbox-prev" data-action="prev" aria-label="Previous piece">&larr;</button>
    <button type="button" class="lightbox-next" data-action="next" aria-label="Next piece">&rarr;</button>
    <figure class="lightbox-content">
      <div class="lightbox-media"></div>
      <figcaption class="lightbox-caption">
        <span class="lightbox-title"></span>
        <span class="lightbox-meta"></span>
      </figcaption>
    </figure>
  `;
  document.body.appendChild(lightbox);

  const mediaEl = lightbox.querySelector('.lightbox-media');
  const titleEl = lightbox.querySelector('.lightbox-title');
  const metaEl = lightbox.querySelector('.lightbox-meta');

  let currentGroup = [];
  let currentIndex = 0;

  function render() {
    const item = currentGroup[currentIndex];
    if (!item) return;

    mediaEl.innerHTML = '';
    const file = item.dataset.file || '';

    if (isVideoFile(file)) {
      const video = document.createElement('video');
      video.src = file;
      video.controls = true;
      video.playsInline = true;
      mediaEl.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = file;
      img.alt = item.dataset.title || '';
      mediaEl.appendChild(img);
    }

    titleEl.textContent = item.dataset.title || '';
    metaEl.textContent = item.dataset.meta || '';
  }

  function open(group, index) {
    currentGroup = group;
    currentIndex = index;
    render();
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
  }

  function close() {
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    mediaEl.innerHTML = '';
  }

  function step(delta) {
    if (!currentGroup.length) return;
    currentIndex = (currentIndex + delta + currentGroup.length) % currentGroup.length;
    render();
  }

  items.forEach((item) => {
    item.addEventListener('click', () => {
      const grid = item.closest('.collage-grid');
      const group = Array.from(grid.querySelectorAll('button.collage-item'));
      open(group, group.indexOf(item));
    });
  });

  lightbox.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (action === 'close') close();
    if (action === 'prev') step(-1);
    if (action === 'next') step(1);
  });

  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  });
}
