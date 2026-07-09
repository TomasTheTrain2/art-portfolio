# Art Portfolio

A plain HTML/CSS/JS portfolio site — no frameworks, no build tools. Just open
`index.html` in a browser or serve the folder as static files.

## Folder structure

```
.
├── index.html          Homepage — hero + featured work grid
├── films.html           Masonry collage of film stills, opens in a lightbox
├── visual-art.html       Tabbed medium collages (Photography / Painting /
│                          Drawing & Illustration / Digital Art), same lightbox
├── writing.html         List of writing pieces
├── about.html            Bio + contact
├── css/
│   └── style.css        All styling, incl. theme variables at the top
├── js/
│   └── main.js           Medium tab switching + the collage lightbox
└── assets/
    ├── films/            Drop film thumbnails/media here
    ├── visual-art/        Drop art piece images here
    └── writing/           Drop writing-related media here
```

Every page shares the same header/nav and footer, hand-copied into each
HTML file (no templating, since this is plain static HTML).

## Personalizing the site

### 1. Swap your name in

The placeholder `YOUR NAME` appears in the `<title>` tags, the header logo,
the homepage hero, and the footer of every page. Find-and-replace
`YOUR NAME` with your actual name across all `.html` files, e.g.:

```
find . -name "*.html" -exec sed -i '' 's/YOUR NAME/Jane Doe/g' {} +
```

(On Linux, drop the `''` after `-i`.)

### 2. Update the tagline, bio, and contact email

- Homepage tagline: edit the `<p class="tagline">` in `index.html`.
- Bio: edit the paragraphs inside `.about-content` in `about.html`.
- Contact email: replace `your.email@example.com` in `about.html` (both the
  visible text and the `mailto:` link).

### 3. Change the colors

All theme colors are CSS variables at the top of `css/style.css`:

```css
:root {
  --accent: #5c7a89;   /* muted accent — used sparingly for links/hover */
  --ink:    #2b2b2b;   /* dark charcoal body text */
  --paper:  #fafafa;   /* off-white background */
  --muted:  #767676;   /* secondary/muted text and captions */
}
```

Change these four values to re-theme the entire site. Note the lightbox
overlay always stays dark regardless of these values (it has its own
`--lightbox-ink` / `--lightbox-muted` / `--lightbox-accent` variables,
since its scrim needs light text no matter how the rest of the page is
themed).

### 4. Add real content

`films.html` and the medium sections inside `visual-art.html` use a
collage/masonry grid (`.collage-grid` of `.collage-item` figures) with a
built-in lightbox and a small caption under each piece. Each placeholder
piece looks like this:

```html
<figure class="collage-item">
  <button type="button" class="collage-media ar-portrait tone-1" data-tone="tone-1" data-ar="3 / 4"
    data-title="My Piece Title" data-meta="2024 · Oil on Canvas"
    aria-label="View enlarged: My Piece Title"></button>
  <figcaption class="collage-caption">
    <span class="cap-title">My Piece Title</span>
    <span class="cap-meta">2024 · Oil on Canvas</span>
  </figcaption>
</figure>
```

To swap in a real image, drop an `<img>` (from the matching `assets/`
folder) inside the `.collage-media` button — the lightbox will pick it up
automatically and show it enlarged:

```html
<figure class="collage-item">
  <button type="button" class="collage-media ar-portrait" data-title="My Piece Title" data-meta="2024 · Oil on Canvas">
    <img src="assets/visual-art/my-piece.jpg" alt="My Piece Title">
  </button>
  <figcaption class="collage-caption">
    <span class="cap-title">My Piece Title</span>
    <span class="cap-meta">2024 · Oil on Canvas</span>
  </figcaption>
</figure>
```

The `ar-*` class (`ar-portrait`, `ar-square`, `ar-landscape`, `ar-wide`,
`ar-tall`) controls the tile's aspect ratio in the masonry layout — pick
whichever roughly matches the image. `writing.html` still uses a plain
list — copy a `.writing-entry` block and fill in real details.

### 5. Visual Art tabs

`visual-art.html` groups pieces into four medium tabs (Photography,
Painting, Drawing & Illustration, Digital Art), each its own
`.collage-grid` with a matching `data-medium` attribute wired to a
`.tab-btn`'s `data-target`. Add pieces inside the grid for the relevant
medium; the tab-switching JS in `js/main.js` handles showing/hiding.

### 6. The lightbox

`js/main.js` builds a single lightbox on page load, wired to every
`.collage-media` button on the page (scoped per-grid, so visual-art's
tabs each navigate their own set). Clicking a piece opens it enlarged
with a dark scrim; next/prev arrows, arrow keys, and Escape all work. No
extra setup needed — it just reads each item's
`data-title`/`data-meta`/`data-ar` and its `<img>` if present.

## Deploying with GitHub Pages

Once this repo is pushed to GitHub:

1. Go to the repo on GitHub → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Set branch to **main** and folder to **/ (root)**, then **Save**.
4. After a minute or two, the site will be live at:
   `https://<your-github-username>.github.io/art-portfolio/`
