const PREVIEW_POOL = [
  { tone: 'tone-1', ar: 'ar-portrait',  title: 'Placeholder Film Title One',      meta: 'Films',      target: 'films.html' },
  { tone: 'tone-2', ar: 'ar-wide',      title: 'Placeholder Film Title Two',      meta: 'Films',      target: 'films.html' },
  { tone: 'tone-4', ar: 'ar-square',    title: 'Placeholder Film Title One',      meta: 'Films',      target: 'films.html' },
  { tone: 'tone-2', ar: 'ar-portrait',  title: 'Placeholder Photograph One',      meta: 'Visual Art', target: 'visual-art.html' },
  { tone: 'tone-3', ar: 'ar-landscape', title: 'Placeholder Painting One',        meta: 'Visual Art', target: 'visual-art.html' },
  { tone: 'tone-1', ar: 'ar-tall',      title: 'Placeholder Drawing One',         meta: 'Visual Art', target: 'visual-art.html' },
  { tone: 'tone-6', ar: 'ar-square',    title: 'Placeholder Digital Piece One',   meta: 'Visual Art', target: 'visual-art.html' },
  { tone: 'tone-5', ar: 'ar-wide',      title: 'Placeholder Photograph Two',      meta: 'Visual Art', target: 'visual-art.html' },
];

document.addEventListener('DOMContentLoaded', () => {
  initHomePreview();
  initTabs();
  initLightbox();
});

function initHomePreview() {
  const grid = document.getElementById('previewGrid');
  if (!grid) return;

  const shuffled = [...PREVIEW_POOL].sort(() => Math.random() - 0.5);
  const count = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
  const picks = shuffled.slice(0, count);

  grid.innerHTML = picks.map((item) => `
    <a class="collage-item ${item.ar} ${item.tone}" href="${item.target}">
      <span class="collage-caption">
        <span class="cap-title">${item.title}</span>
        <span class="cap-meta">${item.meta}</span>
      </span>
    </a>
  `).join('');
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

    mediaEl.className = 'lightbox-media ' + (item.dataset.tone || '');
    mediaEl.style.aspectRatio = item.dataset.ar || '4 / 3';
    mediaEl.innerHTML = '';

    const img = item.querySelector('img');
    if (img) {
      const largeImg = document.createElement('img');
      largeImg.src = img.currentSrc || img.src;
      largeImg.alt = img.alt || '';
      mediaEl.appendChild(largeImg);
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
