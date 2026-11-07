'use strict';
(function(root){
function decimal(value, places, max, label) {
  const s = String(value ?? '').trim();
  if (!new RegExp(`^\\d{1,12}(?:\\.\\d{1,${places}})?$`).test(s)) throw new Error(`${label}格式不正确，最多 ${places} 位小数`);
  const [a,b=''] = s.split('.');
  const n = BigInt(a) * 10n ** BigInt(places) + BigInt(b.padEnd(places,'0'));
  if (n <= 0n || n > max) throw new Error(`${label}超出允许范围`);
  return n;
}
function money(value) { return Number(decimal(value, 2, 100000000000n, '金额')); }
function quantity(value) { return decimal(value, 6, 1000000000000000n, '股数'); }
function priceUnits(value) { return decimal(Number(value).toFixed(6), 6, 100000000000000n, '价格'); }
function cost(price, qty) { return Number((price * qty + 5000000000n) / 10000000000n); }
function emptyState() { return {version:1, initialCents:null, cashCents:0, realizedCents:0, positions:{}, trades:[], watchlist:['AAPL','MSFT','NVDA','TSLA','SPY','QQQ'], createdAt:null, updatedAt:null}; }
function validSymbol(s) { return typeof s === 'string' && /^[A-Z0-9][A-Z0-9.\-^]{0,14}$/.test(s); }
function applyTrade(state, trade) {
  const qty = quantity(trade.quantity);
  const price = priceUnits(trade.price);
  if (!validSymbol(trade.symbol) || !['buy','sell'].includes(trade.side)) throw new Error('交易格式错误');
  const cents = cost(price, qty);
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(state.cashCents + cents) || !Number.isSafeInteger(state.realizedCents + cents)) throw new Error('交易金额超出安全计算范围');
  if (cents < 1) throw new Error('每笔交易至少 0.01 美元');
  const old = state.positions[trade.symbol] || {quantityMicros:'0', costCents:0};
  const oldQty = BigInt(old.quantityMicros);
  if (trade.side === 'buy') {
    if (cents > state.cashCents) throw new Error('可用资金不足');
    state.cashCents -= cents;
    state.positions[trade.symbol] = {quantityMicros:String(oldQty + qty), costCents:old.costCents+cents};
  } else {
    if (qty > oldQty) throw new Error('可卖股数不足');
    const basis = qty === oldQty ? old.costCents : Number(BigInt(old.costCents) * qty / oldQty);
    state.cashCents += cents;
    state.realizedCents += cents - basis;
    if (qty === oldQty) delete state.positions[trade.symbol];
    else state.positions[trade.symbol] = {quantityMicros:String(oldQty-qty), costCents:old.costCents-basis};
  }
  state.trades.push({...trade, amountCents:cents});
}
function validateBackup(data) {
  if (data?.format !== 'e-equity-backup' || data.version !== 1 || !data.account) throw new Error('不是有效的 E-Equity 备份');
  const a = data.account;
  const next = emptyState();
  if (a.initialCents !== null) {
    if (!Number.isSafeInteger(a.initialCents) || a.initialCents < 1 || a.initialCents > 100000000000) throw new Error('备份本金无效');
    next.initialCents = next.cashCents = a.initialCents;
  }
  if (!Array.isArray(a.trades) || a.trades.length > 100000) throw new Error('交易记录格式错误');
  const ids = new Set();
  for (const t of a.trades) {
    if (next.initialCents === null || typeof t.id !== 'string' || ids.has(t.id) || !Number.isFinite(Date.parse(t.timestamp))) throw new Error('交易记录无效或重复');
    ids.add(t.id);
    if (typeof t.provider !== 'string' || t.provider.length > 200) throw new Error('行情来源无效');
    const trade={id:t.id, symbol:t.symbol, side:t.side, quantity:t.quantity, price:t.price, timestamp:t.timestamp, provider:t.provider, quoteTime:t.quoteTime};
    for(const key of ['quoteAsOf','quoteFetchedAt','executionMode']){
      if(t[key]!==undefined){if(typeof t[key]!=='string'||t[key].length>200)throw new Error('报价记录格式错误');trade[key]=t[key];}
    }
    applyTrade(next, trade);
  }
  if (a.cashCents !== next.cashCents || a.realizedCents !== next.realizedCents) throw new Error('备份余额与交易记录不一致');
  const positions = a.positions;
  if (!positions || JSON.stringify(Object.entries(positions).sort()) !== JSON.stringify(Object.entries(next.positions).sort())) throw new Error('备份持仓与交易记录不一致');
  if (!Array.isArray(a.watchlist) || a.watchlist.length > 100 || a.watchlist.some(s => !validSymbol(s))) throw new Error('自选列表无效');
  next.watchlist = [...new Set(a.watchlist)];
  next.createdAt = a.createdAt || null;
  next.updatedAt = a.updatedAt || null;
  return next;
}

root.EquityAccountCore={decimal,money,quantity,priceUnits,cost,emptyState,validSymbol,applyTrade,validateBackup};
})(globalThis);
