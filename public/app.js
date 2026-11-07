'use strict';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=v=>v===null||v===undefined||!Number.isFinite(v)?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const priceUsd=v=>v===null||v===undefined||!Number.isFinite(v)?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:6}).format(v);
const priceChange=v=>`${v>0?'+':''}${new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:6}).format(v)}`;
const num=(v,d=6)=>Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
const signed=v=>`${v>0?'+':''}${v.toFixed(2)}`;
const color=v=>v>0?'positive':v<0?'negative':'muted';
const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('zh-CN',{hour12:false}):'—';
let state=null,symbol='AAPL',security={symbol:'AAPL',name:'Apple Inc.',type:'STOCK'},range='1D',side='buy',page='terminal',selection=0,searchRevision=0,searchTimer,toastTimer,confirmation=null,refreshing=false,submitting=false,serverOffset=0;
const quotes=new Map(),quoteErrors=new Map(),metadata=new Map();
const quoteRevisions=new Map();
const fundamentals=new Map(),fundamentalErrors=new Map(),fundamentalLoading=new Set(),fundamentalRevisions=new Map();
let guideStep=0,fundamentalsDetailStamp='';
const learningKey='e-equity.learning.v1';
const metricDefinitions={
  pe:{label:'PE 市盈率',unit:'倍',explanation:'股价相对于每股盈利的倍数。这里使用来源的 TTM（过去 12 个月）市盈率，不是预测 PE。盈利不大于零时不作通常的估值比较；高低本身不代表买卖结论。'},
  eps:{label:'EPS 每股盈利',unit:'USD',explanation:'过去 12 个月归属于每股的盈利，不是每股股息。采用 Yahoo 的 TTM 数据，可能与公司公告或其他网站的调整口径不同；负值表示该口径下每股亏损。'},
  marketCap:{label:'总市值',unit:'USD',explanation:'公司全部已发行股份按市价估算的总价值，不是公司账上现金。随股价和股本变化，展示来源快照。'},
  pb:{label:'PB 市净率',unit:'倍',explanation:'股价相对于每股账面净资产的倍数，财报通常按季度更新。净资产不大于零时不作通常比较。不同行业的资产结构不同，不能仅靠 PB 判断便宜或昂贵。'},
  dividendYield:{label:'股息率',unit:'%',explanation:'现金股息或基金分配相对价格的比例。公司优先使用 Yahoo 预期年度股息率，缺失时使用 Nasdaq Current Yield；基金使用来源的分配收益率。请查看下方口径。股息会调整，这不是承诺收益。'},
  week52High:{label:'52 周最高价',unit:'USD',explanation:'来源记录的过去 52 周最高交易价，不是当天最高价，也不代表未来价格上限。复权与价格覆盖范围不同可能造成平台差异。'},
  week52Low:{label:'52 周最低价',unit:'USD',explanation:'来源记录的过去 52 周最低交易价，不是当天最低价，也不代表未来价格下限。'},
  aum:{label:'基金资产（来源口径）',unit:'USD',explanation:'来源公布的基金资产资料，基准日期可能未提供。部分基金有多类份额，数值可能包含其他份额类别，不能直接当作当前 ETF 份额的实时资产规模。Nasdaq 标注为千美元时，软件转换为美元。'},
  expenseRatio:{label:'基金年费率',unit:'%',explanation:'基金每年运营费用占资产的比例，通常已在基金净值中体现，不是每次买卖收取的手续费。本软件不会另行模拟扣除基金费用。'}
};
const guideSteps=[
  {title:'设置一笔虚拟本金',text:'账户里的美元都是虚拟资金，买卖不会连接真实券商。先选择一个方便练习的金额；重新设置本金会开始新一轮，已有记录请先备份。',action:'capital',button:'查看本金设置'},
  {title:'找到股票或 ETF',text:'用代码、英文名称或常用中文名搜索。股票代表一家公司的股份；ETF 通常持有一篮子资产。点星标可以加入自选。',action:'search',button:'试试搜索'},
  {title:'看价格，也看指标口径',text:'主界面放常用指标，点任意指标可看解释、来源与财报期。TTM 表示过去 12 个月；“暂无数据”不等于零。ETF 不套用公司的 EPS、PE 或 PB。',action:'metrics',button:'看看当前标的指标'},
  {title:'练习一笔买卖，再复盘',text:'先选买入或卖出，再选择按金额或股数输入。卖出需要已有持仓。只在美股正常交易时段模拟成交，提交时重新读取报价；休市时可以观察行情。成交后去持仓和记录页查看变化，记得导出备份。',action:'order',button:'查看下单区域'}
];
async function api(url,body){
  let response;
  try{response=await fetch(url,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json','X-Equity-Token':state?.token||''},body:JSON.stringify(body)});}catch{throw new Error('无法连接本机服务，请确认 E-Equity 正在运行');}
  const data=await response.json();if(!response.ok)throw new Error(data.error||'操作失败');return data;
}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
function showDialog(id){const d=$('#'+id);if(!d.open)d.showModal();}
function closeDialog(id){$('#'+id).close();}
function confirmAction(title,message,callback){$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;confirmation=callback;showDialog('confirm-dialog');}
const pageTitles={terminal:['交易工作台','从这里，开始观察市场','跟随真实行情，管理你的虚拟投资组合。'],positions:['我的持仓','你的投资组合','了解每一笔持仓，以及它对账户的影响。'],history:['交易记录','每一次决策，都有记录','回顾买卖过程，找到属于自己的节奏。'],data:['行情状态','看清数据，也看清边界','查看当前数据来源、覆盖范围和交易可用状态。'],settings:['账户设置','从你选择的起点开始','设置虚拟本金，管理本机账户与备份。']};
function setPage(value){if(!pageTitles[value])return;page=value;$$('.view').forEach(v=>v.hidden=v.id!==`view-${page}`);$$('.nav[data-page]').forEach(v=>v.classList.toggle('active',v.dataset.page===page));$('#page-name').textContent=pageTitles[page][0];$('#heading').textContent=pageTitles[page][1];$('#subheading').textContent=pageTitles[page][2];}
function currentTime(){return new Date(Date.now()+serverOffset);}
function renderClock(){if(!state)return;const now=currentTime();const et=now.toLocaleTimeString('zh-CN',{timeZone:'America/New_York',hour12:false});const bj=now.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});$('#market-clock').textContent=`纽约 ${et} · 北京 ${bj}`;$('#market-label').textContent=state.market.label+(state.market.earlyClose?' · 提前收盘日':'');$('#market-dot').className=`tiny-dot ${state.market.isOpen?'green':''}`;}
async function loadState(){state=await api('/api/state');serverOffset=Date.parse(state.serverTime)-Date.now();renderState();}
function renderState(){
  if(!state)return;const a=state.account,positions=Object.entries(a.positions),hasAccount=a.initialCents!==null;
  let value=0,complete=true;for(const [s,p]of positions){const q=quotes.get(s);if(!q){complete=false;continue;}value+=q.price*Number(p.quantityMicros)/1e6;}
  const equity=complete?a.cashCents/100+value:null,pnl=equity===null?null:equity-a.initialCents/100;
  $('#equity').textContent=hasAccount?usd(equity):'—';$('#cash').textContent=hasAccount?usd(a.cashCents/100):'—';$('#position-value').textContent=hasAccount?usd(complete?value:null):'—';
  $('#equity-note').textContent=!hasAccount?'设置本金，开启你的投资记录':!complete?'部分持仓暂无报价，无法估算总资产':positions.length?'按公开报价估算 · 时效待验证':'所有资金均为虚拟';
  $('#capital-note').textContent=hasAccount?`初始本金 ${usd(a.initialCents/100)}`:'虚拟美元账户';
  $('#holding-note').textContent=`${positions.length} 个持仓标的${positions.length?' · 公开报价估值':' · 尚未建立持仓'}`;
  $('#pnl').textContent=!hasAccount?'—':pnl===null?'—':`${pnl>0?'+':''}${usd(pnl)}`;$('#pnl').className=hasAccount&&pnl!==null?color(pnl):'';
  $('#pnl-note').textContent=!hasAccount?'相对初始本金':pnl===null?'等待持仓报价':`${signed(pnl/(a.initialCents/100)*100)}% · 已实现 ${usd(a.realizedCents/100)}`;
  $('#position-count').textContent=positions.length;$('#holding-count').textContent=positions.length;$('#watch-count').textContent=a.watchlist.length;
  $('#order-cash').textContent=hasAccount?usd(a.cashCents/100):'—';$('#setting-capital').textContent=hasAccount?usd(a.initialCents/100):'尚未设置';$('#setting-started').textContent=date(a.createdAt);
  $('#listing-count').textContent=`${num(state.feed.symbols,0)} 个标的`;$('#listing-updated').textContent=date(state.feed.listingUpdatedAt);
  renderWatchlist();renderPositions();renderHistory();renderOrder();renderClock();
}
function renderWatchlist(){
  if(!state)return;
  $('#watch-items').innerHTML=state.account.watchlist.length?state.account.watchlist.map(s=>{
    const q=quotes.get(s),m=metadata.get(s),error=quoteErrors.get(s);return `<button class="watch-item ${symbol===s?'selected':''}" data-symbol="${escapeHtml(s)}" aria-label="查看 ${escapeHtml(s)} 行情"><div><strong>${escapeHtml(s)}</strong><small>${escapeHtml(m?.alias||m?.name||'股票 / ETF')}</small></div><div class="watch-price">${q?priceUsd(q.price):'—'}<small class="${q?color(q.changePercent):'muted'}">${q&&q.changePercent!==null?signed(q.changePercent)+'%':error?'暂无报价':'读取中…'}</small></div></button>`;
  }).join(''):'<div class="empty-state"><h3>添加你的第一个自选</h3><p>点击上方 ＋ 搜索股票或 ETF</p></div>';
  $('#toggle-watch').textContent=state.account.watchlist.includes(symbol)?'★':'☆';
  $('#toggle-watch').setAttribute('aria-label',state.account.watchlist.includes(symbol)?'移除自选':'添加自选');
}
const empty=(title,description,button='')=>`<div class="empty-state"><div class="empty-icon">▥</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${button}</div>`;
function renderPositions(){
  if(!state)return;const entries=Object.entries(state.account.positions);
  let html;
  if(!entries.length)html=empty('留一点空间，给你的第一笔投资。',state.account.initialCents===null?'先设定本金，再探索你感兴趣的股票和 ETF。':'持仓会在首笔模拟买入成交后显示。',state.account.initialCents===null?'<button class="button" data-open-capital>设置虚拟本金 ↗</button>':'<button class="secondary-button" data-search>探索股票 ↗</button>');
  else html=`<div class="table-wrap"><table><thead><tr><th>股票代码</th><th>持有股数</th><th>平均成本</th><th>参考价格</th><th>估算市值</th><th>浮动盈亏</th></tr></thead><tbody>${entries.map(([s,p])=>{const qty=Number(p.quantityMicros)/1e6,q=quotes.get(s),value=q?q.price*qty:null,pnl=value===null?null:value-p.costCents/100;return `<tr class="clickable" data-symbol="${escapeHtml(s)}"><td>${escapeHtml(s)}</td><td>${num(qty)}</td><td>${priceUsd(p.costCents/100/qty)}</td><td>${q?priceUsd(q.price):'—'}</td><td>${usd(value)}</td><td class="${pnl===null?'muted':color(pnl)}">${usd(pnl)}</td></tr>`;}).join('')}</tbody></table></div>`;
  $('#positions-table').innerHTML=html;$('#holdings-preview').innerHTML=html;
}
function renderHistory(){
  if(!state)return;const trades=state.account.trades;
  $('#history-table').innerHTML=trades.length?`<div class="table-wrap"><table><thead><tr><th>模拟成交时间（本机时区）</th><th>代码</th><th>方向</th><th>股数</th><th>成交价</th><th>金额</th><th>报价时间（来源）</th><th>读取时间（本机时区）</th></tr></thead><tbody>${trades.slice().reverse().map(t=>`<tr><td>${escapeHtml(date(t.timestamp))}</td><td>${escapeHtml(t.symbol)}</td><td class="${t.side==='buy'?'positive':'negative'}">${t.side==='buy'?'买入':'卖出'}</td><td>${num(t.quantity)}</td><td>${priceUsd(t.price)}</td><td>${usd(t.amountCents/100)}</td><td>${escapeHtml(t.quoteAsOf||t.quoteTime||'来源未提供')}</td><td>${escapeHtml(date(t.quoteFetchedAt))}</td></tr>`).join('')}</tbody></table></div>`:empty('交易记录，从一次决策开始。','成交后的每笔买卖都会保存在这里。');
}
function tradingBlock(){
  if(!state)return '正在检查交易条件…';
  if(state.account.initialCents===null)return '请先在账户设置中输入虚拟本金。';
  if(!state.market.isOpen)return '当前不是美股正常交易时段，休市期间仅可查看。';
  return EquityQuotePolicy.quoteBlock(quotes.get(symbol),currentTime().getTime(),symbol);
}
function renderOrder(){
  $('#order-symbol').textContent=symbol;const q=quotes.get(symbol),mode=$('#order-mode').value,v=Number($('#order-value').value);
  $('#order-price').textContent=q?priceUsd(q.price):'—';$('#order-unit').textContent=mode==='amount'?'USD':'股';$('#order-value-label').textContent=`${side==='buy'?'买入':'卖出'}${mode==='amount'?'金额':'股数'}`;$('#estimate-label').textContent=mode==='amount'?'预计股数':'预计金额';
  $('#estimate').textContent=q&&v>0&&Number.isFinite(v)?mode==='amount'?num(Math.floor(v/q.price*1e6)/1e6)+' 股':usd(v*q.price):'—';
  const block=tradingBlock();$('#order-status').textContent=block||'按公开真实报价模拟成交，行情可能延迟；提交时会重新读取价格。';$('#submit-order').disabled=!!block||!(v>0)||!Number.isFinite(v)||submitting;$('#submit-order').textContent=submitting?'正在处理…':block?(state?.account.initialCents===null?'请先设置本金':!state?.market.isOpen?'休市中，暂不能交易':'等待有效报价'):`确认${side==='buy'?'买入':'卖出'} ${symbol}`;
  $('#order-tip').textContent=side==='sell'?'卖出只能使用已有持仓，不能卖空。金额和股数可以切换，预计结果会随报价变化。':mode==='amount'?'按金额：输入想使用的虚拟美元，软件估算可买股数；支持不足一整股。提交时会重新读取价格。':'按股数：输入想买的股数，支持最多 6 位小数。预计金额随报价变化，请留意可用资金。';
}
function renderQuote(){
  const q=quotes.get(symbol),err=quoteErrors.get(symbol);$('#ticker-logo').textContent=symbol.slice(0,1);
  $('#ticker-symbol').innerHTML=`${escapeHtml(symbol)} <span class="instrument-tag">${security.type==='ETF'?'ETF':'STOCK'}</span>`;
  $('#ticker-name').textContent=security.alias?`${security.alias} · ${security.name}`:security.name;
  $('#quote-price').textContent=q?priceUsd(q.price):'—';$('#quote-change').textContent=q&&q.change!==null?`${priceChange(q.change)} (${q.changePercent===null?'—':signed(q.changePercent)+'%'})`:err?'暂无可用报价':'正在读取报价';$('#quote-change').className='quote-change '+(q?color(q.change):'muted');
  $('#quote-meta').textContent=q?`来源：${q.provider} · 来源最近成交价 · 报价时间（来源）：${q.asOf} · 读取：${date(q.fetchedAt)} · 可能延迟`:err||'来源：Nasdaq 公开行情';
  $('#stat-close').textContent=q?priceUsd(q.previousClose):'—';$('#stat-volume').textContent=q&&q.volume!==null?num(q.volume,0):'—';renderFundamentals();renderOrder();
}
function metricValue(key,metric){
  if(!metric||metric.value===null||!Number.isFinite(metric.value))return metric?.status==='not-applicable'?'不适用':metric?.status==='not-meaningful'?'不具比较意义':'—';
  const value=metric.value;
  if(['marketCap','aum'].includes(key))return value>=1e12?`${num(value/1e12,2)} 万亿美元`:value>=1e8?`${num(value/1e8,2)} 亿美元`:usd(value);
  return metricDefinitions[key].unit==='USD'?(['week52High','week52Low'].includes(key)?priceUsd(value):usd(value)):`${num(value,key==='expenseRatio'?4:2)}${metricDefinitions[key].unit}`;
}
function renderFundamentals(){
  const data=fundamentals.get(symbol),etf=security.type==='ETF',loading=fundamentalLoading.has(symbol);
  const keys=etf?['aum','expenseRatio','week52High','week52Low']:['pe','eps','marketCap','dividendYield'];
  $('#fundamentals-core').innerHTML=keys.map(key=>`<button class="fundamental-card" data-metric="${key}" aria-label="查看${metricDefinitions[key].label}详情与解释"><span>${metricDefinitions[key].label}${['pe','eps'].includes(key)?' · TTM':''}<i aria-hidden="true">ⓘ</i></span><strong>${escapeHtml(metricValue(key,data?.metrics[key]))}</strong></button>`).join('');
  $('#fundamentals-note').textContent=loading?'正在读取财务指标，报价与买卖可独立使用…':fundamentalErrors.get(symbol)||(!data?'财务指标待加载':`${data.status==='partial'?'部分指标暂无数据 · ':data.status==='unavailable'?'当前暂无可用财务数据 · ':''}来源：${[...new Set(data.sources.map(s=>s.provider))].join(' / ')||'暂不可用'} · 读取 ${date(data.fetchedAt)} · 点指标查看口径`);
  if($('#fundamentals-dialog').open&&fundamentalsDetailStamp!==fundamentalStamp())renderFundamentalsDetails();
}
function fundamentalStamp(){return `${symbol}|${fundamentals.get(symbol)?.fetchedAt}|${fundamentalLoading.has(symbol)}|${fundamentalErrors.get(symbol)}`;}
function renderFundamentalsDetails(focusKey=null){
  fundamentalsDetailStamp=fundamentalStamp();
  const data=fundamentals.get(symbol),etf=security.type==='ETF';
  const keys=etf?['aum','expenseRatio','dividendYield','week52High','week52Low','pe','eps','pb']:['pe','eps','marketCap','pb','dividendYield','week52High','week52Low'];
  $('#fundamentals-title').textContent=`${symbol} · 指标与解释`;
  $('#fundamentals-context').textContent=etf?'ETF 使用基金规模与费率等信息；公司口径的 PE、EPS、PB 标为不适用。': 'TTM = 过去 12 个月；PB 参考最近财报。财务指标并非实时更新，不会参与模拟成交定价。';
  const openKeys=new Set($$('#fundamentals-details details[open]').map(d=>d.dataset.metricKey));
  $('#fundamentals-details').innerHTML=keys.map(key=>{const d=metricDefinitions[key],m=data?.metrics[key];return `<details class="metric-detail" data-metric-key="${key}"${focusKey===key||(!focusKey&&openKeys.has(key))?' open':''}><summary><span>${d.label}${['pe','eps'].includes(key)?'（TTM）':''}</span><strong>${escapeHtml(metricValue(key,m))}</strong></summary><p>${d.explanation}</p><p class="metric-provenance">${escapeHtml(m?.reason||m?.period||(fundamentalLoading.has(symbol)?'正在读取…':'来源暂未提供可核验数据'))}${m?.provider?`<br>来源：${escapeHtml(m.provider)}`:''}${m?.provider?` · 读取 ${escapeHtml(date(data.fetchedAt))}`:''}</p></details>`;}).join('');
  $('#fundamentals-sources').innerHTML=data?.sources.map(s=>`<p>${escapeHtml(s.provider)}${s.financialPeriod?` · 最近财报期 ${escapeHtml(s.financialPeriod)}`:''}${s.quoteAsOf?`<br>估值参考行情时间（本地）：${escapeHtml(date(s.quoteAsOf))}`:''}</p>`).join('')||'';
  $('#fundamentals-warning').textContent=data?.warnings.join('；')||fundamentalErrors.get(symbol)||'';
  $('#fundamentals-refresh').disabled=fundamentalLoading.has(symbol);
}
function openFundamentals(key=null){renderFundamentalsDetails(key);showDialog('fundamentals-dialog');}
async function loadFundamentals(target,{fresh=false}={}){
  const revision=(fundamentalRevisions.get(target)||0)+1;fundamentalRevisions.set(target,revision);
  fundamentalLoading.add(target);fundamentalErrors.delete(target);if(target===symbol)renderFundamentals();
  try{const data=await api(`/api/fundamentals?symbol=${encodeURIComponent(target)}${fresh?'&fresh=1':''}`);if(fundamentalRevisions.get(target)!==revision)return;if(data.symbol!==target)throw new Error('财务数据与所选标的不匹配');fundamentals.set(target,data);}
  catch(e){if(fundamentalRevisions.get(target)===revision){fundamentals.delete(target);fundamentalErrors.set(target,e.message);}}
  finally{if(fundamentalRevisions.get(target)===revision){fundamentalLoading.delete(target);if(target===symbol)renderFundamentals();}}
}
function learningSaved(){try{return localStorage.getItem(learningKey)!==null;}catch{return false;}}
function dismissLearning(){try{localStorage.setItem(learningKey,'dismissed');}catch{}$('#learning-card').hidden=true;}
function renderGuide(){
  const step=guideSteps[guideStep];$('#guide-progress').textContent=`${guideStep+1} / ${guideSteps.length}`;$('#guide-title').textContent=step.title;$('#guide-text').textContent=step.text;$('#guide-action').textContent=step.button;$('#guide-action').dataset.guideAction=step.action;$('#guide-back').disabled=guideStep===0;$('#guide-next').textContent=guideStep===guideSteps.length-1?'完成引导':'下一步';
}
function openGuide(){guideStep=0;renderGuide();showDialog('guide-dialog');}
async function getQuote(s,{fresh=false}={}){const revision=(quoteRevisions.get(s)||0)+1;quoteRevisions.set(s,revision);try{const q=await api('/api/quote?symbol='+encodeURIComponent(s)+(fresh?'&fresh=1':''));if(quoteRevisions.get(s)!==revision)return;if(q.symbol!==s||!Number.isFinite(q.price)||q.price<=0)throw new Error('报价内容无效或标的不匹配');quotes.set(s,q);quoteErrors.delete(s);}catch(e){if(quoteRevisions.get(s)!==revision)return;quotes.delete(s);quoteErrors.set(s,e.message);}renderWatchlist();renderPositions();if(s===symbol)renderQuote();}
async function selectSymbol(s){
  symbol=s;const revision=++selection;setPage('terminal');range=range||'1D';
  security=metadata.get(s)||{symbol:s,name:'正在读取名称…',type:'STOCK'};renderQuote();renderWatchlist();
  loadFundamentals(s);
  const metaRequest=api('/api/search?q='+encodeURIComponent(s)).then(r=>{r.results.forEach(m=>metadata.set(m.symbol,m));if(revision===selection){security=metadata.get(s)||security;renderQuote();renderWatchlist();}}).catch(()=>{});
  await Promise.allSettled([metaRequest,getQuote(s),loadChart()]);renderState();
}
let chartRevision=0;
async function loadChart({fresh=false}={}){
  const target=symbol,targetRange=range,revision=++chartRevision;$('#chart-container').innerHTML='<div class="chart-empty">正在读取真实走势图…</div>';$('#chart-date').textContent='';
  try{const data=await api(`/api/chart?symbol=${encodeURIComponent(target)}&range=${targetRange}${fresh?'&fresh=1':''}`);if(revision===chartRevision&&symbol===target&&range===targetRange)drawChart(data);}
  catch(e){if(revision===chartRevision&&symbol===target&&range===targetRange)$('#chart-container').innerHTML=`<div class="chart-empty">${escapeHtml(e.message)}<br>可以稍后切换区间重试。</div>`;}
}
function drawChart(data){
  const points=data.points;$('#chart-date').textContent=data.range==='1D'?`${data.sessionDate||data.asOf||'最近交易日'} · 纽约时间 · 分时采样`:`历史收盘价 · USD${data.diagnostics?.invalid?` · 已排除 ${data.diagnostics.invalid} 条不可核验日线（留空）`:''}`;
  if(points.length<2){$('#chart-container').innerHTML='<div class="chart-empty">这个区间暂无足够的真实行情数据。</div>';return;}
  const width=700,height=280,left=3,right=60,top=12,bottom=27,w=width-left-right,h=height-top-bottom;
  const values=points.map(p=>p.price);let min=Math.min(...values),max=Math.max(...values);const spread=Math.max(max-min,max*.001);min-=spread*.12;max+=spread*.12;
  const start=data.session?.start??points[0].time,end=data.session?.end??points.at(-1).time;
  const xt=t=>left+(t-start)/(end-start)*w,x=i=>xt(points[i].time),y=p=>top+(max-p)/(max-min)*h;
  const excluded=(data.excludedDates||[]).map(d=>Date.parse(`${d}T00:00:00Z`));
  const segments=[];for(const p of points){const previous=segments.at(-1)?.at(-1);if(!previous||(data.range==='1D'?p.time-previous.time>90000:excluded.some(t=>t>previous.time&&t<p.time)))segments.push([]);segments.at(-1).push(p);}
  const pathFor=segment=>segment.map((p,i)=>`${i?'L':'M'}${xt(p.time).toFixed(2)},${y(p.price).toFixed(2)}`).join(' ');
  const line=segments.map(pathFor).join(' ');
  const area=segments.map(s=>pathFor(s)+` L${xt(s.at(-1).time)},${top+h} L${xt(s[0].time)},${top+h} Z`).join(' ');
  const trend=points.at(-1).price>=points[0].price?'#b8a5ff':'#d49abb';
  const grid=[0,1,2,3,4].map(i=>{const pos=top+h*i/4,price=max-(max-min)*i/4;return `<line class="chart-grid" x1="0" x2="${w}" y1="${pos}" y2="${pos}"/><text class="chart-label" x="${w+14}" y="${pos+4}">${price.toFixed(Math.max(2,Math.min(6,2-Math.floor(Math.log10(spread)))))}</text>`;}).join('');
  const label=t=>data.range==='1D'?new Date(t).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):new Date(t).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit',timeZone:'UTC'});
  const ticks=[0,.25,.5,.75,1].map(p=>{const t=start+(end-start)*p;return `<text class="chart-label" text-anchor="${p===0?'start':p===1?'end':'middle'}" x="${xt(t)}" y="${height-3}">${label(t)}</text>`;}).join('');
  $('#chart-container').innerHTML=`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(symbol)} ${data.range} 真实价格走势图"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${trend}" stop-opacity="0.23"/><stop offset="100%" stop-color="${trend}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#chart-fill)"/><path d="${line}" fill="none" stroke="${trend}" stroke-width="1.8" vector-effect="non-scaling-stroke"/>${ticks}<g id="chart-cursor" visibility="hidden"><line id="cursor-line" x1="0" x2="0" y1="${top}" y2="${top+h}" stroke="#a89bc6" stroke-dasharray="3 4"/><circle id="cursor-dot" r="4" fill="#d5c8ff" stroke="#171c2a" stroke-width="2"/></g></svg><div class="chart-tooltip" id="chart-tooltip" hidden></div>`;
  const svg=$('#chart-container svg');svg.addEventListener('pointermove',event=>{const r=svg.getBoundingClientRect(),px=(event.clientX-r.left)/r.width*width,targetTime=start+(px-left)/w*(end-start);let lo=0,hi=points.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(points[mid].time<targetTime)lo=mid+1;else hi=mid;}const i=lo>0&&Math.abs(points[lo-1].time-targetTime)<Math.abs(points[lo].time-targetTime)?lo-1:lo;const p=points[i];$('#chart-cursor').setAttribute('visibility','visible');$('#cursor-line').setAttribute('x1',x(i));$('#cursor-line').setAttribute('x2',x(i));$('#cursor-dot').setAttribute('cx',x(i));$('#cursor-dot').setAttribute('cy',y(p.price));$('#chart-tooltip').textContent=`${label(p.time)} · ${priceUsd(p.price)}${data.range==='1D'?' ET':''}`;$('#chart-tooltip').hidden=false;});svg.addEventListener('pointerleave',()=>{$('#chart-cursor').setAttribute('visibility','hidden');$('#chart-tooltip').hidden=true;});
}
async function search(){const rev=++searchRevision,q=$('#search-input').value;try{const result=await api('/api/search?q='+encodeURIComponent(q));if(rev!==searchRevision)return;result.results.forEach(m=>metadata.set(m.symbol,m));$('#search-results').innerHTML=result.results.length?result.results.map(m=>`<button class="search-result" data-search-symbol="${escapeHtml(m.symbol)}"><strong>${escapeHtml(m.symbol)}</strong><span class="result-name">${escapeHtml(m.alias?m.alias+' · '+m.name:m.name)}</span><small>${m.type==='ETF'?'ETF':'股票'}</small></button>`).join(''):empty('没有找到匹配标的','试试股票代码或英文公司名。');}catch(e){toast(e.message);}}
function openSearch(){showDialog('search-dialog');$('#search-input').focus();search();}
function openCapital(){const initialized=state?.account.initialCents!==null;$('#capital-title').textContent=initialized?'重新设置本金并开始':'设置你的起始本金';$('#capital-warning').textContent=initialized?'确认后将清空本轮持仓与交易记录；当前账户会自动存档。':'本金仅为虚拟资金，范围 0.01 至 1,000,000,000 美元。';showDialog('capital-dialog');$('#capital-value').focus();$('#capital-value').select();}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button,a,tr');if(!button)return;
  if(button.dataset.page)setPage(button.dataset.page);
  if(button.dataset.close){closeDialog(button.dataset.close);if(button.dataset.close==='confirm-dialog')confirmation=null;}
  if(button.dataset.metric)openFundamentals(button.dataset.metric);
  if(button.hasAttribute('data-start-guide'))openGuide();
  if(button.dataset.guideAction){closeDialog('guide-dialog');const action=button.dataset.guideAction;if(action==='capital'){if(state?.account.initialCents===null)openCapital();else setPage('settings');}if(action==='search')openSearch();if(action==='metrics'){setPage('terminal');openFundamentals(security.type==='ETF'?'aum':'pe');}if(action==='order'){setPage('terminal');$('#order-value').scrollIntoView({behavior:'smooth',block:'center'});$('#order-value').focus();}}
  if(button.hasAttribute('data-open-capital'))openCapital();
  if(button.hasAttribute('data-search'))openSearch();
  if(button.dataset.symbol)await selectSymbol(button.dataset.symbol);
  if(button.dataset.searchSymbol){const m=metadata.get(button.dataset.searchSymbol);if(m)security=m;closeDialog('search-dialog');await selectSymbol(button.dataset.searchSymbol);}
  if(button.dataset.range){range=button.dataset.range;$$('[data-range]').forEach(b=>b.classList.toggle('selected',b.dataset.range===range));loadChart();}
  if(button.dataset.side){side=button.dataset.side;$$('[data-side]').forEach(b=>b.classList.toggle('selected',b.dataset.side===side));renderOrder();}
  if(button.dataset.capital)$('#capital-value').value=button.dataset.capital;
  if(button.dataset.percent){if(!state)return;const q=quotes.get(symbol),fraction=Number(button.dataset.percent)/100,mode=$('#order-mode').value;let value;
    if(side==='buy'){const available=Math.floor(state.account.cashCents*fraction)/100;value=mode==='amount'?available:q?Math.floor(available/q.price*1e6)/1e6:0;}
    else{const qty=Number(state.account.positions[symbol]?.quantityMicros||0)/1e6*fraction;value=mode==='shares'?Math.floor(qty*1e6)/1e6:q?Math.floor(qty*q.price*100)/100:0;}
    $('#order-value').value=Number(value||0).toFixed(mode==='amount'?2:6);renderOrder();}
});
$('#search-open').onclick=openSearch;$('#search-shortcut').onclick=openSearch;$('#reset-open').onclick=openCapital;$('#help-open').onclick=()=>showDialog('help-dialog');
$('#fundamentals-open').onclick=()=>openFundamentals();$('#fundamentals-refresh').onclick=()=>loadFundamentals(symbol,{fresh:true});
$('#learning-dismiss').onclick=dismissLearning;$('#guide-back').onclick=()=>{if(guideStep>0)guideStep--;renderGuide();};$('#guide-next').onclick=()=>{if(guideStep<guideSteps.length-1){guideStep++;renderGuide();}else{dismissLearning();closeDialog('guide-dialog');}};
$('#refresh-quote').onclick=async event=>{event.currentTarget.disabled=true;loadFundamentals(symbol,{fresh:true});try{await Promise.allSettled([getQuote(symbol,{fresh:true}),loadChart({fresh:true})]);renderState();}finally{$('#refresh-quote').disabled=false;}};
$('#search-input').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,180);});
$('#order-mode').addEventListener('change',()=>{$('#order-value').value='';renderOrder();});$('#order-value').addEventListener('input',renderOrder);
$('#toggle-watch').onclick=async()=>{if(!state)return;try{const remove=state.account.watchlist.includes(symbol);await api('/api/watchlist',{symbol,remove});await loadState();toast(remove?'已从自选移除':'已加入自选');}catch(e){toast(e.message);}};
$('#capital-form').addEventListener('submit',async event=>{event.preventDefault();const capital=$('#capital-value').value;const button=event.submitter;button.disabled=true;try{await api('/api/account/reset',{capital,confirm:true});closeDialog('capital-dialog');await loadState();toast('本金已设置，账户已开始新的一轮');}catch(e){toast(e.message);}finally{button.disabled=false;}});
$('#order-form').addEventListener('submit',event=>{event.preventDefault();if(tradingBlock()||submitting)return;const input={symbol,side,mode:$('#order-mode').value,value:$('#order-value').value,requestId:crypto.randomUUID()};confirmAction(`确认${side==='buy'?'买入':'卖出'} ${symbol}`,'将重新读取公开真实报价并立即模拟成交。行情可能延迟，实际成交价以本次读取的报价为准。',async()=>{submitting=true;renderOrder();try{const result=await api('/api/trade',input);quoteRevisions.set(input.symbol,(quoteRevisions.get(input.symbol)||0)+1);$('#order-value').value='';await loadState();await getQuote(input.symbol,{fresh:true});renderState();toast(`已模拟成交 ${num(result.quantity)} 股 ${result.symbol}，价格 ${priceUsd(result.price)}`);}catch(e){toast(e.message);}finally{submitting=false;renderOrder();}});});
$('#confirm-action').onclick=async()=>{const action=confirmation;confirmation=null;closeDialog('confirm-dialog');if(action)await action();};
$('#confirm-dialog').addEventListener('cancel',()=>confirmation=null);
$('#import-open').onclick=()=>$('#import-file').click();
$('#import-file').addEventListener('change',async()=>{const file=$('#import-file').files[0];$('#import-file').value='';if(!file)return;if(file.size>9500000){toast('备份文件过大');return;}try{const backup=JSON.parse(await file.text());confirmAction('从备份恢复账户','恢复将替换当前账户，本机服务会先自动存档。确认继续？',async()=>{try{await api('/api/account/import',{backup,confirm:true});await loadState();await refreshQuotes();toast('账户已从备份恢复');}catch(e){toast(e.message);}});}catch{toast('无法读取 JSON 备份文件');}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!$$('dialog').some(d=>d.open))openSearch();}if(event.key==='F1'){event.preventDefault();if(!$$('dialog').some(d=>d.open))showDialog('help-dialog');}});
async function refreshQuotes(){
  if(!state||refreshing)return;refreshing=true;
  try{const symbols=[...new Set([symbol,...state.account.watchlist,...Object.keys(state.account.positions)])];for(let i=0;i<symbols.length;i+=3)await Promise.allSettled(symbols.slice(i,i+3).map(getQuote));renderState();if(!fundamentalLoading.has(symbol)&&Date.now()-(Date.parse(fundamentals.get(symbol)?.fetchedAt)||0)>(fundamentals.get(symbol)?.status==='available'?300000:30000))loadFundamentals(symbol);}finally{refreshing=false;}
}
async function boot(){$('#learning-card').hidden=learningSaved();try{await loadState();const results=await api('/api/search');results.results.forEach(m=>metadata.set(m.symbol,m));await selectSymbol(symbol);await refreshQuotes();}catch(e){toast(e.message);$('#market-label').textContent='本机服务未连接';$('#quote-meta').textContent=e.message;}}
let lastQuoteRefresh=0;
setInterval(()=>{renderClock();renderOrder();},1000);
setInterval(async()=>{try{await loadState();if(Date.now()-lastQuoteRefresh>(state.market.isOpen?30000:300000)){lastQuoteRefresh=Date.now();await refreshQuotes();if(page==='terminal')await loadChart();}}catch(e){$('#market-label').textContent='本机服务未连接';}},15000);
boot();
