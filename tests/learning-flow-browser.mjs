import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://localhost:4173',day1=Date.parse('2026-10-13T03:00:00Z'),day2=Date.parse('2026-10-13T15:01:00Z');
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Asia/Tokyo'});
await context.addInitScript(initial=>{const NativeDate=Date;let stored;try{stored=Number(localStorage.getItem('__duo_test_now'));}catch{}let now=stored||initial;class TestDate extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}Object.setPrototypeOf(TestDate,NativeDate);window.Date=TestDate;window.__setTestNow=value=>{now=value;try{localStorage.setItem('__duo_test_now',String(value));}catch{}};},day1);
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await mkdir('test-results',{recursive:true});
async function state(id='toeic'){return page.evaluate(async id=>(await import('./js/storage.js')).readProfile(id),id);}
async function stats(id='toeic'){return page.evaluate(async id=>{const [{readProfile},{statistics}]=await Promise.all([import('./js/storage.js'),import('./js/statistics.js')]);return statistics(await readProfile(id));},id);}
async function goto(route){await page.goto(`${base}/?profile=toeic#${route}`);await page.locator(`#main[data-route="${route}"]`).waitFor();}
async function rateCurrent(rating='good'){
  const before=await state(),session=before.activeSession,id=session.queue[session.index];await page.locator('.flashcard').click();await page.locator(`[data-rating="${rating}"]`).click();
  await page.waitForFunction(async id=>{const {readProfile}=await import('./js/storage.js'),p=await readProfile('toeic');return !p.activeSession||p.activeSession.queue[p.activeSession.index]!==id;},id);
}
async function finishFlashSession(){while((await state()).activeSession)await rateCurrent('good');await page.locator('.result').waitFor();}
async function finishTypingSession(){while((await state()).activeSession){const p=await state();await page.locator('[name="answer"]').fill(p.activeSession.expected);await page.locator('#answer-form button').click();await page.locator('.feedback').waitFor();await page.locator('[data-action="next"]').click();await page.waitForFunction(()=>document.querySelector('.result')||document.querySelector('[name="answer"]:not([disabled])'));}await page.locator('.result').waitFor();}

try{
  await goto('learn');let p=await state(),s=await stats();assert.equal(p.schemaVersion,3);assert.equal(s.learned,0);assert.equal(s.learnedToday,0);assert.equal(p.settings.goal,25);assert.equal((await state('boeki')).vocabularyProgress&&Object.values((await state('boeki')).vocabularyProgress).filter(x=>x.learningStatus==='learned').length,0);
  await page.locator('[data-mode="choice"]').click();await page.waitForTimeout(100);assert(!(await state()).activeSession);assert.match(await page.locator('#toast').innerText(),/chưa có từ đã học/i);

  await page.locator('[data-mode="flashcard"]').click();await page.locator('.flashcard').waitFor();p=await state();assert.equal(p.activeSession.queue.length,25);const originalNewIds=[...p.activeSession.queue],first=originalNewIds[0];assert.equal(p.vocabularyProgress[first].learningStatus,'learning');
  await rateCurrent('good');s=await stats();assert.equal(s.learnedToday,1);assert.equal(s.learned,1);p=await state();const resumeId=p.activeSession.queue[p.activeSession.index];await page.reload();await page.locator('.flashcard').waitFor();p=await state();assert.equal(p.activeSession.queue[p.activeSession.index],resumeId);assert.equal((await stats()).learnedToday,1);
  await finishFlashSession();s=await stats();assert.equal(s.learnedToday,25);assert.equal(s.learned,25);assert.equal(new Set(Object.values((await state()).completedNewWordIdsByDate).flat()).size,25);assert(await page.locator('[data-action="extend-goal"][data-goal="40"]').isVisible());

  await goto('review');await page.locator('[data-mode="practice"][data-scope="all"]').click();p=await state();assert.equal(p.activeSession.queue.length,25);assert(p.activeSession.queue.every(id=>originalNewIds.includes(id)));await finishFlashSession();assert.equal((await stats()).learnedToday,25);
  for(let round=0;round<2;round++){await goto('learn');await page.locator('[data-mode="typing"][data-scope="all"]').click();assert.equal((await state()).activeSession.queue.length,10);await finishTypingSession();}assert.equal((await stats()).learnedToday,25);

  for(const mode of ['choice','listening','challenge']){await goto('learn');await page.locator(`[data-mode="${mode}"]`).click();p=await state();assert(p.activeSession.queue.every(id=>originalNewIds.includes(id)),`${mode} included an unlearned question`);await page.locator('[data-action="finish-session"]').click();await page.locator('.result').waitFor();}assert.equal((await stats()).learnedToday,25);

  await goto('settings');await page.locator('[name="goal"]').fill('40');await page.locator('#goal-form button[type=submit]').click();await page.waitForFunction(async()=>((await (await import('./js/storage.js')).readProfile('toeic')).settings.goal)===40);assert.equal((await stats()).learnedToday,25);
  await goto('learn');await page.locator('[data-mode="flashcard"]').click();p=await state();assert.equal(p.activeSession.queue.length,15);assert(p.activeSession.queue.every(id=>!originalNewIds.includes(id)));const extraIds=[...p.activeSession.queue];await finishFlashSession();s=await stats();assert.equal(s.learnedToday,40);assert.equal(s.learned,40);assert.equal(new Set(Object.values((await state()).completedNewWordIdsByDate).flat()).size,40);
  await page.reload();await page.locator('#main[data-route="study"]').waitFor();assert.equal((await stats()).learned,40);

  await page.evaluate(value=>window.__setTestNow(value),day2);await page.reload();await page.locator('.header').waitFor();s=await stats();assert.equal(s.learnedToday,0);assert.equal(s.learned,40);assert.equal(s.due,40);p=await state();const learnedIds=new Set([...originalNewIds,...extraIds]);
  await goto('review');await page.locator('[data-mode="review"][data-scope="due"]').click();p=await state();assert.equal(p.activeSession.queue.length,10);assert(p.activeSession.queue.every(id=>learnedIds.has(id)));await page.locator('[data-action="finish-session"]').click();await page.locator('.result').waitFor();
  await goto('review');await page.locator('[data-mode="practice"][data-scope="yesterday"]').click();p=await state();assert.equal(p.activeSession.queue.length,40);assert(p.activeSession.queue.every(id=>learnedIds.has(id)));await page.locator('[data-action="finish-session"]').click();await page.locator('.result').waitFor();
  await goto('learn');await page.locator('[data-mode="flashcard"]').click();p=await state();assert.equal(p.activeSession.queue.length,40);assert(p.activeSession.queue.every(id=>!learnedIds.has(id)));assert.equal((await stats()).learnedToday,0);await page.locator('[data-action="finish-session"]').click();await page.locator('.result').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS: shared vocabulary progress, 0→1→25, 20 typing attempts without recounting, 25-word review without recounting, goal 25→40 with exactly 15 new words, reload resume/persistence, Tokyo next-day 0/40 with 40 retained/due, learned-only practice modes and next unlearned allocation.');
}catch(error){await page.screenshot({path:'test-results/learning-flow-failure.png',fullPage:true});await writeFile('test-results/learning-flow-failure.html',await page.content());throw error;}finally{await browser.close();}
