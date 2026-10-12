import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import webpush from 'web-push';
import {validateReminderSnapshot,reminderAt,notificationContent} from '../js/reminder-rules.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1',origin=process.env.APP_ORIGIN||`http://localhost:${port}`;
const runtime=process.env.PUSH_DATA_DIR||path.join(root,'backend','runtime'),storePath=path.join(runtime,'subscriptions.json');
const enabled=!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.PUSH_SETUP_CODE);
if(enabled)webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@example.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
let state={devices:{},subscriptions:{}},dirty=false,serial=Promise.resolve();
try{state=JSON.parse(await readFile(storePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('Cannot read push state; refusing to overwrite it.',{cause:e});}
async function save(){await mkdir(runtime,{recursive:true});await writeFile(storePath+'.tmp',JSON.stringify(state),{mode:0o600});await rename(storePath+'.tmp',storePath);dirty=false;}
function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);}
const hash=s=>createHash('sha256').update(s).digest('hex');
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>4_000_000)throw Object.assign(new Error('Request too large'),{status:413});}try{return JSON.parse(text);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}}
function validEndpoint(value){let u;try{u=new URL(value);}catch{return false;}return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='fcm.googleapis.com'||u.hostname==='android.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.notify.windows.com'));}
const limits=new Map();function rateLimit(key,max=60){const now=Date.now(),v=limits.get(key)||{at:now,count:0};if(now-v.at>60000){v.at=now;v.count=0;}v.count++;limits.set(key,v);return v.count<=max;}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const publicFiles=new Set(['/index.html','/manifest.webmanifest','/sw.js','/offline.html','/toeic_257_tu_day_du.json','/tu_vung_boueki_1-198.json']);
async function handle(req,res){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
  if(pathname.startsWith('/api/')){
    if(req.method==='GET'&&pathname==='/api/config')return json(res,200,{enabled,publicKey:enabled?process.env.VAPID_PUBLIC_KEY:null});
    if(!enabled)return json(res,503,{error:'Web Push is not configured.'});
    if(req.headers.origin!==origin)return json(res,403,{error:'Invalid origin'});
    if(!rateLimit(req.socket.remoteAddress))return json(res,429,{error:'Too many requests'});
    const match=/^\/api\/(subscriptions|test)\/([a-zA-Z0-9-]{20,64})\/(toeic|boeki)$/.exec(pathname);if(!match)return json(res,404,{error:'Not found'});
    const [,action,device,profile]=match,token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(token))return json(res,401,{error:'Invalid device token'});
    const tokenHash=hash(token),known=state.devices[device];if(known&&!equal(known,tokenHash))return json(res,403,{error:'Device authentication failed'});
    if(!known&&(action!=='subscriptions'||req.method!=='PUT'||!equal(req.headers['x-setup-code']||'',process.env.PUSH_SETUP_CODE)))return json(res,403,{error:'Pairing code required'});
    const key=`${device}:${profile}`;
    if(action==='subscriptions'&&req.method==='PUT'){
      const data=await body(req);try{validateReminderSnapshot(data);}catch{return json(res,400,{error:'Invalid schedule'});}if(data.profile!==profile)return json(res,400,{error:'Profile mismatch'});
      const sub=data.subscription;if(!sub||!validEndpoint(sub.endpoint)||!sub.keys||!/^[\w-]{80,150}$/.test(sub.keys.p256dh)||!/^[\w-]{16,40}$/.test(sub.keys.auth))return json(res,400,{error:'Invalid push subscription'});
      if(!known&&Object.keys(state.devices).length>=100)return json(res,409,{error:'Device limit reached'});
      state.devices[device]=tokenHash;state.subscriptions[key]={...data,lastSent:state.subscriptions[key]?.lastSent||null,updated:Date.now()};await save();return json(res,200,{ok:true});
    }
    if(action==='subscriptions'&&req.method==='DELETE'){delete state.subscriptions[key];await save();return json(res,200,{ok:true});}
    if(action==='test'&&req.method==='POST'){
      if(!rateLimit('test:'+device,3))return json(res,429,{error:'Test limit exceeded'});const item=state.subscriptions[key];if(!item)return json(res,404,{error:'No subscription'});
      try{await send(item,notificationContent(item,Date.now(),true));return json(res,200,{ok:true});}catch(err){if([404,410].includes(err.statusCode)){delete state.subscriptions[key];await save();}return json(res,502,{error:'Push provider rejected or timed out'});}
    }
    return json(res,405,{error:'Method not allowed'});
  }
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
  const requested=pathname==='/'?'/index.html':pathname;
  if(!publicFiles.has(requested)&&!/^\/(js|css|assets)\/[a-zA-Z0-9_./-]+$/.test(requested))return json(res,404,{error:'Not found'});
  const target=path.resolve(root,'.'+requested);if(!target.startsWith(root+path.sep))return json(res,403,{error:'Forbidden'});
  try{const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':requested==='/sw.js'?'no-cache':'public, max-age=0'});res.end(req.method==='HEAD'?undefined:data);}catch{return json(res,404,{error:'Not found'});}
}
async function send(item,content){return webpush.sendNotification(item.subscription,JSON.stringify(content),{TTL:3600,urgency:'normal',timeout:10000});}
async function tick(){if(!enabled)return;const now=Date.now();for(const [key,item] of Object.entries(state.subscriptions)){const slot=reminderAt(item,now);if(!slot||item.lastSent===slot)continue;const content=notificationContent(item,now);if(!content)continue;try{await send(item,content);item.lastSent=slot;dirty=true;}catch(error){if([404,410].includes(error.statusCode)){delete state.subscriptions[key];dirty=true;}else console.warn('Push delivery failed:',error.statusCode||'network');}}if(dirty)await save();for(const [key,v] of limits)if(now-v.at>120000)limits.delete(key);}
const server=http.createServer((req,res)=>{if(req.url.startsWith('/api/')&&req.method!=='GET'){serial=serial.then(()=>handle(req,res)).catch(e=>{console.error('API request failed:',e.message);if(!res.headersSent)json(res,e.status||500,{error:'Request could not be completed'});});}else handle(req,res).catch(()=>{if(!res.headersSent)json(res,500,{error:'Request failed'});});});
server.requestTimeout=15000;server.headersTimeout=10000;
const timer=setInterval(()=>{serial=serial.then(tick).catch(e=>console.error('Scheduler failed:',e.message));},15000);
server.listen(port,host,()=>console.log(`Duo Vocab: http://localhost:${port}\nWeb Push: ${enabled?'configured':'not configured (in-app reminders available)'}`));
process.on('SIGTERM',()=>{clearInterval(timer);server.close(()=>process.exit(0));});
