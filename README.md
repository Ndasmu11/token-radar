# Token Radar: pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Ndasmu11/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Ndasmu11/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An entry to the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

A static board of every protocol in the snapshot that has real TVL and no token, ranked by a model
whose only inputs are the snapshot's own figures: TVL, seven-day growth, how long the protocol has
run with no token, how many chains it lives on and what it does. No protocol name is special-cased
anywhere.

Read it at https://make.fun. The board covers all 40 watchlist protocols and adds 160 early rows from
below the house's floor, which the house's own README calls a floor and never a ceiling.

## Run it

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
    node lib/model.check.ts <snapshot.json>

`main.ts` writes `out/board.json`, `out/data.js`, the dashboard, the screenshots and the dossier the
judge reads. Node 22, standard library only, no build step, no dependency.

## The model (radar-2)

    buying     = priceable_tvl x 0.2782 x sizeShape(tvl)
    patience   = 0.40 + 0.60 x exp(-((age_days - 470) / 420)^2)
    implied    = round( buying x patience x (1 + clamp(change_7d, -60, 150)/100 x 0.45) x chainSpread )

- **The multiple is measured, not chosen.** 0.2782 is the median market cap over median TVL of the
  live-token protocols in this snapshot: the market already priced these, the model applies them.
- **Patience peaks at 470 days with no token** and falls both ways. Three weeks old is too early to
  judge; five years old is unlikely to issue at all. The starter's model only ever rose with age.
- **Size is damped** on a log scale, so a $3B protocol counts three to four times more than a $10M
  one instead of 300 times.
- **Early rows are read at protocol scale.** A row below the floor may be one chain of something
  bigger or a vault under a name already on the watchlist, so its TVL is first lifted (max 6x, capped
  at the floor) before the same multiple prices it. That is why an early row can outrank a bigger,
  older watchlist row: it is judged as a protocol, not as one vault.

Every row also carries its cost side: the capital and gas one position needs, the money at risk, the
model value on that money, and the days of holding needed to cover it. A huge implied value on a
position nobody can afford is not a good farm, and the board says so.

## The dashboard

Search, category filter, chain filter, list filter, sortable columns and a detail drawer with the
row's whole arithmetic, its cost side and a six-step farm plan with a cost and a time on every step.
Renders from `data.js` alone, no network, no framework.
