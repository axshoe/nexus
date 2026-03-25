// src/data/fred.js
// ─────────────────────────────────────────────────────────────────────────────
// Federal Reserve Economic Data (FRED) wrapper
// Free API key from: https://fred.stlouisfed.org/docs/api/api_key.html
//
// Series we pull:
//   VIXCLS   — CBOE VIX (implied volatility / fear gauge)
//   DGS10    — 10-Year Treasury Yield
//   DGS2     — 2-Year Treasury Yield  (10Y-2Y = yield curve spread)
//   FEDFUNDS — Federal Funds Rate
//   CPIAUCSL — CPI (inflation)
//   UNRATE   — Unemployment Rate
//   M2SL     — M2 Money Supply
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');

const BASE = 'https://api.stlouisfed.org/fred/series/observations';

async function getSeries(seriesId, apiKey, limit = 30) {
  const res = await axios.get(BASE, {
    params: {
      series_id: seriesId,
      api_key: apiKey,
      file_type: 'json',
      sort_order: 'desc',
      limit,
    },
    timeout: 10000,
  });

  const obs = res.data.observations
    .filter(o => o.value !== '.' && o.value !== '')
    .map(o => ({
      date: o.date,
      value: parseFloat(o.value),
    }));

  return obs; // most recent first
}

async function getMacroData(apiKey) {
  const results = {};

  const series = [
    { id: 'VIXCLS',   label: 'VIX',          description: 'CBOE Volatility Index' },
    { id: 'DGS10',    label: '10Y_Yield',     description: '10-Year Treasury Yield' },
    { id: 'DGS2',     label: '2Y_Yield',      description: '2-Year Treasury Yield' },
    { id: 'FEDFUNDS', label: 'FedFunds',       description: 'Federal Funds Rate' },
    { id: 'CPIAUCSL', label: 'CPI',            description: 'Consumer Price Index' },
    { id: 'UNRATE',   label: 'Unemployment',   description: 'Unemployment Rate' },
  ];

  // Fetch all in parallel
  const fetches = series.map(async (s) => {
    try {
      const data = await getSeries(s.id, apiKey, 30);
      results[s.label] = {
        description: s.description,
        current: data[0]?.value ?? null,
        previous: data[1]?.value ?? null,
        history: data.slice(0, 12).map(d => d.value),
        dates: data.slice(0, 12).map(d => d.date),
        change: data[0] && data[1] ? data[0].value - data[1].value : null,
      };
    } catch (err) {
      results[s.label] = {
        description: s.description,
        current: null,
        error: err.message,
      };
    }
  });

  await Promise.all(fetches);

  // Derived: yield curve spread (10Y - 2Y)
  const y10 = results['10Y_Yield']?.current;
  const y2 = results['2Y_Yield']?.current;
  if (y10 !== null && y2 !== null) {
    const spread = y10 - y2;
    results['YieldSpread'] = {
      description: '10Y-2Y Yield Curve Spread',
      current: parseFloat(spread.toFixed(3)),
      inverted: spread < 0,
      regime: spread < -0.5 ? 'Deeply Inverted (Recession Signal)'
             : spread < 0   ? 'Inverted (Warning)'
             : spread < 0.5 ? 'Flat (Caution)'
             :                'Normal (Healthy)',
    };
  }

  return results;
}

module.exports = { getMacroData, getSeries };
