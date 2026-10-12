import { normalizeText } from './utils.js';
import { normalizeBoekiFields } from './boeki-engine.js';
const text = value => value==null?'':Array.isArray(value)?value.map(text).join(' / '):typeof value==='object'?Object.entries(value).map(([k,v])=>`${k}: ${text(v)}`).join(' · '):String(value).trim();
export function identity(w) { return JSON.stringify([w.term,w.meaning,w.deck,w.group,w.reading].map(normalizeText)); }
export function parseCSV(input) {
  const rows=[];let row=[],cell='',quoted=false;input=input.replace(/^\uFEFF/,'');
  for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell){throw new Error('CSV có dấu ngoặc kép không hợp lệ.');}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('CSV thiếu dấu ngoặc kép đóng.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length<2)throw new Error('CSV cần dòng tiêu đề và ít nhất một dòng dữ liệu.');const headers=rows.shift().map(x=>x.trim());if(new Set(headers).size!==headers.length)throw new Error('CSV có tên cột trùng.');
  return rows.map((r,i)=>{if(r.length!==headers.length)throw new Error(`CSV dòng ${i+2}: số cột không khớp.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
}
export function normalizeData(data, profile) {
  const rows=Array.isArray(data)?data:data.vocabulary||data.words||data.entries;
  if(!Array.isArray(rows)||!rows.length)throw new Error('Không tìm thấy danh sách từ. Dùng mảng JSON hoặc khóa vocabulary / words / entries.');
  if(rows.length>20000)throw new Error('Mỗi lần nhập tối đa 20.000 từ.');
  const sections=Object.fromEntries((data.sections||[]).map(s=>[s.id,s.title]));const seen=new Set();let duplicates=0;
  const words=rows.map((r,i)=>{
    if(!r||typeof r!=='object')throw new Error(`Mục ${i+1} không phải đối tượng.`);
    const term=text(r.term??(profile==='boeki'?r.japanese??r.kanji:r.word)??r.word);
    const meaning=text(r.meaning??r.vietnamese??r.meaning_vi??r.translation);
    if(!term||!meaning)throw new Error(`Mục ${i+1}: thiếu từ hoặc nghĩa tiếng Việt.`);
    if(term.length>500||meaning.length>5000)throw new Error(`Mục ${i+1}: nội dung quá dài.`);
    const w={term,meaning,reading:text(r.reading??r.hiragana??r.kana),romaji:text(r.romaji),ipa:text(r.ipa),ipaUS:text(r.ipaUS??r.ipa_us),pos:text(r.pos??r.part_of_speech??r.type),deck:text(r.deck??(r.chapter?`Chapter ${r.chapter}`:r.lesson))||'Từ của tôi',group:text(r.group??r.category??sections[r.section]??r.section??r.topic),example:text(r.example??r.example_en??r.example_ja),exampleTranslation:text(r.exampleTranslation??r.example_vi),english:text(r.english),sourceId:text(r.sourceId??r.id),favorite:!!r.favorite,deleted:false,original:r.original??structuredClone(r)};
    if(profile==='boeki')Object.assign(w,normalizeBoekiFields(r,w),{term,meaning,reading:text(r.kana??r.hiragana??r.reading),group:text(r.category??sections[r.section]??r.section??r.topic)||w.group});
    w.id=`${profile}:${identity(w)}`;
    if(seen.has(w.id)){duplicates++;return null;}seen.add(w.id);return w;
  }).filter(Boolean);
  return {words,duplicates};
}
export function mergeWords(existing, incoming) {const identities=new Set(existing.map(identity));let added=0;for(const w of incoming){if(!identities.has(identity(w))){existing.push(w);identities.add(identity(w));added++;}}return added;}
export function parseFile(content,name,profile) { if(content.length>15_000_000)throw new Error('Tệp quá lớn (tối đa 15 MB).');let data;try{data=name.toLowerCase().endsWith('.csv')?parseCSV(content):JSON.parse(content.replace(/^\uFEFF/,''));}catch(e){throw new Error(`Không đọc được tệp: ${e.message}`);}return normalizeData(data,profile); }
export function validateBackup(data, profile) {
  if(data?.format!=='duo-vocab-backup'||data.version!==1||data.profile?.id!==profile)throw new Error('Backup không đúng định dạng hoặc không thuộc profile đang chọn.');
  const p=data.profile;
  if(!Array.isArray(p.words)||!Array.isArray(p.history)||!Array.isArray(p.sessions)||!p.progress||typeof p.progress!=='object'||Array.isArray(p.progress))throw new Error('Backup thiếu dữ liệu bắt buộc.');
  const ids=new Set();for(const w of p.words){if(typeof w.id!=='string'||!w.id.startsWith(profile+':')||!w.term||typeof w.term!=='string'||!w.meaning||typeof w.meaning!=='string'||!w.deck||typeof w.deck!=='string'||ids.has(w.id))throw new Error('Backup chứa từ không hợp lệ hoặc ID trùng.');ids.add(w.id);}
  for(const [id,r] of Object.entries(p.progress)){if(!ids.has(id)||!Number.isFinite(r.due)||!Number.isFinite(r.interval)||r.interval<0||!Number.isFinite(r.ease)||!Number.isInteger(r.reviews)||r.reviews<0)throw new Error('Lịch ôn trong backup không hợp lệ.');}
  if(p.skillProgress!==undefined){if(!p.skillProgress||typeof p.skillProgress!=='object'||Array.isArray(p.skillProgress))throw new Error('Tiến độ kỹ năng trong backup không hợp lệ.');for(const [id,skills] of Object.entries(p.skillProgress)){if(!ids.has(id)||!skills||typeof skills!=='object'||Array.isArray(skills))throw new Error('Tiến độ kỹ năng trong backup không hợp lệ.');for(const r of Object.values(skills)){if(!Number.isFinite(r.due)||!Number.isFinite(r.interval)||r.interval<0||!Number.isFinite(r.ease)||!Number.isInteger(r.reviews)||r.reviews<0)throw new Error('Lịch ôn kỹ năng trong backup không hợp lệ.');}}}
  if(p.vocabularyProgress!==undefined){if(!p.vocabularyProgress||typeof p.vocabularyProgress!=='object'||Array.isArray(p.vocabularyProgress))throw new Error('Trạng thái vốn từ trong backup không hợp lệ.');for(const [id,r] of Object.entries(p.vocabularyProgress)){if(!ids.has(id)||!r||!['new','learning','learned'].includes(r.learningStatus)||!Number.isInteger(r.reviewCount)||r.reviewCount<0||!Number.isInteger(r.correctCount)||r.correctCount<0||!Number.isInteger(r.incorrectCount)||r.incorrectCount<0)throw new Error('Trạng thái vốn từ trong backup không hợp lệ.');}}
  if(p.completedNewWordIdsByDate!==undefined){if(!p.completedNewWordIdsByDate||typeof p.completedNewWordIdsByDate!=='object'||Array.isArray(p.completedNewWordIdsByDate))throw new Error('Bộ đếm từ mới trong backup không hợp lệ.');const completed=new Set();for(const [day,wordIds] of Object.entries(p.completedNewWordIdsByDate)){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(wordIds)||wordIds.some(id=>!ids.has(id)||completed.has(id)))throw new Error('Bộ đếm từ mới trong backup không hợp lệ.');wordIds.forEach(id=>completed.add(id));}}
  for(const h of p.history){if(!ids.has(h.wordId)||!Number.isFinite(h.at)||!['again','hard','good','easy'].includes(h.rating)||!/^\d{4}-\d{2}-\d{2}$/.test(h.day)||!Number.isFinite(h.seconds)||h.seconds<0)throw new Error('Lịch sử trong backup không hợp lệ.');}
  for(const s of p.sessions){if(!s.id||!Number.isFinite(s.at)||!Number.isFinite(s.correct)||!Number.isFinite(s.total))throw new Error('Phiên học trong backup không hợp lệ.');}
  if(!Number.isInteger(p.settings?.goal)||p.settings.goal<1||p.settings.goal>50)throw new Error('Mục tiêu trong backup không hợp lệ.');
  try{new Intl.DateTimeFormat('vi',{timeZone:p.settings.timezone});}catch{throw new Error('Múi giờ trong backup không hợp lệ.');}
  return p;
}
