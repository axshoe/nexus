# NEXUS — Quantitative Market Intelligence System

> Multi-signal quant CLI that fuses technical indicators, Federal Reserve macro data, news sentiment, and cross-asset signals into one interpretable **Market Intelligence Score**.

```bash
node src/index.js AAPL --demo   # no API keys needed
node src/index.js TSLA          # (free API keys)
```

![demo output showing NEXUS terminal dashboard with MIS score, technical indicators, macro table, sentiment, anomaly detection, and backtest results]

## What It Does

Most retail tools show you RSI and call it analysis. NEXUS asks a different question: **is something unusual happening in this asset, and does the macro environment support or contradict the signal?**

NEXUS runs **4 independent analysis pipelines**, then fuses them into 1 score:

| Domain | Weight | Source | What It Measures |
|--------|--------|--------|-----------------|
| Technical | 40% | Finnhub | RSI, MACD, Bollinger Bands, MA alignment, z-scores |
| Macro | 30% | FRED (Federal Reserve) | VIX, yield curve, Fed Funds rate, CPI, unemployment |
| Sentiment | 20% | Finnhub + Alternative.me | News sentiment score + Fear & Greed Index |
| Cross-Asset | 10% | CoinGecko | BTC/ETH as risk-on/risk-off proxy |

**Output: Market Intelligence Score (0–100)**
- `75–100` → Strong Bullish
- `60–74` → Moderately Bullish
- `45–59` → Neutral / Mixed
- `30–44` → Moderately Bearish
- `0–29`  → Strong Bearish

## Features

- **All quant formulas implemented from scratch** — RSI (Wilder smoothing), MACD, Bollinger Bands, rolling z-scores, Sharpe ratio, Sortino ratio, max drawdown, ATR
- **Statistical anomaly detection** — flags unusual price behavior using z-scores, volatility regime shifts, Bollinger squeezes, volume spikes
- **Macro regime classification** — 4-quadrant framework using FRED data (840,000+ free economic series)
- **4-strategy backtesting engine** — RSI mean reversion, MACD momentum, Bollinger reversion, and hybrid; picks best by Sharpe ratio
- **Plain-English interpretations** — every number is explained, not just displayed
- **Demo mode** — full output with synthetic data, no API keys needed

## Quick Start

```bash
git clone git clone https://github.com/axshoe/nexus
cd nexus-market-intelligence
npm install

# Demo (no setup needed)
node src/index.js AAPL --demo

# Real data — copy .env.example to .env, add your 3 free API keys
cp .env.example .env
node src/index.js AAPL
```

## Free API Keys (takes ~5 minutes total)

| Key | Get it at | Free limit |
|-----|-----------|-----------|
| Finnhub | finnhub.io/register | 60 req/min |
| FRED | fred.stlouisfed.org/docs/api/api_key.html | Unlimited |
| Alpha Vantage | alphavantage.co/support/#api-key | 25 req/day |

CoinGecko and Fear & Greed Index require no key.

## Architecture

```
src/
├── data/       finnhub.js · fred.js · feargreed.js
├── analysis/   technical.js · anomaly.js · macro.js · backtest.js
├── engine/     signal.js  ← the fusion layer
├── display/    terminal.js
└── index.js    ← entry point
```

See [docs/README.md](docs/README.md) for the full documentation including all math formulas, the 2-week learning journal, and architecture deep-dive.


**⚠ Educational tool. Not financial advice.**

MIT License · Built by A.Xiu · 2026
