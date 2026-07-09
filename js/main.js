const MEDIUM_LABELS = {
  photography: 'Photography',
  painting: 'Painting',
  drawing: 'Drawing & Illustration',
  digital: 'Digital Art',
  'graphic-design': 'Graphic Design',
};

// Each layout's grid-template pairs with an exact tile count; layouts that
// need one larger "lead" tile mark it via leadSpan (the .span-lead class
// is added to the first rendered tile). Layouts always cover 3-6 tiles so
// the collage reliably fills the space with multiple pieces.
const COLLAGE_LAYOUTS = [
  { count: 3, className: 'layout-3', leadSpan: true },
  { count: 4, className: 'layout-4' },
  { count: 5, className: 'layout-5', leadSpan: true },
  { count: 6, className: 'layout-6' },
];

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i;

document.addEventListener('DOMContentLoaded', () => {
  setNavHeightVar();
  loadPortfolioData().then((data) => {
    if (!data) return;
    renderHomeCollage(data);
    renderMediumGrids(data);
    renderWritingList(data);
    initTabs();
    initLightbox();
  });
});

window.addEventListener('resize', setNavHeightVar);

function setNavHeightVar() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  document.documentElement.style.setProperty('--nav-h', header.offsetHeight + 'px');
}

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
function renderMediumGrids(data) {
  const grids = document.querySelectorAll('.collage-grid[data-medium]');
  grids.forEach((grid) => {
    const medium = grid.dataset.medium;
    const items = medium === 'films'
      ? data.filter((e) => e.section === 'films')
      : data.filter((e) => e.section === 'visual-art' && e.medium === medium);
    grid.innerHTML = items.map(tileHtml).join('');
  });
}

function renderWritingList(data) {
  const list = document.getElementById('writingList');
  if (!list) return;

  const items = data.filter((e) => e.section === 'writing');
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

function renderHomeCollage(data) {
  const grid = document.getElementById('homeCollage');
  if (!grid) return;

  const pool = data.filter((e) => e.section === 'films' || e.section === 'visual-art');
  if (!pool.length) return;

  const eligible = COLLAGE_LAYOUTS.filter((l) => l.count <= pool.length);
  const layout = eligible[Math.floor(Math.random() * eligible.length)] || COLLAGE_LAYOUTS[0];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, layout.count);

  grid.className = 'home-collage ' + layout.className;
  grid.innerHTML = picks.map((entry, index) => {
    const lead = layout.leadSpan && index === 0 ? ' span-lead' : '';
    const target = entry.section === 'films' ? 'films.html' : 'visual-art.html';
    const meta = metaFor(entry);
    return `
      <a class="collage-item home-tile${lead}" href="${target}">
        ${mediaTag(entry)}
        <span class="collage-caption">
          <span class="cap-title">${escapeHtml(entry.title)}</span>
          <span class="cap-meta">${escapeHtml(meta)}</span>
        </span>
      </a>
    `;
  }).join('');
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
