const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {Account,validSymbol}=require('./lib/account.cjs');
const {Market}=require('./lib/market.cjs');
const {marketStatus}=require('./lib/calendar.cjs');
const defaultDataDir=()=>process.env.EEQUITY_DATA_DIR||path.join(process.env.APPDATA||path.join(os.homedir(),'.config'),'E-Equity');
async function startServer({port=17653,directory=defaultDataDir(),market=new Market(),clock=()=>new Date()}={}){
  const account=await new Account(directory,{clock}).init();
  const token=crypto.randomBytes(32).toString('hex');
  let origin;
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try{
      if(req.headers.host!==new URL(origin).host)return json(res,403,{error:'非法本机地址'});
      if(req.headers.origin && req.headers.origin!==origin)return json(res,403,{error:'禁止跨站请求'});
      if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'禁止跨站访问'});
      const url=new URL(req.url,origin);const route=url.pathname;
      if(req.method==='GET'){
        if(route==='/api/health')return json(res,200,{app:'e-equity',version:require('./package.json').version});
        if(route==='/api/state')return json(res,200,{account:account.snapshot(),market:marketStatus(clock()),feed:market.info(),token,serverTime:clock().toISOString()});
        if(route==='/api/search')return json(res,200,{results:market.search(url.searchParams.get('q'))});
        if(route==='/api/quote')return json(res,200,await market.quote(url.searchParams.get('symbol'),{fresh:url.searchParams.get('fresh')==='1'}));
        if(route==='/api/chart')return json(res,200,await market.chart(url.searchParams.get('symbol'),url.searchParams.get('range')||'1D',{fresh:url.searchParams.get('fresh')==='1'}));
        if(route==='/api/export'){
          res.setHeader('Content-Disposition',`attachment; filename="E-Equity-backup-${new Date().toISOString().slice(0,10)}.json"`);
          return json(res,200,account.backup());
        }
        if(route==='/api/trades.csv'){
          const rows=[['Time UTC','Symbol','Side','Shares','Price USD','Amount USD','Data Provider','Quote time (provider)','Quote fetched UTC'],...account.snapshot().trades.map(t=>[t.timestamp,t.symbol,t.side,t.quantity,t.price,(t.amountCents/100).toFixed(2),t.provider,t.quoteAsOf||t.quoteTime||'',t.quoteFetchedAt||''])];
          const csv=rows.map(row=>row.map(v=>{let s=String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
          res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="E-Equity-trades.csv"'});return res.end('\uFEFF'+csv);
        }
        const files={'/':'index.html','/app.js':'app.js','/quote-policy.js':'quote-policy.js','/styles.css':'styles.css','/icon.svg':'icon.svg'};
        if(!files[route])return json(res,404,{error:'页面不存在'});
        const file=files[route],bytes=await fs.readFile(path.join(__dirname,'public',file));
        res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'image/svg+xml');res.setHeader('Cache-Control','no-cache');return res.end(bytes);
      }
      if(req.method!=='POST')return json(res,405,{error:'不支持的操作'});
      if(req.headers['x-equity-token']!==token)return json(res,403,{error:'会话已更新，请刷新页面'});
      if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'需要 JSON 格式'});
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>10000000){json(res,413,{error:'文件太大'});return;}}
      const body=JSON.parse(raw||'{}');
      if(route==='/api/account/reset'){
        if(body.confirm!==true)throw new Error('请确认重新开始');
        return json(res,200,await account.reset(body.capital));
      }
      if(route==='/api/account/import'){
        if(body.confirm!==true)throw new Error('请确认恢复备份');
        return json(res,200,await account.restore(body.backup));
      }
      if(route==='/api/watchlist'){
        if(!validSymbol(body.symbol)||(!body.remove&&!market.symbol(body.symbol)))throw new Error('请从上市目录选择股票');
        return json(res,200,await account.watch(body.symbol,body.remove===true));
      }
      if(route==='/api/trade')return json(res,200,await account.trade(body,market));
      return json(res,404,{error:'接口不存在'});
    }catch(e){return json(res,e instanceof SyntaxError?400:422,{error:e.message||'操作失败'});}
  });
  server.requestTimeout=20000;server.headersTimeout=15000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  return {server,origin,account,directory};
}
if(require.main===module)startServer().then(({origin})=>console.log(`E-Equity Local: ${origin}`)).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={startServer,defaultDataDir};
