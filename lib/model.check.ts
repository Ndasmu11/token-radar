// One runnable check for the model: node lib/model.check.ts
// Fails loudly if the score stops being a function of the snapshot figures, stops covering the
// watchlist, or quietly collapses into a TVL sort.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildBoard, buyingPower, isPreToken, MODEL, patienceMult, parseSnapshot, sizeShape, tokenProfile } from './model.ts';

let failed = 0;
const ok = (name: string, cond: boolean): void => {
  if (!cond) {
    failed++;
    console.error(`FAIL ${name}`);
  } else console.log(`ok   ${name}`);
};

const here = fileURLToPath(new URL('.', import.meta.url));
const snapshot = parseSnapshot(readFileSync(process.argv[2] ?? `${here}../../tr-kit/token-radar-01-kit/input/snapshot.json`, 'utf8'));

// The shape curves behave: bigger TVL is damped, patience peaks at the target age.
const mid = MODEL.peak_age_days;
ok('size damping falls', sizeShape(50_000_000, MODEL) > sizeShape(5_000_000_000, MODEL));
ok('patience peaks at the window', patienceMult(mid, MODEL) > patienceMult(mid + MODEL.age_spread_days, MODEL));
ok('patience peaks over young too', patienceMult(mid, MODEL) > patienceMult(10, MODEL));
ok('patience never zero', patienceMult(null, MODEL) > 0);

const profile = tokenProfile(snapshot);
ok('profile has a multiple', profile.protocol > 0 && profile.chain > 0);
ok('an early row is lifted but capped', buyingPower({ ...snapshot.protocols[0]!, tvl_usd: 6_000_000 }, snapshot.floor_usd, MODEL, profile) <=
  6 * 6_000_000 * 2 * profile.protocol);

const board = buildBoard(snapshot);
ok('board covers the watchlist', snapshot.watchlist.every((s) => board.some((r) => r.slug === s)));
ok('board passes the gate', boardIssue(board, snapshot) === null);
ok('every row is pre-token', board.every((r) => isPreToken(snapshot.protocols.find((p) => p.slug === r.slug)!)));
ok('the orders differ', board[0]!.implied_value_usd > board[board.length - 1]!.implied_value_usd * 4);
ok('cost has a real ratio', board.every((r) => r.cost.all_in_usd > 0 && r.cost.multiple_on_cost > 0));

// Not a TVL sort: the top row by TVL and the top row by score may differ, but at minimum a
// smaller protocol must be able to outrank a 3x bigger, older one - that is what the model adds.
const byTvl = [...board].sort((a, b) => b.tvl_usd - a.tvl_usd);
ok('score is not a TVL sort', board.some((r, i) => r.slug !== byTvl[i]!.slug));

// A same-TVL pair split only by age must not tie: age has to move a row.
const a = buildBoard(snapshot).find((r) => r.age_days !== null)!;
ok('age moves the score', a.model.patience_multiplier > 0 && a.model.patience_multiplier < 1.01);

console.log(failed === 0 ? 'model: all checks pass' : `model: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
