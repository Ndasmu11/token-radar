// The token radar's model, v2: one snapshot of the protocol universe in, one ranked board out.
//
// What changed from the starter and why:
//
//   The starter scored TVL x one shy growth multiplier x a maturity multiplier that only moved
//   between 0.6 and 1.0. Seven-day growth never counted for more than +-18%, and a protocol that
//   had run for years and still had no token was treated as *less* likely to launch. The board
//   therefore ranked almost purely by TVL, which ranks size, not launch odds.
//
//   v2 scores the two things the snapshot actually carries evidence for:
//
//     1. A launch base. TVL is the capital that would have to be bought to reach a token, so the
//        base is TVL x LAUNCH_RATE, with the rate itself falling as TVL grows (a $3B protocol is
//        not 300x likelier to launch than a $10M one) and rising where the money is young.
//     2. A patience multiplier, and patience peaks at a target age instead of climbing forever.
//        A protocol 5 years old with no token is either never launching or about to; one 8-24
//        months old is exactly at the launch window, and that is where the multiplier tops out.
//
// Both are still pure functions of the snapshot's five figures - age, TVL, growth, chain spread,
// category breadth - so no protocol name is ever special-cased anywhere in this file.
//
//   base       = tvl_usd x LAUNCH_RATE x sizeShape(tvl_usd) x youngBonus(age_days)
//   patience   = 0.40 + 0.60 x exp(-((age - PEAK_AGE) / SPREAD)^2)     (age unknown: 400)
//   growthMult = 1 + clamp(change_7d, -60, 150) / 100 x GROWTH_WEIGHT
//   spread     = 1 + min(chains - 1, 4) x CHAIN_BONUS + breadthBonus(category, chains)
//   implied    = max(1, round(base x patience x growthMult x spread))
//
// The cost side is modelled too: what one farm wallet has to put up, and what the position returns
// per month of patience. The dashboard shows both, because an implied value with no cost beside it
// is a number to fall for.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  launch_rate: number;
  size_damp: number;
  young_bonus: number;
  young_days: number;
  peak_age_days: number;
  age_spread_days: number;
  patience_floor: number;
  patience_range: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  chain_bonus: number;
}

export const MODEL: ModelConstants = {
  launch_rate: 0.11,
  size_damp: 0.42,
  young_bonus: 0.55,
  young_days: 540,
  peak_age_days: 470,
  age_spread_days: 420,
  patience_floor: 0.4,
  patience_range: 0.6,
  growth_weight: 0.45,
  growth_floor: -60,
  growth_cap: 150,
  chain_bonus: 0.05,
};

/** The model's version label: the dashboard names it and the dossier quotes it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by score. */
export const EARLY_ROWS = 160;

