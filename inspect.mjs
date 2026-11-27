// Quick eyeball of the built output: node inspect.mjs
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync(new URL('./out/data.js', import.meta.url), 'utf8').trim().slice('window.RADAR='.length, -1));
const rows = D.rows;

const bad = rows.filter((r) => !Array.isArray(r.farm_steps) || r.farm_steps.length === 0);
console.log('rows', rows.length, '| early', D.early_size, '| watchlist rows', rows.filter((r) => r.list === 'watchlist').length);
console.log('multiple', D.token_profile.protocol.toFixed(4), '| chains', D.chains.length, '| categories', D.categories.length);
console.log('rows without farm plan in data.js', bad.length, '(the page derives them, board.json carries them)');
console.log('monotonic', rows.every((r, i) => i === 0 || rows[i - 1].implied_value_usd >= r.implied_value_usd));
console.log('top', rows.slice(0, 3).map((r) => `${r.rank} ${r.slug} ${r.implied_value_usd}`).join(' | '));
console.log('tail', rows.slice(-2).map((r) => `${r.rank} ${r.slug} ${r.implied_value_usd}`).join(' | '));
const board = JSON.parse(readFileSync(new URL('./out/board.json', import.meta.url), 'utf8')).rows;
const badBoard = board.filter((r) => r.farm_steps.length !== 6 || r.farm_steps.some((s) => s.length < 20 || s.length > 600));
console.log('board.json bad farm plans', badBoard.length);
console.log('sample step', board[0].farm_steps[1]);
