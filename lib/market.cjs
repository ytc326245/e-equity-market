const fs=require('node:fs');
const path=require('node:path');
const {validSymbol}=require('./account.cjs');
const {marketStatus}=require('./calendar.cjs');
const {YahooFundamentals,normalizeFundamentals}=require('./fundamentals.cjs');
const listing=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/symbols.json'),'utf8'));
const aliases={AAPL:'苹果',MSFT:'微软',NVDA:'英伟达',TSLA:'特斯拉',AMZN:'亚马逊',GOOGL:'谷歌',META:'脸书',SPY:'标普500',QQQ:'纳斯达克100',DIA:'道琼斯',BABA:'阿里巴巴',PDD:'拼多多',JD:'京东',NIO:'蔚来',XPEV:'小鹏',LI:'理想',COIN:'Coinbase',AMD:'超威半导体',INTC:'英特尔',GLD:'黄金',VTI:'全美股市',VOO:'标普500'};
const bySymbol=new Map(listing.symbols.map(x=>[x.symbol,x]));
const numeric=v=>{ const n=Number(String(v??'').replace(/[$,%\s]/g,''));return String(v??'').trim() && Number.isFinite(n)?n:null; };
const nyFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function nyParts(time){return Object.fromEntries(nyFormat.formatToParts(new Date(time)).map(p=>[p.type,p.value]));}
function sourceDate(value){
  // Parse the provider's calendar date explicitly; never use the machine's time zone.
  const s=String(value||''),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/),year,month,day;
  if(m){[,year,month,day]=m;}else if((m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))){[,month,day,year]=m;}
  else if((m=s.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})(?:$|\s)/))&&months.includes(m[1])){year=m[3];month=months.indexOf(m[1])+1;day=m[2];}
  else return null;
  const date=new Date(Date.UTC(+year,+month-1,+day));
  return date.getUTCFullYear()===+year&&date.getUTCMonth()===+month-1&&date.getUTCDate()===+day?date.toISOString().slice(0,10):null;
}
function newYorkInstant(day,clock){
  const wall=Date.parse(`${day}T${clock}:00Z`);let utc=wall;
  for(let i=0;i<3;i++){
    const p=nyParts(utc),seen=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    utc+=wall-seen;
  }
  const p=nyParts(utc);
  if(`${p.year}-${p.month}-${p.day}`!==day||`${p.hour}:${p.minute}`!==clock)throw new Error('无法核验纽约交易时间');
  return utc;
}
function normalizeIntraday(data){
  const sessionDate=sourceDate(data.timeAsOf);
  if(!sessionDate)throw new Error('分时数据缺少可核验的交易日期');
  const sessionStatus=marketStatus(new Date(newYorkInstant(sessionDate,'12:00')));
  if(['休市','交易日历待更新'].includes(sessionStatus.label))throw new Error('分时数据的交易日期不在有效交易日历内');
  const start=newYorkInstant(sessionDate,'09:30'),end=newYorkInstant(sessionDate,sessionStatus.closeTime);
  const rows=[],encodings=new Set();let invalid=0,outsideSession=0,wrongDate=0,duplicates=0;
  for(const p of data.chart||[]){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.y<=0||!Number.isFinite(new Date(p.x).getTime())){invalid++;continue;}
    const label=String(p.z?.dateTime||'').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*ET$/i);
    if(!label||+label[1]<1||+label[1]>12||+label[2]>59)throw new Error('分时数据缺少可核验的 ET 时间标签');
    const clock=`${String(+label[1]%12+(/PM/i.test(label[3])?12:0)).padStart(2,'0')}:${label[2]}`;
    const raw=new Date(p.x),ny=nyParts(p.x),utcClock=raw.toISOString().slice(11,16);
    let time,day;
    // Nasdaq currently encodes ET wall time in x's UTC fields. Verify against z.dateTime.
    // Also accept a genuine UTC epoch if the ET label agrees, without adding a fixed offset.
    if(utcClock===clock){day=raw.toISOString().slice(0,10);time=newYorkInstant(day,clock);encodings.add('ET-wall-clock');}
    else if(`${ny.hour}:${ny.minute}`===clock){day=`${ny.year}-${ny.month}-${ny.day}`;time=p.x;encodings.add('UTC-epoch');}
    else throw new Error('分时时间戳与 ET 标签不一致，已停止绘图');
    if(day!==sessionDate){wrongDate++;continue;}
    // Half-open interval: the 16:00 (or early-close 13:00) bucket may contain after-hours trades.
    if(time<start||time>=end){outsideSession++;continue;}
    rows.push({time,price:p.y});
  }
  if(encodings.size>1)throw new Error('分时数据混用了不同时间编码，已停止绘图');
  rows.sort((a,b)=>a.time-b.time);
  const byTime=new Map();
  for(const p of rows){if(byTime.has(p.time)){if(byTime.get(p.time).price!==p.price)throw new Error('同一分时时间存在冲突价格，已停止绘图');duplicates++;}else byTime.set(p.time,p);}
  return {points:[...byTime.values()],sessionDate,session:{start,end,closeTime:sessionStatus.closeTime},timeZone:'America/New_York',timestampEncoding:[...encodings][0]||null,priceType:'provider-chart-sample',diagnostics:{input:(data.chart||[]).length,invalid,outsideSession,wrongDate,duplicates}};
}
function normalizeHistorical(data){
  const rows=data.tradesTable?.rows||[],byTime=new Map(),excluded=new Set();let invalid=0,placeholder=0,invalidOHLC=0,duplicates=0;
  for(const row of rows){
    const day=sourceDate(row.date),time=day?Date.parse(`${day}T00:00:00Z`):NaN,price=numeric(row.close);
    if(!Number.isFinite(time)||!(price>0)){invalid++;if(day)excluded.add(day);continue;}
    const open=numeric(row.open),high=numeric(row.high),low=numeric(row.low),hasOHLC=['open','high','low'].some(k=>Object.hasOwn(row,k));
    if(hasOHLC&&(!(open>0)||!(high>0)||!(low>0)||high<low||Math.max(open,price)>high+.005001||Math.min(open,price)<low-.005001)){invalid++;invalidOHLC++;excluded.add(day);continue;}
    // An all-flat row with explicitly absent/zero volume is a carry-forward placeholder,
    // not a verified daily close. Do not substitute a previous close or smooth real moves.
    if(hasOHLC&&open===price&&high===price&&low===price&&Object.hasOwn(row,'volume')&&!(numeric(row.volume)>0)){invalid++;placeholder++;excluded.add(day);continue;}
    if(byTime.has(time)){if(byTime.get(time).price!==price)throw new Error('同一历史日期存在冲突收盘价，已停止绘图');duplicates++;}
    else byTime.set(time,{time,price});
  }
  const points=[...byTime.values()].sort((a,b)=>a.time-b.time);
  return {points,excludedDates:[...excluded].filter(d=>!byTime.has(Date.parse(`${d}T00:00:00Z`))).sort(),priceType:'provider-daily-close',diagnostics:{input:rows.length,invalid,placeholder,invalidOHLC,duplicates}};
}
class Market {
  constructor({financialFetch=fetch}={}){this.cache=new Map();this.pending=new Map();this.financialData=new YahooFundamentals(financialFetch);}
  info(){return {provider:'Nasdaq 公开行情',coverage:'unverified',verified:false,isRealTime:false,tradingEnabled:true,executionMode:'public-quote',delayMayApply:true,status:'真实报价模拟交易已开放',note:'正常交易时段按公开真实报价模拟成交；行情可能存在延迟，不保证与券商实时价格完全一致。报价时间与读取时间分别标注。',symbols:listing.symbols.length,listingUpdatedAt:listing.updatedAt,source:'https://www.nasdaq.com/market-activity',calendarSource:'https://www.nyse.com/trade/hours-calendars'};}
  search(query){const q=String(query??'').trim().toUpperCase().slice(0,100); if(!q)return ['AAPL','MSFT','NVDA','TSLA','SPY','QQQ','AMZN','GOOGL','VOO','VTI'].map(s=>this.symbol(s)).filter(Boolean);
    return listing.symbols.filter(x=>x.symbol.includes(q)||x.name.toUpperCase().includes(q)||aliases[x.symbol]?.includes(q)).sort((a,b)=>(a.symbol===q?-1:b.symbol===q?1:0)||(a.symbol.startsWith(q)?0:1)-(b.symbol.startsWith(q)?0:1)).slice(0,40).map(x=>({...x,alias:aliases[x.symbol]||''}));}
  symbol(symbol){const x=bySymbol.get(symbol);return x?{...x,alias:aliases[symbol]||''}:null;}
  async request(symbol,endpoint){
    if(!validSymbol(symbol)||!bySymbol.has(symbol))throw new Error('股票不在当前上市目录中');
    const type=bySymbol.get(symbol).type==='ETF'?'etf':'stocks';
    const url=`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/${endpoint}${endpoint.includes('?')?'&':'?'}assetclass=${type}`;
    const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json','Referer':'https://www.nasdaq.com/'},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error(`行情服务暂不可用（HTTP ${response.status}）`);
    const body=await response.json();
    if(!body.data)throw new Error('该标的暂无可用行情');
    if(body.data.symbol&&String(body.data.symbol).toUpperCase()!==symbol)throw new Error('行情来源返回了其他标的数据，已停止使用');
    return body.data;
  }
  async cached(key,ttl,fn,fresh=false){
    const old=this.cache.get(key); if(!fresh&&old&&Date.now()-old.at<ttl)return old.value;
    if(this.pending.has(key))return this.pending.get(key);
    const promise=fn().then(value=>{this.cache.set(key,{value,at:Date.now()});return value;}).finally(()=>this.pending.delete(key));this.pending.set(key,promise);return promise;
  }
  quote(symbol,{fresh=false}={}){return this.cached(`quote:${symbol}`,15000,async()=>{
    const data=await this.request(symbol,'info'); const p=data.primaryData; const price=numeric(p?.lastSalePrice);
    if(price===null||price<=0)throw new Error('该标的尚无有效报价');
    return {symbol,price,priceType:'last-sale',sessionDate:sourceDate(p.lastTradeTimestamp),change:numeric(p.netChange),changePercent:numeric(p.percentageChange),volume:numeric(p.volume),previousClose:numeric(p.netChange)===null?null:price-numeric(p.netChange),timestamp:null,asOf:p.lastTradeTimestamp||'来源未提供',fetchedAt:new Date().toISOString(),provider:'Nasdaq 公开行情',coverage:'unverified',verified:false,isRealTime:p.isRealTime===true,providerMarketStatus:data.marketStatus,tradingStatus:'unknown',source:`https://www.nasdaq.com/market-activity/${this.symbol(symbol).type==='ETF'?'etf':'stocks'}/${symbol.toLowerCase()}`};
  },fresh);}
  fundamentals(symbol,{fresh=false}={}){
    const security=this.symbol(symbol);if(!validSymbol(symbol)||!security)return Promise.reject(new Error('股票不在当前上市目录中'));
    const key=`fundamentals:${symbol}`,old=this.cache.get(key),ttl=old?.value.status==='available'?300000:30000;
    return this.cached(key,ttl,async()=>{
      const [yahoo,nasdaq]=await Promise.allSettled([this.financialData.read(symbol),this.request(symbol,'summary')]);
      return normalizeFundamentals(symbol,security.type,yahoo.status==='fulfilled'?yahoo.value:null,nasdaq.status==='fulfilled'?nasdaq.value:null,{warnings:[...(yahoo.status==='rejected'?['Yahoo 财务数据暂不可用，部分指标可能缺失']:[]),...(nasdaq.status==='rejected'?['Nasdaq 汇总数据暂不可用，部分指标可能缺失']:[])]});
    },fresh);
  }
  chart(symbol,range='1D',{fresh=false}={}){const today=nyParts(Date.now());return this.cached(`chart-v2:${symbol}:${range}:${today.year}-${today.month}-${today.day}`,60000,async()=>{
    if(!['1D','1M','3M','1Y'].includes(range))throw new Error('图表区间无效');
    let points=[],asOf='',details={};
    if(range==='1D'){
      const data=await this.request(symbol,'chart'); asOf=data.timeAsOf;
      details=normalizeIntraday(data);points=details.points;
    }else{
      const from=new Date();from.setUTCDate(from.getUTCDate()-({ '1M':32,'3M':94,'1Y':368}[range]));
      const data=await this.request(symbol,`historical?fromdate=${from.toISOString().slice(0,10)}&limit=400`);asOf=data.tradesTable?.asOf||'';
      details=normalizeHistorical(data);points=details.points;
    }
    return {symbol,range,points,asOf,...details,fetchedAt:new Date().toISOString(),provider:'Nasdaq 公开行情',verified:false};
  },fresh);}
}
module.exports={Market};
