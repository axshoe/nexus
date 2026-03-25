// src/analysis/backtest.js
// ─────────────────────────────────────────────────────────────────────────────
// Strategy Backtesting Engine
//
// Strategies implemented:
//   1. RSI Mean Reversion     — buy oversold, sell overbought
//   2. MACD Momentum          — buy MACD cross up, sell cross down
//   3. Bollinger Reversion    — buy lower band, sell upper band
//   4. Hybrid (RSI + MACD)    — combined confirmation strategy
//
// Metrics computed:
//   Total Return, Buy-and-Hold Return, Alpha
//   Sharpe Ratio, Sortino Ratio
//   Max Drawdown, Win Rate
//   Number of Trades
// ─────────────────────────────────────────────────────────────────────────────

const { sharpeRatio, maxDrawdown } = require('./technical');

const STARTING_CAPITAL = 10000;

function runBacktest(closes, rsiVals, macdData, bb, strategyName = 'hybrid') {
  let cash = STARTING_CAPITAL;
  let shares = 0;
  let trades = 0;
  let wins = 0;
  let lastBuyPrice = null;
  const equity = [];
  const tradeLog = [];

  const startIdx = 30; // need enough data for indicators to warm up

  for (let i = startIdx; i < closes.length; i++) {
    const price = closes[i];
    const rsi = rsiVals[i];
    const macdHist = macdData.histogram[i];
    const macdLine = macdData.macd[i];
    const signalLine = macdData.signal[i];
    const bbPct = bb.upper[i] && bb.lower[i]
      ? (price - bb.lower[i]) / (bb.upper[i] - bb.lower[i])
      : 0.5;

    if (rsi === null || macdHist === null) {
      equity.push(cash + shares * price);
      continue;
    }

    let buySignal = false;
    let sellSignal = false;

    if (strategyName === 'rsi') {
      buySignal  = rsi < 30 && shares === 0;
      sellSignal = rsi > 70 && shares > 0;
    } else if (strategyName === 'macd') {
      const prevHist = macdData.histogram[i - 1];
      buySignal  = macdHist > 0 && prevHist <= 0 && shares === 0;
      sellSignal = macdHist < 0 && prevHist >= 0 && shares > 0;
    } else if (strategyName === 'bollinger') {
      buySignal  = bbPct < 0.05 && shares === 0;
      sellSignal = bbPct > 0.95 && shares > 0;
    } else {
      // Hybrid: RSI + MACD confirmation (reduces false signals)
      buySignal  = rsi < 35 && macdHist > 0 && shares === 0;
      sellSignal = (rsi > 65 || macdHist < 0) && shares > 0;
    }

    if (buySignal) {
      shares = Math.floor(cash / price);
      if (shares > 0) {
        cash -= shares * price;
        lastBuyPrice = price;
        tradeLog.push({ type: 'BUY', price, idx: i, date: i });
        trades++;
      }
    } else if (sellSignal && shares > 0) {
      cash += shares * price;
      if (lastBuyPrice && price > lastBuyPrice) wins++;
      tradeLog.push({ type: 'SELL', price, idx: i, pnl: (price - lastBuyPrice) / lastBuyPrice * 100 });
      shares = 0;
      lastBuyPrice = null;
      trades++;
    }

    equity.push(cash + shares * price);
  }

  // Liquidate any remaining position at last price
  const finalPrice = closes[closes.length - 1];
  const finalEquity = cash + shares * finalPrice;
  const equityFull = equity.length > 0 ? equity : [STARTING_CAPITAL];

  const rets = equityFull.slice(1).map((e, i) =>
    equityFull[i] > 0 ? (e - equityFull[i]) / equityFull[i] : 0
  );

  const totalReturn = (finalEquity - STARTING_CAPITAL) / STARTING_CAPITAL * 100;
  const buyHoldReturn = (closes[closes.length - 1] - closes[startIdx]) / closes[startIdx] * 100;
  const alpha = totalReturn - buyHoldReturn;
  const dd = maxDrawdown(equityFull);
  const sharpe = rets.length > 0 ? sharpeRatio(rets) : 0;
  const winRate = trades > 0 ? ((wins / Math.ceil(trades / 2)) * 100).toFixed(1) : 'N/A';

  // Generate buy-and-hold equity for comparison
  const bhStartPrice = closes[startIdx];
  const bhEquity = closes.slice(startIdx).map(p => STARTING_CAPITAL * p / bhStartPrice);

  return {
    strategy: strategyName,
    startingCapital: STARTING_CAPITAL,
    finalEquity: parseFloat(finalEquity.toFixed(2)),
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    buyHoldReturn: parseFloat(buyHoldReturn.toFixed(2)),
    alpha: parseFloat(alpha.toFixed(2)),
    sharpe,
    maxDrawdown: dd.maxDrawdown,
    trades,
    winRate,
    equity: equityFull,
    bhEquity,
    tradeLog: tradeLog.slice(-10), // last 10 trades
  };
}

// Run all 4 strategies and pick the best by Sharpe
function runAllStrategies(closes, rsiVals, macdData, bb) {
  const strategies = ['rsi', 'macd', 'bollinger', 'hybrid'];
  const results = {};
  for (const s of strategies) {
    results[s] = runBacktest(closes, rsiVals, macdData, bb, s);
  }
  // Find best by Sharpe ratio
  const best = Object.entries(results).sort((a, b) => b[1].sharpe - a[1].sharpe)[0];
  return { all: results, best: best[1], bestName: best[0] };
}

module.exports = { runBacktest, runAllStrategies };
