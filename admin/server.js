'use strict';

// Local-only admin tool for managing the portfolio's content.
//
// Run with: node admin/server.js   ->  http://localhost:3000
//
// Uses only Node's built-in modules (http, fs, path, crypto, child_process,
// url) — no npm install required. This file (and everything under admin/)
// is never executed by GitHub Pages: Pages only serves static files, so at
// most the raw source of this script would be servable as inert text if a
// visitor requested its URL directly. It stores no credentials — the
// "Publish" button below shells out to the `git` binary and relies entirely
// on whatever git/GitHub auth is already configured on this machine.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const ASSETS_ROOT = path.join(REPO_ROOT, 'assets');
const VISUAL_ART_ROOT = path.join(ASSETS_ROOT, 'visual-art');
const DATA_FILE = path.join(REPO_ROOT, 'data', 'portfolio.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const PORT = 3000;
const HOST = '127.0.0.1';
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024; // keep uploads well under GitHub's 100MB hard file limit

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

const STATIC_ROUTES = {
  '/': 'index.html',
  '/admin.css': 'admin.css',
  '/admin.js': 'admin.js',
};

function mimeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (maxBytes && total > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Minimal multipart/form-data parser (Node's http module doesn't parse this
// itself, and we're not allowed to reach for an npm package like multer).
// Operates entirely on Buffers so binary file data is never corrupted by a
// string round-trip.
// ---------------------------------------------------------------------------
function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!boundaryMatch) return [];
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryBuf = Buffer.from('--' + boundary);

  const parts = [];
  let start = buffer.indexOf(boundaryBuf);
  while (start !== -1) {
    const nextStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextStart === -1) break;

    let partBuf = buffer.slice(start + boundaryBuf.length, nextStart);
    if (partBuf.slice(0, 2).toString('latin1') === '\r\n') partBuf = partBuf.slice(2);
    if (partBuf.slice(-2).toString('latin1') === '\r\n') partBuf = partBuf.slice(0, -2);

    if (partBuf.length > 0) {
      const headerEnd = partBuf.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const headerStr = partBuf.slice(0, headerEnd).toString('utf8');
        const data = partBuf.slice(headerEnd + 4);
        const nameMatch = /name="([^"]*)"/i.exec(headerStr);
        const filenameMatch = /filename="([^"]*)"/i.exec(headerStr);
        const typeMatch = /Content-Type:\s*(.+)/i.exec(headerStr);
        parts.push({
          name: nameMatch ? nameMatch[1] : null,
          filename: filenameMatch ? filenameMatch[1] : null,
          contentType: typeMatch ? typeMatch[1].trim() : null,
          data,
        });
      }
    }
    start = nextStart;
  }
  return parts;
}

function fieldValue(parts, name) {
  const part = parts.find((p) => p.name === name && p.filename == null);
  return part ? part.data.toString('utf8') : '';
}

// ---------------------------------------------------------------------------
// Filename helpers (mirrors the rules used by the one-time import)
// ---------------------------------------------------------------------------
function slugifyBase(name) {
  const stripped = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'file';
}

