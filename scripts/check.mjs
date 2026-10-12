import {access,readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=['sw.js'];for(const dir of ['js','backend','scripts','tests']){for(const file of await readdir(dir))if(/\.(m?js)$/.test(file))files.push(`${dir}/${file}`);}
for(const f of files){const p=spawnSync(process.execPath,['--check',f],{stdio:'inherit'});if(p.status)process.exit(p.status);}
const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
if(manifest.display!=='standalone'||!manifest.start_url||!manifest.scope)throw new Error('PWA manifest is missing standalone, start_url or scope metadata.');
if(manifest.name!=='Duo Vocab'||manifest.short_name!=='Duo Vocab')throw new Error('PWA manifest app names are incorrect.');
if(manifest.start_url!=='./'||manifest.scope!=='./')throw new Error('PWA start_url and scope must remain relative for subpath deployment.');
for(const size of [192,512]){
  const icon=manifest.icons?.find(item=>item.sizes===`${size}x${size}`&&item.type==='image/png'&&item.purpose==='any');
  if(!icon)throw new Error(`PWA manifest is missing the ${size}x${size} PNG icon.`);
  const data=await readFile(icon.src.replace(/^\.\//,''));
  if(data.toString('ascii',1,4)!=='PNG'||data.readUInt32BE(16)!==size||data.readUInt32BE(20)!==size)throw new Error(`PWA icon ${icon.src} does not have the declared dimensions.`);
}
const maskable=manifest.icons?.find(item=>item.sizes==='512x512'&&item.type==='image/png'&&item.purpose==='maskable');
if(!maskable)throw new Error('PWA manifest is missing the 512x512 maskable PNG icon.');
for(const [file,size] of [['assets/icon-512-maskable.png',512],['assets/apple-touch-icon.png',180],['assets/favicon-32.png',32]]){
  const data=await readFile(file);
  if(data.toString('ascii',1,4)!=='PNG'||data.readUInt32BE(16)!==size||data.readUInt32BE(20)!==size)throw new Error(`${file} is not a ${size}x${size} PNG.`);
}
const favicon=await readFile('assets/favicon.ico');
if(favicon.readUInt16LE(0)!==0||favicon.readUInt16LE(2)!==1||favicon.readUInt16LE(4)<1)throw new Error('assets/favicon.ico is not a valid ICO file.');
const index=await readFile('index.html','utf8');
const linkedAssets=['./manifest.webmanifest','./assets/apple-touch-icon.png','./assets/favicon-32.png','./assets/favicon.ico'];
for(const href of linkedAssets){
  if(!index.includes(`href="${href}"`))throw new Error(`index.html does not link ${href}.`);
  const deployed=new URL(href,'https://example.test/apps/duo-vocab/index.html');
  if(!deployed.pathname.startsWith('/apps/duo-vocab/'))throw new Error(`${href} escapes the deployment subpath.`);
}
const worker=await readFile('sw.js','utf8'),assetBlock=worker.match(/const ASSETS=\[(.*?)\];/s)?.[1];
if(!assetBlock)throw new Error('Service Worker pre-cache list was not found.');
const assets=[...assetBlock.matchAll(/'([^']+)'/g)].map(match=>match[1]);
for(const asset of ['./assets/icon-192.png','./assets/icon-512.png','./assets/icon-512-maskable.png','./assets/apple-touch-icon.png','./assets/favicon-32.png','./assets/favicon.ico'])if(!assets.includes(asset))throw new Error(`Service Worker does not pre-cache ${asset}.`);
for(const asset of assets)await access(asset.replace(/^\.\//,'')||'.');
console.log(`Syntax OK: ${files.length} JavaScript files + manifest. PWA OK: ${manifest.icons.length} icons + ${assets.length} offline assets.`);
