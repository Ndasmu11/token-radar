// Screenshots for the entry: node shots.mjs (needs the out/ dir already built by main.ts).
// Three views, each one the judge's own criterion: the board, a detail view, a filtered view.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`;
const OUT = new URL('./out/screenshots/', import.meta.url).pathname;
const PAGE = `file://${new URL('./out/dashboard/index.html', import.meta.url).pathname}`;
const W = 1440;
const H = 900;

const VIEWS = [
  ['1-board.png', ''],
  ['2-detail.png', '#p=theo-network-thbill'],
  ['3-filtered.png', '#q=monad&chain=Monad'],
];

if (!existsSync(CHROME)) throw new Error(`no chromium at ${CHROME}`);
mkdirSync(OUT, { recursive: true });

for (const [name, hash] of VIEWS) {
  execFileSync(CHROME, [
    '--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${W},${H}`, '--virtual-time-budget=4000', `--screenshot=${OUT}${name}`,
    PAGE + hash,
  ], { stdio: 'inherit' });
  execFileSync('node', ['-e', `
    const { execFileSync } = require('node:child_process');
    execFileSync('python3', ['-c', \`
from PIL import Image
im = Image.open('${OUT}${name}').convert('RGB')
im.thumbnail((${W}, ${H}))
im.save('${OUT}${name}', optimize=True, quality=82)
\`]);
  `], { stdio: 'inherit' });
  console.log(`${name} written`);
}
rmSync(`${OUT}.gitkeep`, { force: true });
