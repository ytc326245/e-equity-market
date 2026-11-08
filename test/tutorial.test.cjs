const test=require('node:test'),assert=require('node:assert/strict');
const tutorial=require('../public/tutorial.js');
test('beginner curriculum covers all displayed metrics, account data and source limitations with valid questions',()=>{
  assert.equal(tutorial.lessons.length,9);assert.equal(new Set(tutorial.lessons.map(l=>l.id)).size,9);
  for(const key of ['pe','eps','marketCap','pb','dividendYield','week52High','week52Low','aum','expenseRatio'])assert.ok(tutorial.lessons.some(l=>l.id===tutorial.topicMap[key]));
  for(const q of [...tutorial.lessons.map(l=>l.question),...tutorial.cases.map(c=>c.question)].filter(Boolean)){assert.ok(q.answer>=0&&q.answer<q.options.length);assert.ok(q.explain.length>10);}
  const text=JSON.stringify(tutorial.lessons);for(const term of ['可用资金','浮动盈亏','TTM','GAAP','财年','存托凭证','读取时间','分红','成交量'])assert.ok(text.includes(term));
});
test('valuation exercise demonstrates rising earnings with a falling assumed price, not a forecast',()=>{
  const r=tutorial.model(20,14);assert.ok(Math.abs(r.eps-7.2)<1e-10);assert.ok(Math.abs(r.price-100.8)<1e-10);assert.ok(Math.abs(r.change+16)<1e-10);
  assert.equal(tutorial.model(0,20).price,120);assert.throws(()=>tutorial.model('bad',20));assert.ok(Number.isFinite(tutorial.model(999,-99).price));
});
test('progress is bounded to known lessons and tolerates unavailable or corrupt device storage',()=>{
  assert.deepEqual(tutorial.restore({getItem(){throw Error('denied');}}),{lesson:'quotes',completed:[]});
  assert.deepEqual(tutorial.restore({getItem:()=>'{broken'}),{lesson:'quotes',completed:[]});
  assert.deepEqual(tutorial.restore({getItem:()=>JSON.stringify({lesson:'<script>',completed:['quotes','quotes','foreign','earnings']})}),{lesson:'quotes',completed:['quotes','earnings']});
});
test('company examples keep snapshot data, TTM and quarter disclosures distinct and do not compute negative PE',()=>{
  const a=tutorial.cases.find(c=>c.symbol==='AAPL'),m=tutorial.cases.find(c=>c.symbol==='MSFT'),i=tutorial.cases.find(c=>c.symbol==='INTC');
  assert.ok(Math.abs(a.price/a.eps-a.pe)<.01);assert.ok(Math.abs(m.price/m.eps-m.pe)<.01);assert.equal(i.pe,null);assert.ok(i.eps<0);assert.match(i.steps[0].text,/季度/);
  assert.ok(tutorial.cases.every(c=>c.refs.some(r=>r==='yahoo-'+c.symbol)));
});
test('only reviewed HTTPS reference URLs can open outside the desktop window',()=>{
  assert.ok(tutorial.references.length>=8);for(const r of tutorial.references){assert.equal(new URL(r.url).protocol,'https:');assert.ok(tutorial.isReference(r.url));}
  assert.equal(tutorial.isReference('https://example.com'),false);assert.equal(tutorial.isReference(tutorial.references[0].url+'?redirect=evil'),false);assert.equal(tutorial.isReference('javascript:alert(1)'),false);
});
test('tutorial navigation switches views and can return to the trading workspace',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),elements=new Map(),views=[{id:'view-terminal'},{id:'view-tutorial'}];let rendered=0;
  const el=s=>{if(!elements.has(s))elements.set(s,{textContent:'',value:'',addEventListener(){},classList:{toggle(){}},setAttribute(){}});return elements.get(s);};
  const c=vm.createContext({document:{querySelector:el,querySelectorAll:s=>s==='.view'?views:[],addEventListener(){},body:{classList:{toggle(){}}}},EquityTutorial:{render(){rendered++;},init(){}},fetch:async()=>{throw Error('offline fixture');},setInterval(){},setTimeout(){},clearTimeout(){},Intl,Date});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),c);vm.runInContext("setPage('tutorial')",c);assert.equal(rendered,1);assert.equal(views[0].hidden,true);assert.equal(views[1].hidden,false);
  vm.runInContext("setPage('terminal')",c);assert.equal(views[0].hidden,false);assert.equal(views[1].hidden,true);
});
