/* verify.js — 검증 사례 후보를 뽑아 주는 도우미
 *
 * 사용법: poems.js 의 text 를 채운 뒤, 이 폴더에서  node verify.js
 * 출력은 "후보"일 뿐입니다. README 의 검증 사례(원인·개선 방법)는 직접 읽고 자신의 말로 쓰세요.
 */
const POEMS = require('./poems.js');
const E = require('./engine.js');
const name = k => E.EMOS[E.EIDX[k]].name;
const P = x => Math.round(x * 100) + '%';
const top = (vec, n) => vec.map((v, i) => [E.EMOS[i].name, v]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0] + ' ' + P(x[1])).join(', ') || '(없음)';

const filled = POEMS.filter(p => (p.text || '').trim());
console.log('본문이 채워진 시: ' + filled.length + ' / ' + POEMS.length + '편');
if (!filled.length) { console.log('poems.js 의 text 를 먼저 채워 주세요.'); process.exit(0); }

/* 1. 가중치별 지배 정서 */
console.log('\n=== 1. 가중치별 지배 정서 (w=0 해석만 / 0.4 기본 / 1 사전만) ===');
const diff = [];
filled.forEach(p => {
  const a = E.analyze(p, 0), b = E.analyze(p, 0.4), c = E.analyze(p, 1);
  const d = x => (x.dominant ? name(x.dominant) : '없음');
  console.log('[' + p.title + '] ' + d(a) + ' / ' + d(b) + ' / ' + d(c) + '   사전 상위: ' + top(c.vec, 3));
  if (a.dominant !== c.dominant) diff.push(p.title + ': 해석 ' + d(a) + ' ↔ 사전 ' + d(c));
});
console.log('\n→ 해석과 사전의 지배 정서가 다른 시 (검증 사례 후보):');
console.log(diff.length ? diff.map(x => '  - ' + x).join('\n') : '  (없음)');

/* 2. 감지 시어가 하나도 없는 시 */
const none = filled.filter(p => E.analyze(p, 1).total === 0).map(p => p.title);
console.log('\n=== 2. 사전으로 감지된 시어가 없는 시 ===\n' + (none.length ? '  ' + none.join(', ') : '  (없음)'));

/* 3. 오탐 후보: 시어가 어절의 일부로 잡힌 경우 (예: '죽' ← '죽어도', '님' ← '그님') */
console.log('\n=== 3. 오탐 후보: 시어가 더 긴 어절 속에서 잡힌 경우 ===');
let shown = 0;
filled.forEach(p => {
  E.lexAnalyze(p.text).lines.forEach(l => {
    l.text.split(/\s+/).forEach(tok => {
      const re = E.mkRe(); const hits = []; let m;
      while ((m = re.exec(tok))) hits.push(m[0]);
      hits.forEach(h => {
        if (h.length <= 2 && tok.length > h.length + 1 && shown < 60) {
          console.log('  [' + p.title + ' ' + l.no + '행] 어절 "' + tok + '" 에서 "' + h + '" → ' + name(E.WORD2K[h]));
          shown++;
        }
      });
    });
  });
});
if (!shown) console.log('  (없음)');

/* 4. 한 행에 서로 반대되는 정서가 함께 잡힌 행 (반어·역설 후보) */
console.log('\n=== 4. 한 행에서 슬픔과 사랑/기쁨/평온이 함께 잡힌 행 (반어·역설 후보) ===');
let n4 = 0;
filled.forEach(p => {
  E.lexAnalyze(p.text).lines.forEach(l => {
    const c = l.counts, g = k => c[E.EIDX[k]];
    if (g('sad') && (g('love') || g('joy') || g('calm')) && n4 < 30) { console.log('  [' + p.title + ' ' + l.no + '행] ' + l.text + '  ← ' + l.hits.join(', ')); n4++; }
  });
});
if (!n4) console.log('  (없음)');

/* 5. 사전 점수가 해석 프로필과 가장 어긋나는 시 */
console.log('\n=== 5. 해석 프로필과 사전 점수의 코사인 유사도가 낮은 시 (낮을수록 어긋남) ===');
filled.filter(p => p.profile).map(p => {
  const ph = E.norm(E.EMOS.map(e => p.profile[e.k] || 0));
  return { t: p.title, s: E.cos(ph, E.analyze(p, 1).vec) };
}).sort((a, b) => a.s - b.s).slice(0, 5).forEach(x => console.log('  ' + x.t + ': ' + P(x.s)));
