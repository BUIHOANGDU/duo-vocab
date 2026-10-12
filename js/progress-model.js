import { dateKey } from './utils.js';
import { isMastered } from './spaced-repetition.js';

export const WORD_STATUS={NEW:'new',LEARNING:'learning',LEARNED:'learned'};

const emptyRecord=()=>({
  learningStatus:WORD_STATUS.NEW,
  firstIntroducedAt:null,
  firstLearnedAt:null,
  lastReviewedAt:null,
  nextReviewAt:null,
  reviewCount:0,
  correctCount:0,
  incorrectCount:0,
  masteryLevel:0,
  firstScheduledReviewCompleted:false,
  srsState:null
});

export function wordProgress(profile,wordId){
  profile.vocabularyProgress||={};
  return profile.vocabularyProgress[wordId]||=emptyRecord();
}
export const learningStatus=(profile,wordId)=>profile.vocabularyProgress?.[wordId]?.learningStatus||WORD_STATUS.NEW;
export const isLearned=(profile,wordId)=>learningStatus(profile,wordId)===WORD_STATUS.LEARNED;
export const learnedWords=profile=>profile.words.filter(word=>!word.deleted&&isLearned(profile,word.id));
export const unlearnedWords=profile=>profile.words.filter(word=>!word.deleted&&!isLearned(profile,word.id));

export function introduceWord(profile,wordId,at=Date.now()){
  const record=wordProgress(profile,wordId);
  if(record.learningStatus===WORD_STATUS.NEW)record.learningStatus=WORD_STATUS.LEARNING;
  record.firstIntroducedAt??=at;
  profile.learningHistory||=[];
  if(!profile.learningHistory.some(event=>event.type==='introduced'&&event.wordId===wordId))profile.learningHistory.push({type:'introduced',wordId,at});
  return record;
}

export function nextLocalDayAt(now,timezone){
  const today=dateKey(new Date(now),timezone);let low=now,high=now+36*60*60*1000;
  while(dateKey(new Date(high),timezone)===today)high+=12*60*60*1000;
  while(high-low>1000){const middle=Math.floor((low+high)/2);if(dateKey(new Date(middle),timezone)===today)low=middle;else high=middle;}
  return high;
}

function completedPreviously(profile,wordId){return Object.values(profile.completedNewWordIdsByDate||{}).some(ids=>ids.includes(wordId));}
export function completeFirstLearning(profile,wordId,{at=Date.now(),srsState=null}={}){
  const record=introduceWord(profile,wordId,at);
  if(record.learningStatus===WORD_STATUS.LEARNED||completedPreviously(profile,wordId))return false;
  record.learningStatus=WORD_STATUS.LEARNED;record.firstLearnedAt=at;record.srsState=srsState?structuredClone(srsState):record.srsState;
  record.lastReviewedAt=at;record.nextReviewAt=srsState?.due??record.nextReviewAt;record.reviewCount=Math.max(1,record.reviewCount||0);record.correctCount++;
  const day=dateKey(new Date(at),profile.settings.timezone);profile.completedNewWordIdsByDate||={};profile.completedNewWordIdsByDate[day]||=[];profile.completedNewWordIdsByDate[day].push(wordId);
  profile.learningHistory||=[];profile.learningHistory.push({type:'completed-first-learning',wordId,at,day});
  return true;
}

export function recordPractice(profile,wordId,{at=Date.now(),correct=false,srsState=null}={}){
  const record=wordProgress(profile,wordId);record.lastReviewedAt=at;if(srsState?.due)record.nextReviewAt=record.firstScheduledReviewCompleted?srsState.due:Math.min(record.nextReviewAt||Infinity,srsState.due);record.srsState=srsState?structuredClone(srsState):record.srsState;
  record.reviewCount=(record.reviewCount||0)+1;if(correct)record.correctCount=(record.correctCount||0)+1;else record.incorrectCount=(record.incorrectCount||0)+1;
  record.masteryLevel=isMastered(srsState)?4:Math.min(3,Math.max(0,srsState?.streak||0));
  return record;
}

export function reviewSchedule(profile,wordId,previous,proposed,at=Date.now()){
  const record=wordProgress(profile,wordId);
  if(!record.firstScheduledReviewCompleted&&previous&&record.nextReviewAt&&at<record.nextReviewAt)return previous;
  if(!record.firstScheduledReviewCompleted&&record.nextReviewAt&&at>=record.nextReviewAt)record.firstScheduledReviewCompleted=true;
  return proposed;
}

export function completedNewWordIds(profile,now=new Date()){
  return new Set(profile.completedNewWordIdsByDate?.[dateKey(now,profile.settings.timezone)]||[]);
}

