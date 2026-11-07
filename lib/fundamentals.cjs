'use strict';
const raw=value=>typeof value?.raw==='number'&&Number.isFinite(value.raw)?value.raw:null;
const yahooSymbol=s=>s.replace(/^([A-Z0-9]+)\.([A-Z])$/,'$1-$2');
const iso=value=>{const n=raw(value);return n!==null&&n>0&&n<253402300799?new Date(n*1000).toISOString():null;};
const number=value=>{
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  const text=String(value??'').trim();
  if(!/^\$?-?\d[\d,]*(?:\.\d+)?%?$/.test(text))return null;
  const n=Number(text.replace(/[$,%]/g,''));return Number.isFinite(n)?n:null;
};

// Anonymous provider session, held in memory only. No user login, token or portfolio is sent.
class YahooFundamentals {
  constructor(fetcher=fetch){this.fetcher=fetcher;this.session=null;this.pending=null;}
  async request(url,headers={}){
    return this.fetcher(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'*/*',...headers},signal:AbortSignal.timeout(7000)});
  }
  async getSession(){
    if(this.session&&Date.now()-this.session.at<3600000)return this.session;
    if(this.pending)return this.pending;
    this.pending=(async()=>{
      const response=await this.request('https://fc.yahoo.com');
      // fc.yahoo.com normally returns 404 while setting the anonymous A3 cookie.
      const cookies=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')||''];
      const cookie=cookies.map(c=>c.split(';')[0]).filter(Boolean).join('; ');
      if(!cookie)throw new Error('Yahoo 暂未提供匿名数据会话');
      const r=await this.request('https://query1.finance.yahoo.com/v1/test/getcrumb',{Cookie:cookie});
      const crumb=(await r.text()).trim();
      if(!r.ok||!crumb||crumb.length>100||/[<>\s]/.test(crumb))throw new Error('Yahoo 财务数据暂不可用');
      return this.session={cookie,crumb,at:Date.now()};
    })().finally(()=>{this.pending=null;});
    return this.pending;
  }
  async read(symbol,retry=true){
    const session=await this.getSession();
    const providerSymbol=yahooSymbol(symbol);
    const url=`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(providerSymbol)}?modules=price,summaryDetail,defaultKeyStatistics,financialData,fundProfile&crumb=${encodeURIComponent(session.crumb)}`;
    const response=await this.request(url,{Cookie:session.cookie});
    if(response.status===401&&retry){this.session=null;return this.read(symbol,false);}
    if(!response.ok)throw new Error(`Yahoo 财务数据暂不可用（HTTP ${response.status}）`);
    const body=await response.json(),data=body.quoteSummary?.result?.[0];
    if(!data||data.price?.symbol!==providerSymbol)throw new Error('Yahoo 未返回匹配标的的财务数据');
    return data;
  }
}

