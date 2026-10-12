import { isDue, isMastered } from './spaced-repetition.js';
import { normalizeText, shuffle } from './utils.js';
import { completedNewWordIds, isLearned, learningStatus, WORD_STATUS } from './progress-model.js';

export const BOEKI_SKILLS = {
  ja_en: { label: 'Nhật → Anh', prompt: 'japanese', answer: 'english', requiresEnglish: true },
  en_ja: { label: 'Anh → Nhật', prompt: 'english', answer: 'japanese', requiresEnglish: true },
  ja_vi: { label: 'Nhật → Việt', prompt: 'japanese', answer: 'vietnamese' },
  vi_ja: { label: 'Việt → Nhật', prompt: 'vietnamese', answer: 'japanese' },
  vi_en: { label: 'Việt → Anh', prompt: 'vietnamese', answer: 'english', requiresEnglish: true },
  en_vi: { label: 'Anh → Việt', prompt: 'english', answer: 'vietnamese', requiresEnglish: true },
  kanji_kana: { label: 'Kanji → Kana', prompt: 'japanese', answer: 'kana', requiresKana: true },
  vi_both: { label: 'Việt → Nhật + Anh', prompt: 'vietnamese', answer: 'both', requiresEnglish: true }
};
export const DEFAULT_BOEKI_SKILLS = Object.keys(BOEKI_SKILLS);

export const BOEKI_QUIZ_MODES = {
  'boeki-ja-en': { skill: 'ja_en', format: 'choice' },
  'boeki-en-ja': { skill: 'en_ja', format: 'choice' },
  'boeki-vi-ja': { skill: 'vi_ja', format: 'choice' },
  'boeki-vi-en': { skill: 'vi_en', format: 'choice' },
  'boeki-listen-ja': { skill: 'ja_en', format: 'listen-choice', listenLang: 'ja-JP' },
  'boeki-listen-en': { skill: 'en_ja', format: 'listen-choice', listenLang: 'en-US' },
  'boeki-type-en': { skill: 'vi_en', format: 'type' },
  'boeki-type-kana': { skill: 'kanji_kana', format: 'type' },
  'boeki-abbreviation': { skill: 'abbreviation', format: 'choice' },
  'boeki-context': { skill: 'context', format: 'type' },
  'boeki-mixed': { skill: 'mixed', format: 'choice' }
};

const clean = value => value == null ? '' : String(value).trim();
const aliases = value => Array.isArray(value) ? value.map(clean).filter(Boolean) : clean(value) ? clean(value).split(/[|;]/).map(clean).filter(Boolean) : [];

export function normalizeBoekiFields(raw, base = {}) {
  const japanese = clean(raw.japanese ?? raw.kanji ?? base.term);
  const kana = clean(raw.kana ?? raw.hiragana ?? raw.reading ?? base.reading);
  const english = clean(raw.english ?? base.english);
  const vietnamese = clean(raw.vietnamese ?? raw.meaning ?? base.meaning);
  return {
    japanese,
    kana,
    romaji: clean(raw.romaji ?? base.romaji),
    english,
    englishAliases: aliases(raw.englishAliases ?? base.englishAliases),
    abbreviation: clean(raw.abbreviation ?? base.abbreviation),
    vietnamese,
    category: clean(raw.category ?? raw.topic ?? base.group),
    exampleJa: clean(raw.exampleJa ?? raw.example_ja ?? base.exampleJa),
    exampleEn: clean(raw.exampleEn ?? raw.example_en ?? base.exampleEn),
    exampleVi: clean(raw.exampleVi ?? raw.example_vi ?? base.exampleVi ?? base.exampleTranslation),
    notes: clean(raw.notes ?? base.notes),
    englishMissing: !english
  };
}

export function migrateBoekiProfile(profile) {
  if (profile.id !== 'boeki') return profile;
  profile.skillProgress ||= {};
  profile.settings.boekiDirections = Array.isArray(profile.settings.boekiDirections) && profile.settings.boekiDirections.length
    ? profile.settings.boekiDirections.filter(id => BOEKI_SKILLS[id]) : [...DEFAULT_BOEKI_SKILLS];
  profile.settings.reminders.boekiTypes = Array.isArray(profile.settings.reminders.boekiTypes)
    ? profile.settings.reminders.boekiTypes : ['ja_en', 'en_ja', 'kana', 'mistakes'];
  for (const word of profile.words) {
    const fields = normalizeBoekiFields(word.original || {}, word);
    Object.assign(word, fields, {
      term: fields.japanese || word.term,
      reading: fields.kana,
      meaning: fields.vietnamese || word.meaning,
      group: fields.category || word.group
    });
    profile.skillProgress[word.id] ||= {};
    // Legacy BOEKI only trained Japanese → Vietnamese. Preserve that exact knowledge,
    // without claiming the learner knows English, Kanji recall or reading.
    if (profile.progress[word.id] && !profile.skillProgress[word.id].ja_vi) {
      profile.skillProgress[word.id].ja_vi = structuredClone(profile.progress[word.id]);
    }
  }
  profile.schemaVersion = Math.max(profile.schemaVersion || 1, 2);
  return profile;
}

