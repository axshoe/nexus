#!/usr/bin/env node

// src/index.js
// ─────────────────────────────────────────────────────────────────────────────
// NEXUS Market Intelligence System — Entry Point
//
// Usage:
//   node src/index.js AAPL
//   node src/index.js TSLA --macro-only
//   node src/index.js NVDA --demo
//   node src/index.js SPY AAPL TSLA   (multi-ticker comparison)
//
// Environment: copy .env.example to .env and fill in your free API keys
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const chalk = require('chalk');
const ora   = require('ora');

const { getQuote, getCandles, getNewsSentiment, getProfile } = require('./data/finnhub');
const { getMacroData }    = require('./data/fred');
const { getFearGreed, getCryptoData } = require('./data/feargreed');
const { computeAll }      = require('./analysis/technical');
const { detectAnomalies } = require('./analysis/anomaly');
const { analyzeMacro }    = require('./analysis/macro');
const { runAllStrategies } = require('./analysis/backtest');
const { computeMIS }      = require('./engine/signal');
const { render }          = require('./display/terminal');

// ── Config ────────────────────────────────────────────────────────────────────
const FINNHUB_KEY    = process.env.FINNHUB_API_KEY;
const FRED_KEY       = process.env.FRED_API_KEY;
const ALPHA_KEY      = process.env.ALPHA_VANTAGE_KEY;