export function migrateLearningModel(profile){
  const legacyMigration=(profile.schemaVersion||1)<3;
  profile.vocabularyProgress||={};profile.completedNewWordIdsByDate||={};profile.learningHistory||=[];
  profile.settings.dailyNewWordGoal=Number.isInteger(profile.settings.dailyNewWordGoal)?profile.settings.dailyNewWordGoal:profile.settings.goal;
  profile.settings.goal=profile.settings.dailyNewWordGoal;
  const histories=[...profile.history].filter(item=>item?.wordId&&Number.isFinite(item.at)).sort((a,b)=>a.at-b.at),firstHistory=new Map();
  for(const item of histories)if(!firstHistory.has(item.wordId))firstHistory.set(item.wordId,item);
  const alreadyCompleted=new Set(Object.values(profile.completedNewWordIdsByDate).flat());
  for(const word of profile.words){
    const record=wordProgress(profile,word.id),history=histories.filter(item=>item.wordId===word.id),legacy=profile.progress?.[word.id],skills=Object.values(profile.skillProgress?.[word.id]||{}).filter(Boolean);
    const evidence=record.learningStatus===WORD_STATUS.LEARNED||(legacyMigration&&(history.length||legacy?.reviews>0||skills.some(state=>state?.reviews>0)));
    if(evidence&&record.learningStatus!==WORD_STATUS.LEARNED){
      const first=firstHistory.get(word.id),at=first?.at||legacy?.firstReviewed||Math.min(...skills.map(state=>state.firstReviewed||state.lastReviewed).filter(Number.isFinite));
      record.learningStatus=WORD_STATUS.LEARNED;record.firstIntroducedAt??=Number.isFinite(at)?at:null;record.firstLearnedAt??=Number.isFinite(at)?at:null;
    }
    const srs=profile.id==='boeki'?(skills.sort((a,b)=>(a.due||Infinity)-(b.due||Infinity))[0]||null):(legacy||null);
    if(evidence){record.lastReviewedAt=Math.max(record.lastReviewedAt||0,...history.map(item=>item.at),legacy?.lastReviewed||0,...skills.map(state=>state.lastReviewed||0))||null;record.nextReviewAt=srs?.due??record.nextReviewAt;record.reviewCount=Math.max(record.reviewCount||0,history.length,legacy?.reviews||0,skills.reduce((sum,state)=>sum+(state.reviews||0),0));record.correctCount=Math.max(record.correctCount||0,history.filter(item=>item.rating!=='again').length);record.incorrectCount=Math.max(record.incorrectCount||0,history.filter(item=>item.rating==='again').length);record.srsState=srs?structuredClone(srs):record.srsState;record.masteryLevel=isMastered(srs)?4:Math.min(3,Math.max(0,srs?.streak||0));if(record.firstScheduledReviewCompleted===undefined)record.firstScheduledReviewCompleted=record.reviewCount>1;}
    if(record.learningStatus===WORD_STATUS.LEARNED&&!alreadyCompleted.has(word.id)){
      const first=firstHistory.get(word.id),at=record.firstLearnedAt||first?.at;if(Number.isFinite(at)){const day=first?.day||dateKey(new Date(at),profile.settings.timezone);profile.completedNewWordIdsByDate[day]||=[];profile.completedNewWordIdsByDate[day].push(word.id);alreadyCompleted.add(word.id);}
    }
  }
  if(legacyMigration&&profile.activeSession&&profile.activeSession.mode!=='part5'){
    const session=profile.activeSession,isNewSession=['flashcard','boeki-flash'].includes(session.mode),remaining=(session.queue||[]).slice(session.index||0).filter(entry=>{const id=typeof entry==='string'?entry:entry?.wordId;return id&&(isNewSession?!isLearned(profile,id):isLearned(profile,id));});
    if(remaining.length){session.queue=remaining;session.index=0;session.purpose=isNewSession?'new':'practice';}else profile.activeSession=null;
  }
  const session=profile.activeSession,current=session?.queue?.[session.index],wordId=typeof current==='string'?current:current?.wordId;
  if(wordId&&['flashcard','boeki-flash'].includes(session.mode)&&!isLearned(profile,wordId))introduceWord(profile,wordId,session.started||Date.now());
  for(const [day,ids] of Object.entries(profile.completedNewWordIdsByDate))profile.completedNewWordIdsByDate[day]=[...new Set(ids.filter(id=>profile.words.some(word=>word.id===id)))];
  profile.schemaVersion=Math.max(profile.schemaVersion||1,3);return profile;
}
