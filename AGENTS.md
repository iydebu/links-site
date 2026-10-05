# links-site (links.iydebu.com)

Debu's custom "link in bio" page for Instagram. Made 2026-10-06. Public repo iydebu/links-site, hosted on Cloudflare (Worker links-site, deploy `npx wrangler deploy`; GitHub Pages off),
custom domain links.iydebu.com (Cloudflare DNS: CNAME links -> iydebu.github.io, DNS only / grey cloud).

Rules
- Real facts only. Project names, lines and URLs come from D:\Personal\Portfolio Website\site\content.js.
- No home city / country anywhere (Debu's rule for all his public pages).
- LudoNow is the featured card (the thing being marketed). Outbound links to his own sites carry
  ?utm_source=instagram&utm_medium=bio.
- Simple Indian English, short lines. No third-party scripts or trackers.
- Pushing to the public repo = changing the live site: ask Debu before any push.

Check before every push: `node tools/check.mjs` must print CHECK PASS (LinkedIn answers 429/999 to bots; allowed).
Then look at .hermes/shots/phone.png yourself.

Reel video: copy of D:\Startup Project\Games\Ludo\.hermes\reel\ludonow-reel.mp4 cut to 540x960 crf 29
(ffmpeg command in .hermes/JOURNAL.md). Swap it when a new reel is made.
