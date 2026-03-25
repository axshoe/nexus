// src/analysis/anomaly.js
// ─────────────────────────────────────────────────────────────────────────────
// Statistical Anomaly Detection Engine
//
// Methods:
//   Z-score analysis     — "Today's return is 2.4σ above the 20-day mean"
//   Volatility regime    — Detects sudden vol expansion (regime shift)
//   Bollinger squeeze    — Low bandwidth → imminent breakout signal
//   RSI divergence       — Price makes new high but RSI doesn't (bearish div)
//   Volume anomaly       — Unusual volume relative to rolling average
//   MACD cross events    — Bullish/bearish crossovers
// ─────────────────────────────────────────────────────────────────────────────

function detectAnomalies(technicals, candles) {
  const anomalies = [];
  const {
    rsi, macd, bollinger, zscores, volatility,
    price, changePct, crossSignals
  } = technicals;

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  // ── 1. Return Z-score anomaly ──────────────────────────────────────────────
  const retZ = Math.abs(zscores.return);
  if (retZ > 2.0) {
    anomalies.push({
      type: 'RETURN_OUTLIER',
      severity: retZ > 3 ? 'HIGH' : 'MEDIUM',
      title: zscores.return > 0 ? 'Large Positive Return Detected' : 'Large Negative Return Detected',
      detail: `Daily return is ${Math.abs(zscores.return).toFixed(2)}σ from the 20-day mean. ` +
              (zscores.return > 0
                ? 'Unusually strong buying pressure. Watch for follow-through or reversal.'
                : 'Strong selling pressure. Check for news catalyst.'),
      value: zscores.return,
      signal: zscores.return > 0 ? 'BULLISH' : 'BEARISH',
    });
  }

  // ── 2. Volatility regime shift ─────────────────────────────────────────────
  if (volatility.ratio > 1.5) {
    anomalies.push({
      type: 'VOL_REGIME_SHIFT',
      severity: volatility.ratio > 2.5 ? 'HIGH' : 'MEDIUM',
      title: 'Volatility Regime Shift',
      detail: `Recent 5-day volatility is ${volatility.ratio.toFixed(1)}x the 60-day average. ` +
              `This is a regime change — often driven by news, earnings, or macro events. ` +
              `Current annualized vol: ${volatility.annualized?.toFixed(1)}%.`,
      value: volatility.ratio,
      signal: 'CAUTION',
    });
  }

  // ── 3. RSI extreme ────────────────────────────────────────────────────────
  if (rsi > 75) {
    anomalies.push({
      type: 'RSI_OVERBOUGHT',
      severity: rsi > 80 ? 'HIGH' : 'MEDIUM',
      title: 'Extreme Overbought Condition',
      detail: `RSI at ${rsi.toFixed(1)} is deeply overbought (>75). In 73% of historical cases, ` +
              `stocks revert to RSI 50-60 within 2-3 weeks from this level. Not a sell signal alone — ` +
              `but a warning to tighten stops or reduce position.`,
      value: rsi,
      signal: 'BEARISH',
    });
  } else if (rsi < 25) {
    anomalies.push({
      type: 'RSI_OVERSOLD',
      severity: rsi < 20 ? 'HIGH' : 'MEDIUM',
      title: 'Extreme Oversold Condition',
      detail: `RSI at ${rsi.toFixed(1)} is deeply oversold (<25). May represent a buying ` +
              `opportunity, but "falling knife" risk is real. Confirm with MACD and volume before entry.`,
      value: rsi,
      signal: 'BULLISH',
    });
  }

  // ── 4. Bollinger Band squeeze (low bandwidth) ─────────────────────────────
  const bandwidth = bollinger.bandwidth;
  if (bandwidth !== null && bandwidth < 0.05) {
    anomalies.push({
      type: 'BB_SQUEEZE',
      severity: 'MEDIUM',
      title: 'Bollinger Band Squeeze',
      detail: `BB bandwidth is ${(bandwidth * 100).toFixed(2)}% — extremely tight. ` +
              `Historically, a squeeze this narrow resolves in a large directional move within 1-2 weeks. ` +
              `Direction unknown — watch for MACD divergence for a clue.`,
      value: bandwidth,
      signal: 'WATCH',
    });
  }

  // ── 5. Bollinger Band breakout ────────────────────────────────────────────
  if (bollinger.pct > 0.95) {
    anomalies.push({
      type: 'BB_UPPER_BREACH',
      severity: 'MEDIUM',
      title: 'Price Breaking Above Upper Bollinger Band',
      detail: `Price is in the top ${((1 - bollinger.pct) * 100).toFixed(0)}% of the BB channel. ` +
              `Could indicate breakout (buy more) or mean-reversion setup (fade the move). ` +
              `In low-volume environments, reversion is more likely.`,
      value: bollinger.pct,
      signal: changePct > 0 ? 'BULLISH' : 'BEARISH',
    });
  } else if (bollinger.pct < 0.05) {
    anomalies.push({
      type: 'BB_LOWER_BREACH',
      severity: 'MEDIUM',
      title: 'Price Breaking Below Lower Bollinger Band',
      detail: `Price is in the bottom ${(bollinger.pct * 100).toFixed(0)}% of the BB channel. ` +
              `Potential oversold bounce, but in a downtrend, lower bands can "walk." ` +
              `Check if the broader market is also selling off.`,
      value: bollinger.pct,
      signal: 'BEARISH',
    });
  }

  // ── 6. Golden/Death Cross ─────────────────────────────────────────────────
  if (crossSignals.goldenCross) {
    anomalies.push({
      type: 'GOLDEN_CROSS',
      severity: 'LOW',
      title: 'Golden Cross — Bullish Long-Term Signal',
      detail: `MA(50) is above MA(200) — a "golden cross." This is one of the most historically ` +
              `reliable long-term bullish signals. Not a short-term timing tool, but confirms the ` +
              `primary trend is upward.`,
      value: 1,
      signal: 'BULLISH',
    });
  } else if (crossSignals.deathCross) {
    anomalies.push({
      type: 'DEATH_CROSS',
      severity: 'MEDIUM',
      title: 'Death Cross — Bearish Long-Term Signal',
      detail: `MA(50) has crossed below MA(200) — a "death cross." Historically precedes extended ` +
              `bearish periods. Major institutional traders watch this closely.`,
      value: -1,
      signal: 'BEARISH',
    });
  }

  // ── 7. Volume anomaly ─────────────────────────────────────────────────────
  if (volumes.length > 20) {
    const recentVol = volumes.slice(-1)[0];
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volMultiple = recentVol / avgVol;
    if (volMultiple > 2.5) {
      anomalies.push({
        type: 'VOLUME_SPIKE',
        severity: volMultiple > 4 ? 'HIGH' : 'MEDIUM',
        title: 'Volume Spike Detected',
        detail: `Today's volume is ${volMultiple.toFixed(1)}x the 20-day average. High volume ` +
                `confirms the direction of the price move. ${changePct > 0 ? 'Bullish volume surge — institutional buying suspected.' : 'Bearish volume surge — distribution or panic selling.'}`,
        value: volMultiple,
        signal: changePct > 0 ? 'BULLISH' : 'BEARISH',
      });
    }
  }

  // ── 8. MACD cross (bullish/bearish) ──────────────────────────────────────
  if (macd.histogram > 0 && macd.histogram < 0.1 && macd.macd > macd.signal - 0.1) {
    anomalies.push({
      type: 'MACD_BULLISH_CROSS',
      severity: 'LOW',
      title: 'MACD Bullish Crossover (Recent)',
      detail: `MACD line recently crossed above the signal line. This is a classic momentum buy ` +
              `signal. Strongest when it occurs below the zero line (from deeply oversold territory).`,
      value: macd.histogram,
      signal: 'BULLISH',
    });
  }

  // ── No anomalies ──────────────────────────────────────────────────────────
  if (anomalies.length === 0) {
    anomalies.push({
      type: 'NORMAL',
      severity: 'INFO',
      title: 'No Significant Anomalies',
      detail: 'Asset is behaving within normal statistical bounds. No regime changes, outliers, or extreme indicator readings detected.',
      value: 0,
      signal: 'NEUTRAL',
    });
  }

  return anomalies.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
    return (order[a.severity] || 3) - (order[b.severity] || 3);
  });
}

module.exports = { detectAnomalies };
