const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { marketStatus } = require('./calendar.cjs');
const { quoteBlock } = require('../public/quote-policy.js');
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
class Account {
  constructor(directory, {clock = () => new Date(), status = marketStatus} = {}) { this.directory=directory; this.file=path.join(directory,'account.json'); this.state=emptyState(); this.queue=Promise.resolve(); this.clock=clock; this.status=status; }
  async init() {
    await fs.mkdir(this.directory,{recursive:true});
    try { this.state = validateBackup(JSON.parse(await fs.readFile(this.file,'utf8'))); }
    catch(e) { if(e.code !== 'ENOENT') throw new Error('本机账户文件读取失败。请先保留原文件并从备份恢复：'+e.message); }
    return this;
  }
  snapshot() { return structuredClone(this.state); }
  backup(state=this.state) { return {format:'e-equity-backup', version:1, exportedAt:this.clock().toISOString(), account:structuredClone(state)}; }
  mutate(fn) {
    const operation = this.queue.then(async()=>{
      const next = this.snapshot();
      const result = await fn(next);
      next.updatedAt=this.clock().toISOString();
      const temp = this.file+'.tmp';
      await fs.writeFile(temp,JSON.stringify(this.backup(next),null,2),{mode:0o600});
      await fs.rename(temp,this.file);
      this.state=next;
      return result ?? this.snapshot();
    });
    this.queue = operation.catch(()=>{});
    return operation;
  }
  reset(capital) {
    const cents=money(capital);
    return this.mutate(async next=>{
      if (next.initialCents !== null) {
        const folder=path.join(this.directory,'archives');
        await fs.mkdir(folder,{recursive:true});
        await fs.writeFile(path.join(folder,`account-${Date.now()}-${crypto.randomUUID().slice(0,8)}.json`),JSON.stringify(this.backup(next),null,2));
      }
      Object.assign(next,emptyState(),{initialCents:cents,cashCents:cents,watchlist:next.watchlist,createdAt:this.clock().toISOString()});
    });
  }
  watch(symbol, remove=false) {
    if(!validSymbol(symbol)) throw new Error('股票代码无效');
    return this.mutate(next=>{ next.watchlist = remove ? next.watchlist.filter(s=>s!==symbol) : [...new Set([...next.watchlist,symbol])]; if(next.watchlist.length>100) throw new Error('最多添加 100 个自选'); });
  }
  async restore(data) {
    const validated=validateBackup(data);
    return this.mutate(async next=>{
      await fs.mkdir(path.join(this.directory,'archives'),{recursive:true});
      await fs.writeFile(path.join(this.directory,'archives',`before-import-${Date.now()}.json`),JSON.stringify(this.backup(next),null,2));
      Object.assign(next,validated);
    });
  }
  trade(input, provider) {
    return this.mutate(async next=>{
      if(next.initialCents===null) throw new Error('请先设置虚拟本金');
      if(!validSymbol(input.symbol) || !['buy','sell'].includes(input.side)) throw new Error('交易参数错误');
      if(typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId)) throw new Error('交易请求编号无效');
      const existing=next.trades.find(t=>t.id===input.requestId);
      if(existing) return existing;
      if(!this.status(this.clock()).isOpen) throw new Error('当前不是美股正常交易时段');
      const quote=await provider.quote(input.symbol,{fresh:true});
      const now=this.clock();
      if(!this.status(now).isOpen) throw new Error('已收盘，本次交易未执行');
      const block=quoteBlock(quote,now.getTime(),input.symbol);
      if(block)throw new Error(block);
      const price=priceUnits(quote.price);
      let qty;
      if(input.mode==='amount') qty=BigInt(money(input.value))*10000000000n/price;
      else if(input.mode==='shares') qty=quantity(input.value);
      else throw new Error('买卖输入方式无效');
      if(qty<=0n) throw new Error('金额太小，无法买入最小股数');
      const trade={id:input.requestId,symbol:input.symbol,side:input.side,quantity:(Number(qty)/1e6).toFixed(6),price:Number(price)/1e6,timestamp:now.toISOString(),quoteTime:quote.timestamp||null,quoteAsOf:quote.asOf||'来源未提供',quoteFetchedAt:quote.fetchedAt,executionMode:'public-quote',provider:quote.provider};
      applyTrade(next,trade);
      return next.trades.at(-1);
    });
  }
}
module.exports={Account,emptyState,validateBackup,applyTrade,money,quantity,cost,priceUnits,validSymbol};
