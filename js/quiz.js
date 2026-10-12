import { normalizeText,shuffle } from './utils.js';
export function optionsFor(word,words,field='meaning') {const answer=word[field];const others=[...new Set(words.map(w=>w[field]).filter(x=>x&&x!==answer))];if(others.length<3)return null;return shuffle([answer,...shuffle(others).slice(0,3)]);}
export function checkTyped(answer,word,mode) {const accepted=mode==='reading'?[word.reading]:[word.term];return accepted.filter(Boolean).some(a=>normalizeText(a)===normalizeText(answer));}
// Curated, independent grammar examples. Never inserted into the user's vocabulary.
export const PART5=[
  {id:'p5-1',prompt:'The manager asked all employees _____ the meeting on time.',options:['to attend','attending','attended','attendance'],answer:'to attend',explanation:'ask + someone + to V: yêu cầu ai làm gì.'},
  {id:'p5-2',prompt:'Please contact the supplier _____ if you notice a problem.',options:['immediate','immediately','immediacy','more immediate'],answer:'immediately',explanation:'Trạng từ immediately bổ nghĩa cho động từ contact.'},
  {id:'p5-3',prompt:'The new software will improve the _____ of our accounting department.',options:['efficient','efficiently','efficiency','efficiencies are'],answer:'efficiency',explanation:'Sau the và trước of cần danh từ: efficiency (hiệu quả).'},
  {id:'p5-4',prompt:'All invoices must _____ before the end of the month.',options:['pay','be paid','paying','to pay'],answer:'be paid',explanation:'Bị động với động từ khuyết thiếu: must + be + V3.'},
  {id:'p5-5',prompt:'_____ the heavy rain, the delivery arrived on schedule.',options:['Despite','Although','Because','Even'],answer:'Despite',explanation:'Despite + cụm danh từ (the heavy rain): mặc dù.'}
];
