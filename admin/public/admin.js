const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i;
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

// Matches the medium order used on the public site (js/main.js MEDIUM_LABELS)
// so group order in the admin list lines up with what visitors see.
const MEDIUM_ORDER = ['photography', 'painting', 'drawing', 'digital', 'graphic-design'];

let mediums = [];
let entries = [];

document.addEventListener('DOMContentLoaded', () => {
  loadEntries();
  wireUploadForm();
  wirePublish();
});

async function loadEntries() {
  const res = await fetch('/api/entries');
  const data = await res.json();
  entries = data.entries || [];
  mediums = data.mediums || [];
  populateMediumSelect(document.getElementById('mediumSelect'));
  renderEntries();
}

function titleFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  return base
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function mediumLabel(medium) {
  return medium
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function populateMediumSelect(select) {
  const current = select.value;
  select.innerHTML = mediums.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(mediumLabel(m))}</option>`).join('');
  if (mediums.includes(current)) select.value = current;
}

function wireUploadForm() {
  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('fileInput');
  const sectionSelect = document.getElementById('sectionSelect');
  const mediumField = document.getElementById('mediumField');
  const titleInput = document.getElementById('titleInput');
  const statusEl = document.getElementById('uploadStatus');

  function syncMediumVisibility() {
    mediumField.hidden = sectionSelect.value !== 'visual-art';
  }
  sectionSelect.addEventListener('change', syncMediumVisibility);
  syncMediumVisibility();

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && !titleInput.value) {
      titleInput.value = titleFromFilename(file.name);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.hidden = true;

    const formData = new FormData(form);
    if (sectionSelect.value !== 'visual-art') {
      formData.delete('medium');
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      showStatus(statusEl, `Uploaded "${data.entry.title}".`, 'success');
      form.reset();
      syncMediumVisibility();
      await loadEntries();
    } catch (err) {
      showStatus(statusEl, err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function showStatus(el, message, kind) {
  el.textContent = message;
  el.className = 'status ' + kind;
  el.hidden = false;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function thumbHtml(entry) {
  if (IMAGE_EXT_RE.test(entry.file)) {
    return `<img class="entry-thumb" src="/${escapeHtml(entry.file)}" alt="">`;
  }
  if (VIDEO_EXT_RE.test(entry.file)) {
    return `<video class="entry-thumb" src="/${escapeHtml(entry.file)}" muted preload="metadata"></video>`;
  }
  const ext = (entry.file.split('.').pop() || '').toUpperCase();
  return `<div class="entry-thumb placeholder">${escapeHtml(ext)}</div>`;
}

function groupKey(entry) {
  return entry.section === 'visual-art' ? `visual-art:${entry.medium}` : entry.section;
}

function groupLabel(key) {
  if (key === 'films') return 'Films';
  if (key === 'writing') return 'Writing';
  const medium = key.split(':')[1];
  return `Visual Art — ${mediumLabel(medium)}`;
}

// Groups entries the same way the public site sections/tabs do, each sorted
// by its order field, so up/down here maps directly onto display order.
function groupedEntries() {
  const byKey = new Map();
  entries.forEach((entry) => {
    const key = groupKey(entry);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(entry);
  });
  byKey.forEach((items) => items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));

  const orderedMediums = [
    ...MEDIUM_ORDER.filter((m) => mediums.includes(m)),
    ...mediums.filter((m) => !MEDIUM_ORDER.includes(m)).sort(),
  ];
  const keyOrder = ['films', ...orderedMediums.map((m) => `visual-art:${m}`), 'writing'];

  return keyOrder
    .filter((key) => byKey.has(key))
    .map((key) => ({ key, label: groupLabel(key), items: byKey.get(key) }));
}

function entryCardHtml(entry, position) {
  return `
    <div class="entry-card" data-id="${escapeHtml(entry.id)}">
      <div class="position-field">
        <label>
          Position
          <input type="number" class="position-input" min="1" step="1" value="${position + 1}">
        </label>
      </div>
      ${thumbHtml(entry)}
      <div class="entry-fields">
        <input type="text" class="field-title" value="${escapeHtml(entry.title)}" placeholder="Title">
        <textarea class="field-description" rows="2" placeholder="Description">${escapeHtml(entry.description || '')}</textarea>
        <div class="row">
          <select class="field-section">
            <option value="films"${entry.section === 'films' ? ' selected' : ''}>Films</option>
            <option value="visual-art"${entry.section === 'visual-art' ? ' selected' : ''}>Visual Art</option>
            <option value="writing"${entry.section === 'writing' ? ' selected' : ''}>Writing</option>
          </select>
          <select class="field-medium"${entry.section === 'visual-art' ? '' : ' hidden'}>
            ${mediums.map((m) => `<option value="${escapeHtml(m)}"${entry.medium === m ? ' selected' : ''}>${escapeHtml(mediumLabel(m))}</option>`).join('')}
          </select>
        </div>
        <div class="file-path">${escapeHtml(entry.file)}</div>
      </div>
      <div class="entry-actions">
        <button type="button" class="secondary save-btn">Save</button>
        <button type="button" class="danger delete-btn">Delete</button>
      </div>
    </div>
  `;
}

function renderEntries() {
  const list = document.getElementById('entriesList');
  document.getElementById('entryCount').textContent = entries.length;

  const groups = groupedEntries();
  list.innerHTML = groups.map((group) => `
    <div class="entry-group" data-group-key="${escapeHtml(group.key)}">
      <div class="entry-group-header">
        <h3 class="entry-group-label">${escapeHtml(group.label)}</h3>
        <button type="button" class="secondary save-order-btn">Save Order</button>
      </div>
      ${group.items.map((entry, i) => entryCardHtml(entry, i)).join('')}
    </div>
  `).join('');

  list.querySelectorAll('.entry-group').forEach((groupEl) => {
    groupEl.querySelector('.save-order-btn').addEventListener('click', () => saveGroupOrder(groupEl));
  });

  list.querySelectorAll('.entry-card').forEach((card) => {
    const id = card.dataset.id;
    const sectionSelect = card.querySelector('.field-section');
    const mediumSelect = card.querySelector('.field-medium');

    sectionSelect.addEventListener('change', () => {
      mediumSelect.hidden = sectionSelect.value !== 'visual-art';
    });

    card.querySelector('.save-btn').addEventListener('click', () => saveEntry(id, card));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteEntry(id));
  });
}

async function updateOrder(id, order) {
  const res = await fetch(`/api/entries/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Failed to update order');
  }
}

