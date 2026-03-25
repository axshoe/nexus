// src/analysis/technical.js
// ─────────────────────────────────────────────────────────────────────────────
// Quantitative Technical Analysis Engine
// All formulas implemented from scratch — no financial libraries.
//
// Implemented:
//   RSI (Wilder smoothing)     — momentum oscillator
//   MACD (EMA cross)           — trend + momentum
//   Bollinger Bands            — volatility envelope
//   Moving Averages (SMA/EMA)  — trend direction
//   Rolling Z-scores           — statistical normalization
//   Rolling Volatility         — annualized standard deviation
//   Sharpe Ratio               — risk-adjusted return
//   Max Drawdown               — worst peak-to-trough loss
//   ATR (Average True Range)   — volatility measure for stops
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────

function returns(prices) {
  return prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
}

function sma(arr, n) {
  return arr.map((_, i) =>
    i < n - 1 ? null : arr.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n
  );
}

function rollingStd(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null;
    const w = arr.slice(i - n + 1, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(w.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / n);
  });
}

function ema(arr, n) {
  const k = 2 / (n + 1);
  const result = [arr[0]];
  for (let i = 1; i < arr.length; i++) {
    result.push(arr[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

// ── RSI (Wilder's Smoothing Method) ─────────────────────────────────────────
function rsi(prices, period = 14) {
  const rets = returns(prices);
  const gains = rets.map(r => (r > 0 ? r : 0));
  const losses = rets.map(r => (r < 0 ? -r : 0));

  // Seed with simple averages for first period
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const result = new Array(period + 1).fill(null);

  // Wilder smoothing for subsequent values
  for (let i = period; i < rets.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)));
  }
  return result;
}

// ── MACD ─────────────────────────────────────────────────────────────────────
function macd(prices, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(prices, fast);
  const emaSlow = ema(prices, slow);
  const macdLine = emaFast.map((v, i) => parseFloat((v - emaSlow[i]).toFixed(4)));
  const signalLine = ema(macdLine, signal).map(v => parseFloat(v.toFixed(4)));
  const histogram = macdLine.map((v, i) => parseFloat((v - signalLine[i]).toFixed(4)));
  return { macd: macdLine, signal: signalLine, histogram };
}

// ── Bollinger Bands ──────────────────────────────────────────────────────────
function bollingerBands(prices, period = 20, numStd = 2) {
  const mid = sma(prices, period);
  const std = rollingStd(prices, period);
  return {
    upper: mid.map((m, i) => m !== null ? parseFloat((m + numStd * std[i]).toFixed(4)) : null),
    mid:   mid.map(m => m !== null ? parseFloat(m.toFixed(4)) : null),
    lower: mid.map((m, i) => m !== null ? parseFloat((m - numStd * std[i]).toFixed(4)) : null),
    bandwidth: mid.map((m, i) => m !== null && m !== 0 ? parseFloat(((4 * numStd * std[i]) / m).toFixed(4)) : null),
  };
}

// ── Rolling Z-scores ─────────────────────────────────────────────────────────
function zScores(arr, window = 20) {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const w = arr.slice(i - window + 1, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / window;
    const s = Math.sqrt(w.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / window);
    return s === 0 ? 0 : parseFloat(((arr[i] - m) / s).toFixed(3));
  });
}

// ── Rolling Annualized Volatility ────────────────────────────────────────────
function rollingVolatility(prices, window = 20) {
  const rets = returns(prices);
  return rets.map((_, i) => {
    if (i < window - 1) return null;
    const w = rets.slice(i - window + 1, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / window;
    const variance = w.map(x => (x - m) ** 2).reduce((a, b) => a + b, 0) / window;
    return parseFloat((Math.sqrt(variance * 252) * 100).toFixed(2)); // annualized %
  });
}

// ── ATR (Average True Range) ─────────────────────────────────────────────────
function atr(candles, period = 14) {
  const trueRanges = candles.slice(1).map((c, i) => {
    const prev = candles[i];
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close)
    );
  });
  // Wilder smoothing
  let atrVal = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = new Array(period + 1).fill(null);
  for (let i = period; i < trueRanges.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]) / period;
    result.push(parseFloat(atrVal.toFixed(4)));
  }
  return result;
}

// ── Sharpe Ratio ─────────────────────────────────────────────────────────────
function sharpeRatio(dailyReturns, riskFreeAnnual = 0.05) {
  const rf = riskFreeAnnual / 252; // daily risk-free rate
  const excess = dailyReturns.map(r => r - rf);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const std = Math.sqrt(excess.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / excess.length);
  return std === 0 ? 0 : parseFloat(((mean / std) * Math.sqrt(252)).toFixed(3));
}

