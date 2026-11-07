'use strict';
(function(root){
  const Core=root.EquityAccountCore;
  const clone=value=>structuredClone(value);
  function id(){if(root.crypto?.randomUUID)return root.crypto.randomUUID();const b=new Uint8Array(16);root.crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}
  class IndexedAccountStore{
    constructor(){this.connection=null;}
    async database(){
      if(this.connection)return this.connection;
      this.connection=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('e-equity-iphone',1);
        request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('account');db.createObjectStore('archives',{autoIncrement:true});};
        request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();this.connection=null;};resolve(request.result);};
        request.onerror=()=>reject(new Error('无法打开手机本地账户存储，请使用 Safari 普通浏览模式并允许网站保存数据。'));
        request.onblocked=()=>reject(new Error('请关闭另一个纸上美股页面后重试。'));
      });return this.connection;
    }
    async load(){const db=await this.database();return new Promise((resolve,reject)=>{const r=db.transaction('account','readonly').objectStore('account').get('current');r.onsuccess=()=>resolve(r.result?Core.validateBackup({format:'e-equity-backup',version:1,account:r.result}):Core.emptyState());r.onerror=()=>reject(new Error('读取本地账户失败'));});}
    async update(callback){
      const db=await this.database();return new Promise((resolve,reject)=>{
        const tx=db.transaction(['account','archives'],'readwrite'),store=tx.objectStore('account');let result,error;
        const get=store.get('current');
        get.onsuccess=()=>{try{const next=get.result?Core.validateBackup({format:'e-equity-backup',version:1,account:get.result}):Core.emptyState();result=callback(next,backup=>tx.objectStore('archives').add(backup));next.updatedAt=new Date().toISOString();store.put(next,'current');if(result===undefined)result=clone(next);}catch(e){error=e;tx.abort();}};
        tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(error||new Error('本地保存失败，账户未修改，请检查手机存储空间。'));tx.onerror=()=>{error ||= new Error('本地保存失败，账户未修改。');};
      });
    }
  }
  async function remote(url,body){
    let response;try{response=await fetch(url,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch{throw new Error('网络不可用，请联网后重试；本地账户仍保留。');}
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('访问会话可能已过期，请重新打开网页并登录。');
    const data=await response.json();if(!response.ok)throw new Error(data.error||'行情读取失败');return data;
  }
  function createClient({store,network=remote,clock=()=>Date.now()}={}){
    let feed={provider:'Nasdaq 公开行情',symbols:13129,tradingEnabled:true,verified:false},serverOffset=0;
    const now=()=>new Date(clock()+serverOffset);
    const backup=account=>({format:'e-equity-backup',version:1,exportedAt:now().toISOString(),account:clone(account)});
    return {
      async request(url,body){
        if(url==='/api/state'){
          let data;try{data=await network(url);feed=data.feed;serverOffset=Date.parse(data.serverTime)-clock();}catch{data={feed,market:{isOpen:false,label:'离线或会话过期：仅查看'},serverTime:now().toISOString()};}
          return {...data,account:await store.load(),token:'phone-local'};
        }
        if(url==='/api/account/reset'){
          if(body.confirm!==true)throw new Error('请确认重新开始');const cents=Core.money(body.capital);
          return store.update((next,archive)=>{if(next.initialCents!==null)archive(backup(next));Object.assign(next,Core.emptyState(),{initialCents:cents,cashCents:cents,watchlist:next.watchlist,createdAt:now().toISOString()});});
        }
        if(url==='/api/account/import'){
          if(body.confirm!==true)throw new Error('请确认恢复备份');const imported=Core.validateBackup(body.backup);
          return store.update((next,archive)=>{archive(backup(next));Object.assign(next,imported);});
        }
        if(url==='/api/watchlist'){
          if(!Core.validSymbol(body.symbol))throw new Error('股票代码无效');
          return store.update(next=>{next.watchlist=body.remove?next.watchlist.filter(s=>s!==body.symbol):[...new Set([...next.watchlist,body.symbol])];if(next.watchlist.length>100)throw new Error('最多添加 100 个自选');});
        }
        if(url==='/api/export')return backup(await store.load());
        if(url==='/api/trade'){
          if(!Core.validSymbol(body.symbol)||!['buy','sell'].includes(body.side)||typeof body.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw new Error('交易参数无效');
          const existing=(await store.load()).trades.find(t=>t.id===body.requestId);if(existing)return existing;
          if(body.mode==='amount')Core.money(body.value);else if(body.mode==='shares')Core.quantity(body.value);else throw new Error('输入方式无效');
          const reply=await network('/api/trade-quote',{symbol:body.symbol});serverOffset=Date.parse(reply.serverTime)-clock();
          return store.update(next=>{
            if(next.initialCents===null)throw new Error('请先设置虚拟本金');
            const duplicate=next.trades.find(t=>t.id===body.requestId);if(duplicate)return duplicate;
            const time=now();if(!reply.market.isOpen||!root.EquityCalendar.marketStatus(time).isOpen)throw new Error('当前不是美股正常交易时段');
            const quote=reply.quote,block=root.EquityQuotePolicy.quoteBlock(quote,time.getTime(),body.symbol);if(block)throw new Error(block);
            const price=Core.priceUnits(quote.price),qty=body.mode==='amount'?BigInt(Core.money(body.value))*10000000000n/price:Core.quantity(body.value);
            if(qty<=0n)throw new Error('金额太小，无法买入最小股数');
            const trade={id:body.requestId,symbol:body.symbol,side:body.side,quantity:(Number(qty)/1e6).toFixed(6),price:Number(price)/1e6,timestamp:time.toISOString(),quoteTime:quote.timestamp||null,quoteAsOf:quote.asOf||'来源未提供',quoteFetchedAt:quote.fetchedAt,executionMode:'public-quote',provider:quote.provider};
            Core.applyTrade(next,trade);return clone(next.trades.at(-1));
          });
        }
        return network(url,body);
      }
    };
  }
  root.EquityMobile={IndexedAccountStore,createClient};
  root.EquityMobileAPI={...createClient({store:new IndexedAccountStore()}),id};
})(globalThis);
