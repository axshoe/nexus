// src/display/terminal.js
// ─────────────────────────────────────────────────────────────────────────────
// NEXUS Terminal Dashboard
// Renders the full analysis output to the terminal using chalk + cli-table3
// ─────────────────────────────────────────────────────────────────────────────

const chalk = require('chalk');
const Table = require('cli-table3');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  accent:  s => chalk.cyan(s),
  dim:     s => chalk.gray(s),
  bold:    s => chalk.white.bold(s),
  bull:    s => chalk.greenBright(s),
  bear:    s => chalk.redBright(s),
  warn:    s => chalk.yellow(s),
  purple:  s => chalk.magentaBright(s),
  header:  s => chalk.bgCyan.black.bold(` ${s} `),
  high:    s => chalk.red.bold(s),
  medium:  s => chalk.yellow(s),
  low:     s => chalk.blue(s),
  info:    s => chalk.gray(s),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function signalColor(signal, text) {
  if (!text) text = signal;
  switch (signal) {
    case 'BULLISH': return C.bull(text);
    case 'BEARISH': return C.bear(text);
    case 'CAUTION':
    case 'WATCH':   return C.warn(text);
    default:        return C.dim(text);
  }
}

function severityColor(sev, text) {
  switch (sev) {
    case 'HIGH':   return C.high(text);
    case 'MEDIUM': return C.medium(text);
    case 'LOW':    return C.low(text);
    default:       return C.info(text);
  }
}