// Reads every position number currently typed into this group's cards,
// re-sorts by that number (ties broken by each card's current on-screen
// order, so untouched entries keep their relative place), and reassigns
// clean sequential order values (0, 1, 2, ...) rather than saving the
// typed numbers verbatim — typed values can have gaps or duplicates, but
// the stored order field should always be a clean sequence.
async function saveGroupOrder(groupEl) {
  const btn = groupEl.querySelector('.save-order-btn');
  const cards = [...groupEl.querySelectorAll('.entry-card')];

  const items = cards.map((card, originalIndex) => {
    const id = card.dataset.id;
    const entry = entries.find((e) => e.id === id);
    const raw = parseInt(card.querySelector('.position-input').value, 10);
    const typedPosition = Number.isFinite(raw) ? raw : originalIndex + 1;
    return { entry, typedPosition, originalIndex };
  });

  items.sort((a, b) => a.typedPosition - b.typedPosition || a.originalIndex - b.originalIndex);

  btn.disabled = true;
  try {
    await Promise.all(items.map((item, newOrder) => {
      if (item.entry.order === newOrder) return null;
      return updateOrder(item.entry.id, newOrder);
    }));
  } catch (err) {
    alert('Save order failed: ' + err.message);
  } finally {
    btn.disabled = false;
  }

  await loadEntries();
}

async function saveEntry(id, card) {
  const payload = {
    title: card.querySelector('.field-title').value,
    description: card.querySelector('.field-description').value,
    section: card.querySelector('.field-section').value,
    medium: card.querySelector('.field-medium').value,
  };

  const res = await fetch(`/api/entries/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    alert('Save failed: ' + (data.error || 'unknown error'));
    return;
  }
  await loadEntries();
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry from the catalog? The underlying file is left on disk.')) {
    return;
  }
  const res = await fetch(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    alert('Delete failed: ' + (data.error || 'unknown error'));
    return;
  }
  await loadEntries();
}

function wirePublish() {
  const publishBtn = document.getElementById('publishBtn');
  const confirmBox = document.getElementById('publishConfirm');
  const confirmBtn = document.getElementById('confirmPublishBtn');
  const cancelBtn = document.getElementById('cancelPublishBtn');
  const output = document.getElementById('publishOutput');

  publishBtn.addEventListener('click', () => {
    confirmBox.hidden = false;
  });

  cancelBtn.addEventListener('click', () => {
    confirmBox.hidden = true;
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBox.hidden = true;
    output.hidden = false;
    output.textContent = 'Publishing…';

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });
      const data = await res.json();
      output.textContent = formatPublishSteps(data.steps || []);
      if (!res.ok || !data.ok) {
        output.textContent += '\n\nPublish failed — see output above.';
      }
    } catch (err) {
      output.textContent = 'Publish failed: ' + err.message;
    }
  });
}

function formatPublishSteps(steps) {
  return steps.map((step) => {
    const lines = [`$ ${step.command}`];
    if (step.stdout) lines.push(step.stdout.trim());
    if (step.stderr) lines.push(step.stderr.trim());
    if (step.note) lines.push(step.note);
    lines.push(step.ok ? '(ok)' : '(failed)');
    return lines.join('\n');
  }).join('\n\n');
}