export function wordValue(word, field) {
  if (field === 'japanese') return word.japanese || word.term;
  if (field === 'kana') return word.kana || word.reading;
  if (field === 'vietnamese') return word.vietnamese || word.meaning;
  if (field === 'both') return `${word.japanese || word.term} · ${word.english}`;
  return word[field] || '';
}

export function validForSkill(word, skill) {
  if (skill === 'abbreviation') return !!(word.abbreviation && word.english);
  if (skill === 'context') return !!((word.exampleJa && wordValue(word, 'japanese') && word.exampleJa.includes(wordValue(word, 'japanese'))) || (word.exampleEn && word.english && word.exampleEn.toLocaleLowerCase().includes(word.english.toLocaleLowerCase())));
  const spec = BOEKI_SKILLS[skill];
  if (!spec) return false;
  if (spec.requiresEnglish && !word.english) return false;
  if (spec.requiresKana && !wordValue(word, 'kana')) return false;
  return !!(wordValue(word, spec.prompt) && wordValue(word, spec.answer));
}

export function configuredSkills(profile, word) {
  const selected = profile.settings.boekiDirections?.filter(id => BOEKI_SKILLS[id]) || DEFAULT_BOEKI_SKILLS;
  return selected.filter(skill => validForSkill(word, skill));
}
export const skillState = (profile, wordId, skill) => profile.skillProgress?.[wordId]?.[skill];
export const comprehensiveMastery = (profile, word) => {
  if (!isLearned(profile, word.id)) return false;
  const required = configuredSkills(profile, word);
  return required.length > 0 && required.every(skill => isMastered(skillState(profile, word.id, skill)));
};
export const wordHasDueSkill = (profile, word, now = Date.now()) => isLearned(profile, word.id) && configuredSkills(profile, word).some(skill => isDue(skillState(profile, word.id, skill), now));

export function boekiStats(profile, now = Date.now()) {
  const allWords = profile.words.filter(w => !w.deleted), words = allWords.filter(w => isLearned(profile, w.id));
  const skillBreakdown = Object.fromEntries(Object.keys(BOEKI_SKILLS).map(skill => {
    const eligible = words.filter(w => validForSkill(w, skill));
    return [skill, { total: eligible.length, mastered: eligible.filter(w => isMastered(skillState(profile, w.id, skill))).length }];
  }));
  const dueSkills = words.reduce((sum, word) => sum + configuredSkills(profile, word).filter(skill => isDue(skillState(profile, word.id, skill), now)).length, 0);
  return { skillBreakdown, dueSkills, comprehensive: words.filter(w => comprehensiveMastery(profile, w)).length, missingEnglish: allWords.filter(w => !w.english).length };
}

function pairKey(wordId, skill) { return `${wordId}::${skill}`; }
export function parsePair(entry) { return typeof entry === 'string' ? { wordId: entry, skill: null } : entry; }

