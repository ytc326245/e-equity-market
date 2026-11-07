const {app,BrowserWindow,Menu,shell,dialog,session}=require('electron');
const {startServer}=require('./server.cjs');
const {Market}=require('./lib/market.cjs');
let window,service;
if(!app.requestSingleInstanceLock()){app.quit();}else{
  app.on('second-instance',()=>{if(window){window.show();if(window.isMinimized())window.restore();window.focus();}});
  app.whenReady().then(async()=>{
    const selfCheck=process.argv.includes('--self-check');
    // Use the operating system's network/proxy settings for supplemental financial data.
    const financialSession=session.fromPartition('equity-financial-data');
    service=await startServer({port:selfCheck?0:17653,market:new Market({financialFetch:(url,options)=>financialSession.fetch(url,options)})});
    if(selfCheck){
      if(!process.env.EEQUITY_SELF_CHECK_REPORT)throw new Error('自检报告路径未设置');
      const response=await fetch(service.origin+'/api/state');const data=await response.json();
      const html=await(await fetch(service.origin)).text();const script=await(await fetch(service.origin+'/app.js')).text();const policy=await(await fetch(service.origin+'/quote-policy.js')).text();
      const report={ok:response.ok&&data.feed.symbols>0&&data.feed.tradingEnabled===true&&html.includes('交易工作台')&&script.includes('function boot')&&policy.includes('function quoteBlock'),version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,packaged:app.isPackaged,symbols:data.feed.symbols,market:data.market.label,feedVerified:data.feed.verified,tradingEnabled:data.feed.tradingEnabled,accountFileReadable:!!data.account,htmlBytes:Buffer.byteLength(html),scriptBytes:Buffer.byteLength(script),checkedAt:new Date().toISOString()};
      await require('node:fs/promises').writeFile(process.env.EEQUITY_SELF_CHECK_REPORT,JSON.stringify(report,null,2));
      await new Promise(resolve=>service.server.close(resolve));app.exit(report.ok?0:1);return;
    }
    window=new BrowserWindow({width:1480,height:980,minWidth:1050,minHeight:720,backgroundColor:'#0c1017',icon:require('node:path').join(__dirname,'public/icon.png'),title:'纸上美股 · E-Equity',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:!app.isPackaged}});
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==service.origin)event.preventDefault();});
    window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
    window.webContents.session.on('will-download',async(event,item)=>{
      event.preventDefault();
      const url=new URL(item.getURL());
      if(url.origin!==service.origin||!['/api/export','/api/trades.csv'].includes(url.pathname))return;
      const result=await dialog.showSaveDialog(window,{defaultPath:item.getFilename()});
      if(!result.canceled){
        try{const fs=require('node:fs/promises');const data=await(await fetch(url)).arrayBuffer();await fs.writeFile(result.filePath,Buffer.from(data));}
        catch(e){dialog.showErrorBox('导出失败',e.message);}
      }
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'文件',submenu:[{label:'在浏览器打开网页版',click:()=>shell.openExternal(service.origin)},{label:'打开账户数据文件夹',click:()=>shell.openPath(service.directory)},{type:'separator'},{role:'quit',label:'退出'}]},
      {label:'视图',submenu:[{role:'reload',label:'刷新'},{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'全屏'}]},
      {label:'帮助',submenu:[{label:'基本操作',click:()=>window.webContents.sendInputEvent({type:'keyDown',keyCode:'F1'})},{label:'关于',click:()=>dialog.showMessageBox(window,{title:'E-Equity '+app.getVersion(),message:'纸上美股 · E-Equity',detail:'本机模拟交易工作台\n已开放真实报价模拟交易，行情可能存在延迟。\n账户文件仅保存在本机。'})}]}
    ]));
    await window.loadURL(service.origin);
  }).catch(e=>{dialog.showErrorBox('E-Equity 启动失败',e.code==='EADDRINUSE'?'本机端口 17653 已被占用。请关闭另一个网页版服务后重试。':e.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>service?.server.close());
}
