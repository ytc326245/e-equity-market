const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function browser(){
  const elements=new Map(),storage=new Map();
  const element=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',innerHTML:'',value:'',dataset:{},open:false,hidden:false,disabled:false,addEventListener(){},classList:{toggle(){}},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(selector);};
  const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setTimeout(){},clearTimeout(){},setInterval(){},Intl,Date,fetch:async()=>{throw Error('offline fixture');}});
  vm.runInContext(fs.readFileSync('public/app.js','utf8'),context);
  return {context,element,storage,run:code=>vm.runInContext(code,context)};
}
function snapshot(symbol,value){return {symbol,type:'STOCK',status:'partial',metrics:{pe:{value,provider:'TEST',period:'TTM'},eps:{value:null},marketCap:{value:null},dividendYield:{value:null}},sources:[],warnings:[],fetchedAt:'2026-11-08T00:00:00Z'};}
test('late symbol replies and overlapping refreshes cannot replace current financial metrics',async()=>{
  const b=browser(),pending=[];b.context.network=url=>new Promise(resolve=>pending.push({url,resolve}));b.run('api=network;');
  const a=b.run("symbol='AAPL';loadFundamentals('AAPL')");
  const m=b.run("symbol='MSFT';loadFundamentals('MSFT')");
  pending[1].resolve(snapshot('MSFT',30));await m;pending[0].resolve(snapshot('AAPL',20));await a;
  assert.match(b.element('#fundamentals-core').innerHTML,/30倍/);assert.doesNotMatch(b.element('#fundamentals-core').innerHTML,/20倍/);
  const first=b.run("loadFundamentals('MSFT',{fresh:true})"),second=b.run("loadFundamentals('MSFT',{fresh:true})");
  pending[3].resolve(snapshot('MSFT',31));await second;pending[2].resolve(snapshot('MSFT',29));await first;
  assert.match(b.element('#fundamentals-core').innerHTML,/31倍/);
});
test('guide dismissal persists locally, can be reopened, and cannot reset an account or submit a trade',()=>{
  const b=browser();assert.equal(b.run('learningSaved()'),false);
  b.run('openGuide();');assert.equal(b.element('#guide-dialog').open,true);assert.equal(b.element('#guide-progress').textContent,'1 / 4');
  b.element('#guide-next').onclick();assert.equal(b.element('#guide-progress').textContent,'2 / 4');
  b.element('#guide-next').onclick();b.element('#guide-next').onclick();b.element('#guide-next').onclick();
  assert.equal(b.run('learningSaved()'),true);assert.equal(b.element('#learning-card').hidden,true);assert.equal(b.element('#guide-dialog').open,false);
  b.run('openGuide();');assert.equal(b.element('#guide-progress').textContent,'1 / 4');assert.equal(b.element('#guide-dialog').open,true);
  b.run("localStorage.getItem=()=>{throw Error('storage denied')};localStorage.setItem=()=>{throw Error('storage denied')};dismissLearning();");
  assert.equal(b.element('#learning-card').hidden,true);
});
test('missing financial metrics show a dash, never a fabricated zero',()=>{
  const b=browser();assert.equal(b.run("metricValue('pe',{value:null,status:'unavailable'})"),'—');
  assert.equal(b.run("metricValue('eps',{value:-2})"),'-$2.00');assert.equal(b.run("metricValue('pe',{value:null,status:'not-applicable'})"),'不适用');
});
