let input='';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stderr.write('Ready for private Site check JSON on stdin (input is hidden).\n');
process.stdin.on('data',async chunk=>{
  input+=chunk;if(!/[\r\n]/.test(input))return;process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);
  try{
    const {url,token}=JSON.parse(input),origin=new URL(url).origin;
    const paths=['/','/manifest.webmanifest','/sw.js','/mobile-api.js','/api/state','/api/quote?symbol=AAPL','/api/quote?symbol=SPY','/api/chart?symbol=AAPL&range=1D'];
    let failed=false;
    for(let i=0;i<paths.length;i+=3)await Promise.all(paths.slice(i,i+3).map(async p=>{
      const response=await fetch(origin+p,{headers:{'OAI-Sites-Authorization':'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});
      const type=response.headers.get('content-type')||'',body=type.includes('json')?await response.json():await response.text();
      const result={path:p,status:response.status,type};
      if(typeof body==='object'){result.price=body.price;result.error=body.error;result.market=body.market?.label;result.points=body.points?.length;result.display=body.display;}else result.length=body.length;
      if(!response.ok||body?.error)failed=true;console.log(JSON.stringify(result));
    }));
    process.exit(failed?1:0);
  }catch(e){console.error('Production check failed: '+e.message);process.exit(1);}
});