function normalizeFundamentals(symbol,type,yahoo,nasdaq,{fetchedAt=new Date().toISOString(),warnings=[]}={}){
  const etf=type==='ETF',metrics={},sources=[];
  const names=['pe','eps','marketCap','pb','dividendYield','week52High','week52Low','aum','expenseRatio'];
  for(const key of names)metrics[key]={value:null,status:'unavailable',reason:'来源暂未提供可核验数据',provider:null,source:null,period:null};
  function set(key,value,provider,source,period){
    if(value===null||!Number.isFinite(value))return;
    if(key!=='eps'&&value<0)return;
    metrics[key]={value,status:'available',reason:null,provider,source,period};
  }
  if(nasdaq){
    const source=`https://www.nasdaq.com/market-activity/${etf?'etf':'stocks'}/${symbol.toLowerCase()}`,d=nasdaq.summaryData||{};
    sources.push({provider:'Nasdaq',source,fetchedAt,quoteAsOf:null,financialPeriod:null});
    set('marketCap',number(d.MarketCap?.value),'Nasdaq',source,'来源市值快照 · USD');
    set('dividendYield',number(d.Yield?.value),'Nasdaq',source,'Current Yield · 来源口径');
    const pair=String(d.FiftTwoWeekHighLow?.value||'').split('/');
    if(pair.length===2){const high=number(pair[0]),low=number(pair[1]);if(high!==null&&low!==null&&high>=low&&low>0){set('week52High',high,'Nasdaq',source,'过去 52 周 · USD');set('week52Low',low,'Nasdaq',source,'过去 52 周 · USD');}}
    // Nasdaq explicitly labels AUM in thousands of USD, not USD.
    if(/\(,000\)/.test(d.AUM?.label||'')){const aum=number(d.AUM.value);set('aum',aum===null?null:aum*1000,'Nasdaq',source,'基金资产规模 · USD');}
    if(etf&&number(d.ExpenseRatio?.value)!==null)metrics.expenseRatio={...metrics.expenseRatio,provider:'Nasdaq',source,reason:'汇总费率未提供可核验更新时间，等待基金资料确认'};
  }
  if(yahoo){
    const p=yahoo.price||{},s=yahoo.summaryDetail||{},k=yahoo.defaultKeyStatistics||{},f=yahoo.financialData||{};
    const source=`https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol(symbol))}/key-statistics/`;
    const financialPeriod=iso(k.mostRecentQuarter)?.slice(0,10)||null,usd=p.currency==='USD';
    sources.push({provider:'Yahoo Finance',source,fetchedAt,quoteAsOf:iso({raw:p.regularMarketTime}),financialPeriod,currency:p.currency||null,financialCurrency:f.financialCurrency||null});
    if(usd){
      set('marketCap',raw(s.marketCap)??raw(p.marketCap),'Yahoo Finance',source,'来源市值快照 · USD');
      const high=raw(s.fiftyTwoWeekHigh),low=raw(s.fiftyTwoWeekLow);
      if(high!==null&&low!==null&&high>=low&&low>0){set('week52High',high,'Yahoo Finance',source,'过去 52 周 · USD');set('week52Low',low,'Yahoo Finance',source,'过去 52 周 · USD');}
      set('aum',raw(s.totalAssets)??raw(k.totalAssets),'Yahoo Finance',source,'来源基金总资产 · USD · 基准日期未提供，可能含其他份额类别');
    }
    if(!etf){
      set('pe',raw(s.trailingPE),'Yahoo Finance',source,'TTM · 来源滚动市盈率');
      // defaultKeyStatistics EPS is quote-currency/per-listed-unit data. financialCurrency
      // describes the income statement; comparing those currencies incorrectly hid ADR EPS.
      if(usd)set('eps',raw(k.trailingEps),'Yahoo Finance',source,`TTM · 每股或每存托凭证盈利 · USD${f.financialCurrency&&f.financialCurrency!=='USD'?` · 原财报币种 ${f.financialCurrency}`:''}`);
      else metrics.eps.reason='报价币种不是 USD 或未提供，暂不展示美元 EPS';
      set('pb',raw(k.priceToBook),'Yahoo Finance',source,financialPeriod?`最近财报期 ${financialPeriod}`:'最近财报 · 来源未提供期间');
      const eps=raw(k.trailingEps),book=raw(k.bookValue);
      if(eps!==null&&eps<=0)metrics.pe={...metrics.pe,value:null,status:'not-meaningful',reason:'过去 12 个月每股盈利不大于零，PE 不具通常比较意义'};
      if(book!==null&&book<=0)metrics.pb={...metrics.pb,value:null,status:'not-meaningful',reason:'每股账面净资产不大于零，PB 不具通常比较意义'};
      for(const key of ['pe','pb'])if(metrics[key].value===0)metrics[key]={...metrics[key],value:null,status:'not-meaningful',reason:'来源比率不大于零，暂不作估值比较'};
    }
    const yieldValue=raw(etf?s.yield:s.dividendYield);
    set('dividendYield',yieldValue===null?null:yieldValue*100,'Yahoo Finance',source,etf?'基金分配收益率 · 来源口径':'预期年度现金股息 / 股价 · 非承诺回报');
    const expense=raw(yahoo.fundProfile?.feesExpensesInvestment?.annualReportExpenseRatio)??raw(k.annualReportExpenseRatio);
    set('expenseRatio',expense===null?null:expense*100,'Yahoo Finance',source,'基金资料 · 年度报告费率');
  }
  for(const key of etf?['pe','eps','pb','marketCap']:['aum','expenseRatio'])metrics[key]={...metrics[key],value:null,status:'not-applicable',reason:etf?'ETF 为一篮子资产，不套用公司口径；请查看基金资产规模与费率':'该项适用于 ETF'};
  const relevant=etf?['aum','expenseRatio','dividendYield','week52High','week52Low']:['pe','eps','marketCap','pb','dividendYield','week52High','week52Low'];
  const available=relevant.filter(k=>metrics[k].status==='available'||metrics[k].status==='not-meaningful').length;
  return {symbol,type,currency:'USD',fetchedAt,status:available===relevant.length?'available':available?'partial':'unavailable',metrics,sources,warnings};
}
module.exports={YahooFundamentals,normalizeFundamentals};