function uniqueFilename(dir, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const base = slugifyBase(path.basename(originalName, path.extname(originalName)));
  let candidate = `${base}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

function targetDir(section, medium) {
  if (section === 'films') return path.join(ASSETS_ROOT, 'films');
  if (section === 'writing') return path.join(ASSETS_ROOT, 'writing');
  if (section === 'visual-art') return path.join(VISUAL_ART_ROOT, medium || '');
  return null;
}

function listMediums() {
  if (!fs.existsSync(VISUAL_ART_ROOT)) return [];
  return fs.readdirSync(VISUAL_ART_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// ---------------------------------------------------------------------------
// data/portfolio.json read/write
// ---------------------------------------------------------------------------
function readEntries() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return raw.trim() ? JSON.parse(raw) : [];
}

function writeEntries(entries) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
function handleGetEntries(req, res) {
  sendJson(res, 200, { entries: readEntries(), mediums: listMediums() });
}

async function handleUpload(req, res) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return sendJson(res, 400, { ok: false, error: 'Expected multipart/form-data' });
  }

  let body;
  try {
    body = await readBody(req, MAX_UPLOAD_BYTES);
  } catch (err) {
    return sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.statusCode === 413
        ? `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit`
        : 'Failed to read upload',
    });
  }

  const parts = parseMultipart(body, contentType);
  const filePart = parts.find((p) => p.name === 'file' && p.filename);
  if (!filePart || !filePart.data.length) {
    return sendJson(res, 400, { ok: false, error: 'No file provided' });
  }

  const section = fieldValue(parts, 'section');
  const medium = fieldValue(parts, 'medium') || null;
  const title = fieldValue(parts, 'title').trim();
  const description = fieldValue(parts, 'description').trim();

  if (!['films', 'visual-art', 'writing'].includes(section)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid section' });
  }
  if (section === 'visual-art' && !listMediums().includes(medium)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid or missing medium' });
  }
  if (!title) {
    return sendJson(res, 400, { ok: false, error: 'Title is required' });
  }

  const dir = targetDir(section, medium);
  fs.mkdirSync(dir, { recursive: true });
  const filename = uniqueFilename(dir, filePart.filename);
  const destPath = path.join(dir, filename);
  fs.writeFileSync(destPath, filePart.data);

  const entries = readEntries();
  const groupMedium = section === 'visual-art' ? medium : null;
  const groupOrders = entries
    .filter((e) => e.section === section && e.medium === groupMedium)
    .map((e) => e.order ?? 0);
  const nextOrder = groupOrders.length ? Math.max(...groupOrders) + 1 : 0;

  const entry = {
    id: crypto.randomUUID(),
    title,
    section,
    medium: groupMedium,
    description,
    year: '',
    file: path.relative(REPO_ROOT, destPath).split(path.sep).join('/'),
    order: nextOrder,
  };

  entries.push(entry);
  writeEntries(entries);

  sendJson(res, 200, { ok: true, entry });
}

async function handleUpdateEntry(req, res, id) {
  let body;
  try {
    body = await readBody(req, 1024 * 1024);
  } catch (err) {
    return sendJson(res, err.statusCode || 500, { ok: false, error: 'Failed to read request body' });
  }

  let payload;
  try {
    payload = JSON.parse(body.toString('utf8') || '{}');
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
  }

  const entries = readEntries();
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) {
    return sendJson(res, 404, { ok: false, error: 'Entry not found' });
  }

  const entry = entries[index];
  const prevSection = entry.section;
  const prevMedium = entry.medium;

  if (typeof payload.title === 'string') entry.title = payload.title.trim();
  if (typeof payload.description === 'string') entry.description = payload.description.trim();
  if (typeof payload.section === 'string' && ['films', 'visual-art', 'writing'].includes(payload.section)) {
    entry.section = payload.section;
    if (entry.section !== 'visual-art') entry.medium = null;
  }
  if (typeof payload.medium === 'string' && entry.section === 'visual-art') {
    entry.medium = payload.medium;
  }
  if (typeof payload.order === 'number' && Number.isFinite(payload.order)) {
    entry.order = payload.order;
  }

  // Keep the file's location on disk in sync with its catalog grouping —
  // otherwise a re-sectioned entry ends up pointing at a file still sitting
  // in its old section/medium's folder.
  if ((entry.section !== prevSection || entry.medium !== prevMedium)
    && (entry.section !== 'visual-art' || entry.medium)) {
    const newDir = targetDir(entry.section, entry.medium);
    const oldPath = path.join(REPO_ROOT, entry.file);
    if (newDir && fs.existsSync(oldPath) && path.resolve(path.dirname(oldPath)) !== path.resolve(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
      const filename = uniqueFilename(newDir, path.basename(oldPath));
      const newPath = path.join(newDir, filename);
      fs.renameSync(oldPath, newPath);
      entry.file = path.relative(REPO_ROOT, newPath).split(path.sep).join('/');
    }
  }

  entries[index] = entry;
  writeEntries(entries);
  sendJson(res, 200, { ok: true, entry });
}

function handleDeleteEntry(req, res, id) {
  const entries = readEntries();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) {
    return sendJson(res, 404, { ok: false, error: 'Entry not found' });
  }
  writeEntries(next);
  sendJson(res, 200, { ok: true });
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return {
    command: 'git ' + args.join(' '),
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

async function handlePublish(req, res) {
  let body;
  try {
    body = await readBody(req, 1024 * 1024);
  } catch (err) {
    return sendJson(res, err.statusCode || 500, { ok: false, error: 'Failed to read request body' });
  }

  let payload = {};
  try {
    payload = JSON.parse(body.toString('utf8') || '{}');
  } catch (err) {
    // ignore, treated as not confirmed below
  }

  if (payload.confirmed !== true) {
    return sendJson(res, 400, { ok: false, error: 'Publish requires confirmation' });
  }

  const steps = [];

  const addResult = runGit(['add', '-A']);
  steps.push(addResult);
  if (!addResult.ok) return sendJson(res, 500, { ok: false, steps });

  const commitResult = runGit(['commit', '-m', 'Update portfolio content']);
  const nothingToCommit = /nothing to commit/i.test(commitResult.stdout + commitResult.stderr);
  if (nothingToCommit) commitResult.note = 'No new changes to commit.';
  steps.push(commitResult);
  if (!commitResult.ok && !nothingToCommit) return sendJson(res, 500, { ok: false, steps });

  if (!nothingToCommit) {
    const pushResult = runGit(['push']);
    steps.push(pushResult);
    if (!pushResult.ok) return sendJson(res, 500, { ok: false, steps });
  }

  sendJson(res, 200, { ok: true, steps });
}

function serveStaticFile(res, relativePath) {
  const filePath = path.join(PUBLIC_DIR, relativePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeFor(filePath) });
    res.end(data);
  });
}

function serveAsset(res, urlPath) {
  const relPath = decodeURIComponent(urlPath.replace(/^\/assets\//, ''));
  const resolved = path.join(ASSETS_ROOT, relPath);
  if (!resolved.startsWith(ASSETS_ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeFor(resolved) });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const [urlPath] = req.url.split('?');

  if (req.method === 'GET' && STATIC_ROUTES[urlPath]) {
    return serveStaticFile(res, STATIC_ROUTES[urlPath]);
  }

  if (req.method === 'GET' && urlPath.startsWith('/assets/')) {
    return serveAsset(res, urlPath);
  }

  if (req.method === 'GET' && urlPath === '/api/entries') {
    return handleGetEntries(req, res);
  }

  if (req.method === 'POST' && urlPath === '/api/upload') {
    return handleUpload(req, res);
  }

  const entryMatch = /^\/api\/entries\/([^/]+)$/.exec(urlPath);
  if (entryMatch && req.method === 'PUT') {
    return handleUpdateEntry(req, res, decodeURIComponent(entryMatch[1]));
  }
  if (entryMatch && req.method === 'DELETE') {
    return handleDeleteEntry(req, res, decodeURIComponent(entryMatch[1]));
  }

  if (req.method === 'POST' && urlPath === '/api/publish') {
    return handlePublish(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Portfolio admin running at http://localhost:${PORT}`);
  console.log(`Repo root: ${REPO_ROOT}`);
});
