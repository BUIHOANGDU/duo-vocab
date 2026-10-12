import { dateKey,shiftDay } from './utils.js';
import { isDue,isMastered } from './spaced-repetition.js';
import { boekiStats, comprehensiveMastery, wordHasDueSkill } from './boeki-engine.js';
import { completedNewWordIds, isLearned } from './progress-model.js';
export function statistics(p,now=new Date()) {
  const today=dateKey(now,p.settings.timezone),words=p.words.filter(w=>!w.deleted),history=p.history;
  const todayHistory=history.filter(h=>h.day===today),learnedToday=completedNewWordIds(p,now).size,learnedWords=words.filter(w=>isLearned(p,w.id));
  const days=new Set(history.map(h=>h.day));let streak=0,day=days.has(today)?today:shiftDay(today,-1);while(days.has(day)){streak++;day=shiftDay(day,-1);}
  const multi=p.id==='boeki'?boekiStats(p,+now):null;
  return {today,total:words.length,learnedToday,answersToday:todayHistory.length,mastered:p.id==='boeki'?learnedWords.filter(w=>comprehensiveMastery(p,w)).length:learnedWords.filter(w=>isMastered(p.progress[w.id])).length,due:p.id==='boeki'?learnedWords.filter(w=>wordHasDueSkill(p,w,+now)).length:learnedWords.filter(w=>isDue(p.progress[w.id],+now)).length,dueSkills:multi?.dueSkills||0,learned:learnedWords.length,unlearned:words.length-learnedWords.length,streak,seconds:history.reduce((s,h)=>s+h.seconds,0),accuracy:history.length?Math.round(history.filter(h=>h.rating!=='again').length/history.length*100):0,skillBreakdown:multi?.skillBreakdown,missingEnglish:multi?.missingEnglish||0};
}
export function chartDays(p,count=7) {const today=dateKey(new Date(),p.settings.timezone);return Array.from({length:count},(_,i)=>{const day=shiftDay(today,i-count+1);const hs=p.history.filter(h=>h.day===day);return {day,count:hs.length,new:new Set(p.completedNewWordIdsByDate?.[day]||[]).size};});}
