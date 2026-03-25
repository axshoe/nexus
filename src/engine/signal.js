// src/engine/signal.js
// ─────────────────────────────────────────────────────────────────────────────
// NEXUS FUSION ENGINE — The Core Differentiator
//
// This is what separates NEXUS from every other retail tool:
// It synthesizes 4 independent signal domains into one composite score.
//
// Signal Domains:
//   1. Technical (40% weight)  — RSI, MACD, BB, MAs, volatility
//   2. Macro (30% weight)      — Fed rates, yield curve, VIX, CPI
//   3. Sentiment (20% weight)  — News sentiment, Fear & Greed Index
//   4. Cross-asset (10% weight)— BTC correlation, crypto market mood
//
// Output: Market Intelligence Score (MIS) — 0 to 100
//   80-100: Strong Bullish
//   60-79:  Moderately Bullish
//   40-59:  Neutral / Mixed
//   20-39:  Moderately Bearish
//   0-19:   Strong Bearish
// ─────────────────────────────────────────────────────────────────────────────

function computeMIS(technicals, macroAnalysis, sentimentData, cryptoData, fearGreed) {
  const breakdown = {};

  // ──────────────────────────────────────────────────────────────────────────
  // DOMAIN 1: TECHNICAL (0-100 → weighted 40%)
  // ──────────────────────────────────────────────────────────────────────────
  let techScore = 50;

  // RSI contribution (± 15)
  const rsi = technicals.rsi;
  if (rsi !== null) {
    if (rsi < 30)      techScore += 12;
    else if (rsi < 40) techScore += 5;
    else if (rsi > 70) techScore -= 12;
    else if (rsi > 60) techScore -= 5;
  }

  // MACD (± 10)
  const macdHist = technicals.macd.histogram;
  const macdLine = technicals.macd.line;
  const macdSig = technicals.macd.signal;
  if (macdHist !== null) {
    if (macdHist > 0 && macdLine > macdSig) techScore += 10;
    else if (macdHist < 0)                  techScore -= 8;
  }

  // Bollinger Band position (± 8)
  const bbPct = technicals.bollinger.pct;
  if (bbPct < 0.2)      techScore += 8;
  else if (bbPct > 0.8) techScore -= 6;

  // Moving average alignment (± 8)
  const price = technicals.price;
  const ma20 = technicals.movingAverages.ma20;
  const ma50 = technicals.movingAverages.ma50;
  if (ma20 && ma50) {
    if (price > ma20 && price > ma50 && ma20 > ma50) techScore += 8; // full bullish stack
    else if (price < ma20 && price < ma50 && ma20 < ma50) techScore -= 8; // full bearish stack
    else if (price > ma20) techScore += 3;
  }

  // Volatility (dampens signal confidence in high-vol regime)
  if (technicals.volatility.regime === 'Extreme') {
    // Pull toward neutral: high vol = high uncertainty = lower confidence
    techScore = 50 + (techScore - 50) * 0.6;
  }

  // Clamp
  techScore = Math.max(0, Math.min(100, techScore));
  breakdown.technical = {
    score: Math.round(techScore),
    weight: 0.40,
    details: `RSI: ${rsi?.toFixed(1)} | MACD Hist: ${macdHist?.toFixed(3)} | BB%: ${(bbPct * 100).toFixed(0)}%`,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // DOMAIN 2: MACRO (0-100 → weighted 30%)
  // ──────────────────────────────────────────────────────────────────────────
  const macroScore = macroAnalysis?.riskScore ?? 50;
  breakdown.macro = {
    score: Math.round(macroScore),
    weight: 0.30,
    details: macroAnalysis?.regime ?? 'Data unavailable',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // DOMAIN 3: SENTIMENT (0-100 → weighted 20%)
  // ──────────────────────────────────────────────────────────────────────────
  let sentScore = 50;

  // News sentiment (-1 to +1)
  const newsSent = sentimentData?.score ?? 0;
  sentScore += newsSent * 25; // maps -1..1 to ±25

  // Fear & Greed Index (0-100, but inverted for contrarian logic at extremes)
  const fg = fearGreed?.score ?? 50;
  if (fg <= 25) {
    // Extreme fear = contrarian BUY signal
    sentScore += 15;
  } else if (fg >= 75) {
    // Extreme greed = contrarian SELL signal
    sentScore -= 10;
  } else if (fg > 55) {
    sentScore += 5;
  } else if (fg < 45) {
    sentScore -= 5;
  }

  sentScore = Math.max(0, Math.min(100, sentScore));
  breakdown.sentiment = {
    score: Math.round(sentScore),
    weight: 0.20,
    details: `News: ${sentimentData?.label ?? 'N/A'} (${newsSent.toFixed(2)}) | F&G: ${fg} (${fearGreed?.label ?? 'N/A'})`,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // DOMAIN 4: CROSS-ASSET (0-100 → weighted 10%)
  // ──────────────────────────────────────────────────────────────────────────
  let crossScore = 50;

  if (cryptoData?.bitcoin?.change24h !== null) {
    const btcChange = cryptoData.bitcoin.change24h;
    // BTC as a risk-on/risk-off proxy (especially relevant post-2020)
    if (btcChange > 5)       crossScore += 15;
    else if (btcChange > 2)  crossScore += 8;
    else if (btcChange < -5) crossScore -= 15;
    else if (btcChange < -2) crossScore -= 8;
  }

  crossScore = Math.max(0, Math.min(100, crossScore));
  breakdown.crossAsset = {
    score: Math.round(crossScore),
    weight: 0.10,
    details: `BTC 24h: ${cryptoData?.bitcoin?.change24h?.toFixed(2) ?? 'N/A'}% | ETH: ${cryptoData?.ethereum?.change24h?.toFixed(2) ?? 'N/A'}%`,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // COMPOSITE MIS
  // ──────────────────────────────────────────────────────────────────────────
  const mis = (
    breakdown.technical.score  * 0.40 +
    breakdown.macro.score      * 0.30 +
    breakdown.sentiment.score  * 0.20 +
    breakdown.crossAsset.score * 0.10
  );

  const misRounded = Math.round(mis);

  let label, recommendation, confidence;
  if (misRounded >= 75) {
    label = 'STRONG BULLISH';
    recommendation = 'Multiple signal domains align bullishly. Risk-adjusted accumulation warranted.';
    confidence = 'High';
  } else if (misRounded >= 60) {
    label = 'MODERATELY BULLISH';
    recommendation = 'More bulls than bears across signal domains. Bias toward long positions.';
    confidence = 'Moderate';
  } else if (misRounded >= 45) {
    label = 'NEUTRAL / MIXED';
    recommendation = 'Signals conflict. No high-conviction directional play. Reduce position size.';
    confidence = 'Low';
  } else if (misRounded >= 30) {
    label = 'MODERATELY BEARISH';
    recommendation = 'More bears than bulls. Defensive positioning or reduced exposure is prudent.';
    confidence = 'Moderate';
  } else {
    label = 'STRONG BEARISH';
    recommendation = 'Broad-based weakness across signal domains. Significant downside risk present.';
    confidence = 'High';
  }

  return {
    mis: misRounded,
    label,
    recommendation,
    confidence,
    breakdown,
    // Interpretable text summary
    narrative: buildNarrative(misRounded, breakdown, technicals, macroAnalysis),
  };
}

function buildNarrative(mis, breakdown, technicals, macro) {
  const tech = breakdown.technical.score;
  const macroScore = breakdown.macro.score;
  const sent = breakdown.sentiment.score;

  const domainMessages = [];

  if (tech > 65) domainMessages.push('technical indicators are bullish');
  else if (tech < 40) domainMessages.push('technical setup is weak');
  else domainMessages.push('technicals are mixed');

  if (macroScore > 60) domainMessages.push('the macro backdrop is supportive');
  else if (macroScore < 40) domainMessages.push('macro headwinds are present');
  else domainMessages.push('macro conditions are neutral');

  if (sent > 60) domainMessages.push('market sentiment leans positive');
  else if (sent < 40) domainMessages.push('sentiment is cautious or fearful');

  const yieldCurve = macro?.signals?.find(s => s.name === 'Yield Curve');
  const yieldNote = yieldCurve?.signal === 'BEARISH'
    ? ' Note: the yield curve is inverted, which historically precedes recessions by 6-24 months.'
    : '';

  return `NEXUS analysis: ${domainMessages.join(', ')}. MIS of ${mis}/100 reflects a ${mis >= 60 ? 'net bullish' : mis >= 45 ? 'neutral' : 'net bearish'} environment.${yieldNote}`;
}

module.exports = { computeMIS };
