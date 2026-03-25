# NEXUS — Quantitative Market Intelligence System

> *"Most financial tools show you what happened. NEXUS tells you what it means."*

A multi-signal quantitative market intelligence engine built entirely in Node.js. NEXUS fuses four independent signal domains — technical indicators, macroeconomic data (Federal Reserve), news sentiment, and cross-asset signals — into a single interpretable **Market Intelligence Score (MIS)**. It runs entirely in your terminal with a clean CLI dashboard, uses only free APIs, and requires zero subscription fees.

```
  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
  Quantitative Market Intelligence System  v1.0
```

---

## Table of Contents

1. [What Makes This Different](#what-makes-this-different)
2. [Quick Start](#quick-start)
3. [Getting Your Free API Keys](#getting-your-free-api-keys)
4. [Project Architecture](#project-architecture)
5. [The Math — Every Formula Explained](#the-math)
6. [Signal Domain Breakdown](#signal-domain-breakdown)
7. [The Fusion Engine](#the-fusion-engine)
8. [Backtesting Engine](#backtesting-engine)
9. [Data Sources](#data-sources)
10. [Learning Journal — How This Was Built](#learning-journal)
11. [What I Learned](#what-i-learned)
12. [Roadmap](#roadmap)
13. [Disclaimer](#disclaimer)

---

## What Makes This Different

Most retail financial tools fall into one of two traps:

**Trap 1: Price dashboards** — they show you a chart and some RSI/MACD overlays. They never ask *whether the broader environment supports the signal*. An RSI reading of 28 means something very different when the Fed is cutting rates vs. when the yield curve is inverted and VIX is spiking.

**Trap 2: Macro-only tools** — they show you CPI and yield curve data but have no way to connect those readings to specific equities.

**NEXUS bridges both.** It runs four independent signal pipelines and synthesizes them into one **Market Intelligence Score** — a single number from 0–100 that reflects the combined weight of technical, macro, sentiment, and cross-asset evidence. Each domain contributes with a calibrated weight, and the system outputs not just numbers but plain-English interpretations.

This is the architecture pattern used by quantitative hedge funds. NEXUS brings it to a CLI tool that runs in your terminal for free.

---

## Quick Start

### Prerequisites

- Node.js 16+ (check: `node --version`)
- npm (comes with Node)
- A terminal (WebStorm's built-in terminal works great)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/nexus-market-intelligence.git
cd nexus-market-intelligence

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Open .env in your editor and paste your API keys (see below)

# 4. Run in demo mode (no API keys needed!)
node src/index.js AAPL --demo

# 5. Run with real data
node src/index.js AAPL
node src/index.js TSLA
node src/index.js SPY
```

### Demo Mode

Don't have API keys yet? Run any ticker with the `--demo` flag:

```bash
node src/index.js NVDA --demo
node src/index.js MSFT --demo
```

Demo mode generates statistically realistic synthetic price data with intentional anomalies injected so you can see the full system output.

---

## Getting Your Free API Keys

All three keys are completely free. No credit card. No trial period.

### 1. Finnhub API Key (primary data source)

- Go to: **https://finnhub.io/register**
- Click "Get free API key"
- Copy the key from your dashboard
- Free tier: **60 API requests per minute** — more than enough

Provides: real-time quotes, 1 year of daily OHLCV candles, company news with sentiment scores, earnings calendars, and company profiles.

### 2. FRED API Key (Federal Reserve Economic Data)

- Go to: **https://fred.stlouisfed.org/docs/api/api_key.html**
- Create a free account
- Request an API key (instant approval)
- Free tier: **unlimited requests** — FRED is a public service

Provides: 840,000+ macroeconomic time series including VIX, yield curves, CPI, unemployment, Fed Funds Rate, M2 money supply, and more.

### 3. Alpha Vantage Key (fallback historical data)

- Go to: **https://www.alphavantage.co/support/#api-key**
- One-click registration
- Free tier: **25 requests per day**

Used as a fallback for extended historical data when Finnhub's free tier history is insufficient.

### No Key Required

The following data sources require no API key and are fetched automatically:

| Source | Data |
|--------|------|
| Alternative.me | CNN Fear & Greed Index |
| CoinGecko v3 | Bitcoin & Ethereum prices, market caps |

---

## Project Architecture

```
nexus-market-intelligence/
│
├── src/
│   ├── data/                     # API integration layer
│   │   ├── finnhub.js            # Stocks: quotes, candles, news sentiment
│   │   ├── fred.js               # Macro: VIX, yield curve, CPI, unemployment
│   │   └── feargreed.js          # Sentiment: Fear & Greed, BTC, ETH
│   │
│   ├── analysis/                 # Quantitative analysis engine
│   │   ├── technical.js          # RSI, MACD, BB, z-scores, Sharpe (all from scratch)
│   │   ├── anomaly.js            # Statistical anomaly detection
│   │   ├── macro.js              # Macro regime classification
│   │   └── backtest.js           # Strategy backtesting + performance metrics
│   │
│   ├── engine/
│   │   └── signal.js             # FUSION ENGINE — combines all domains into MIS
│   │
│   ├── display/
│   │   └── terminal.js           # CLI dashboard renderer (chalk + cli-table3)
│   │
│   └── index.js                  # Entry point & analysis pipeline orchestrator
│
├── docs/
│   └── README.md                 # This file
│
├── .env.example                  # API key template
├── .env                          # Your keys (gitignored)
└── package.json
```

### Data Flow

```
User: node src/index.js AAPL
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │              DATA INGESTION LAYER                │
    │  Finnhub (quotes + candles) ──────────────────┐  │
    │  FRED (VIX, yields, CPI, unemployment) ──────►│  │
    │  CoinGecko (BTC, ETH prices) ────────────────►│  │
    │  Alternative.me (Fear & Greed) ──────────────►│  │
    └─────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │           ANALYSIS ENGINE (4 DOMAINS)           │
    │                                                  │
    │  [1] Technical   RSI, MACD, BB, MA, vol, z-score│
    │  [2] Macro       Yield curve, VIX, Fed, CPI     │
    │  [3] Sentiment   News score + Fear & Greed      │
    │  [4] Cross-Asset BTC proxy, crypto market mood  │
    └─────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │              FUSION ENGINE                       │
    │   MIS = 0.40 × Tech + 0.30 × Macro              │
    │         + 0.20 × Sentiment + 0.10 × Cross       │
    │   Output: 0–100 score + narrative                │
    └─────────────────────────────────────────────────┘
         │
         ▼
    Terminal Dashboard (chalk + cli-table3)
```

---

## The Math

Every formula in NEXUS is implemented from scratch in `src/analysis/technical.js`. No financial libraries. This section explains each one.

### Returns

The foundation of all quantitative analysis. A return is the percentage change in price from one period to the next.

```
r_t = (P_t - P_{t-1}) / P_{t-1}
```

where `P_t` is the closing price on day `t`. Returns are preferred over raw prices for most statistical analysis because they're stationary (their mean and variance don't change over time), while raw prices are non-stationary (they trend).

### Exponential Moving Average (EMA)

Unlike a Simple Moving Average (SMA), the EMA gives more weight to recent prices. The smoothing factor `k` controls how quickly old data is forgotten.

```
k = 2 / (n + 1)
EMA_t = P_t × k + EMA_{t-1} × (1 - k)
```

For `n = 12`: `k = 0.1538` — fairly responsive to new prices.
For `n = 26`: `k = 0.0741` — slower to react, captures longer trends.

This is used as the basis for MACD.

### RSI — Relative Strength Index

Developed by J. Welles Wilder in 1978. Measures the velocity and magnitude of directional price moves on a 0–100 scale.

**Step 1:** Separate gains and losses from the return series.
```
gain_t = max(r_t, 0)
loss_t = max(-r_t, 0)
```

**Step 2:** Wilder smoothing (a modified EMA with period n = 14):
```
avg_gain_t = (avg_gain_{t-1} × (n-1) + gain_t) / n
avg_loss_t = (avg_loss_{t-1} × (n-1) + loss_t) / n
```

**Step 3:** Relative Strength and RSI:
```
RS_t = avg_gain_t / avg_loss_t
RSI_t = 100 - (100 / (1 + RS_t))
```

**Interpretation:**
- RSI > 70: Asset is overbought — price has risen faster than the underlying momentum can sustain
- RSI < 30: Asset is oversold — selling pressure may be exhausted
- RSI divergence (price makes new high but RSI doesn't) is an advanced signal of trend weakening

### MACD — Moving Average Convergence/Divergence

Created by Gerald Appel in the late 1970s. The MACD measures the difference between two EMAs to quantify momentum.

```
MACD Line    = EMA(12) - EMA(26)
Signal Line  = EMA(MACD Line, 9)
Histogram    = MACD Line - Signal Line
```

**Interpretation:**
- When histogram > 0 and rising: momentum is accelerating bullishly
- When histogram crosses zero from below: classic buy signal
- When histogram crosses zero from above: classic sell/short signal
- The histogram shrinking (but still positive) = momentum fading

### Bollinger Bands

Developed by John Bollinger in the 1980s. Bands adapt to volatility using rolling standard deviation.

```
Middle Band = SMA(close, 20)
Upper Band  = Middle + 2 × σ(close, 20)
Lower Band  = Middle - 2 × σ(close, 20)

%B = (Price - Lower) / (Upper - Lower)   ← where price is in the channel
Bandwidth = (Upper - Lower) / Middle     ← channel width (volatility measure)
```

**Interpretation:**
- %B > 0.8: price near upper band — extended, potential reversal
- %B < 0.2: price near lower band — compressed, potential bounce
- Bandwidth squeezing to historical lows (Bollinger Squeeze) precedes explosive moves — direction unknown

By definition, roughly 95% of price action falls within the ±2σ bands under normal distribution assumptions. Real returns are leptokurtic (fat-tailed), so band breaks are more common than naive stats suggest.

### Rolling Z-Score

Z-scores normalize any time series to units of standard deviations from the rolling mean. This is the core of the anomaly detection engine.

```
z_t = (x_t - μ_window) / σ_window
```

where `μ_window` and `σ_window` are computed over a rolling window (20 days for returns, 30 days for prices).

**Interpretation:**
- |z| > 2.0: statistically unusual (outside 2 standard deviations) — flagged as anomaly
- |z| > 3.0: extreme outlier — high-severity anomaly
- Under normality, |z| > 2 should occur ~4.6% of the time; in practice it's more frequent due to fat tails

### Sharpe Ratio

Developed by William Sharpe (Nobel Prize, 1990). The most widely used risk-adjusted return metric.

```
Sharpe = (mean(r_excess) / σ(r_excess)) × √252

where r_excess_t = r_t - r_f_daily
and r_f_daily = annual_risk_free_rate / 252
```

The `√252` annualizes the daily ratio (252 trading days per year).

**Interpretation:**
- Sharpe > 2.0: exceptional (hedge fund territory)
- Sharpe > 1.0: good
- Sharpe > 0.5: acceptable
- Sharpe < 0: strategy is underperforming the risk-free rate

### Sortino Ratio

A refinement of Sharpe that only penalizes downside volatility. Investors don't mind upside volatility.

```
Sortino = (mean(r_excess) / σ_downside) × √252

where σ_downside = std of only the negative excess returns
```

A strategy that produces irregular large gains but few losses will score much higher on Sortino than Sharpe.

### Maximum Drawdown

The largest peak-to-trough decline in portfolio value over a period. The most psychologically relevant risk metric.

```
MDD = max over all (t_peak, t_trough) of: (P_peak - P_trough) / P_peak
```

Implemented with a single O(n) pass: track the running maximum price and compute the current drawdown at each step.

**Why it matters:** A 50% drawdown requires a 100% subsequent gain just to break even. MDD tells you the worst-case pain a strategy inflicts.

### Annualized Volatility

```
σ_annual = √252 × √(Σ(r_t - r̄)² / n)
```

This is the standard deviation of daily returns, scaled to an annual figure. Expressed as a percentage — e.g., 25% means on average the asset moves ±25% per year.

---

## Signal Domain Breakdown

### Domain 1: Technical (40% weight)

The technical domain scores the internal momentum and structure of the asset's price action, independent of the broader market.

| Indicator | Contribution | Logic |
|-----------|-------------|-------|
| RSI | ±12 pts | < 30 = bullish, > 70 = bearish |
| MACD Histogram | ±10 pts | Positive + expanding = bullish |
| Bollinger %B | ±8 pts | < 20% = bullish, > 80% = bearish |
| MA Alignment | ±8 pts | Price > MA20 > MA50 = bullish stack |
| Vol Regime | Modifier | High vol dampens confidence |

High-volatility regimes pull the technical score toward neutral (50) because uncertainty reduces signal reliability. A strong RSI buy signal in a volatility spike is less trustworthy than the same signal in a calm regime.

### Domain 2: Macro (30% weight)

The macro domain uses the 4-Quadrant Framework from institutional asset allocation:

```
Growth Rising  │  Inflation Falling  →  Quadrant I: Risk-ON (stocks win)
Growth Rising  │  Inflation Rising   →  Quadrant II: Reflation (commodities)
Growth Falling │  Inflation Rising   →  Quadrant III: Stagflation (cash/TIPs)
Growth Falling │  Inflation Falling  →  Quadrant IV: Deflation (bonds)
```

NEXUS approximates growth from unemployment trends and approximates inflation from CPI momentum. The yield curve is the dominant signal — an inverted 2Y/10Y spread has preceded every U.S. recession since 1955.

| Series | Bullish Signal | Bearish Signal |
|--------|---------------|----------------|
| VIX | < 15 (low fear) | > 30 (panic) |
| Yield Curve | > 0.5% | < 0% (inverted) |
| Fed Funds | Cutting rates | Hiking rates |
| CPI | Near 2% target | > 4% |
| Unemployment | Low + falling | Rising > 0.3pp |

### Domain 3: Sentiment (20% weight)

Behavioral finance research (De Long et al., Baker & Wurgler) shows that investor sentiment can move prices independently of fundamentals — sometimes for extended periods. NEXUS captures this through two channels:

**News Sentiment Score:** Company-specific news from the last 7 days is scored using keyword analysis. Positive keywords (beat, surge, upgrade, growth) and negative keywords (miss, fall, downgrade, concern) are counted and normalized to a -1 to +1 scale.

**Fear & Greed Index (Alternative.me):** A composite sentiment index using market volatility, momentum, volume, put/call ratio, and social signals. Critically, NEXUS uses this as a **contrarian** indicator at extremes:
- Extreme Fear (< 25): *contrarian buy signal* — everyone is already scared, selling pressure may be exhausted
- Extreme Greed (> 75): *contrarian warning* — when everyone is bullish, who's left to buy?

### Domain 4: Cross-Asset (10% weight)

Bitcoin's correlation with risk assets increased dramatically after 2020, making it a useful real-time risk-on/risk-off proxy. Crypto markets trade 24/7, meaning BTC price action can telegraph equity market sentiment before the U.S. open.

| BTC 24h Change | Signal | Logic |
|---------------|--------|-------|
| > +5% | Strong bullish | Risk appetite high |
| +2% to +5% | Mild bullish | Moderate risk-on |
| -2% to -5% | Mild bearish | Risk-off pressure |
| < -5% | Strong bearish | Risk-off flight |

---

## The Fusion Engine

The Market Intelligence Score (MIS) is the core output of NEXUS, computed in `src/engine/signal.js`.

```
MIS = 0.40 × TechnicalScore
    + 0.30 × MacroScore
    + 0.20 × SentimentScore
    + 0.10 × CrossAssetScore
```

All domain scores are normalized to the 0–100 range before weighting.

**Why these weights?**

The weighting scheme reflects the following view of what drives equity prices:

- **Technical (40%):** In the short term (days to weeks), price action is self-referential. Markets move because participants believe they will move. Technical signals capture this reflexivity.
- **Macro (30%):** Over weeks to months, the macro regime determines the direction of market wind. A bullish technical setup in a rising-rate, inverted-yield-curve environment is swimming upstream.
- **Sentiment (20%):** Sentiment is a medium-frequency signal. News sentiment is noisy day-to-day but meaningful over several days. Fear & Greed at extremes is more reliable as a contrarian indicator than a momentum one.
- **Cross-Asset (10%):** Bitcoin is a useful but imperfect proxy. Markets don't always follow crypto, but strong divergences are informative.

**MIS Interpretation:**

| Score | Label | Meaning |
|-------|-------|---------|
| 75–100 | Strong Bullish | Multiple domains aligned bullishly — high conviction |
| 60–74 | Moderately Bullish | Net positive signal — more bull evidence than bear |
| 45–59 | Neutral / Mixed | Signal domains conflict — wait for resolution |
| 30–44 | Moderately Bearish | Net negative signal — defensive positioning advisable |
| 0–29 | Strong Bearish | Broad-based weakness — significant downside risk |

---

## Backtesting Engine

`src/analysis/backtest.js` runs four independent strategies on historical data and reports performance metrics for each. The backtest starts with $10,000 and simulates realistic trading (no fractional shares, no lookahead).

### Strategy 1: RSI Mean Reversion
```
BUY  when RSI < 30 (oversold)
SELL when RSI > 70 (overbought)
```
Classic mean-reversion. Works well in range-bound markets. Fails badly in strong trends.

### Strategy 2: MACD Momentum
```
BUY  when MACD histogram crosses above zero (from negative)
SELL when MACD histogram crosses below zero (from positive)
```
Trend-following. Captures big directional moves but generates many false signals in choppy markets.

### Strategy 3: Bollinger Reversion
```
BUY  when price touches lower Bollinger Band (< 5th %B)
SELL when price touches upper Bollinger Band (> 95th %B)
```
Pure volatility-based entry. Works well when bands are tight (low volatility regime).

### Strategy 4: Hybrid (RSI + MACD Confirmation)
```
BUY  when RSI < 35 AND MACD histogram > 0
SELL when RSI > 65 OR MACD histogram < 0
```
The dual-confirmation approach. Reduces false signals dramatically by requiring two independent indicators to agree before entry. This is why it typically has the best Sharpe ratio of the four.

**Why backtesting matters:** Anyone can build a strategy that looks good in hindsight with cherry-picked parameters. A rigorous backtest over 1+ years with realistic assumptions separates real signal from noise. A Sharpe ratio > 1 means the strategy is generating more return per unit of risk than a simple buy-and-hold — that's a meaningful result.

**Limitations acknowledged:**
- No transaction costs (slippage, commissions) are modeled
- 1-year lookback may not capture full market cycles
- Survivorship bias: only testing tickers that are still publicly traded

---

## Data Sources

| Source | What We Pull | Key? | Limit |
|--------|-------------|------|-------|
| **Finnhub** | Quotes, candles (1Y daily), news sentiment, company profile | Yes (free) | 60 req/min |
| **FRED** | VIX, 10Y/2Y yields, Fed Funds, CPI, unemployment | Yes (free) | Unlimited |
| **CoinGecko** | BTC & ETH prices, 24h change, market caps | No | 10-50 req/min |
| **Alternative.me** | Fear & Greed Index, 10-day history | No | Generous |
| **Alpha Vantage** | Extended historical OHLCV (backup) | Yes (free) | 25/day |

All free. All public. The total API key registration time is under 5 minutes.

---

## Learning Journal

This section documents the 2-week learning process behind building NEXUS — the concepts studied, the dead ends hit, and how the architecture evolved.

### Week 1: Learning the Quant Finance Stack

**Days 1–2: What are financial returns, and why do quants use them instead of prices?**

The first thing I learned is that raw stock prices are nearly useless for statistical analysis. A price of $150 means nothing in isolation — what matters is whether that's up or down, and by how much relative to what's normal. Daily returns (`r_t = (P_t - P_{t-1}) / P_{t-1}`) solve this: they're unitless, comparable across assets, and — critically — *stationary*, meaning their statistical properties (mean, variance) don't drift over time the way raw prices do. This stationarity is required by most statistical and machine learning models.

I also learned about log returns (`ln(P_t / P_{t-1})`) which have nicer mathematical properties (they're additive over time), but simple returns are more intuitive for this project.

**Days 3–4: Implementing RSI from scratch**

The Wikipedia formula looked simple. The implementation was not. The naive version (straight average of gains/losses) produces different results from the "correct" Wilder smoothing version used by every professional platform. Wilder's method is a modified EMA with the formula `avg = (prev_avg × (n-1) + current) / n`, which gives much more weight to recent data than a simple rolling mean.

I verified my implementation against known RSI values for SPY from multiple sources before trusting it. This taught me an important lesson: in finance, *implementation details matter enormously*. Two people can implement RSI and get results that differ by several points if they use different smoothing methods.

**Days 5–7: MACD, Bollinger Bands, and the Z-score idea**

MACD was straightforward once I had EMA working. The interesting insight: the histogram (MACD minus Signal) is actually the second derivative of price momentum — it tells you whether momentum is accelerating or decelerating, not just its direction. A positive histogram that's shrinking means bullish momentum is fading, which is often a better early warning than waiting for the MACD line to cross.

Bollinger Bands introduced the concept of **volatility normalization** — using rolling standard deviation to create adaptive envelopes around price. The Bandwidth metric (`(Upper - Lower) / Middle`) captures how compressed or expanded the channel is, and extremely low bandwidth values historically precede explosive moves.

The Z-score approach came from reading about statistical process control (used in manufacturing to detect when a process goes out of control). Applied to financial returns, it answers: "Is today's move unusual relative to recent history?" This became the core of the anomaly detection engine.

### Week 2: Macro, Sentiment, and Fusion

**Days 8–9: Discovering FRED**

FRED (Federal Reserve Economic Data) is one of the most underutilized free resources in existence. 840,000 economic time series, maintained by the Federal Reserve Bank of St. Louis, completely free with a simple API. I spent half a day just exploring what's available — commodity prices, satellite imagery-based economic proxies, census data, international exchange rates.

For NEXUS, I focused on the series most directly relevant to equity markets: the yield curve, VIX, CPI, and unemployment. The yield curve (10Y - 2Y spread) was the most intellectually interesting to research. The fact that an inverted yield curve has predicted every U.S. recession since 1955 is one of the most robust empirical findings in macroeconomics — but most retail investors have never heard of it. Understanding *why* it predicts recessions (short-term rates rise when the Fed hikes to fight inflation, which squeezes bank lending margins, which contracts credit, which slows the economy) made the signal feel less like magic and more like cause-and-effect.

**Days 10–11: Sentiment analysis and behavioral finance**

Reading Daniel Kahneman's work (and the adjacent finance literature by Shiller, Thaler, and De Long) revealed something surprising: markets are not the perfectly rational machines classical economics assumes. Investor sentiment — fear, greed, narrative, social proof — can drive prices away from fundamental value for months or years.

The Fear & Greed Index is a composite built from seven market signals: stock price momentum, stock price strength (52-week highs vs. lows), stock price breadth, put/call ratios, junk bond demand, market volatility (VIX), and safe haven demand. I learned that the *contrarian* interpretation (buy when fear is extreme, reduce exposure when greed is extreme) has stronger empirical support than the momentum interpretation.

**Days 12–13: Building the Fusion Engine**

The hardest architectural decision was how to combine four heterogeneous signals into one score. Each domain produces values in different units (RSI is 0-100, yield spread is -1% to +3%, news sentiment is -1 to +1, BTC change is -20% to +20%). Normalizing everything to a 0-100 range before combining solves the units problem.

The weight selection (40/30/20/10) reflects a view about what drives equity prices at different timescales: technical signals dominate short-term moves, macro dominates medium-term regime, sentiment is noisier but real, and cross-asset is useful but not dominant. These weights are reasonable priors — a rigorous optimization would require years of labeled data to tune them properly.

**Day 14: Backtesting and humility**

The most humbling part of the project. I assumed the RSI strategy would obviously work — buy oversold, sell overbought, what could go wrong? The backtest showed it dramatically underperforms buy-and-hold on many tickers, especially in strong trending markets where "oversold" just means "the trend is accelerating downward."

This forced a real intellectual reckoning: most simple technical strategies don't work consistently. The hybrid strategy (requiring MACD confirmation of the RSI signal) performed better because dual confirmation reduces false signals. But even the hybrid is data-mined to some degree — it's been tested on historical data and the parameters chosen retrospectively. This is called overfitting, and it's the central methodological challenge in quantitative finance.

---

## What I Learned

### Finance concepts

- **Stationarity and returns** — why quants work with returns, not prices
- **Risk-adjusted performance** — Sharpe/Sortino ratios, why raw returns are misleading
- **Yield curve mechanics** — what the 2Y/10Y spread tells you about credit conditions and growth expectations
- **Behavioral finance** — how sentiment, narrative, and cognitive biases create exploitable patterns
- **Regime analysis** — markets are not stationary; volatility, correlation, and trend can shift suddenly
- **Backtesting methodology** — and why backtests almost always overestimate real-world performance

### Technical / Engineering

- **Node.js async patterns** — Promise.all for parallel API calls, graceful error handling
- **API design patterns** — rate limiting, caching, retry logic, pagination
- **Statistical implementation** — the gap between a formula on paper and a numerically stable implementation
- **CLI design** — chalk, ora spinners, cli-table3 for terminal UI
- **Environment variable management** — .env files, .gitignore, never commit secrets

### Architectural thinking

The most important design decision was separating the data layer (src/data/), analysis layer (src/analysis/), and display layer (src/display/) instead of writing one giant function. This separation makes each component independently testable and replaceable — if Finnhub changes their API, only finnhub.js needs to change. If I want to add a new visualization, only terminal.js changes.

---

## Roadmap

Future enhancements planned for v2.0:

- [ ] **Options flow integration** — unusual options activity is one of the most powerful alternative data signals (smart money positioning)
- [ ] **Sector correlation analysis** — detect when a stock is diverging from its sector
- [ ] **Portfolio mode** — analyze multiple tickers together and compute correlation matrix
- [ ] **SQLite caching layer** — cache API responses to stay under rate limits and enable offline mode
- [ ] **Email/SMS alerts** — trigger notifications when MIS crosses threshold or anomaly detected
- [ ] **Web export** — pipe terminal output to a static HTML file with embedded charts
- [ ] **Congressional trading tracker** — SEC Form 4 filings as alternative data signal
- [ ] **Earnings calendar integration** — auto-flag upcoming earnings as volatility events

---

## Disclaimer

NEXUS is an educational and research tool. Nothing in this codebase or its outputs constitutes financial advice. The Market Intelligence Score, signal outputs, and backtest results are for informational purposes only and are not recommendations to buy or sell any security. Past performance of any strategy does not guarantee future results. All investments involve risk, including the possible loss of principal.

The author is not a licensed financial advisor. Use this tool to learn about quantitative finance, not to make trading decisions.

---

## License

MIT License — see LICENSE file.

Built by **Jo** | Carmel High School, Indiana | 2025

*"I built this to understand finance the same way I understand everything else — by building it from scratch."*
