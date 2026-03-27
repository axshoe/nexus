// src/data/finnhub.js
const axios = require('axios');

const BASE = 'https://finnhub.io/api/v1';

function headers(key) {
  return { 'X-Finnhub-Token': key };
}

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

async function getCandles(symbol, apiKey) {
  const avKey = process.env.ALPHA_VANTAGE_KEY;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${avKey}`;

  const res = await axios.get(url, { timeout: 15000 });
  const json = res.data;

  if (json['Note']) throw new Error('Alpha Vantage rate limit hit. Wait 1 minute and try again.');
  if (json['Information']) throw new Error('Alpha Vantage: ' + json['Information']);
  if (json['Error Message']) throw new Error(`Invalid ticker: ${symbol}`);

  const series = json['Time Series (Daily)'];
  if (!series) throw new Error('No historical data returned from Alpha Vantage.');

  const dates = Object.keys(series).sort();
  return dates.slice(-365).map(date => ({
    date,
    open:   parseFloat(series[date]['1. open']),
    high:   parseFloat(series[date]['2. high']),
    low:    parseFloat(series[date]['3. low']),
    close:  parseFloat(series[date]['4. close']),
    volume: parseFloat(series[date]['5. volume']),
  }));
}

async function getNewsSentiment(symbol, apiKey) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const res = await axios.get(`${BASE}/company-news`, {
    params: { symbol, from, to },
    headers: headers(apiKey),
    timeout: 8000,
  });

  const articles = res.data.slice(0, 20);

  if (!articles.length) {
    return { score: 0, label: 'Neutral', articleCount: 0, headlines: [] };
  }

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

  const normalized = totalScore / articles.length;
  const clampedScore = Math.max(-1, Math.min(1, normalized / 3));

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