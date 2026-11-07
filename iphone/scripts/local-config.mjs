import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=path.join(root,'.openai/hosting.json');
try{await fs.access(target);}catch(error){
  if(error.code!=='ENOENT')throw error;
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.copyFile(path.join(root,'.openai/hosting.example.json'),target,fs.constants.COPYFILE_EXCL);
  console.log('Created local hosting configuration without a Site identity.');
}
