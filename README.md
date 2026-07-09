# Art Portfolio

A plain HTML/CSS/JS portfolio site — no frameworks, no build tools. All the
content (films, visual art, writing) is data-driven from a single JSON file
and rendered client-side at page load.

## Folder structure

```
.
├── index.html            Homepage — full-screen randomized collage
├── films.html             Masonry collage of films, opens in a lightbox
├── visual-art.html         Tabbed medium collages (Photography / Painting /
│                            Drawing & Illustration / Digital Art /
│                            Graphic Design), same lightbox
├── writing.html           Plain list of writing pieces, links to the PDFs
├── about.html              Bio + contact
├── css/
│   └── style.css          All styling, incl. theme variables at the top
├── js/
│   └── main.js             Fetches data/portfolio.json and renders every
│                            page's tiles/list, plus tabs + the lightbox
├── data/
│   └── portfolio.json      The single source of truth for every piece —
│                            see "The content file" below
├── assets/
│   ├── films/               Film files
│   ├── visual-art/<medium>/ One folder per medium (photography, painting,
│   │                        drawing, digital, graphic-design)
│   └── writing/             Writing files (PDFs etc.)
└── admin/                  Local-only content-management tool — see below.
    ├── server.js            Run with `node admin/server.js`
    └── public/               Its HTML/CSS/JS front end
```

Every page shares the same header/nav and footer, hand-copied into each
HTML file (no templating, since this is plain static HTML).

## The content file

`data/portfolio.json` is an array of entries, one per piece:

```json
{
  "id": "5b1f...-uuid",
  "title": "Horse Study",
  "section": "visual-art",
  "medium": "drawing",
  "description": "",
  "year": "",
  "file": "assets/visual-art/drawing/horse-study.jpg"
}
```

- `section` is one of `films`, `visual-art`, `writing`.
- `medium` only applies to `visual-art` entries — it must match one of the
  sub-folder names under `assets/visual-art/` (this is also what wires an
  entry to the right tab on `visual-art.html`). `null` for films/writing.
- `file` is a path relative to the repo root.
- `year` and `description` can be left blank (`""`).
- Both images (`.jpg/.jpeg/.png/.gif/.webp`) and video (`.mp4/.mov/.m4v/.webm`)
  are supported — `js/main.js` picks `<img>` vs `<video>` automatically based
  on the file extension, both in the grids and in the lightbox.

`js/main.js` fetches this file on every page load and renders:
films.html's grid, visual-art.html's five medium grids, writing.html's list,
and the homepage's randomized full-screen collage (pulled from the combined
films + visual-art pool). There's no hardcoded content left in the HTML —
edit `data/portfolio.json` (by hand, or via the admin tool below) and every
page picks it up automatically.

## Adding content going forward

The easiest way is the local admin tool (below) — it handles copying the
file into the right `assets/` folder, writing the JSON entry, and pushing.

You can also edit `data/portfolio.json` by hand: drop a file into the
matching `assets/` folder and add a matching entry with a unique `id`
(any unique string works, e.g. from `uuidgen`).

## Local admin tool

A small local-only tool at `admin/server.js` lets you add, edit, and delete
portfolio pieces from a form in your browser, and publish changes with one
click — no editing JSON by hand or using git directly.

**Run it:**

```
node admin/server.js
```

Then open **http://localhost:3000**. It needs Node.js installed (built-in
modules only — `http`, `fs`, `path`, `crypto`, `child_process` — no `npm
install` required).

**What it does:**

- **Add New Piece** — pick a file, a section (Films / Visual Art / Writing),
  a medium (only shown for Visual Art, populated from the folders that
  already exist under `assets/visual-art/`), a title (auto-filled from the
  filename, editable), and a description. Submitting copies the file into
  the right `assets/` subfolder and appends an entry to
  `data/portfolio.json`.
- **Existing Entries** — every entry from the JSON, with inline-editable
  title/description/section/medium and a delete button (delete removes the
  JSON entry only; the underlying file is left on disk).
- **Publish** — runs `git add -A`, `git commit -m "Update portfolio
  content"`, and `git push` in the repo, and shows the raw command output.
  It asks for a confirmation click before it actually runs — nothing is
  pushed on the first click.

**About `admin/` and GitHub Pages:** GitHub Pages only serves static files —
it has no server to execute `admin/server.js` on, so the admin tool itself
is never reachable or runnable from the published site; it only ever runs
on your own machine. Because Pages serves the repo's files as-is, the *raw
source* of `admin/server.js` and the files under `admin/public/` would be
downloadable as plain text if someone requested that URL directly (the same
way any other file in the repo is). That source contains no credentials or
tokens — the Publish button relies entirely on whatever `git`/GitHub
authentication is already set up on your machine — so this is a minor
transparency note, not a security exposure. If you'd rather its source not
be servable at all, the common fix is renaming the folder to `_admin/`
(GitHub Pages' default Jekyll processing skips underscore-prefixed
folders); ask if you want that changed.

## Personalizing the site

### Colors

All theme colors are CSS variables at the top of `css/style.css`:

```css
:root {
  --accent: #5c7a89;   /* muted accent — used sparingly for links/hover */
  --ink:    #2b2b2b;   /* dark charcoal body text */
  --paper:  #fafafa;   /* off-white background */
  --muted:  #767676;   /* secondary/muted text and captions */
}
```

Change these four values to re-theme the entire site. The lightbox overlay
always stays dark regardless of these values (it has its own
`--lightbox-ink` / `--lightbox-muted` / `--lightbox-accent` variables, since
its scrim needs light text no matter how the rest of the page is themed).

### Bio and contact

Edit the paragraphs inside `.about-content` in `about.html`, and the
`mailto:` link in the same file.

## Deploying with GitHub Pages

Once this repo is pushed to GitHub:

1. Go to the repo on GitHub → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Set branch to **main** and folder to **/ (root)**, then **Save**.
4. After a minute or two, the site will be live at:
   `https://<your-github-username>.github.io/art-portfolio/`
