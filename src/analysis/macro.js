// src/analysis/macro.js
// ─────────────────────────────────────────────────────────────────────────────
// Macro Environment Interpreter
// Translates raw FRED data into market regime signals
//
// Framework: "4-Quadrant Macro Regime"
//   Quadrant I:   Growth up,  Inflation down  → Risk-ON (best for stocks)
//   Quadrant II:  Growth up,  Inflation up    → Reflation (commodities win)
//   Quadrant III: Growth down, Inflation up   → Stagflation (worst regime)
//   Quadrant IV:  Growth down, Inflation down → Deflation/Recession (bonds win)
// ─────────────────────────────────────────────────────────────────────────────

function analyzeMacro(macroData) {
  const signals = [];
  let riskScore = 50; // baseline neutral

  // ── VIX Analysis ──────────────────────────────────────────────────────────
  const vix = macroData['VIX'];
  if (vix?.current !== null) {
    const vixVal = vix.current;
    let vixRegime, vixImpact;
    if (vixVal < 15) {
      vixRegime = 'Complacency';
      vixImpact = +8;
      signals.push({
        name: 'VIX',
        value: vixVal,
        label: `${vixVal.toFixed(1)} — Complacency (contrarian warning)`,
        signal: 'NEUTRAL',
        detail: `VIX below 15 suggests extreme investor complacency. Markets tend to be most vulnerable when fear is absent. This is often when corrections begin.`,
      });
    } else if (vixVal < 20) {
      vixRegime = 'Low Volatility';
      vixImpact = +5;
      signals.push({ name: 'VIX', value: vixVal, label: `${vixVal.toFixed(1)} — Low Vol`, signal: 'BULLISH', detail: 'Normal low-volatility environment. Risk appetite is healthy.' });
    } else if (vixVal < 30) {
      vixRegime = 'Elevated';
      vixImpact = -5;
      signals.push({ name: 'VIX', value: vixVal, label: `${vixVal.toFixed(1)} — Elevated`, signal: 'CAUTION', detail: 'Elevated market fear. Increased uncertainty but not panic.' });
    } else {
      vixRegime = 'Fear / Panic';
      vixImpact = -15;
      signals.push({ name: 'VIX', value: vixVal, label: `${vixVal.toFixed(1)} — Fear/Panic`, signal: 'BEARISH', detail: 'VIX above 30 signals fear or near-panic conditions. Historically, this marks buying opportunities for contrarian investors — but volatility can persist.' });
    }
    riskScore += vixImpact;
  }

  // ── Yield Curve ───────────────────────────────────────────────────────────
  const yc = macroData['YieldSpread'];
  if (yc) {
    const spread = yc.current;
    if (yc.inverted) {
      riskScore -= 12;
      signals.push({
        name: 'Yield Curve',
        value: spread,
        label: `${spread.toFixed(3)}% — INVERTED ⚠`,
        signal: 'BEARISH',
        detail: `An inverted yield curve (2Y > 10Y) has preceded every U.S. recession since 1955. ` +
                `Current spread: ${spread.toFixed(3)}%. This doesn't predict timing — recessions ` +
                `can follow 6-24 months later — but it's the single most reliable macro warning signal.`,
      });
    } else if (spread < 0.5) {
      riskScore -= 5;
      signals.push({ name: 'Yield Curve', value: spread, label: `${spread.toFixed(3)}% — Flat`, signal: 'CAUTION', detail: 'Flat yield curve. Not inverted yet but narrowing. Growth concerns emerging.' });
    } else {
      riskScore += 5;
      signals.push({ name: 'Yield Curve', value: spread, label: `${spread.toFixed(3)}% — Normal`, signal: 'BULLISH', detail: 'Normal upward-sloping yield curve. Markets pricing in continued economic growth.' });
    }
  }

  // ── Federal Funds Rate ────────────────────────────────────────────────────
  const fed = macroData['FedFunds'];
  if (fed?.current !== null) {
    const rate = fed.current;
    const change = fed.change || 0;
    if (change > 0) {
      riskScore -= 8;
      signals.push({ name: 'Fed Funds Rate', value: rate, label: `${rate.toFixed(2)}% — HIKING`, signal: 'BEARISH', detail: `Fed is tightening. Historically, rate hike cycles compress P/E multiples by 15-25%. Higher rates mean lower present value of future earnings — headwind for growth stocks especially.` });
    } else if (change < 0) {
      riskScore += 8;
      signals.push({ name: 'Fed Funds Rate', value: rate, label: `${rate.toFixed(2)}% — CUTTING`, signal: 'BULLISH', detail: 'Fed is cutting rates. Easing monetary policy historically drives equity markets higher as borrowing costs fall and risk appetite increases.' });
    } else {
      signals.push({ name: 'Fed Funds Rate', value: rate, label: `${rate.toFixed(2)}% — On Hold`, signal: 'NEUTRAL', detail: 'Fed holding rates steady. No near-term monetary policy catalyst for markets.' });
    }
  }

  // ── CPI (Inflation) ───────────────────────────────────────────────────────
  const cpi = macroData['CPI'];
  if (cpi?.current !== null && cpi?.previous !== null) {
    // Calculate YoY approximately from monthly change
    const monthlyChange = ((cpi.current - cpi.previous) / cpi.previous) * 100;
    const approxYoY = monthlyChange * 12;
    if (approxYoY > 4) {
      riskScore -= 8;
      signals.push({ name: 'CPI / Inflation', value: approxYoY, label: `~${approxYoY.toFixed(1)}% ann. — HIGH`, signal: 'BEARISH', detail: 'High inflation pressures force the Fed to maintain restrictive policy. Erodes real returns and compresses valuations.' });
    } else if (approxYoY > 2) {
      signals.push({ name: 'CPI / Inflation', value: approxYoY, label: `~${approxYoY.toFixed(1)}% ann. — Elevated`, signal: 'NEUTRAL', detail: 'Above Fed target of 2% but moderating. Markets watching for sustained decline toward target.' });
    } else {
      riskScore += 5;
      signals.push({ name: 'CPI / Inflation', value: approxYoY, label: `~${approxYoY.toFixed(1)}% ann. — Near Target`, signal: 'BULLISH', detail: 'Inflation near or below Fed 2% target. Creates room for rate cuts if growth slows.' });
    }
  }

  // ── Unemployment ──────────────────────────────────────────────────────────
  const unemp = macroData['Unemployment'];
  if (unemp?.current !== null) {
    const rate = unemp.current;
    const change = unemp.change || 0;
    if (rate < 4.5 && change <= 0) {
      riskScore += 5;
      signals.push({ name: 'Unemployment', value: rate, label: `${rate.toFixed(1)}% — Strong`, signal: 'BULLISH', detail: 'Labor market is strong. Consumer spending is robust — positive for corporate revenues.' });
    } else if (change > 0.3) {
      riskScore -= 8;
      signals.push({ name: 'Unemployment', value: rate, label: `${rate.toFixed(1)}% — Rising ⚠`, signal: 'BEARISH', detail: `Unemployment rising by ${change.toFixed(1)}%. Weakening labor market signals potential slowdown. Watch for consumer spending deceleration.` });
    } else {
      signals.push({ name: 'Unemployment', value: rate, label: `${rate.toFixed(1)}% — Normal`, signal: 'NEUTRAL', detail: 'Unemployment within normal range. No significant labor market stress.' });
    }
  }

  // ── Macro Regime Classification ────────────────────────────────────────────
  riskScore = Math.max(0, Math.min(100, riskScore));
  let regime;
  if (riskScore >= 70)      regime = 'RISK-ON (Goldilocks)';
  else if (riskScore >= 55) regime = 'MODERATELY BULLISH';
  else if (riskScore >= 45) regime = 'NEUTRAL / MIXED';
  else if (riskScore >= 30) regime = 'RISK-OFF (Caution)';
  else                      regime = 'RISK-OFF (Defensive)';

  return {
    regime,
    riskScore: Math.round(riskScore),
    signals,
    summary: buildMacroSummary(signals, riskScore),
  };
}

function buildMacroSummary(signals, score) {
  const bearish = signals.filter(s => s.signal === 'BEARISH').length;
  const bullish = signals.filter(s => s.signal === 'BULLISH').length;
  if (bearish > bullish + 1) return `Macro environment is broadly restrictive. ${bearish} bearish macro signals vs ${bullish} bullish. Risk-adjusted positioning advised.`;
  if (bullish > bearish + 1) return `Macro backdrop is supportive. ${bullish} bullish signals. Growth and liquidity conditions are favorable for risk assets.`;
  return `Mixed macro signals. Investors should look to individual company fundamentals rather than broad market momentum for conviction.`;
}

module.exports = { analyzeMacro };
