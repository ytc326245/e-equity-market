// Documentation screenshots use synthetic prices and a disposable account only.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {startServer}=require('../server.cjs');
const {Market}=require('../lib/market.cjs');
const root=path.resolve(__dirname,'..');
app.setPath('userData',path.join(root,'work/screenshots-browser'));
app.commandLine.appendSwitch('disable-gpu');
app.on('window-all-closed',()=>{});
let desktop,phone;
async function screenshot(url,width,height,file,mobile=false){
  const win=new BrowserWindow({show:false,width,height,useContentSize:true,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true,sandbox:true}});
  try{
    await win.loadURL(url);
    await win.webContents.executeJavaScript(`(async()=>{for(let i=0;i<120;i++){if(document.querySelector('#chart-container svg')&&document.querySelector('#quote-meta').textContent.includes('演示数据'))return;await new Promise(r=>setTimeout(r,100));}throw Error('Demo UI did not finish loading');})()`);
    if(mobile)await win.webContents.executeJavaScript(`(async()=>{await EquityMobileAPI.request('/api/account/reset',{capital:'10000',confirm:true});await loadState();document.querySelector('#install-hint').hidden=true;window.scrollTo(0,document.querySelector('.chart-panel').getBoundingClientRect().top+window.scrollY-80);})()`);
    await win.webContents.executeJavaScript('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    await fs.writeFile(file,(await win.webContents.capturePage()).toPNG());
  }finally{win.destroy();}
}
app.whenReady().then(async()=>{
  await fs.mkdir(path.join(root,'work'),{recursive:true});
  const directory=await fs.mkdtemp(path.join(root,'work/screenshot-account-'));
  const now='2026-11-06T21:15:00Z',market=new Market();
  market.info=()=>({provider:'演示数据（仅文档截图）',symbols:22,tradingEnabled:true,verified:false});
  market.quote=async symbol=>({symbol,price:105.25,change:1.2,changePercent:1.15,previousClose:104.05,volume:123456,fetchedAt:now,asOf:'演示数据 · 2026-11-06',provider:'演示数据（仅文档截图）',coverage:'demo',verified:false,isRealTime:false});
  market.chart=async(symbol,range='1D')=>{const start=Date.parse('2026-11-06T14:30:00Z'),end=Date.parse('2026-11-06T21:00:00Z');return {symbol,range,sessionDate:'2026-11-06',asOf:'演示数据',session:{start,end},points:Array.from({length:390},(_,i)=>({time:start+i*60000,price:100+Math.sin(i/24)*1.3+i*.014})),provider:'演示数据（仅文档截图）'};};
  desktop=await startServer({port:0,directory,market,clock:()=>new Date(now)});
  const state=await(await fetch(desktop.origin+'/api/state')).json();
  const reset=await fetch(desktop.origin+'/api/account/reset',{method:'POST',headers:{'Content-Type':'application/json','X-Equity-Token':state.token},body:JSON.stringify({capital:'10000',confirm:true})});
  if(!reset.ok)throw Error('Could not initialize disposable demo account');
  phone=http.createServer(async(req,res)=>{try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname.startsWith('/api/')){const result=await fetch(desktop.origin+req.url);res.writeHead(result.status,{'Content-Type':result.headers.get('content-type')||'application/json'});res.end(Buffer.from(await result.arrayBuffer()));return;}
    const name=pathname==='/'?'equity.html':pathname.slice(1);if(!/^[a-z0-9.-]+$/i.test(name)){res.writeHead(404);res.end();return;}
    const bytes=await fs.readFile(path.join(root,'iphone/public',name));const ext=path.extname(name);res.writeHead(200,{'Content-Type':({'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[ext]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}});
  await new Promise(r=>phone.listen(0,'127.0.0.1',r));
  const out=path.join(root,'docs/screenshots');await fs.mkdir(out,{recursive:true});
  await screenshot(desktop.origin,1440,1000,path.join(out,'desktop.png'));
  await screenshot(`http://127.0.0.1:${phone.address().port}`,390,1000,path.join(out,'mobile.png'),true);
  console.log('Saved desktop/mobile screenshots with labeled synthetic demo prices and disposable accounts.');
}).then(async()=>{await new Promise(r=>desktop.server.close(r));await new Promise(r=>phone.close(r));app.exit(0);}).catch(e=>{console.error(e.stack||e.message);desktop?.server.close();phone?.close();app.exit(1);});
