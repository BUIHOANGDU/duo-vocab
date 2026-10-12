import { meta,readProfile,updateProfile } from './storage.js';
import { dateKey,toast } from './utils.js';
import { reminderAt,notificationContent } from './reminder-rules.js';
import { completedNewWordIds, isLearned } from './progress-model.js';
let registration,config={enabled:false},flushing=false;
export async function initializeNotifications() {
  if('serviceWorker' in navigator){try{registration=await navigator.serviceWorker.register('./sw.js');}catch{toast('Chưa thể bật chế độ offline trên môi trường này.');}}
  try{const r=await fetch('./api/config');if(r.ok)config=await r.json();}catch{/* Static hosting has no backend. */}
  window.addEventListener('online',()=>flushOutbox());await flushOutbox();
}
export async function capabilities() {let subscription=null;try{subscription=await registration?.pushManager?.getSubscription();}catch{}return {secure:isSecureContext,notifications:'Notification' in window,permission:'Notification' in window?Notification.permission:'unsupported',worker:!!registration?.active,push:'PushManager' in window,subscribed:!!subscription,backend:!!config.enabled};}
async function device() {let d=await meta('push-device');if(!d){d={id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('')};await meta('push-device',d);}return d;}
export async function enableBrowser(profile,setupCode='') {
  if(!isSecureContext)throw new Error('Thông báo cần HTTPS hoặc localhost.');
  if(!('Notification' in window))throw new Error('Trình duyệt chưa hỗ trợ. Trên iPhone, hãy thêm vào Màn hình chính rồi mở ứng dụng.');
  const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Chưa được cấp quyền. Bạn có thể thay đổi quyền trong cài đặt trình duyệt.');
  await updateProfile(profile,p=>{p.settings.reminders.browser=true;p.settings.reminders.enabled=true;});
  if(config.enabled&&'PushManager' in window){registration=await navigator.serviceWorker.ready;let sub=await registration.pushManager.getSubscription();if(!sub){const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});}await queuePush(profile,sub.toJSON());const success=await flushOutbox(setupCode);if(!success)throw new Error('Quyền đã bật; lịch Push chưa đồng bộ. Kiểm tra mã ghép nối và kết nối rồi thử lại.');}
  return !!config.enabled;
}
export function reminderSnapshot(p) {return {profile:p.id,timezone:p.settings.timezone,reminders:p.settings.reminders,goal:p.settings.goal,lastStudy:p.history.at(-1)?.day||null,newToday:completedNewWordIds(p).size,words:p.words.filter(w=>!w.deleted&&isLearned(p,w.id)).map(w=>{const skills=p.id==='boeki'?p.skillProgress?.[w.id]||{}:{};const dues=Object.values(skills).map(x=>x.due).filter(Number.isFinite);return {id:w.id,term:w.term,japanese:w.japanese,english:w.english,kana:w.kana,reading:w.reading||w.ipa,due:p.id==='boeki'?(dues.length?Math.min(...dues):null):p.progress[w.id]?.due||null,skills:Object.fromEntries(Object.entries(skills).map(([id,x])=>[id,{due:x.due,lapses:x.lapses||0}]))};})};}
export async function queuePush(id,subscription) {const p=await readProfile(id);if(!config.enabled)return;if(!subscription)subscription=(await registration?.pushManager?.getSubscription())?.toJSON();if(!subscription)return;await updateProfile(id,p=>{p.outbox={subscription,...reminderSnapshot(p)};});}
export async function flushOutbox(setupCode='') {if(flushing||!config.enabled||!navigator.onLine)return false;flushing=true;let success=true;try{const d=await device();for(const id of ['toeic','boeki']){const p=await readProfile(id);if(!p.outbox)continue;const snapshot=JSON.stringify(p.outbox);try{const r=await fetch(`./api/subscriptions/${d.id}/${id}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${d.token}`,...(setupCode?{'X-Setup-Code':setupCode}:{})},body:snapshot});if(!r.ok)throw new Error('Push chưa đồng bộ');await updateProfile(id,current=>{if(JSON.stringify(current.outbox)===snapshot)current.outbox=null;});}catch{success=false;}}}finally{flushing=false;}return success;}
export async function syncReminders(id) {await queuePush(id);return flushOutbox();}
export async function showTest(id,background=false) {
  const p=await readProfile(id),content=notificationContent(reminderSnapshot(p),Date.now(),true);
  if(background){const d=await device();const r=await fetch(`./api/test/${d.id}/${id}`,{method:'POST',headers:{Authorization:`Bearer ${d.token}`}});if(!r.ok)throw new Error('Push chưa sẵn sàng. Bật thông báo và ghép nối backend trước.');toast('Backend đã gửi thông báo thử đến dịch vụ Push.');return;}
  if(!('Notification' in window)||Notification.permission!=='granted')throw new Error('Hãy nhấn “Bật thông báo” để cấp quyền trước.');
  registration=await navigator.serviceWorker.ready;await registration.showNotification(content.title,{body:content.body,icon:'./assets/icon-192.png',data:{url:content.url}});
}
export async function checkInApp() {for(const id of ['toeic','boeki']){const p=await readProfile(id),snapshot=reminderSnapshot(p),slot=reminderAt(snapshot,Date.now());if(!slot)continue;const key=`reminder:${id}:${slot}`;if(await meta(key))continue;const content=notificationContent(snapshot,Date.now());if(!content)continue;await meta(key,true);toast(`${content.title} ${content.body}`);const sub=await registration?.pushManager?.getSubscription();if(p.settings.reminders.browser&&!config.enabled&&!sub&&'Notification' in window&&Notification.permission==='granted'&&registration?.active)await registration.showNotification(content.title,{body:content.body,icon:'./assets/icon-192.png',data:{url:content.url}});}}
