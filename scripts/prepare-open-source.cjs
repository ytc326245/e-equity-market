const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==='--out'))throw new Error('Usage: node scripts/prepare-open-source.cjs [--out NEW_DIRECTORY]');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
const destination=path.resolve(root,args[1]||`work/open-source/e-equity-market-${version}`);
const allowedRoot=path.join(root,'work')+path.sep;
if(!destination.startsWith(allowedRoot))throw new Error('Export must stay inside this project\'s work directory.');
if(fs.existsSync(destination))throw new Error('Export directory already exists; choose a new directory. Nothing was removed.');
const excluded=new Set(['.git','node_modules','dist','release','.next','.cache','.tools','.local-data','.sites-runtime','.wrangler','test-results','work','outputs','.agents','.codex','next-env.d.ts']);
function copy(relative){
  const input=path.join(root,relative),output=path.join(destination,relative),entry=fs.lstatSync(input);
  if(entry.isSymbolicLink())throw new Error(`Refusing to export symlink: ${relative}`);
  const base=path.basename(input);
  if(excluded.has(base)||/^\.env(?:\.|$)|^\.dev\.vars|\.(?:log|pem|key|tsbuildinfo)$/.test(base)||base==='hosting.json'||base==='captured-chart.test.cjs'||/^nasdaq-.*\.json$/.test(base))return;
  if(entry.isDirectory()){fs.mkdirSync(output,{recursive:true});for(const child of fs.readdirSync(input))copy(path.join(relative,child));}
  else {fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(input,output);}
}
const entries=['.gitignore','.gitattributes','.github','LICENSE','THIRD_PARTY_NOTICES.md','README.md','README.en.md','CONTRIBUTING.md','SECURITY.md','CHANGELOG.md','package.json','package-lock.json','desktop.cjs','server.cjs','使用说明.md','build','lib','public','scripts','test','docs','iphone'];
for(const entry of entries)copy(entry);
const etfs=new Set(['SPY','QQQ','DIA','GLD','VTI','VOO']);
const names={AAPL:'Apple',MSFT:'Microsoft',NVDA:'NVIDIA',TSLA:'Tesla',AMZN:'Amazon',GOOGL:'Alphabet',META:'Meta Platforms',SPY:'SPDR S&P 500 ETF Trust',QQQ:'Invesco QQQ Trust',DIA:'SPDR Dow Jones Industrial Average ETF Trust',BABA:'Alibaba Group',PDD:'PDD Holdings',JD:'JD.com',NIO:'NIO',XPEV:'XPeng',LI:'Li Auto',COIN:'Coinbase',AMD:'Advanced Micro Devices',INTC:'Intel',GLD:'SPDR Gold Shares',VTI:'Vanguard Total Stock Market ETF',VOO:'Vanguard S&P 500 ETF'};
const directory={updatedAt:'2026-11-07T00:00:00.000Z',note:'Manually maintained starter directory; use npm run symbols:update to fetch a current directory. Not a quote dataset.',sources:[],symbols:Object.entries(names).map(([symbol,name])=>({symbol,name,type:etfs.has(symbol)?'ETF':'STOCK',exchange:'US'})).sort((a,b)=>a.symbol.localeCompare(b.symbol))};
for(const relative of ['data/symbols.json','iphone/data/symbols.json']){const output=path.join(destination,relative);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(directory,null,2)+'\n');}
const files=[];
function scan(folder){for(const e of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,e.name);if(e.isDirectory())scan(p);else files.push({path:path.relative(destination,p).split(path.sep).join('/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bytes:fs.statSync(p).size});}}
scan(destination);
fs.writeFileSync(path.join(root,'work',`public-source-manifest-${version}.json`),JSON.stringify({version,destination,files},null,2));
console.log(JSON.stringify({version,destination,files:files.length,starterSymbols:directory.symbols.length}));
