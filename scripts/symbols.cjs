const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const urls=['https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt','https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt'];
  const all=[];
  for(const url of urls){
    const r=await fetch(url,{signal:AbortSignal.timeout(30000)}); if(!r.ok) throw new Error(`股票名单 ${r.status}`);
    const text=await r.text(); const [header,...lines]=text.trim().split(/\r?\n/); const columns=header.split('|');
    for(const line of lines){ const row=Object.fromEntries(line.split('|').map((v,i)=>[columns[i],v])); const symbol=row.Symbol || row['NASDAQ Symbol'];
      if(!symbol || row['Test Issue']!=='N' || !/^[A-Z0-9][A-Z0-9.\-^]{0,14}$/.test(symbol)) continue;
      all.push({symbol,name:row['Security Name'],type:row.ETF==='Y'?'ETF':'STOCK',exchange:row.Exchange || 'NASDAQ'});
    }
  }
  const symbols=[...new Map(all.map(x=>[x.symbol,x])).values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
  await fs.mkdir(path.resolve(__dirname,'../data'),{recursive:true});
  await fs.writeFile(path.resolve(__dirname,'../data/symbols.json'),JSON.stringify({updatedAt:new Date().toISOString(),sources:urls,symbols}));
  console.log(`Saved ${symbols.length} listed US stocks and ETFs`);
})().catch(e=>{console.error(e);process.exitCode=1;});