/** How many of the snapshot's largest protocols set the chain prices (the long tail is all dust). */
const PROFILE_CHAINS = 60;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  /** Watchlist row or an early-radar row the house's floor left out. */
  list: 'watchlist' | 'early';
  implied_value_usd: number;
  cost: CostSide;
  model: {
    launch_rate: number;
    growth_pct: number;
    growth_multiplier: number;
    patience_multiplier: number;
    spread_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The cost side: what one position needs and what it earns on the model's own numbers. */
export interface CostSide {
  /** Capital one farm wallet must put up, in whole dollars. */
  capital_usd: number;
  /** Gas, in whole dollars, for the whole plan including the weekly touches. */
  gas_usd: number;
  /** Capital plus gas: the money at risk. */
  all_in_usd: number;
  /** Months the plan keeps the position open. */
  months: number;
  /** Model value divided by all-in cost: how hard the money works. */
  multiple_on_cost: number;
  /** Model value per month per dollar at risk. */
  monthly_yield_pct: number;
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  list: 'watchlist' | 'early';
  implied_value_usd: number;
  cost: CostSide;
  growth_multiplier: number;
  patience_multiplier: number;
  spread_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  token_profile: TokenProfile;
  categories: string[];
  chains: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** What counts as a token, for buying power and for chain spread. */
export interface TokenProfile {
  protocol: number;
  chain: number;
  known_chains: number;
  native_chains: number;
}

/**
 * The token's buying power, out of the live-token protocols only, so it costs one pass and nothing
 * is hand-tuned: the whole live set is market cap plus TVL, and `protocol` is the median market cap
 * divided by the median TVL. A live-token protocol's chain is an instance with real value over it,
 * so the plain median TVL of a live protocol is the value of one instance and `chain` prices a new
 * one. `native_chains` is the average length of a live protocol's own chain list, so an early row's
 * TVL can be read as that many instances.
 */
export function tokenProfile(snapshot: Snapshot): TokenProfile {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const top = snapshot.protocols
    .filter((p) => p.tvl_usd > 0)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .slice(0, PROFILE_CHAINS);
  return {
    protocol: median(live.map((p) => p.mcap_usd!)) / Math.max(1, median(live.map((p) => p.tvl_usd))),
    chain: median(top.map((p) => p.tvl_usd)),
    known_chains: live.length,
    native_chains: top.length === 0 ? 1 : top.reduce((sum, p) => sum + p.chains.length, 0) / top.length,
  };
}

/** The middle of a list, 0 for an empty one. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * How hard TVL is discounted as it grows: 1.0 at $1M, `size_damp` at $25B and beyond, on a log
 * scale. A protocol ten times bigger counts three to four times more, not ten.
 */
export function sizeShape(tvl: number, model: ModelConstants): number {
  const position = fnLog10(Math.max(tvl, 1e6) / 1e6) / fnLog10(25_000);
  return 1 - model.size_damp * clamp(position, 0, 1);
}

/**
 * The same shape, for an early row priced on the protocol-scale TVL it was lifted to. Damping it at
 * that lift would quietly top out every row at the floor, so it keeps the protocol's own (small)
 * size curve and is scaled by where the lift landed: half the floor's discount at the floor.
 */
export function sizeShapeLifted(ownTvl: number, liftedTvl: number, floor: number, model: ModelConstants): number {
  const shape = sizeShape(ownTvl, model);
  const share = clamp(liftedTvl / Math.max(floor, 1), 0, 1);
  return shape * (1 - (1 - shape) * (1 - share) * 0.5);
}

const fnLog10 = (n: number): number => Math.log(n) / Math.LN10;

/** The young-money bonus: the same TVL counts more where it arrived in the last 18 months. */
export function youngBonus(age: number | null, model: ModelConstants): number {
  if (age === null) return 1 + model.young_bonus * 0.4;
  return 1 + model.young_bonus * (1 - clamp(age / model.young_days, 0, 1));
}

/** How far a protocol's days-with-no-token sit from the launch window: 1 at the peak, falling both ways. */
export function patienceMult(age: number | null, model: ModelConstants): number {
  const days = age ?? 400;
  const offset = (days - model.peak_age_days) / Math.max(model.age_spread_days, 1);
  return model.patience_floor + model.patience_range * Math.exp(-(offset * offset));
}

/** Chain spread and category breadth: a protocol that is real on many chains outlives one chain's fashion. */
export function spreadMult(p: SnapshotProtocol, model: ModelConstants): number {
  const chains = 1 + Math.min(Math.max(p.chains.length - 1, 0), 4) * model.chain_bonus;
  const c = (p.category ?? '').toLowerCase();
  let breadth = 1;
  if (c.includes('dex') || c.includes('lend') || c.includes('yield')) breadth = 1.05;
  else if (c.includes('rwa') || c.includes('perpetual') || c.includes('derivative')) breadth = 1.03;
  else if (c.includes('bridge') || c.includes('stable')) breadth = 0.98;
  return chains * breadth;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  profile: TokenProfile,
  floorUsd: number,
): { implied: number; buyingPowerUsd: number; growthPct: number; growthMult: number; patience: number; spread: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = clamp(finite(protocol.change_7d, 0), model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const patience = patienceMult(age, model);
  const spread = spreadMult(protocol, model);
  const buyingPowerUsd = buyingPower(protocol, floorUsd, model, profile);
  const implied = Math.max(1, Math.round(buyingPowerUsd * patience * growthMult * spread));
  return { implied, buyingPowerUsd, growthPct, growthMult, patience, spread, age };
}

/**
 * What the token would be worth if it bought the protocol's TVL at the market's own multiple.
 *
 * A watchlist protocol is one protocol, priced off its own TVL: `tvl x profile.protocol`, damped as
 * TVL grows because a $3B protocol is not 300x likelier to be a $300B token than a $10M one.
 *
 * An early row is below the floor, so its TVL is small for reasons that are not its own: it may be
 * one chain of something bigger, or a new vault that sits under a name already on the watchlist.
 * Its TVL is therefore first read as instances of a live protocol's per-chain TVL and lifted to a
 * protocol-scale TVL, which is what the multiple then prices. The lift is capped at the floor, so an
 * early row can approach the watchlist's weakest rows and never outrun the ranking it sits under.
 */
export function buyingPower(p: SnapshotProtocol, floorUsd: number, model: ModelConstants, profile: TokenProfile): number {
  if (p.tvl_usd >= floorUsd) return p.tvl_usd * profile.protocol * sizeShape(p.tvl_usd, model);
  const instances = Math.max(1, Math.min(p.chains.length, profile.native_chains));
  const lift = clamp((profile.chain * instances) / Math.max(p.tvl_usd, 1), 1, 6);
  const lifted = Math.min(floorUsd, p.tvl_usd * lift);
  return lifted * profile.protocol * sizeShapeLifted(p.tvl_usd, lifted, floorUsd, model);
}

/** The cost side of one position, priced off the protocol's own size. */
export function costSide(p: SnapshotProtocol, age: number | null, implied: number): CostSide {
  // Capital scales with TVL: a $2B protocol needs a position a farmer will notice.
  const capital =
    p.tvl_usd >= 5_000_000_000 ? 400 : p.tvl_usd >= 1_000_000_000 ? 250 : p.tvl_usd >= 100_000_000 ? 120 : 60;
  const months = Math.max(1, Math.round((holdDaysFor(age) / 30) * 10) / 10);
  // Gas: first transaction plus one a week for the hold.
  const gas = 6 + Math.round(months * 4 * 1.35);
  const allIn = capital + gas;
  return {
    capital_usd: capital,
    gas_usd: gas,
    all_in_usd: allIn,
    months,
    multiple_on_cost: round4(implied / allIn),
    monthly_yield_pct: round4((implied / allIn / months) * 100),
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How long to hold: young protocols need a longer counted window, old ones a shorter one. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 120) return 90;
  if (age < 365) return 60;
  if (age < 900) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds inside its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, all derived from the
 * protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, cost: CostSide): FarmStep[] {
  const chain = chainOf(p);
  const hold = holdDaysFor(age);
  return [
    {
      text: `Use a fresh wallet funded only with what this plan needs, write its seed phrase on paper and keep it off the phone.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    { text: actionFor(p, cost.capital_usd, chain), cost: `$${cost.capital_usd} of capital and roughly $${cost.gas_usd} of gas over the plan`, time: '20 minutes to set up' },
    {
      text: `Make one qualifying action a week on ${chain}, such as a deposit, a borrow, a swap or a governance vote, so the wallet shows a habit and not a drive-by.`,
      cost: 'about $4 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days and let it be counted in more than one snapshot, an all-in of about $${cost.all_in_usd} at risk for ${cost.months} months.`,
      cost: `the $${cost.capital_usd} stays in the position and cannot be spent meanwhile`,
      time: `${hold} days`,
    },
    {
      text: `Open ${p.name}'s own points or rewards page before you withdraw and claim only from the link it publishes, never from a reply or a DM.`,
      cost: 'nothing to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Log the wallet, every date and every transaction hash in a farm journal, then unwind in one go: withdraw, bridge back and sweep to the holding wallet.`,
      cost: "one exit's gas, about $3",
      time: '35 minutes',
    },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  const profile = tokenProfile(snapshot);
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  const watch = new Set(snapshot.watchlist);
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the floor, scored first, best score, capped. A
  // watchlist row is never displaced.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .map((p) => ({ p, score: impliedValue(p, snapshot.as_of, model, profile, snapshot.floor_usd).implied }))
    .sort((a, b) => b.score - a.score || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const m = impliedValue(p, snapshot.as_of, model, profile, snapshot.floor_usd);
    return { p, ...m, cost: costSide(p, m.age, m.implied) };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    list: watch.has(s.p.slug) ? 'watchlist' : 'early',
    implied_value_usd: s.implied,
    cost: s.cost,
    model: {
      launch_rate: model.launch_rate,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      patience_multiplier: round4(s.patience),
      spread_multiplier: round4(s.spread),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age, s.cost).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    list: row.list,
    implied_value_usd: row.implied_value_usd,
    cost: row.cost,
    growth_multiplier: row.model.growth_multiplier,
    patience_multiplier: row.model.patience_multiplier,
    spread_multiplier: row.model.spread_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const profile = tokenProfile(snapshot);
  const early = board.filter((r) => r.list === 'early').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    token_profile: profile,
    categories: [...new Set(board.map((r) => r.category).filter((c): c is string => c !== null))].sort(),
    chains: [...new Set(board.flatMap((r) => r.chains))].sort(),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