export function boekiFlashQueue(profile, selected = profile.settings.boekiDirections, { review = false, quick = false, mistakes = false, newOnly = false, onlyWord = null, now = new Date() } = {}) {
  let words = profile.words.filter(w => !w.deleted && (!onlyWord || w.id === onlyWord));
  if (newOnly) {
    const remaining = Math.max(0, profile.settings.goal - completedNewWordIds(profile, now).size), candidates = words.filter(w => !isLearned(profile, w.id));
    const learning = candidates.filter(w => learningStatus(profile, w.id) === WORD_STATUS.LEARNING), fresh = candidates.filter(w => learningStatus(profile, w.id) === WORD_STATUS.NEW);
    words = [...learning, ...fresh].slice(0, remaining || learning.length);
    return words.map((word, index) => { const valid = selected.filter(skill => validForSkill(word, skill)); return valid.length ? { wordId: word.id, skill: valid[index % valid.length] } : null; }).filter(Boolean);
  }
  words = words.filter(w => isLearned(profile, w.id));
  const pairs = [];
  for (const word of words) for (const skill of selected) if (validForSkill(word, skill)) pairs.push({ wordId: word.id, skill });
  const due = pairs.filter(x => isDue(skillState(profile, x.wordId, x.skill))).sort((a,b) => skillState(profile,a.wordId,a.skill).due - skillState(profile,b.wordId,b.skill).due);
  const wrong = pairs.filter(x => (skillState(profile,x.wordId,x.skill)?.lapses || 0) > 0).sort((a,b) => skillState(profile,b.wordId,b.skill).lapses - skillState(profile,a.wordId,a.skill).lapses);
  if (mistakes) return wrong.slice(0, 10);
  if (review) return due.slice(0, 10);
  const unseen = shuffle(pairs.filter(x => !skillState(profile,x.wordId,x.skill)));
  const practiced = shuffle(pairs.filter(x => skillState(profile,x.wordId,x.skill) && !isDue(skillState(profile,x.wordId,x.skill))));
  const dedupe = new Set();
  return [...due, ...unseen, ...practiced].filter(x => { const k=pairKey(x.wordId,x.skill); if(dedupe.has(k)) return false; dedupe.add(k); return true; }).slice(0, quick ? 5 : 10);
}

export function promptAnswer(word, skill) {
  if (skill === 'abbreviation') return { prompt: word.abbreviation, answer: word.english };
  if (skill === 'context') {
    if (word.exampleJa?.includes(wordValue(word,'japanese'))) return { prompt: word.exampleJa.replace(wordValue(word,'japanese'),'_____'), answer: wordValue(word,'japanese'), progressSkill: 'vi_ja' };
    return { prompt: word.exampleEn.replace(new RegExp(word.english.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),'_____'), answer: word.english, progressSkill: 'vi_en' };
  }
  const spec = BOEKI_SKILLS[skill];
  return { prompt: wordValue(word, spec.prompt), answer: wordValue(word, spec.answer), progressSkill: skill };
}

export function unambiguousWords(words, skill) {
  const valid = words.filter(w => !w.deleted && validForSkill(w, skill));
  const map = new Map();
  for (const word of valid) {
    const {prompt,answer}=promptAnswer(word,skill),key=normalizeText(prompt);
    if (!map.has(key)) map.set(key,new Set());
    map.get(key).add(normalizeText(answer));
  }
  return valid.filter(w => map.get(normalizeText(promptAnswer(w,skill).prompt)).size === 1);
}

export function boekiQuizQueue(profile, mode, limit = 10) {
  const allWords = profile.words.filter(w => !w.deleted), words = allWords.filter(w => isLearned(profile, w.id));
  const spec = BOEKI_QUIZ_MODES[mode];
  if (!spec) return [];
  if (spec.skill === 'mixed') {
    const skills = profile.settings.boekiDirections.filter(skill => skill !== 'vi_both');
    const all = skills.flatMap(skill => unambiguousWords(words,skill).filter(word=>optionsForBoeki(word,allWords,skill)).map(word => ({wordId:word.id,skill,format:'choice'})));
    return shuffle(all).slice(0,limit);
  }
  const eligible = unambiguousWords(words,spec.skill).filter(word=>spec.format==='type'||optionsForBoeki(word,allWords,spec.skill));
  return shuffle(eligible).map(word => ({wordId:word.id,skill:spec.skill,format:spec.format,listenLang:spec.listenLang})).slice(0,limit);
}

export function optionsForBoeki(word, words, skill) {
  const answer = promptAnswer(word,skill).answer;
  const candidates = unambiguousWords(words,skill).filter(w => w.id !== word.id).map(w => promptAnswer(w,skill).answer);
  const others = [...new Map(candidates.filter(x => normalizeText(x)!==normalizeText(answer)).map(x => [normalizeText(x),x])).values()];
  return others.length < 3 ? null : shuffle([answer,...shuffle(others).slice(0,3)]);
}

export function acceptedAnswers(word, skill) {
  const {answer}=promptAnswer(word,skill);
  const result=[answer];
  if (['ja_en','vi_en'].includes(skill)) result.push(...(word.englishAliases||[]),word.abbreviation);
  return result.filter(Boolean);
}
export function checkBoekiTyped(value, word, skill) {
  return acceptedAnswers(word,skill).some(answer => normalizeText(answer) === normalizeText(value));
}
