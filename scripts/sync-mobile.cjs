const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(process.execPath,['scripts/sync-equity.mjs'],{cwd:path.join(__dirname,'../iphone'),stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
