/* engine.js — 감정 범주, 감정 사전, 분석 엔진 (브라우저와 Node 모두에서 동작) */
(function (root) {
  'use strict';

  /* 1. 감정 범주 8개 (기술명세서 3.1: k, name, def, color) */
  const EMOS = [
    { k: 'sad',     name: '슬픔',          color: '#3d5a9e', def: '상실이나 이별, 죽음 앞에서 느끼는 아픔과 눈물의 정서.' },
    { k: 'joy',     name: '기쁨',          color: '#e8903a', def: '즐거움과 환희, 웃음처럼 밝고 들뜬 정서.' },
    { k: 'calm',    name: '평온·달관',     color: '#2e9aa0', def: '자연과 조화를 이루며 마음이 고요하고 여유로운 정서.' },
    { k: 'hope',    name: '희망·의지',     color: '#9bb52e', def: '어려움 속에서도 앞날을 기대하고 이겨 내려는 정서.' },
    { k: 'reflect', name: '성찰·부끄러움', color: '#7b5ea7', def: '자신의 내면을 돌아보며 부끄러워하고 반성하는 정서.' },
    { k: 'long',    name: '그리움',        color: '#8a6d4f', def: '멀리 있거나 잃어버린 대상·고향·과거를 간절히 떠올리는 정서.' },
    { k: 'love',    name: '사랑·헌신',     color: '#ee7fa6', def: '대상을 아끼고 조건 없이 마음을 바치는 정서.' },
    { k: 'anger',   name: '원망·미움',     color: '#a8232f', def: '부당함이나 상처에 대해 원망하고 미워하며 분노하는 정서.' }
  ];

  /* 2. 감정 사전 (방식 A) — 범주마다 시어 10개 이상, 어간 사용 */
  const LEX = {
    sad:     ['슬프', '슬픔', '눈물', '설움', '서러', '이별', '울고', '울며', '울음', '통곡', '쓸쓸', '외로', '애달', '죽', '비통', '아프'],
    joy:     ['기쁘', '기쁨', '웃', '즐거', '행복', '환희', '신나', '반짝', '환하', '노래', '춤', '잔치'],
    calm:    ['고요', '평화', '평온', '바람', '구름', '하늘', '맑', '한가', '강물', '푸른', '안식', '달관', '잔잔', '고즈넉'],
    hope:    ['희망', '새벽', '아침', '봄', '꿈', '일어', '씨를', '마침내', '광복', '다시', '열리', '무지개', '빛', '이겨'],
    reflect: ['부끄', '괴로', '뉘우', '반성', '거울', '우물', '참회', '고백', '가엾', '죄', '어둠', '한 점'],
    long:    ['그리', '보고 싶', '옛', '추억', '기다', '고향', '어머니', '아련', '사무치', '돌아가', '멀리', '아득'],
    love:    ['사랑', '님', '그대', '고이', '품', '안기', '보듬', '꽃', '정성', '따뜻', '헌신', '축복', '아름'],
    anger:   ['원망', '미움', '미워', '증오', '분노', '역겨', '저주', '노여', '빼앗', '짓밟', '억울', '원수', '즈려밟']
  };

  const EIDX = {};
  EMOS.forEach((e, i) => { EIDX[e.k] = i; });
  const WORD2K = {};
  Object.keys(LEX).forEach(k => LEX[k].forEach(w => { if (!(w in WORD2K)) WORD2K[w] = k; }));

  /* 긴 시어부터 하나의 정규식으로 (기술명세서 5.2) */
  const SRC = Object.keys(WORD2K)
    .sort((a, b) => b.length - a.length)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const mkRe = () => new RegExp(SRC, 'g');

  const norm = v => {
    const s = v.reduce((a, b) => a + b, 0);
    return s > 0 ? v.map(x => x / s) : v.map(() => 0);
  };

  /* 3. 사전 분석: 행마다 범주별 일치 수 c(l, e) */
  function lexAnalyze(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = lines.map((t, i) => {
      const counts = EMOS.map(() => 0);
      const hits = [];
      const re = mkRe();
      let m;
      while ((m = re.exec(t))) {
        counts[EIDX[WORD2K[m[0]]]]++;
        hits.push(m[0]);
      }
      return { no: i + 1, text: t, counts: counts, hits: hits };
    });
    const tot = EMOS.map((_, i) => out.reduce((a, l) => a + l.counts[i], 0));
    return { lines: out, vlex: norm(tot), total: tot.reduce((a, b) => a + b, 0) };
  }

  /* 4. 해석 프로필과 결합: v = normalize((1-w)·p̂ + w·v_lex) (5.4) */
  function analyze(poem, w) {
    const r = lexAnalyze(poem.text);
    let vec = r.vlex;
    let method = 'lexicon';
    if (poem.profile) {
      const ph = norm(EMOS.map(e => poem.profile[e.k] || 0));
      vec = norm(ph.map((x, i) => (1 - w) * x + w * r.vlex[i]));
      method = 'hybrid';
    }
    const mx = Math.max.apply(null, vec);
    return {
      id: poem.id, vec: vec, vlex: r.vlex, lines: r.lines, total: r.total, method: method,
      dominant: mx > 0 ? EMOS[vec.indexOf(mx)].k : null
    };
  }

  /* 5. 코사인 유사도 (5.5) */
  function cos(a, b) {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  }

  /* 6. PCA — 평균 제거, 공분산, 거듭제곱법 (5.6) */
  function pca(X) {
    const n = X.length, d = X[0].length;
    const mean = Array.from({ length: d }, (_, j) => X.reduce((a, v) => a + v[j], 0) / n);
    const C = X.map(v => v.map((x, j) => x - mean[j]));
    const cov = Array.from({ length: d }, (_, a) =>
      Array.from({ length: d }, (_, b) => C.reduce((s, v) => s + v[a] * v[b], 0) / n));
    const power = M => {
      let v = Array.from({ length: d }, (_, i) => 1 + i * 0.1);
      for (let t = 0; t < 300; t++) {
        const nv = M.map(r => r.reduce((s, x, j) => s + x * v[j], 0));
        const len = Math.hypot.apply(null, nv) || 1;
        v = nv.map(x => x / len);
      }
      const Mv = M.map(r => r.reduce((s, x, j) => s + x * v[j], 0));
      return { v: v, lam: Mv.reduce((s, x, i) => s + x * v[i], 0) };
    };
    const e1 = power(cov);
    const e2 = power(cov.map((r, a) => r.map((x, b) => x - e1.lam * e1.v[a] * e1.v[b])));
    const trace = cov.reduce((s, r, i) => s + r[i], 0) || 1;
    return {
      pts: C.map(v => [v.reduce((s, x, j) => s + x * e1.v[j], 0), v.reduce((s, x, j) => s + x * e2.v[j], 0)]),
      axes: [{ v: e1.v, share: e1.lam / trace }, { v: e2.v, share: e2.lam / trace }]
    };
  }

  const api = { EMOS: EMOS, LEX: LEX, EIDX: EIDX, WORD2K: WORD2K, mkRe: mkRe, norm: norm, lexAnalyze: lexAnalyze, analyze: analyze, cos: cos, pca: pca };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : this);
