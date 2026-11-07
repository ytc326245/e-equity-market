const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
app.setPath('userData',path.join(root,'.sites-runtime','dialog-layout-test'));
app.commandLine.appendSwitch('disable-gpu');
app.on('window-all-closed',()=>{});
async function run(){
  const styles=['styles.css','mobile.css'].map(f=>fs.readFileSync(path.join(root,'public',f),'utf8')).join('\n');
  const scriptPath=path.join(root,'public/mobile-dialogs.js');
  const script=fs.existsSync(scriptPath)?fs.readFileSync(scriptPath,'utf8'):'';
  let html=fs.readFileSync(path.join(root,'public/equity.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*rel="stylesheet"[^>]*>/gi,'');
  html=html.replace('</head>',`<style>${styles}</style></head>`).replace('</body>',`<script>
    const viewportCallbacks={};window.testViewport={height:innerHeight,offsetTop:0,addEventListener(type,fn){(viewportCallbacks[type]||=[]).push(fn);}};
    Object.defineProperty(window,'visualViewport',{value:window.testViewport,configurable:true});
    window.testResize=(height,top=0)=>{testViewport.height=height;testViewport.offsetTop=top;for(const cb of viewportCallbacks.resize||[])cb();};
    ${script}
  </script></body>`);
  const results=[];
  for(const [width,height]of [[320,568],[375,812],[390,844],[430,932],[812,375]]){
    const win=new BrowserWindow({show:false,width,height,useContentSize:true,webPreferences:{offscreen:true,nodeIntegration:false,contextIsolation:true,sandbox:true}});
    try{
      await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
      await win.webContents.executeJavaScript("document.querySelector('#search-dialog').showModal();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
      const bounds=await win.webContents.executeJavaScript(`(()=>{const d=document.querySelector('#search-dialog'),b=d.querySelector('[data-close]'),r=d.getBoundingClientRect(),c=b.getBoundingClientRect();return {viewport:innerWidth,left:r.left,right:r.right,closeLeft:c.left,closeRight:c.right,closeTop:c.top,closeBottom:c.bottom};})()`);
      assert.ok(bounds.left>=0&&bounds.right<=width,`Dialog overflows ${width}px viewport: ${JSON.stringify(bounds)}`);
      assert.ok(bounds.closeLeft>=0&&bounds.closeRight<=width,`Close control outside ${width}px viewport`);
      await win.webContents.executeJavaScript("document.querySelector('#search-dialog [data-close]').click()");
      assert.equal(await win.webContents.executeJavaScript("document.querySelector('#search-dialog').open"),false,'Visible Cancel must close the dialog');
      await win.webContents.executeJavaScript("document.querySelector('#search-dialog').showModal();testResize(320,80);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
      const keyboard=await win.webContents.executeJavaScript("(()=>{const r=document.querySelector('#search-dialog [data-close]').getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()");
      assert.ok(keyboard.top>=80&&keyboard.bottom<=400,`Cancel hidden when keyboard is open: ${JSON.stringify(keyboard)}`);
      await win.webContents.executeJavaScript("document.querySelector('#search-dialog').dispatchEvent(new Event('cancel',{cancelable:true}))");
      assert.equal(await win.webContents.executeJavaScript("document.querySelector('#search-dialog').open"),false,'Cancel event must dismiss search');
      await win.webContents.executeJavaScript("const d=document.querySelector('#search-dialog');d.showModal();d.dispatchEvent(new PointerEvent('pointerdown',{clientX:1,clientY:1,bubbles:true}));d.dispatchEvent(new MouseEvent('click',{clientX:1,clientY:1,bubbles:true}))");
      assert.equal(await win.webContents.executeJavaScript("document.querySelector('#search-dialog').open"),false,'Backdrop tap must dismiss search');
      results.push({width,height,dialogFits:true,cancelCloses:true,keyboardCancelVisible:true,backdropCloses:true});
    }finally{win.destroy();}
  }
  console.log(JSON.stringify({ok:true,results},null,2));
}
app.whenReady().then(run).then(()=>app.exit(0)).catch(e=>{console.error(e.stack||e.message);app.exit(1);});
