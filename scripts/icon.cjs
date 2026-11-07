const fs=require('node:fs');const path=require('node:path');const zlib=require('node:zlib');
const size=256,raw=Buffer.alloc((size*4+1)*size);
const segments=[[62,152,102,152],[102,152,138,87],[138,87,165,175],[165,175,199,126]];
function distance(x,y,a,b,c,d){const t=Math.max(0,Math.min(1,((x-a)*(c-a)+(y-b)*(d-b))/((c-a)**2+(d-b)**2)));return Math.hypot(x-(a+t*(c-a)),y-(b+t*(d-b)));}
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const at=y*(size*4+1)+1+x*4;const cx=Math.max(58,Math.min(198,x)),cy=Math.max(58,Math.min(198,y));
 if(Math.hypot(x-cx,y-cy)>58)continue;
 const line=segments.some(s=>distance(x,y,...s)<10);const c=line?[23,19,33]:[184,165,255];raw[at]=c[0];raw[at+1]=c[1];raw[at+2]=c[2];raw[at+3]=255;
}
function crc32(buffer){let c=0xffffffff;for(const byte of buffer){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),body=Buffer.concat([t,data]),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc32(body));return Buffer.concat([head,body,tail]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'build'),{recursive:true});fs.writeFileSync(path.join(root,'build/icon.ico'),Buffer.concat([ico,png]));fs.writeFileSync(path.join(root,'public/icon.png'),png);
console.log('Generated E-Equity app icons');