function misBar(score) {
  const filled = Math.round(score / 5); // 0-20 blocks
  const empty = 20 - filled;
  let color;
  if (score >= 65)      color = chalk.greenBright;
  else if (score >= 45) color = chalk.yellow;
  else                  color = chalk.redBright;
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function arrowFor(val, bull = true) {
  if (val === null || val === undefined) return C.dim('—');
  if (val > 0) return bull ? C.bull(`▲ +${val.toFixed(2)}`) : C.bear(`▲ ${val.toFixed(2)}`);
  if (val < 0) return bull ? C.bear(`▼ ${val.toFixed(2)}`) : C.bull(`▼ ${val.toFixed(2)}`);
  return C.dim('→ 0.00');
}

function fmtNum(n, decimals = 2, prefix = '') {
  if (n === null || n === undefined) return C.dim('N/A');
  return `${prefix}${n.toFixed(decimals)}`;
}

function fmtPrice(n) {
  if (n === null || n === undefined) return C.dim('N/A');
  return `$${n.toFixed(2)}`;
}

// ── SECTION: Header Banner ────────────────────────────────────────────────────
function renderBanner(symbol, profile, quote) {
  const width = 72;
  const line = chalk.cyan('─'.repeat(width));
  console.log('\n' + line);
  console.log(chalk.cyan.bold('  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗'));
  console.log(chalk.cyan.bold('  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝'));
  console.log(chalk.cyan.bold('  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗'));
  console.log(chalk.cyan.bold('  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║'));
  console.log(chalk.cyan.bold('  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║'));
  console.log(chalk.gray  ('  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝'));
  console.log(chalk.gray  ('  Quantitative Market Intelligence System  v1.0'));
  console.log(line);

  const name = profile?.name || symbol;
  const sector = profile?.sector || '';
  const mcap = profile?.marketCap ? `  Market Cap: $${(profile.marketCap / 1000).toFixed(1)}B` : '';
  console.log(`\n  ${C.bold(symbol)}  ${C.dim(name)}  ${C.dim(sector)}${mcap}`);

  if (quote) {
    const changeStr = quote.changePct >= 0
      ? C.bull(`▲ +${quote.changePct?.toFixed(2)}%`)
      : C.bear(`▼ ${quote.changePct?.toFixed(2)}%`);
    console.log(`  ${chalk.white.bold(`$${quote.current?.toFixed(2)}`)}  ${changeStr}  ${C.dim(`H: $${quote.high?.toFixed(2)}  L: $${quote.low?.toFixed(2)}`)}`);
  }
  console.log(line);
}

// ── SECTION: MIS Score ────────────────────────────────────────────────────────
function renderMIS(fusion) {
  console.log(`\n  ${C.header('MARKET INTELLIGENCE SCORE')}\n`);

  const { mis, label, confidence, recommendation, breakdown, narrative } = fusion;
  const misColor = mis >= 65 ? chalk.greenBright : mis >= 45 ? chalk.yellow : chalk.redBright;

  console.log(`  ${misColor.bold(`${mis}/100`)}  ${misBar(mis)}  ${misColor(label)}`);
  console.log(`  Confidence: ${C.dim(confidence)}`);
  console.log(`\n  ${chalk.white(recommendation)}`);

  // Domain breakdown table
  const table = new Table({
    head: [C.dim('Domain'), C.dim('Score'), C.dim('Weight'), C.dim('Detail')],
    style: { head: [], border: ['gray'], compact: true },
    colWidths: [18, 8, 10, 36],
  });

  const domains = [
    ['Technical', breakdown.technical],
    ['Macro',     breakdown.macro],
    ['Sentiment', breakdown.sentiment],
    ['Cross-Asset',breakdown.crossAsset],
  ];

  domains.forEach(([name, d]) => {
    const scoreColor = d.score >= 65 ? chalk.greenBright : d.score >= 45 ? chalk.yellow : chalk.redBright;
    table.push([
      C.accent(name),
      scoreColor(d.score.toString()),
      C.dim(`${(d.weight * 100).toFixed(0)}%`),
      C.dim(d.details.substring(0, 34)),
    ]);
  });

  console.log('\n' + table.toString().split('\n').map(l => '  ' + l).join('\n'));
  console.log(`\n  ${C.dim(narrative)}`);
}

// ── SECTION: Technical Indicators ────────────────────────────────────────────
function renderTechnicals(tech) {
  console.log(`\n  ${C.header('TECHNICAL INDICATORS')}\n`);

  const table = new Table({
    head: [C.dim('Indicator'), C.dim('Value'), C.dim('Signal'), C.dim('Interpretation')],
    style: { head: [], border: ['gray'], compact: true },
    colWidths: [20, 12, 12, 30],
  });

  // RSI
  const rsiSig = tech.rsi > 70 ? 'BEARISH' : tech.rsi < 30 ? 'BULLISH' : 'NEUTRAL';
  table.push(['RSI (14)',
    fmtNum(tech.rsi, 1),
    signalColor(rsiSig, rsiSig),
    C.dim(tech.rsi > 70 ? 'Overbought — watch for reversal' : tech.rsi < 30 ? 'Oversold — potential bounce' : 'Neutral zone'),
  ]);

  // MACD
  const macdSig = tech.macd.histogram > 0 ? 'BULLISH' : 'BEARISH';
  table.push(['MACD Histogram',
    arrowFor(tech.macd.histogram),
    signalColor(macdSig, macdSig),
    C.dim(tech.macd.histogram > 0 ? 'Momentum expanding' : 'Momentum contracting'),
  ]);

  // Bollinger
  const bbSig = tech.bollinger.pct > 0.8 ? 'BEARISH' : tech.bollinger.pct < 0.2 ? 'BULLISH' : 'NEUTRAL';
  table.push(['Bollinger %B',
    fmtNum(tech.bollinger.pct * 100, 0) + '%',
    signalColor(bbSig, bbSig),
    C.dim(`Upper: ${fmtPrice(tech.bollinger.upper)}  Lower: ${fmtPrice(tech.bollinger.lower)}`),
  ]);

  // MAs
  const price = tech.price;
  const maSig = price > tech.movingAverages.ma50 ? 'BULLISH' : 'BEARISH';
  table.push(['MA Alignment',
    `${fmtPrice(tech.movingAverages.ma20)} / ${fmtPrice(tech.movingAverages.ma50)}`,
    signalColor(maSig, maSig),
    C.dim(tech.crossSignals.goldenCross ? 'Golden Cross ✓' : tech.crossSignals.deathCross ? 'Death Cross ✗' : 'No cross signal'),
  ]);

  // Volatility
  const volSig = tech.volatility.regime === 'Extreme' ? 'CAUTION' : tech.volatility.regime === 'Elevated' ? 'CAUTION' : 'NEUTRAL';
  table.push(['Volatility (Ann.)',
    fmtNum(tech.volatility.annualized, 1) + '%',
    signalColor(volSig, tech.volatility.regime),
    C.dim(`ATR: ${fmtNum(tech.volatility.atr, 2)}  Vol ratio: ${fmtNum(tech.volatility.ratio, 2)}x`),
  ]);

  // Risk
  table.push(['Risk Metrics',
    `Sharpe: ${fmtNum(tech.risk.sharpe, 2)}`,
    signalColor(tech.risk.sharpe > 1 ? 'BULLISH' : tech.risk.sharpe < 0 ? 'BEARISH' : 'NEUTRAL', tech.risk.sharpe > 1 ? 'GOOD' : 'WEAK'),
    C.dim(`Max DD: -${fmtNum(tech.risk.maxDrawdown, 1)}%  Sortino: ${fmtNum(tech.risk.sortino, 2)}`),
  ]);

  console.log(table.toString().split('\n').map(l => '  ' + l).join('\n'));
}

// ── SECTION: Macro ────────────────────────────────────────────────────────────
function renderMacro(macro) {
  console.log(`\n  ${C.header('MACRO ENVIRONMENT')}\n`);
  if (!macro) { console.log('  ' + C.dim('Macro data unavailable — check FRED_API_KEY')); return; }

  const regimeColor = macro.riskScore >= 60 ? chalk.greenBright : macro.riskScore >= 40 ? chalk.yellow : chalk.redBright;
  console.log(`  Regime: ${regimeColor.bold(macro.regime)}  ${C.dim(`(score: ${macro.riskScore}/100)`)}`);
  console.log(`  ${C.dim(macro.summary)}\n`);

  const table = new Table({
    head: [C.dim('Series'), C.dim('Value'), C.dim('Signal'), C.dim('Note')],
    style: { head: [], border: ['gray'], compact: true },
    colWidths: [20, 14, 12, 28],
  });

  macro.signals.forEach(s => {
    table.push([
      C.accent(s.name),
      C.dim(s.label),
      signalColor(s.signal, s.signal),
      C.dim(s.detail.substring(0, 26) + (s.detail.length > 26 ? '…' : '')),
    ]);
  });

  console.log(table.toString().split('\n').map(l => '  ' + l).join('\n'));
}

// ── SECTION: Sentiment ────────────────────────────────────────────────────────
function renderSentiment(sentimentData, fearGreed, cryptoData) {
  console.log(`\n  ${C.header('SENTIMENT & CROSS-ASSET')}\n`);

  const table = new Table({
    style: { head: [], border: ['gray'], compact: true },
    colWidths: [24, 16, 34],
  });

  // News sentiment
  if (sentimentData) {
    const sentColor = sentimentData.label === 'Positive' ? C.bull : sentimentData.label === 'Negative' ? C.bear : C.dim;
    table.push([C.accent('News Sentiment'), sentColor(sentimentData.label), C.dim(`Score: ${sentimentData.score?.toFixed(3)}  Articles: ${sentimentData.articleCount}`)]);
  }

  // Fear & Greed
  if (fearGreed?.score !== null) {
    const fgColor = fearGreed.score < 30 ? chalk.redBright : fearGreed.score > 70 ? chalk.greenBright : chalk.yellow;
    table.push([C.accent('Fear & Greed Index'), fgColor(`${fearGreed.score} — ${fearGreed.label}`), C.dim(`7-day trend: ${fearGreed.trendLabel}`)]);
  }

  // BTC
  if (cryptoData?.bitcoin?.price) {
    const btcChangeStr = cryptoData.bitcoin.change24h >= 0
      ? C.bull(`+${cryptoData.bitcoin.change24h?.toFixed(2)}%`)
      : C.bear(`${cryptoData.bitcoin.change24h?.toFixed(2)}%`);
    table.push([C.accent('Bitcoin (Risk Proxy)'), `$${cryptoData.bitcoin.price?.toLocaleString()}`, btcChangeStr]);
  }

  // ETH
  if (cryptoData?.ethereum?.price) {
    const ethChangeStr = cryptoData.ethereum.change24h >= 0
      ? C.bull(`+${cryptoData.ethereum.change24h?.toFixed(2)}%`)
      : C.bear(`${cryptoData.ethereum.change24h?.toFixed(2)}%`);
    table.push([C.accent('Ethereum'), `$${cryptoData.ethereum.price?.toLocaleString()}`, ethChangeStr]);
  }

  console.log(table.toString().split('\n').map(l => '  ' + l).join('\n'));

  // Recent headlines
  if (sentimentData?.headlines?.length > 0) {
    console.log(`\n  ${C.dim('Recent News:')}`);
    sentimentData.headlines.slice(0, 4).forEach(h => {
      console.log(`  ${C.dim('·')} ${chalk.white(h.title.substring(0, 65))} ${C.dim(`[${h.source}]`)}`);
    });
  }
}

// ── SECTION: Anomalies ────────────────────────────────────────────────────────
function renderAnomalies(anomalies) {
  console.log(`\n  ${C.header('ANOMALY DETECTION')}\n`);

  anomalies.forEach(a => {
    const sev = severityColor(a.severity, `[${a.severity}]`);
    const sig = signalColor(a.signal, a.signal);
    console.log(`  ${sev}  ${chalk.white.bold(a.title)}  ${sig}`);
    console.log(`  ${C.dim('     ' + a.detail)}\n`);
  });
}

// ── SECTION: Backtest ─────────────────────────────────────────────────────────
function renderBacktest(bt) {
  console.log(`\n  ${C.header('BACKTEST RESULTS')}\n`);
  if (!bt) { console.log('  ' + C.dim('Backtest unavailable')); return; }

  const { best, bestName, all } = bt;

  console.log(`  Best Strategy: ${C.accent(bestName.toUpperCase())}  ${C.dim('(by Sharpe ratio)')}\n`);

  const table = new Table({
    head: [C.dim('Metric'), C.dim('Strategy'), C.dim('Buy & Hold'), C.dim('Alpha')],
    style: { head: [], border: ['gray'], compact: true },
    colWidths: [22, 16, 16, 16],
  });

  const retColor = best.totalReturn >= 0 ? C.bull : C.bear;
  const bhColor  = best.buyHoldReturn >= 0 ? C.bull : C.bear;
  const alphaColor = best.alpha >= 0 ? C.bull : C.bear;
  const sharpeColor = best.sharpe > 1 ? C.bull : best.sharpe > 0 ? C.warn : C.bear;
  const ddColor = parseFloat(best.maxDrawdown) > 20 ? C.bear : C.warn;

  table.push(['Total Return',   retColor(`${best.totalReturn >= 0 ? '+' : ''}${best.totalReturn}%`), bhColor(`${best.buyHoldReturn >= 0 ? '+' : ''}${best.buyHoldReturn}%`), alphaColor(`${best.alpha >= 0 ? '+' : ''}${best.alpha}%`)]);
  table.push(['Sharpe Ratio',   sharpeColor(best.sharpe.toString()), C.dim('—'), C.dim('—')]);
  table.push(['Max Drawdown',   ddColor(`-${best.maxDrawdown}%`), C.dim('—'), C.dim('—')]);
  table.push(['# of Trades',    C.dim(best.trades.toString()), C.dim('—'), C.dim('—')]);

  console.log(table.toString().split('\n').map(l => '  ' + l).join('\n'));

  // Strategy comparison table
  console.log(`\n  ${C.dim('All Strategies:')}`);
  const compareTable = new Table({
    head: [C.dim('Strategy'), C.dim('Return'), C.dim('Sharpe'), C.dim('Max DD')],
    style: { head: [], border: ['gray'], compact: true },
    colWidths: [16, 12, 10, 10],
  });

  Object.entries(all).forEach(([name, r]) => {
    const isB = name === bestName;
    compareTable.push([
      isB ? C.accent(name.toUpperCase() + ' ★') : C.dim(name),
      (r.totalReturn >= 0 ? C.bull : C.bear)(`${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn}%`),
      (r.sharpe > 1 ? C.bull : r.sharpe > 0 ? C.warn : C.bear)(r.sharpe.toString()),
      C.dim(`-${r.maxDrawdown}%`),
    ]);
  });

  console.log(compareTable.toString().split('\n').map(l => '  ' + l).join('\n'));
}

// ── SECTION: Footer ───────────────────────────────────────────────────────────
function renderFooter(symbol, durationMs) {
  const width = 72;
  console.log('\n' + chalk.cyan('─'.repeat(width)));
  console.log(`  ${C.dim(`Analysis complete for ${symbol} in ${(durationMs / 1000).toFixed(1)}s`)}`);
  console.log(`  ${C.dim('⚠  NEXUS is a research tool. Not financial advice.')}`);
  console.log(`  ${C.dim('   github.com/yourusername/nexus-market-intelligence')}`);
  console.log(chalk.cyan('─'.repeat(width)) + '\n');
}

// ── Main render function ──────────────────────────────────────────────────────
function render(data) {
  const { symbol, profile, quote, technicals, macroAnalysis, sentiment, fearGreed, cryptoData, anomalies, backtest, fusion, durationMs } = data;

  renderBanner(symbol, profile, quote);
  renderMIS(fusion);
  renderTechnicals(technicals);
  renderMacro(macroAnalysis);
  renderSentiment(sentiment, fearGreed, cryptoData);
  renderAnomalies(anomalies);
  renderBacktest(backtest);
  renderFooter(symbol, durationMs);
}

module.exports = { render };
