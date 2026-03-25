// src/data/finnhub.js
// ─────────────────────────────────────────────────────────────────────────────
// Finnhub API wrapper
// Handles: real-time quotes, 1-year OHLCV candles, company news + sentiment
// Free tier: 60 req/min — we stay well under that
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');

const BASE = 'https://finnhub.io/api/v1';

function headers(key) {
  return { 'X-Finnhub-Token': key };
}

// ── Real-time quote ──────────────────────────────────────────────────────────
async function getQuote(symbol, apiKey) {
  const res = await axios.get(`${BASE}/quote`, {
    params: { symbol },
    headers: headers(apiKey),
    timeout: 8000,
  });
  const d = res.data;
  if (!d.c) throw new Error(`No quote data for ${symbol}. Check the ticker.`);
  return {
    current: d.c,
    change: d.d,
    changePct: d.dp,
    high: d.h,
    low: d.l,
    open: d.o,
    prevClose: d.pc,
    timestamp: d.t,
  };
}

// ── 1-year daily OHLCV candles ───────────────────────────────────────────────
async function getCandles(symbol, apiKey, days = 365) {
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const res = await axios.get(`${BASE}/stock/candle`, {
    params: { symbol, resolution: 'D', from, to },
    headers: headers(apiKey),
    timeout: 10000,
  });
  const d = res.data;
  if (d.s !== 'ok' || !d.c || d.c.length === 0) {
    throw new Error(`No candle data for ${symbol}. May not be on Finnhub free tier.`);
  }
  // Convert parallel arrays to array of objects, sorted by date
  const candles = d.t.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: d.o[i],
    high: d.h[i],
    low: d.l[i],
    close: d.c[i],
    volume: d.v[i],
  }));
  return candles.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Company news + sentiment ─────────────────────────────────────────────────
async function getNewsSentiment(symbol, apiKey) {
  // Get company-specific news from last 7 days
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const res = await axios.get(`${BASE}/company-news`, {
    params: { symbol, from, to },
    headers: headers(apiKey),
    timeout: 8000,
  });

  const articles = res.data.slice(0, 20); // top 20 recent articles

  if (!articles.length) {
    return { score: 0, label: 'Neutral', articleCount: 0, headlines: [] };
  }

  // Finnhub returns sentiment in the article objects as `sentiment` field
  // We also do basic keyword scoring as a sanity check
  const positiveWords = ['beat', 'surge', 'record', 'growth', 'profit', 'upgrade', 'gain', 'rally', 'strong', 'buy'];
  const negativeWords = ['miss', 'fall', 'loss', 'downgrade', 'cut', 'weak', 'decline', 'concern', 'risk', 'sell'];

  let totalScore = 0;
  articles.forEach(a => {
    const text = (a.headline + ' ' + (a.summary || '')).toLowerCase();
    let score = 0;
    positiveWords.forEach(w => { if (text.includes(w)) score++; });
    negativeWords.forEach(w => { if (text.includes(w)) score--; });
    totalScore += score;
  });

  const normalized = totalScore / articles.length; // range ~-3 to +3
  const clampedScore = Math.max(-1, Math.min(1, normalized / 3)); // normalize to -1..1

  let label;
  if (clampedScore > 0.25) label = 'Positive';
  else if (clampedScore < -0.25) label = 'Negative';
  else label = 'Neutral';

  return {
    score: parseFloat(clampedScore.toFixed(3)),
    label,
    articleCount: articles.length,
    headlines: articles.slice(0, 5).map(a => ({
      title: a.headline,
      source: a.source,
      datetime: new Date(a.datetime * 1000).toISOString().slice(0, 10),
    })),
  };
}

// ── Company profile (name, sector, market cap) ───────────────────────────────
async function getProfile(symbol, apiKey) {
  try {
    const res = await axios.get(`${BASE}/stock/profile2`, {
      params: { symbol },
      headers: headers(apiKey),
      timeout: 8000,
    });
    const d = res.data;
    return {
      name: d.name || symbol,
      sector: d.finnhubIndustry || 'Unknown',
      exchange: d.exchange || 'Unknown',
      marketCap: d.marketCapitalization || null,
      logo: d.logo || null,
    };
  } catch {
    return { name: symbol, sector: 'Unknown', exchange: 'Unknown', marketCap: null };
  }
}

module.exports = { getQuote, getCandles, getNewsSentiment, getProfile };
