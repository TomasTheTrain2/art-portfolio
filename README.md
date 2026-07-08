# Art Portfolio

A plain HTML/CSS/JS portfolio site — no frameworks, no build tools. Just open
`index.html` in a browser or serve the folder as static files.

## Folder structure

```
.
├── index.html          Homepage — hero + featured work grid
├── films.html           List of film entries
├── visual-art.html       List of visual art pieces
├── writing.html         List of writing pieces
├── about.html            Bio + contact
├── css/
│   └── style.css        All styling, incl. theme variables at the top
├── js/
│   └── main.js           Empty placeholder for future interactivity
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
  --accent: #f5e800;   /* bright hero/highlight color */
  --ink:    #0a0a0a;   /* near-black text and borders */
  --paper:  #fdfdf8;   /* background */
  --muted:  #6b6b6b;   /* secondary/muted text */
}
```

Change these four values to re-theme the entire site.

### 4. Add real content

Each list page (`films.html`, `visual-art.html`, `writing.html`) has two
placeholder entries showing the expected structure. Copy an entry block,
fill in real titles/years/descriptions, and replace the placeholder
thumbnail `<div class="entry-thumb">` with a real `<img>` tag pointing at
a file you've dropped into the matching `assets/` folder, e.g.:

```html
<div class="entry-thumb">
  <img src="assets/films/my-film-still.jpg" alt="Still from My Film">
</div>
```

### 5. Add interactivity (optional)

`js/main.js` is an empty placeholder, linked from every page, ready for
whatever interactivity you want to add later (lightboxes, filters,
animations, etc.).

## Deploying with GitHub Pages

Once this repo is pushed to GitHub:

1. Go to the repo on GitHub → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Set branch to **main** and folder to **/ (root)**, then **Save**.
4. After a minute or two, the site will be live at:
   `https://<your-github-username>.github.io/art-portfolio/`
