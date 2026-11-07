import {Market} from './equity-market.mjs';
import {marketStatus} from './equity-calendar.mjs';
export function createEquityApi({market=new Market(),clock=()=>new Date()}={}){
  const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  return async request=>{
    try{
      const u=new URL(request.url),route=u.pathname;
      if(request.method==='GET'){
        if(route==='/api/state')return json(200,{feed:market.info(),market:marketStatus(clock()),serverTime:clock().toISOString()});
        if(route==='/api/search')return json(200,{results:market.search(u.searchParams.get('q'))});
        if(route==='/api/quote')return json(200,await market.quote(u.searchParams.get('symbol'),{fresh:u.searchParams.get('fresh')==='1'}));
        if(route==='/api/fundamentals')return json(200,await market.fundamentals(u.searchParams.get('symbol'),{fresh:u.searchParams.get('fresh')==='1'}));
        if(route==='/api/chart')return json(200,await market.chart(u.searchParams.get('symbol'),u.searchParams.get('range')||'1D',{fresh:u.searchParams.get('fresh')==='1'}));
        if(route==='/api/health')return json(200,{app:'e-equity-iphone',version:'1.1.1'});
      }
      if(request.method==='POST'&&route==='/api/trade-quote'){
        const origin=request.headers.get('Origin');if(origin&&origin!==u.origin)return json(403,{error:'请从本应用内下单'});
        if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json(415,{error:'需要 JSON 格式'});
        const raw=await request.text();if(raw.length>512)return json(413,{error:'请求太大'});
        const body=JSON.parse(raw);if(!body||Object.keys(body).some(k=>k!=='symbol')||!market.symbol(body.symbol))return json(400,{error:'仅接受有效的股票代码，不接收账户或资金信息'});
        if(!marketStatus(clock()).isOpen)return json(422,{error:'当前不是美股正常交易时段'});
        const quote=await market.quote(body.symbol,{fresh:true}),now=clock(),status=marketStatus(now);
        if(!status.isOpen)return json(422,{error:'已收盘，本次交易未执行'});
        return json(200,{quote,market:status,serverTime:now.toISOString()});
      }
      return json(404,{error:'接口不存在'});
    }catch(e){return json(422,{error:e.message||'行情读取失败'});}
  };
}
export const handleEquityApi=createEquityApi();
