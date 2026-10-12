export const escapeHTML = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const normalizeText = s => String(s).normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
export function dateKey(date = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function shiftDay(key, n) { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function shuffle(items) { const a = [...items]; for(let i=a.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
export function download(name, value) { const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export function toast(message) { const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4500); }
export function speak(text, profileOrLang) { if (!('speechSynthesis' in window)) {toast('Thiết bị chưa hỗ trợ phát âm.');return false;} speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=String(profileOrLang).includes('-')?profileOrLang:profileOrLang==='toeic'?'en-US':'ja-JP';const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang.toLowerCase()===u.lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(u.lang.slice(0,2).toLowerCase()))||null;u.rate=.85;u.onerror=()=>toast('Không phát được âm thanh. Hãy kiểm tra giọng đọc của thiết bị.');speechSynthesis.speak(u);return true; }
export function uid() { return crypto.randomUUID(); }
