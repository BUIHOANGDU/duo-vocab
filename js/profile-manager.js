export const PROFILES = {
  toeic: { id: 'toeic', name: 'Dự', course: 'TOEIC', subtitle: 'English → Tiếng Việt', icon: 'cap', goal: 25, file: './toeic_257_tu_day_du.json' },
  boeki: { id: 'boeki', name: 'Châm', course: 'BOEKI 貿易', subtitle: '日本語 ↔ English ↔ Tiếng Việt', icon: 'book', goal: 10, file: './tu_vung_boueki_1-198.json' }
};
export function defaults(id) {
  return { goal: PROFILES[id].goal, target: 750, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo', boekiDirections: id==='boeki'?['ja_en','en_ja','ja_vi','vi_ja','vi_en','en_vi','kanji_kana','vi_both']:undefined, reminders: { enabled: false, times: ['08:00', '12:30', '20:00'], frequency: 3, days: [1,2,3,4,5,6,0], quietStart: '22:00', quietEnd: '07:00', wordCount: 1, types: ['new', 'due', 'challenge'], boekiTypes: id==='boeki'?['ja_en','en_ja','kana','mistakes']:undefined, browser: false } };
}
export function freshProfile(id) { const settings=defaults(id);settings.dailyNewWordGoal=settings.goal;return { id, words: [], progress: {}, skillProgress: {}, vocabularyProgress: {}, completedNewWordIdsByDate: {}, learningHistory: [], history: [], sessions: [], settings, seeded: false, outbox: null, schemaVersion: 3 }; }
