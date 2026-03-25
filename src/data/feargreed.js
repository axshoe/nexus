// src/data/feargreed.js
// ─────────────────────────────────────────────────────────────────────────────
// Fear & Greed Index + Crypto market data
// NO API KEY REQUIRED for either source
//
// Sources:
//   Alternative.me   — CNN Fear & Greed Index (free, no key)
//   CoinGecko v3     — Bitcoin, Ethereum prices + market data (free, no key)
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');

// ── Fear & Greed Index ───────────────────────────────────────────────────────
async function getFearGreed() {
  try {
    const res = await axios.get('https://api.alternative.me/fng/?limit=10', {
      timeout: 8000,
    });
    const data = res.data.data;
    const latest = data[0];

    // Classify regime
    const score = parseInt(latest.value);
    let regime;
    if (score <= 20)      regime = 'Extreme Fear';
    else if (score <= 40) regime = 'Fear';
    else if (score <= 60) regime = 'Neutral';
    else if (score <= 80) regime = 'Greed';
    else                  regime = 'Extreme Greed';

    // 7-day trend
    const values = data.map(d => parseInt(d.value));
    const trend7d = values[0] - values[Math.min(6, values.length - 1)];

    return {
      score,
      label: latest.value_classification,
      regime,
      trend7d,
      trendLabel: trend7d > 5 ? 'Rising Fear/Greed' : trend7d < -5 ? 'Cooling' : 'Stable',
      history: data.map(d => ({
        date: new Date(parseInt(d.timestamp) * 1000).toISOString().slice(0, 10),
        value: parseInt(d.value),
        label: d.value_classification,
      })),
    };
  } catch (err) {
    return { score: null, label: 'Unavailable', error: err.message };
  }
}

// ── Bitcoin & Ethereum (CoinGecko free API, no key) ──────────────────────────
async function getCryptoData() {
  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: {
          ids: 'bitcoin,ethereum',
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_market_cap: true,
        },
        timeout: 8000,
      }
    );
    const d = res.data;
    return {
      bitcoin: {
        price: d.bitcoin?.usd ?? null,
        change24h: d.bitcoin?.usd_24h_change ?? null,
        marketCap: d.bitcoin?.usd_market_cap ?? null,
      },
      ethereum: {
        price: d.ethereum?.usd ?? null,
        change24h: d.ethereum?.usd_24h_change ?? null,
        marketCap: d.ethereum?.usd_market_cap ?? null,
      },
    };
  } catch (err) {
    return { bitcoin: null, ethereum: null, error: err.message };
  }
}

// ── Bitcoin dominance (used as risk-on/risk-off proxy) ───────────────────────
async function getBTCDominance() {
  try {
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/global',
      { timeout: 8000 }
    );
    const btcDominance = res.data.data?.market_cap_percentage?.btc ?? null;
    const totalMarketCap = res.data.data?.total_market_cap?.usd ?? null;
    const change24h = res.data.data?.market_cap_change_percentage_24h_usd ?? null;
    return { btcDominance, totalMarketCap, change24h };
  } catch {
    return { btcDominance: null, totalMarketCap: null };
  }
}

module.exports = { getFearGreed, getCryptoData, getBTCDominance };
