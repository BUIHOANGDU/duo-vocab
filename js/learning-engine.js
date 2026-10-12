import { isDue } from './spaced-repetition.js';
import { completedNewWordIds, isLearned, learningStatus, WORD_STATUS } from './progress-model.js';
import { dateKey, shiftDay, shuffle } from './utils.js';

export function newWordQueue(profile,now=new Date()){
  const words=profile.words.filter(word=>!word.deleted&&!isLearned(profile,word.id));
  const completed=completedNewWordIds(profile,now).size,remaining=Math.max(0,profile.settings.goal-completed);
  const learning=words.filter(word=>learningStatus(profile,word.id)===WORD_STATUS.LEARNING),fresh=words.filter(word=>learningStatus(profile,word.id)===WORD_STATUS.NEW);
  if(!remaining)return learning;
  return [...learning,...fresh].slice(0,remaining);
}

export function practiceWords(profile,{scope='all',now=new Date()}={}){
  const learned=profile.words.filter(word=>!word.deleted&&isLearned(profile,word.id)),today=dateKey(now,profile.settings.timezone),yesterday=shiftDay(today,-1);
  if(scope==='due')return learned.filter(word=>isDue(profile.progress[word.id],+now)).sort((a,b)=>profile.progress[a.id].due-profile.progress[b.id].due);
  if(scope==='mistakes')return learned.filter(word=>(profile.progress[word.id]?.lapses||0)>0).sort((a,b)=>profile.progress[b.id].lapses-profile.progress[a.id].lapses);
  if(scope==='today'||scope==='yesterday'){const day=scope==='today'?today:yesterday,ids=new Set(profile.completedNewWordIdsByDate?.[day]||[]);return learned.filter(word=>ids.has(word.id));}
  return learned;
}

export function learningQueue(profile,{review=false,quick=false,mistakes=false,scope=null,now=new Date()}={}){
  if(!review&&!quick&&!mistakes&&!scope)return newWordQueue(profile,now);
  const selected=practiceWords(profile,{scope:scope||(review?'due':mistakes?'mistakes':'all'),now});
  if(scope&&!review&&!quick&&!mistakes)return selected;
  return (review||mistakes?selected:shuffle(selected)).slice(0,quick?5:10);
}
