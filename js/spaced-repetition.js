export const DAY=86400000;
export function schedule(previous, rating, now=Date.now()) {
  if(!['again','hard','good','easy'].includes(rating))throw new Error('Đánh giá không hợp lệ.');
  const p=previous||{interval:0,ease:2.5,reviews:0,lapses:0,streak:0};let interval,ease=p.ease||2.5;
  if(rating==='again'){interval=0;ease=Math.max(1.3,ease-.2);}
  if(rating==='hard'){interval=p.interval?Math.max(1,Math.round(p.interval*1.2)):1;ease=Math.max(1.3,ease-.15);}
  if(rating==='good')interval=p.interval?Math.max(3,Math.round(p.interval*ease)):3;
  if(rating==='easy'){interval=p.interval?Math.max(7,Math.round(p.interval*ease*1.3)):7;ease=Math.min(3.2,ease+.15);}
  return {interval,ease,reviews:p.reviews+1,lapses:(p.lapses||0)+(rating==='again'?1:0),streak:rating==='again'?0:(p.streak||0)+1,due:now+(rating==='again'?60000:interval*DAY),lastReviewed:now,firstReviewed:p.firstReviewed||now};
}
export const isMastered = p => !!p&&p.interval>=21&&p.streak>=3;
export const isDue = (p,now=Date.now()) => !!p&&p.due<=now;
