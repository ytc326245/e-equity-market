const test=require('node:test');
const assert=require('node:assert/strict');
const {YahooFundamentals,normalizeFundamentals}=require('../lib/fundamentals.cjs');
const {Market}=require('../lib/market.cjs');
const n=raw=>({raw});
function fixture(symbol='AAPL'){
  return {price:{symbol,currency:'USD',quoteType:'EQUITY',regularMarketTime:1793998800},summaryDetail:{marketCap:n(1000000000),trailingPE:n(20),dividendYield:n(.012),fiftyTwoWeekHigh:n(120),fiftyTwoWeekLow:n(80)},defaultKeyStatistics:{trailingEps:n(5),priceToBook:n(2),bookValue:n(50),mostRecentQuarter:n(1790726400)},financialData:{financialCurrency:'USD'}};
}
test('financial snapshots retain provider TTM ratios, currencies, dates and percentage units',()=>{
  const r=normalizeFundamentals('AAPL','STOCK',fixture(),{summaryData:{Yield:{value:'0.99%'}}});
  assert.equal(r.status,'available');assert.equal(r.metrics.pe.value,20);assert.equal(r.metrics.eps.value,5);assert.equal(r.metrics.pb.value,2);
  assert.equal(r.metrics.dividendYield.value,1.2);assert.match(r.metrics.dividendYield.period,/预期/);
  assert.equal(r.sources[1].financialPeriod,'2026-09-30');assert.equal(r.sources[1].quoteAsOf,'2026-11-06T21:00:00.000Z');
  assert.equal(r.metrics.marketCap.provider,'Yahoo Finance');
});
test('missing values are never zero; losses and quote currency are explicit without confusing ADR statement currency',()=>{
  const d=fixture();d.defaultKeyStatistics.trailingEps=n(-2);d.defaultKeyStatistics.bookValue=n(-5);
  let r=normalizeFundamentals('AAPL','STOCK',d,null);assert.equal(r.metrics.eps.value,-2);assert.equal(r.metrics.pe.value,null);assert.equal(r.metrics.pe.status,'not-meaningful');assert.equal(r.metrics.pb.value,null);
  d.financialData.financialCurrency='CNY';r=normalizeFundamentals('AAPL','STOCK',d,null);assert.equal(r.metrics.eps.value,-2);assert.match(r.metrics.eps.period,/CNY/);
  d.price.currency='EUR';r=normalizeFundamentals('AAPL','STOCK',d,null);assert.equal(r.metrics.eps.value,null);assert.match(r.metrics.eps.reason,/币种/);
  r=normalizeFundamentals('AAPL','STOCK',null,{summaryData:{Yield:{value:'N/A'},MarketCap:{value:'--'},FiftTwoWeekHighLow:{value:'$80/$120'}}});
  assert.equal(r.status,'unavailable');assert.equal(r.metrics.marketCap.value,null);assert.equal(r.metrics.dividendYield.value,null);assert.equal(r.metrics.week52High.value,null);
});
test('ETF company ratios are not applicable; fund AUM thousands and fees are converted correctly',()=>{
  const d=fixture('SPY');d.price.quoteType='ETF';d.summaryDetail.yield=n(.01);d.fundProfile={feesExpensesInvestment:{annualReportExpenseRatio:n(.0009)}};
  const r=normalizeFundamentals('SPY','ETF',d,{summaryData:{AUM:{label:'Assets Under Management (,000)',value:'1,234,000'},ExpenseRatio:{value:'0.09%'}}});
  assert.equal(r.status,'available');assert.equal(r.metrics.aum.value,1234000000);assert.equal(r.metrics.expenseRatio.value,.09);assert.equal(r.metrics.dividendYield.value,1);
  for(const k of ['pe','eps','pb','marketCap']){assert.equal(r.metrics[k].value,null);assert.equal(r.metrics[k].status,'not-applicable');}
});
test('Yahoo anonymous sessions deduplicate, recover once from expiry and reject mismatched symbols',async()=>{
  const calls=[];let unauthorized=true;
  const client=new YahooFundamentals(async(url,options)=>{
    calls.push({url,headers:options.headers});
    if(url==='https://fc.yahoo.com')return new Response('',{status:404,headers:{'set-cookie':'A3=anonymous-test-cookie; Secure; HttpOnly'}});
    if(url.endsWith('/getcrumb')){assert.equal(options.headers.Accept,'*/*');return new Response('anonymous-crumb');}
    if(unauthorized){unauthorized=false;return new Response('',{status:401});}
    return Response.json({quoteSummary:{result:[fixture(url.includes('/MSFT?')?'MSFT':'AAPL')]}});
  });
  await Promise.all([client.getSession(),client.getSession()]);assert.equal(calls.length,2);
  assert.equal((await client.read('AAPL')).price.symbol,'AAPL');assert.equal(calls.filter(c=>c.url==='https://fc.yahoo.com').length,2);
  assert.equal((await client.read('MSFT')).price.symbol,'MSFT');
  await assert.rejects(client.read('NVDA'),/匹配标的/);
  assert.ok(calls.filter(c=>c.url.includes('/quoteSummary/')).every(c=>c.headers.Cookie==='A3=anonymous-test-cookie'));
  assert.equal(JSON.stringify(await client.read('AAPL')).includes('anonymous-crumb'),false);
});
test('financial failures preserve Nasdaq fields, deduplicate cache reads and allow explicit refresh',async()=>{
  const m=new Market();let reads=0;
  m.financialData.read=async()=>{reads++;throw Error('offline');};
  m.request=async()=>({summaryData:{MarketCap:{value:'1,000,000,000'},Yield:{value:'0%'},FiftTwoWeekHighLow:{value:'$120/$80'}}});
  const [a,b]=await Promise.all([m.fundamentals('AAPL'),m.fundamentals('AAPL')]);assert.equal(a,b);assert.equal(reads,1);
  assert.equal(a.status,'partial');assert.equal(a.metrics.marketCap.value,1000000000);assert.equal(a.metrics.pe.value,null);assert.equal(a.metrics.dividendYield.value,0);
  await m.fundamentals('AAPL');assert.equal(reads,1);await m.fundamentals('AAPL',{fresh:true});assert.equal(reads,2);
  await assert.rejects(m.fundamentals('../AAPL'),/上市目录/);assert.equal(reads,2);
});
test('desktop and phone fundamental routes forward refresh and preserve response metadata',async t=>{
  const fs=require('node:fs/promises'),path=require('node:path');const {startServer}=require('../server.cjs');
  const {createEquityApi}=await import('../iphone/lib/equity-api.mjs');
  const m=new Market(),requests=[];m.fundamentals=async(s,o)=>{requests.push({s,o});return normalizeFundamentals(s,'STOCK',fixture(s),null);};
  await fs.mkdir(path.resolve('test-results'),{recursive:true});const directory=await fs.mkdtemp(path.resolve('test-results/fundamentals-http-'));const server=await startServer({port:0,directory,market:m});t.after(()=>new Promise(resolve=>server.server.close(resolve)));
  const r=await fetch(server.origin+'/api/fundamentals?symbol=AAPL&fresh=1');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).metrics.eps.value,5);
  const phone=createEquityApi({market:m}),p=await phone(new Request('https://example.test/api/fundamentals?symbol=MSFT&fresh=1'));
  assert.equal((await p.json()).symbol,'MSFT');assert.deepEqual(requests,[{s:'AAPL',o:{fresh:true}},{s:'MSFT',o:{fresh:true}}]);
});
test('generated phone financial normalization has the same missing-data and unit rules as desktop',async()=>{
  const phone=await import('../iphone/lib/equity-fundamentals.mjs');const options={fetchedAt:'2026-11-08T00:00:00Z'};
  assert.deepEqual(phone.normalizeFundamentals('AAPL','STOCK',fixture(),null,options),normalizeFundamentals('AAPL','STOCK',fixture(),null,options));
});
