# links.iydebu.com

Debu's link page for Instagram (and anywhere else one link fits). Plain HTML, no build step, no trackers.

- `index.html` - the whole page (styles and a tiny script inline).
- `assets/` - LudoNow reel (540x960, ~1.3 MB) + poster, game thumbnails.
- `og.png` - share card, made from `tools/og.html` by `node tools/check.mjs --og`.
- `node tools/check.mjs` - headless Chrome check: phone/small/PC screenshots, sideways scroll, video plays,
  Play button on the first screen, every link answers. `LINKS_URL=https://links.iydebu.com/ node tools/check.mjs` checks the live site.

Hosted on Cloudflare (see Hosting below). GitHub Pages is turned off.

## Hosting

Cloudflare (free plan), static assets Worker `links-site`, custom domain links.iydebu.com (Cloudflare makes the
HTTPS certificate). Deploy from this folder: `npx wrangler deploy`. `.assetsignore` keeps tools, notes and git out
of the upload. Live check: `LINKS_URL=https://links.iydebu.com/ node tools/check.mjs`.