// ── Sortino Ratio (penalizes only downside volatility) ───────────────────────
function sortinoRatio(dailyReturns, riskFreeAnnual = 0.05) {
  const rf = riskFreeAnnual / 252;
  const excess = dailyReturns.map(r => r - rf);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const downside = excess.filter(r => r < 0);
  const downsideStd = Math.sqrt(
    downside.map(r => r ** 2).reduce((a, b) => a + b, 0) / downside.length
  );
  return downsideStd === 0 ? 0 : parseFloat(((mean / downsideStd) * Math.sqrt(252)).toFixed(3));
}

// ── Maximum Drawdown ─────────────────────────────────────────────────────────
function maxDrawdown(prices) {
  let peak = prices[0];
  let maxDD = 0;
  let drawdownStart = 0, drawdownEnd = 0, peakIdx = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i];
      peakIdx = i;
    }
    const dd = (peak - prices[i]) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      drawdownEnd = i;
      drawdownStart = peakIdx;
    }
  }
  return {
    maxDrawdown: parseFloat((maxDD * 100).toFixed(2)),
    startIdx: drawdownStart,
    endIdx: drawdownEnd,
  };
}

// ── Compile all latest indicators into one object ────────────────────────────
function computeAll(candles) {
  const closes = candles.map(c => c.close);
  const N = closes.length;

  const rets = returns(closes);
  const rsiVals = rsi(closes);
  const macdData = macd(closes);
  const bb = bollingerBands(closes);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const vol20 = rollingVolatility(closes, 20);
  const retZ = zScores(rets, 20);
  const priceZ = zScores(closes, 30);
  const atrVals = atr(candles);

  const price = closes[N - 1];
  const latestRSI = rsiVals.filter(x => x !== null).slice(-1)[0];
  const latestMACD = macdData.macd.slice(-1)[0];
  const latestSignal = macdData.signal.slice(-1)[0];
  const latestHist = macdData.histogram.slice(-1)[0];
  const latestUpper = bb.upper.filter(x => x !== null).slice(-1)[0];
  const latestMid = bb.mid.filter(x => x !== null).slice(-1)[0];
  const latestLower = bb.lower.filter(x => x !== null).slice(-1)[0];
  const latestMA20 = ma20.filter(x => x !== null).slice(-1)[0];
  const latestMA50 = ma50.filter(x => x !== null).slice(-1)[0];
  const latestMA200 = ma200.filter(x => x !== null).slice(-1)[0];
  const latestVol = vol20.filter(x => x !== null).slice(-1)[0];
  const latestRetZ = retZ.filter(x => x !== null).slice(-1)[0] || 0;
  const latestPriceZ = priceZ.filter(x => x !== null).slice(-1)[0] || 0;
  const latestATR = atrVals.filter(x => x !== null).slice(-1)[0];

  const bbPct = latestUpper !== latestLower
    ? (price - latestLower) / (latestUpper - latestLower)
    : 0.5;

  // Volatility regime
  const recentVol = vol20.filter(x => x !== null).slice(-5);
  const historicVol = vol20.filter(x => x !== null).slice(-60, -5);
  const avgRecent = recentVol.reduce((a, b) => a + b, 0) / (recentVol.length || 1);
  const avgHistoric = historicVol.reduce((a, b) => a + b, 0) / (historicVol.length || 1);
  const volRatio = avgRecent / (avgHistoric || 1);

  // Golden/Death cross
  const goldenCross = latestMA50 && latestMA200 && latestMA50 > latestMA200;
  const deathCross = latestMA50 && latestMA200 && latestMA50 < latestMA200;

  const dd = maxDrawdown(closes);
  const sharpe = sharpeRatio(rets);
  const sortino = sortinoRatio(rets);

  return {
    price,
    change: closes[N - 1] - closes[N - 2],
    changePct: ((closes[N - 1] - closes[N - 2]) / closes[N - 2]) * 100,
    rsi: latestRSI,
    macd: { line: latestMACD, signal: latestSignal, histogram: latestHist },
    bollinger: {
      upper: latestUpper, mid: latestMid, lower: latestLower, pct: bbPct,
      bandwidth: bb.bandwidth.filter(x => x !== null).slice(-1)[0],
    },
    movingAverages: { ma20: latestMA20, ma50: latestMA50, ma200: latestMA200 },
    crossSignals: { goldenCross, deathCross },
    volatility: {
      annualized: latestVol,
      atr: latestATR,
      ratio: parseFloat(volRatio.toFixed(3)),
      regime: volRatio > 2.5 ? 'Extreme' : volRatio > 1.5 ? 'Elevated' : volRatio > 0.8 ? 'Normal' : 'Low',
    },
    zscores: { return: latestRetZ, price: latestPriceZ },
    risk: { sharpe, sortino, maxDrawdown: dd.maxDrawdown },
    dataPoints: N,
    // Raw arrays for charting/backtest
    raw: { closes, rets, rsiVals, macdData, bb, ma20, ma50, ma200, retZ, vol20 },
  };
}

module.exports = { computeAll, rsi, macd, bollingerBands, sma, ema, zScores, returns, sharpeRatio, maxDrawdown, rollingVolatility };