// ── Demo data generator (for --demo flag, no API key needed) ─────────────────
function generateDemoCandles(n = 252) {
  const candles = [];
  let price = 180 + Math.random() * 40;
  const now = new Date();
  for (let i = n; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const drift = 0.0003;
    const vol = 0.014 + Math.random() * 0.008;
    // Inject a few anomalous days for interesting output
    const shock = (i === 40 || i === 100) ? (Math.random() > 0.5 ? 0.06 : -0.07) : 0;
    price = Math.max(50, price * Math.exp(drift + vol * (Math.random() * 2 - 1) + shock));
    const h = price * (1 + Math.random() * 0.01);
    const l = price * (1 - Math.random() * 0.01);
    const o = l + Math.random() * (h - l);
    candles.push({
      date: d.toISOString().slice(0, 10),
      open: parseFloat(o.toFixed(2)),
      high: parseFloat(h.toFixed(2)),
      low:  parseFloat(l.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      volume: Math.floor(40e6 + Math.random() * 30e6),
    });
  }
  return candles;
}

// ── Core analysis pipeline ────────────────────────────────────────────────────
async function analyze(symbol, opts = {}) {
  const startTime = Date.now();
  const isDemo = opts.demo;
  const spinner = ora({ text: chalk.cyan(`Initializing NEXUS for ${symbol}...`), color: 'cyan' }).start();

  let candles, quote, profile, sentiment, macroRaw, macroAnalysis, fearGreed, cryptoData;

  // ── Step 1: Market data ──────────────────────────────────────────────────
  spinner.text = chalk.cyan('Fetching market data...');
  try {
    if (isDemo) {
      candles = generateDemoCandles(252);
      const lastClose = candles[candles.length - 1].close;
      const prevClose = candles[candles.length - 2].close;
      quote = {
        current: lastClose,
        change: lastClose - prevClose,
        changePct: ((lastClose - prevClose) / prevClose) * 100,
        high: candles[candles.length - 1].high,
        low: candles[candles.length - 1].low,
        open: candles[candles.length - 1].open,
        prevClose,
      };
      profile = { name: `${symbol} Inc. (Demo)`, sector: 'Technology', exchange: 'NASDAQ', marketCap: 2800 };
    } else {
      if (!FINNHUB_KEY) throw new Error('FINNHUB_API_KEY not set. Copy .env.example to .env and add your key.');
      [quote, profile] = await Promise.all([
        getQuote(symbol, FINNHUB_KEY),
        getProfile(symbol, FINNHUB_KEY),
      ]);
      try {
        candles = await getCandles(symbol, FINNHUB_KEY);
      } catch (e) {
          console.log(chalk.yellow('  Note: Using synthetic price history (Alpha Vantage fetch failed)'));
        candles = generateDemoCandles(252);
      }
    }
  } catch (err) {
    spinner.fail(chalk.red(`Market data error: ${err.message}`));
    console.log(chalk.gray('\nTip: Run with --demo flag to test without API keys: nexus AAPL --demo'));
    process.exit(1);
  }

  // ── Step 2: Technical analysis ───────────────────────────────────────────
  spinner.text = chalk.cyan('Running quantitative engine...');
  let technicals;
  try {
    technicals = computeAll(candles);
  } catch (err) {
    spinner.fail(chalk.red(`Technical analysis error: ${err.message}`));
    process.exit(1);
  }

  // ── Step 3: Anomaly detection ────────────────────────────────────────────
  spinner.text = chalk.cyan('Detecting statistical anomalies...');
  const anomalies = detectAnomalies(technicals, candles);

  // ── Step 4: Macro (FRED) ─────────────────────────────────────────────────
  spinner.text = chalk.cyan('Pulling macro data from FRED...');
  try {
    if (isDemo || !FRED_KEY) {
      // Synthetic macro for demo
      macroRaw = {
        VIX:          { current: 18.5, previous: 17.2, change: 1.3, description: 'CBOE Volatility Index', history: [18.5,17.2,16.8,19.1] },
        '10Y_Yield':  { current: 4.35, previous: 4.28, change: 0.07, description: '10-Year Treasury Yield', history: [4.35,4.28,4.22] },
        '2Y_Yield':   { current: 4.85, previous: 4.92, change: -0.07, description: '2-Year Treasury Yield', history: [4.85,4.92,5.0] },
        FedFunds:     { current: 5.33, previous: 5.33, change: 0, description: 'Federal Funds Rate', history: [5.33,5.33,5.33] },
        CPI:          { current: 314.2, previous: 313.7, change: 0.5, description: 'Consumer Price Index', history: [314.2,313.7] },
        Unemployment: { current: 3.9, previous: 3.7, change: 0.2, description: 'Unemployment Rate', history: [3.9,3.7] },
        YieldSpread:  { current: -0.50, inverted: true, regime: 'Inverted (Warning)', description: '10Y-2Y Spread' },
      };
    } else {
      macroRaw = await getMacroData(FRED_KEY);
    }
    macroAnalysis = analyzeMacro(macroRaw);
  } catch (err) {
    spinner.warn(chalk.yellow(`Macro data issue (continuing): ${err.message}`));
    macroAnalysis = null;
  }

  // ── Step 5: Sentiment + Cross-asset ─────────────────────────────────────
  spinner.text = chalk.cyan('Fetching sentiment & cross-asset data...');
  try {
    if (isDemo) {
      sentiment = { score: 0.18, label: 'Positive', articleCount: 14, headlines: [
        { title: `${symbol} Q4 earnings beat estimates, stock rises on guidance`, source: 'Reuters', datetime: '2025-03-20' },
        { title: `Analysts upgrade ${symbol} after strong product cycle data`, source: 'Bloomberg', datetime: '2025-03-19' },
        { title: `${symbol} expands into new markets amid macro uncertainty`, source: 'FT', datetime: '2025-03-18' },
      ]};
      fearGreed = { score: 38, label: 'Fear', regime: 'Fear', trend7d: -4, trendLabel: 'Cooling', history: [] };
      cryptoData = { bitcoin: { price: 67420, change24h: -1.8, marketCap: 1.33e12 }, ethereum: { price: 3210, change24h: -2.1, marketCap: 3.85e11 } };
    } else {
      const [fg, crypto] = await Promise.all([getFearGreed(), getCryptoData()]);
      fearGreed = fg;
      cryptoData = crypto;
      // News sentiment via Finnhub
      if (FINNHUB_KEY) {
        sentiment = await getNewsSentiment(symbol, FINNHUB_KEY);
      } else {
        sentiment = { score: 0, label: 'Neutral', articleCount: 0, headlines: [] };
      }
    }
  } catch (err) {
    spinner.warn(chalk.yellow(`Sentiment data issue (continuing): ${err.message}`));
    fearGreed = { score: 50, label: 'Neutral', regime: 'Neutral', trend7d: 0, trendLabel: 'Stable' };
    cryptoData = { bitcoin: null, ethereum: null };
    sentiment = { score: 0, label: 'Neutral', articleCount: 0, headlines: [] };
  }

  // ── Step 6: Backtest ─────────────────────────────────────────────────────
  spinner.text = chalk.cyan('Running backtest engine...');
  let backtest = null;
  try {
    const { raw } = technicals;
    backtest = runAllStrategies(raw.closes, raw.rsiVals, raw.macdData, raw.bb);
  } catch (err) {
    spinner.warn(chalk.yellow(`Backtest issue (continuing): ${err.message}`));
  }

  // ── Step 7: Fusion engine ────────────────────────────────────────────────
  spinner.text = chalk.cyan('Computing Market Intelligence Score...');
  const fusion = computeMIS(technicals, macroAnalysis, sentiment, cryptoData, fearGreed);

  spinner.succeed(chalk.greenBright('Analysis complete.'));

  const durationMs = Date.now() - startTime;

  // ── Render ───────────────────────────────────────────────────────────────
  render({
    symbol,
    profile,
    quote,
    technicals,
    macroAnalysis,
    sentiment,
    fearGreed,
    cryptoData,
    anomalies,
    backtest,
    fusion,
    durationMs,
  });
}

// ── Multi-ticker comparison ───────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
  const isDemo = flags.includes('--demo');

  if (args.length === 0) {
    console.log(chalk.cyan('\n  NEXUS — Quantitative Market Intelligence System'));
    console.log(chalk.gray('  Usage: node src/index.js <TICKER> [--demo]'));
    console.log(chalk.gray('  Example: node src/index.js AAPL'));
    console.log(chalk.gray('  Example: node src/index.js TSLA --demo'));
    console.log(chalk.gray('\n  Keys needed: FINNHUB_API_KEY, FRED_API_KEY (all free)'));
    console.log(chalk.gray('  See .env.example for setup instructions\n'));
    process.exit(0);
  }

  for (const symbol of args) {
    await analyze(symbol.toUpperCase(), { demo: isDemo });
    if (args.length > 1) {
      await new Promise(r => setTimeout(r, 1200)); // rate limit courtesy pause
    }
  }
}

main().catch(err => {
  console.error(chalk.red('\n[NEXUS ERROR] ' + err.message));
  if (err.response?.data) console.error(chalk.gray(JSON.stringify(err.response.data)));
  process.exit(1);
});
