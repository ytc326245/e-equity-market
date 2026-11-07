const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {Market}=require('../lib/market.cjs');
function row(day,clock,price=100,{utc=false}={}){
 const [hour,minute]=clock.split(':').map(Number);
 return {x:Date.parse(`${day}T${clock}:00Z`),y:price,z:{dateTime:`${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'} ET`}};
}
async function chart(data,Class=Market){const m=new Class();m.request=async()=>structuredClone(data);return m.chart('AAPL');}
const payload=(day,rows)=>({timeAsOf:day,chart:rows});
test('synthetic Nasdaq-style ET samples normalize identically on desktop and phone',async()=>{
 const {Market:MobileMarket}=await import('../iphone/lib/equity-market.mjs');
 const day='2026-11-06',rows=[];
 for(let minute=240;minute<1200;minute++){const clock=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');rows.push(row(day,clock,minute===1011?60:100+minute/10000));}
 const d=payload(day,rows),fixed=await chart(d),phone=await chart(d,MobileMarket);
 assert.deepEqual(phone.points,fixed.points);assert.equal(fixed.points.length,390);assert.equal(fixed.timestampEncoding,'ET-wall-clock');
 assert.equal(fixed.points[0].time,Date.parse('2026-11-06T14:30:00Z'));assert.equal(fixed.points.at(-1).time,Date.parse('2026-11-06T20:59:00Z'));
 assert.ok(fixed.points.every(p=>p.price>100));assert.equal(fixed.diagnostics.outsideSession,570);
 const old=rows.filter(p=>{const t=new Date(p.x).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return t>='09:30'&&t<='16:00';});
 assert.equal(old[0].z.dateTime,'2:30 PM ET');assert.ok(old.some(p=>p.y===60));
});
test('New York offsets follow DST, including both sides of each change',async()=>{
 for(const [day,expected]of [['2026-03-06','14:30'],['2026-03-09','13:30'],['2026-10-30','13:30'],['2026-11-02','14:30']]){
  const c=await chart(payload(day,[row(day,'09:30'),row(day,'15:59')]));assert.equal(c.points[0].time,Date.parse(`${day}T${expected}:00Z`));
 }
});
test('a genuine UTC epoch is verified and never shifted again',async()=>{
 const p=row('2026-11-06','09:30');p.x=Date.parse('2026-11-06T14:30:00Z');
 const c=await chart(payload('Nov 6, 2026',[p]));assert.equal(c.points[0].time,p.x);assert.equal(c.timestampEncoding,'UTC-epoch');
});
test('sorts, deduplicates, excludes another date and extended hours; honors early close',async()=>{
 const day='2026-11-27',p=row(day,'09:30');
 const c=await chart(payload(day,[row(day,'12:59',102),row(day,'13:00',1),p,row(day,'09:29',1),p,row('2026-11-25','10:00',1),{x:NaN,y:1},row(day,'11:00',0)]));
 assert.deepEqual(c.points.map(p=>p.price),[100,102]);assert.equal(c.session.closeTime,'13:00');assert.equal(c.diagnostics.wrongDate,1);assert.equal(c.diagnostics.duplicates,1);assert.equal(c.diagnostics.invalid,2);assert.equal(c.diagnostics.outsideSession,2);
});
test('conflicting times, labels, missing dates and holidays fail visibly instead of drawing unverifiable data',async()=>{
 const day='2026-11-06';
 await assert.rejects(chart(payload(day,[row(day,'09:30',100),row(day,'09:30',101)])),/冲突/);
 const bad=row(day,'09:30');bad.z.dateTime='11:30 AM ET';await assert.rejects(chart(payload(day,[bad])),/不一致/);
 await assert.rejects(chart(payload(day,[{x:bad.x,y:100}])),/标签/);
 await assert.rejects(chart(payload('',[row(day,'09:30')])),/交易日期/);
 await assert.rejects(chart(payload('2026-11-26',[row('2026-11-26','09:30')])),/日历/);
});
test('retains unusual regular-session samples; does not fabricate daily OHLC or the closing print',async()=>{
 const day='2026-11-06',c=await chart(payload(day,[row(day,'09:30',100),row(day,'10:00',50),row(day,'15:59',99),row(day,'16:00',5)]));
 assert.deepEqual(c.points.map(p=>p.price),[100,50,99]);assert.equal(c.priceType,'provider-chart-sample');
});
test('cache refresh bypasses old chart and historical dates are midnight UTC',async()=>{
 const day='2026-11-06',m=new Market();let calls=0;m.request=async()=>{calls++;return payload(day,[row(day,'09:30',100+calls)]);};
 const a=await m.chart('AAPL');assert.equal((await m.chart('AAPL')).points[0].price,a.points[0].price);assert.equal(calls,1);
 assert.equal((await m.chart('AAPL','1D',{fresh:true})).points[0].price,102);assert.equal(calls,2);
 m.request=async()=>({tradesTable:{rows:[{date:'11/06/2026',close:'$342.37'},{date:'11/05/2026',close:'$344.17'},{date:'bad',close:'1'}]}});
 const history=await m.chart('AAPL','1M');assert.deepEqual(history.points.map(p=>p.time),[Date.parse('2026-11-05T00:00Z'),Date.parse('2026-11-06T00:00Z')]);
});
test('desktop and phone chart routes forward explicit refresh',async t=>{
 const {startServer}=require('../server.cjs');const {createEquityApi}=await import('../iphone/lib/equity-api.mjs');
 const m=new Market(),calls=[];m.chart=async(...args)=>{calls.push(args);return {points:[]}};
 const root=path.join(__dirname,'../test-results');fs.mkdirSync(root,{recursive:true});const directory=fs.mkdtempSync(path.join(root,'chart-'));
 const s=await startServer({port:0,directory,market:m});t.after(()=>new Promise(r=>s.server.close(r)));
 assert.equal((await fetch(s.origin+'/api/chart?symbol=AAPL&range=1D&fresh=1')).status,200);
 const mobile=createEquityApi({market:m});assert.equal((await mobile(new Request('https://example.test/api/chart?symbol=MSFT&fresh=1'))).status,200);
 assert.deepEqual(calls,[['AAPL','1D',{fresh:true}],['MSFT','1D',{fresh:true}]]);
});
test('renderer uses time spacing, leaves gaps and resolves the cursor by timestamp',()=>{
 const elements=new Map();function el(s){if(!elements.has(s))elements.set(s,{value:'',textContent:'',innerHTML:'',listeners:{},attrs:{},addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(k,v){this.attrs[k]=v;},getBoundingClientRect(){return {left:0,width:700}},classList:{toggle(){}}});return elements.get(s);}
 const ctx=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[],addEventListener(){}},setInterval(){},setTimeout(){},clearTimeout(){},Intl,Date,console,fetch:async()=>{throw Error('offline')}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),ctx);
 const start=Date.parse('2026-11-06T14:30Z'),end=Date.parse('2026-11-06T21:00Z');ctx.fixture={range:'1D',sessionDate:'2026-11-06',session:{start,end},points:[{time:start,price:100},{time:start+60000,price:101},{time:end-60000,price:102}]};vm.runInContext('drawChart(fixture)',ctx);
 const html=el('#chart-container').innerHTML;assert.match(html,/09:30/);assert.match(html,/16:00/);assert.match(html,/L4\.63,/);assert.match(html,/M638\.37,/);
 el('#chart-container svg').listeners.pointermove({clientX:162.25});assert.match(el('#chart-tooltip').textContent,/09:31/);
});

