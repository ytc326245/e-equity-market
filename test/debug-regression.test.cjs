const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.EEQUITY_BASELINE_DIR||path.resolve(__dirname,'..');
const {Market}=require(path.join(root,'lib/market.cjs'));
const {YahooFundamentals,normalizeFundamentals}=require(path.join(root,'lib/fundamentals.cjs'));
const {quoteBlock}=require(path.join(root,'public/quote-policy.js'));
const n=raw=>({raw});
test('QQQ fundProfile fee wins over an obsolete summary; unverified undated fee stays missing',()=>{
  const r=normalizeFundamentals('QQQ','ETF',{price:{symbol:'QQQ',currency:'USD'},fundProfile:{feesExpensesInvestment:{annualReportExpenseRatio:n(.0018)}}},{summaryData:{ExpenseRatio:{value:'0.20%'}}});
  assert.ok(Math.abs(r.metrics.expenseRatio.value-.18)<1e-8);assert.equal(r.metrics.expenseRatio.provider,'Yahoo Finance');
  assert.equal(normalizeFundamentals('QQQ','ETF',null,{summaryData:{ExpenseRatio:{value:'0.20%'}}}).metrics.expenseRatio.value,null);
});
test('quote-unit ADR EPS remains available when statement currency is CNY',()=>{
  const r=normalizeFundamentals('TEST','STOCK',{price:{currency:'USD'},financialData:{financialCurrency:'CNY'},defaultKeyStatistics:{trailingEps:n(4)},summaryDetail:{trailingPE:n(25)}},null);
  assert.equal(r.metrics.eps.value,4);assert.match(r.metrics.eps.period,/CNY/);
});
test('Yahoo share classes use canonical provider symbols and reject unrelated responses',async()=>{
  let requested='';const c=new YahooFundamentals(async u=>{requested=u;return Response.json({quoteSummary:{result:[{price:{symbol:'BRK-B'}}]}});});c.getSession=async()=>({cookie:'test',crumb:'test'});
  assert.equal((await c.read('BRK.B')).price.symbol,'BRK-B');assert.match(requested,/quoteSummary\/BRK-B\?/);
});
test('fresh HTTP cannot make a quote from another New York trading date executable',()=>{
  const now=Date.parse('2026-11-06T15:00:00Z'),q={symbol:'AAPL',price:100,fetchedAt:new Date(now).toISOString(),sessionDate:'2026-11-05'};
  assert.match(quoteBlock(q,now,'AAPL'),/纽约交易日/);q.sessionDate='2026-11-06';assert.equal(quoteBlock(q,now,'AAPL'),'');
  const shanghaiNextDay=Date.parse('2026-11-07T00:30:00Z');q.fetchedAt=new Date(shanghaiNextDay).toISOString();assert.equal(quoteBlock(q,shanghaiNextDay,'AAPL'),'');
});
test('Nasdaq mismatched response symbols are rejected before tagging a quote with the requested symbol',async t=>{
  const old=global.fetch;t.after(()=>global.fetch=old);global.fetch=async()=>Response.json({data:{symbol:'MSFT',primaryData:{lastSalePrice:'$100',netChange:'1',lastTradeTimestamp:'Nov 6, 2026'}}});
  await assert.rejects(new Market().quote('AAPL'),/其他标的/);
});
test('historical carry-forward placeholders leave a dated gap while genuine sharp moves survive',async()=>{
  const m=new Market();m.request=async()=>({tradesTable:{rows:[{date:'04/17/2026',close:'100',open:'90',high:'105',low:'85',volume:'1000'},{date:'04/20/2026',close:'100',open:'100',high:'100',low:'100',volume:'N/A'},{date:'04/21/2026',close:'70',open:'95',high:'96',low:'69',volume:'1000'}]}});
  const c=await m.chart('SPY','1Y');assert.equal(c.points.length,2);assert.equal(c.points[1].price,70);assert.deepEqual(c.excludedDates,['2026-04-20']);assert.equal(c.diagnostics.placeholder,1);
});
function ui(){const elements=new Map();const el=s=>{if(!elements.has(s))elements.set(s,{textContent:'',innerHTML:'',value:'',dataset:{},addEventListener(){},classList:{toggle(){}},setAttribute(){}});return elements.get(s);};const c=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[],addEventListener(){}},setInterval(){},setTimeout(){},clearTimeout(){},Date,Intl,fetch:async()=>{throw Error('offline fixture');}});vm.runInContext(fs.readFileSync(path.join(root,'public/app.js'),'utf8'),c);return {c,el,run:s=>vm.runInContext(s,c)};}
test('price formatting retains fractional cents and fund fee formatting retains four decimal percentage precision',()=>{
  const b=ui();assert.equal(b.run('priceUsd(3.395)'),'$3.395');assert.equal(b.run('priceUsd(342.37)'),'$342.37');assert.equal(b.run("metricValue('expenseRatio',{value:.0945})"),'0.0945%');
});
test('late quote successes and failures cannot overwrite a newer refresh',async()=>{
  const b=ui(),pending=[];b.c.network=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));b.run('api=network');const a=b.run("getQuote('AAPL')"),z=b.run("getQuote('AAPL',{fresh:true})");
  pending[1].resolve({symbol:'AAPL',price:105,change:0,changePercent:0});await z;pending[0].reject(Error('old failure'));await a;assert.equal(b.el('#quote-price').textContent,'$105.00');
});
test('missing percent change stays missing while absolute change remains available',()=>{
  const b=ui();b.run("quotes.set('AAPL',{symbol:'AAPL',price:100,change:1,changePercent:null});renderQuote();");
  assert.match(b.el('#quote-change').textContent,/\(—\)/);assert.doesNotMatch(b.el('#quote-change').textContent,/0\.00%/);
});
test('partial financial snapshots retry after 30 seconds while complete snapshots retain five-minute caching',async()=>{
  const b=ui();b.c.fixtureTime=new Date(Date.now()-45000).toISOString();b.run("state={account:{watchlist:[],positions:{}}};getQuote=async()=>{};renderState=()=>{};globalThis.retries=0;loadFundamentals=async()=>{retries++};fundamentals.set('AAPL',{fetchedAt:fixtureTime,status:'partial'});");
  await b.run('refreshQuotes()');assert.equal(b.run('retries'),1);b.run("fundamentals.get('AAPL').status='available';");await b.run('refreshQuotes()');assert.equal(b.run('retries'),1);
});
test('random fractional-share buys and sells preserve exact cash/cost/realized ledger identity and backup replay',()=>{
  const {applyTrade,emptyState,validateBackup}=require(path.join(root,'lib/account.cjs'));const a=emptyState();a.initialCents=a.cashCents=1000000;let seed=8128;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let i=0;i<1500;i++){const sym=['AAPL','MSFT','SPY'][rand()%3],position=a.positions[sym],sell=position&&rand()%2,qty=sell?(Number(position.quantityMicros)/(rand()%4+1)/1e6).toFixed(6):((rand()%100000+1)/1e6).toFixed(6);const t={id:`fuzz-${i.toString().padStart(6,'0')}`,symbol:sym,side:sell?'sell':'buy',quantity:qty,price:(rand()%900000+10000)/10000,timestamp:'2026-11-06T15:00:00Z',provider:'SYNTHETIC TEST',quoteTime:null};const before=JSON.stringify(a);try{applyTrade(a,t);}catch{assert.equal(JSON.stringify(a),before);}
    assert.equal(a.cashCents+Object.values(a.positions).reduce((n,p)=>n+p.costCents,0),a.initialCents+a.realizedCents);assert.ok(a.cashCents>=0);
  }
  assert.deepEqual(validateBackup({format:'e-equity-backup',version:1,account:a}),a);
});
