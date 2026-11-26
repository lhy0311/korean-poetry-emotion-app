/* art.js — 감정 이미지 (F-13): 브라우저 수묵화 + AI 이미지 프롬프트 */
const Art = (function () {
  'use strict';
  const W = 720, H = 960;

  /* 같은 시 + 같은 seed → 같은 그림 */
  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };

  /* 시 본문에서 소재를 찾고, 데이터의 motifs와 합친다 */
  const MOTIF_RE = {
    '꽃': /꽃|진달래|모란|매화|벚/, '길': /길|걸음|오솔/, '산': /산|봉우리|고원|산맥/,
    '달': /보름달|달빛|(?:^|\s)달(?![리려라렸콤])/m, '별': /별빛|별(?=[이을은도에]|\s|$)/,
    '물': /물결|강물|우물|호수|강나루|시냇|개천|바다|물에|물이/, '구름': /구름/,
    '눈': /눈보라|함박눈|눈발|눈이 (?:내|쌓)|눈 내/, '새': /산새|참새|종달새|갈매기|새가|새를|새는/
  };
  function motifsOf(poem) {
    const set = new Set(poem.motifs || []);
    Object.keys(MOTIF_RE).forEach(k => { if (MOTIF_RE[k].test(poem.text || '')) set.add(k); });
    return Array.from(set);
  }

  /* 핵심 구절: poem.key → 감정 시어가 가장 많은 행 → 제목 */
  function pickPhrase(poem, lines) {
    if (poem.key && poem.key.trim()) return { text: poem.key.trim(), from: '입력한 핵심 구절' };
    let best = null;
    (lines || []).forEach(l => { if (l.hits.length && (!best || l.hits.length > best.hits.length)) best = l; });
    if (best) return { text: best.text, from: '감정 시어가 가장 많은 행(' + best.no + '행)' };
    return { text: poem.title, from: '제목' };
  }

  const EMO_RULE = {
    sad: '푸른 빗줄기', joy: '주황빛 해와 번짐', calm: '청록빛 잔물결', hope: '연둣빛 새싹',
    reflect: '보랏빛 파문', long: '갈색 안개', love: '꽃잎의 양', anger: '붉은 붓 자국'
  };

  function paint(canvas, o) {
    const poem = o.poem, vec = o.vec, EM = o.emos, seed = o.seed || 0;
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext('2d');
    const R = mulberry(hash(poem.id) + seed * 7919);
    const rr = (a, b) => a + (b - a) * R();
    const V = {}; EM.forEach((e, i) => { V[e.k] = vec[i]; });
    const col = {}; EM.forEach(e => { col[e.k] = e.color; });
    const order = EM.map((e, i) => ({ e: e, v: vec[i] })).filter(x => x.v > 0.01).sort((a, b) => b.v - a.v);
    const motifs = o.motifs;
    const has = m => motifs.indexOf(m) >= 0;

    /* 한지 바탕 */
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) {
      g.strokeStyle = 'rgba(120,100,70,' + rr(0.02, 0.07) + ')'; g.lineWidth = rr(0.3, 1);
      const x = rr(0, W), y = rr(0, H), l = rr(4, 18), a = rr(0, 6.28);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }

    /* 1) 번짐: 색의 양 = 감정 비율 */
    g.globalCompositeOperation = 'multiply';
    order.forEach(x => {
      const n = Math.round(2 + x.v * 26);
      for (let i = 0; i < n; i++) {
        const cx = rr(60, W - 60), cy = rr(40, H * 0.62), r = rr(70, 170) * (0.7 + x.v);
        for (let k = 0; k < 5; k++) {
          const px = cx + rr(-r * 0.25, r * 0.25), py = cy + rr(-r * 0.25, r * 0.25), rad = r * rr(0.5, 1);
          const gr = g.createRadialGradient(px, py, rad * 0.1, px, py, rad);
          gr.addColorStop(0, rgba(x.e.color, rr(0.08, 0.16))); gr.addColorStop(1, rgba(x.e.color, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad, 0, 6.283); g.fill();
        }
      }
    });
    g.globalCompositeOperation = 'source-over';

    /* 2) 산 / 먼 언덕 */
    function ridge(base, amp, rough, color, alpha) {
      const ph = [rr(0, 6), rr(0, 6), rr(0, 6)];
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) {
        g.lineTo(x, base - amp * (0.55 * Math.sin(x / (140 * rough) + ph[0]) + 0.3 * Math.sin(x / (63 * rough) + ph[1]) + 0.15 * Math.sin(x / (27 * rough) + ph[2])));
      }
      g.lineTo(W, H); g.closePath();
      const gr = g.createLinearGradient(0, base - amp, 0, base + amp * 1.3);
      gr.addColorStop(0, rgba(color, alpha)); gr.addColorStop(1, rgba(color, alpha * 0.15));
      g.fillStyle = gr; g.fill();
    }
    const domColor = order.length ? order[0].e.color : '#3a3f4a';
    if (has('산')) {
      ridge(H * 0.62, 70, 1.1, domColor, 0.25);
      ridge(H * 0.64, 70, 1.1, '#3a3f4a', 0.34);
      const mist = g.createLinearGradient(0, H * 0.62, 0, H * 0.78);
      mist.addColorStop(0, 'rgba(239,230,210,0)'); mist.addColorStop(0.5, 'rgba(239,230,210,.7)'); mist.addColorStop(1, 'rgba(239,230,210,0)');
      g.fillStyle = mist; g.fillRect(0, H * 0.62, W, H * 0.16);
      ridge(H * 0.74, 90, 0.9, '#2c3038', 0.46);
      ridge(H * 0.86, 60, 0.7, '#1f2228', 0.56);
    } else {
      ridge(H * 0.88, 26, 1.2, '#3a3f4a', 0.26);
    }

    /* 3) 소재 */
    if (has('달')) {
      const mx = W * 0.76, my = H * 0.15;
      const gr = g.createRadialGradient(mx, my, 20, mx, my, 120);
      gr.addColorStop(0, 'rgba(255,248,225,.75)'); gr.addColorStop(1, 'rgba(255,248,225,0)');
      g.fillStyle = gr; g.fillRect(mx - 130, my - 130, 260, 260);
      g.fillStyle = 'rgba(255,251,238,.96)'; g.beginPath(); g.arc(mx, my, 50, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(80,60,30,.25)'; g.lineWidth = 1.5; g.stroke();
    }
    if (has('별')) {
      for (let i = 0; i < 30; i++) {
        const x = rr(20, W - 20), y = rr(20, H * 0.5), r = rr(1.2, 3);
        g.fillStyle = 'rgba(59,63,102,.7)'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      }
      for (let i = 0; i < 6; i++) {
        const x = rr(40, W - 40), y = rr(30, H * 0.4), r = rr(8, 15);
        g.fillStyle = '#c8a24a'; g.beginPath();
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rad = k % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
        g.closePath(); g.fill();
      }
    }
    if (has('구름')) {
      for (let i = 0; i < 6; i++) {
        const x = rr(60, W - 60), y = rr(H * 0.08, H * 0.45), rw = rr(90, 190);
        g.save(); g.translate(x, y); g.scale(1, rr(0.22, 0.34));
        const gr = g.createRadialGradient(0, 0, 5, 0, 0, rw);
        gr.addColorStop(0, 'rgba(255,252,242,.8)'); gr.addColorStop(1, 'rgba(255,252,242,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rw, 0, 6.283); g.fill(); g.restore();
      }
    }
    if (has('눈')) {
      for (let i = 0; i < 110; i++) {
        const x = rr(0, W), y = rr(0, H * 0.92), r = rr(1.5, 4.2);
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(90,100,120,.25)'; g.lineWidth = 0.8; g.stroke();
      }
    }
    if (has('물')) {
      for (let i = 0; i < 8; i++) {
        const x = rr(80, W - 80), y = rr(H * 0.8, H * 0.95), w = rr(60, 200);
        g.strokeStyle = rgba(col.calm, 0.4); g.lineWidth = rr(1.2, 2.6);
        g.beginPath(); g.ellipse(x, y, w, w * 0.07, 0, 0, 6.283); g.stroke();
      }
    }
    if (has('길')) {
      const x0 = rr(W * 0.38, W * 0.62), ph = rr(0, 6);
      const cx = t => x0 + 95 * Math.sin(t * 3 + ph) * t, wd = t => 130 * (1 - t) + 6, yy = t => H - 10 - t * H * 0.3;
      g.beginPath();
      for (let t = 0; t <= 1.001; t += 0.04) g.lineTo(cx(t) - wd(t) / 2, yy(t));
      for (let t = 1; t >= -0.001; t -= 0.04) g.lineTo(cx(t) + wd(t) / 2, yy(t));
      g.closePath(); g.fillStyle = 'rgba(247,240,224,.82)'; g.fill();
      g.strokeStyle = 'rgba(70,50,30,.22)'; g.lineWidth = 1.2; g.stroke();
    }
    if (has('새')) {
      g.strokeStyle = 'rgba(40,36,32,.75)'; g.lineWidth = 2.2; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x = rr(W * 0.15, W * 0.85), y = rr(H * 0.1, H * 0.32), s = rr(8, 15);
        g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s * 0.4, y - s * 0.8, x, y); g.quadraticCurveTo(x + s * 0.4, y - s * 0.8, x + s, y); g.stroke();
      }
    }
    const petalN = (has('꽃') ? 30 : 8) + Math.round(V.love * 90);
    if (has('꽃') || V.love >= 0.08) {
      const pc = V.love >= 0.05 ? col.love : domColor;
      for (let i = 0; i < petalN; i++) {
        g.save(); g.translate(rr(10, W - 10), rr(H * 0.28, H * 0.97)); g.rotate(rr(0, 6.28));
        g.fillStyle = rgba(pc, rr(0.5, 0.85)); g.beginPath(); g.ellipse(0, 0, rr(5, 10), rr(3, 6), 0, 0, 6.283); g.fill(); g.restore();
      }
    }

    /* 4) 감정별 붓질 */
    if (V.sad > 0.03) {
      const n = Math.round(V.sad * 260); g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const x = rr(0, W), y = rr(0, H * 0.9), len = rr(40, 130);
        g.strokeStyle = rgba(col.sad, rr(0.25, 0.55)); g.lineWidth = rr(0.8, 1.9);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * 0.12, y + len); g.stroke();
      }
    }
    if (V.anger > 0.03) {
      const n = Math.round(2 + V.anger * 20);
      for (let i = 0; i < n; i++) {
        const x = rr(40, W - 200), y = rr(H * 0.32, H * 0.9), a = -0.5 + rr(-0.3, 0.3), len = rr(90, 230), wd = rr(9, 24);
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = rgba(col.anger, rr(0.45, 0.7)); g.beginPath(); g.moveTo(0, 0);
        for (let t = 0; t <= 1; t += 0.1) g.lineTo(len * t, -wd * 0.5 * Math.sqrt(Math.sin(Math.PI * t)) + rr(-1.5, 1.5));
        for (let t = 1; t >= 0; t -= 0.1) g.lineTo(len * t, wd * 0.5 * Math.sqrt(Math.sin(Math.PI * t)) + rr(-1.5, 1.5));
        g.closePath(); g.fill();
        g.strokeStyle = rgba(col.anger, 0.25); g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(len * 0.1, rr(-wd * 0.5, wd * 0.5)); g.lineTo(len * rr(0.7, 1.05), rr(-wd * 0.5, wd * 0.5)); g.stroke(); }
        g.restore();
      }
    }
    if (V.joy > 0.03) {
      const sx = rr(W * 0.15, W * 0.5), sy = rr(H * 0.1, H * 0.22), r = 36 + V.joy * 90;
      const gr = g.createRadialGradient(sx, sy, 4, sx, sy, r);
      gr.addColorStop(0, rgba(col.joy, 0.75)); gr.addColorStop(1, rgba(col.joy, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, r, 0, 6.283); g.fill();
      for (let i = 0, n = Math.round(V.joy * 70); i < n; i++) { g.fillStyle = rgba(col.joy, rr(0.35, 0.7)); g.beginPath(); g.arc(rr(0, W), rr(0, H * 0.8), rr(2, 5), 0, 6.283); g.fill(); }
    }
    if (V.calm > 0.03) {
      g.lineCap = 'round';
      for (let i = 0, n = 2 + Math.round(V.calm * 12); i < n; i++) {
        const x = rr(0, W * 0.5), y = rr(H * 0.45, H * 0.8);
        g.strokeStyle = rgba(col.calm, 0.2); g.lineWidth = rr(6, 18);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(160, 420), y + rr(-6, 6)); g.stroke();
      }
    }
    if (V.hope > 0.03) {
      g.lineCap = 'round';
      for (let i = 0, n = Math.round(V.hope * 40); i < n; i++) {
        const x = rr(10, W - 10), y = rr(H * 0.72, H * 0.98), dx = rr(-14, 14), dy = rr(18, 50);
        g.strokeStyle = rgba(col.hope, 0.8); g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x, y - dy * 0.6, x + dx, y - dy); g.stroke();
        g.fillStyle = rgba(col.hope, 0.75); g.beginPath(); g.ellipse(x + dx, y - dy, 7, 3.4, rr(-1, 1), 0, 6.283); g.fill();
      }
    }
    if (V.reflect > 0.03) {
      const cx = rr(W * 0.3, W * 0.7), cy = rr(H * 0.58, H * 0.8);
      for (let i = 1, n = 3 + Math.round(V.reflect * 6); i <= n; i++) {
        g.strokeStyle = rgba(col.reflect, 0.55 - i * 0.04); g.lineWidth = 2;
        g.beginPath(); g.ellipse(cx, cy, 24 * i, 8.5 * i, 0, 0, 6.283); g.stroke();
      }
    }
    if (V.long > 0.03) {
      for (let i = 0, n = 2 + Math.round(V.long * 8); i < n; i++) {
        const y = rr(H * 0.3, H * 0.8), hh = rr(30, 70);
        const gr = g.createLinearGradient(0, y - hh, 0, y + hh);
        gr.addColorStop(0, rgba(col.long, 0)); gr.addColorStop(0.5, rgba(col.long, rr(0.1, 0.2))); gr.addColorStop(1, rgba(col.long, 0));
        g.fillStyle = gr; g.fillRect(0, y - hh, W, hh * 2);
      }
    }

    /* 5) 글씨: 핵심 구절(세로) + 제목 */
    const phrase = o.phrase.replace(/[.,!?'"“”‘’]/g, '').trim();
    const chars = Array.from(phrase.length > 30 ? phrase.slice(0, 29) + '…' : phrase);
    const FS = 34, perCol = 15, cols = Math.max(1, Math.ceil(chars.length / perCol));
    const rows = Math.min(chars.length, perCol);
    g.fillStyle = 'rgba(239,230,210,.5)';
    g.fillRect(W - 40 - cols * (FS + 10) - 8, 34, cols * (FS + 10) + 16, rows * FS * 1.12 + 34);
    g.fillStyle = '#2b2622'; g.font = '700 ' + FS + 'px "Nanum Myeongjo", serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    chars.forEach((ch, i) => {
      const c = Math.floor(i / perCol), r = i % perCol;
      if (ch === ' ') return;
      g.fillText(ch, W - 40 - FS / 2 - c * (FS + 10), 48 + r * FS * 1.12);
    });
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const title = '「' + poem.title + '」';
    g.font = '800 38px "Nanum Myeongjo", serif';
    const tw = Math.min(g.measureText(title).width, W - 190);
    g.fillStyle = 'rgba(239,230,210,.88)'; g.fillRect(26, H - 118, tw + 100, 92);
    g.fillStyle = '#2b2622'; g.fillText(title, 40, H - 66, W - 190);
    g.font = '500 22px "Nanum Myeongjo", serif'; g.fillStyle = '#5a4e40'; g.fillText(poem.poet || '', 44, H - 36);
    g.fillStyle = '#b23a2a'; g.fillRect(tw + 54, H - 98, 36, 36);
    g.fillStyle = '#fff'; g.font = '800 24px "Nanum Myeongjo", serif'; g.textAlign = 'center'; g.fillText('詩', tw + 72, H - 71);

    /* 화면에 보여 줄 규칙 */
    const rules = [];
    rules.push('색의 양 = 감정 비율 (' + order.slice(0, 4).map(x => x.e.name).join(' > ') + ')');
    order.filter(x => x.v >= 0.08).forEach(x => rules.push(x.e.name + ' → ' + EMO_RULE[x.e.k]));
    return { rules: rules, order: order };
  }

  /* AI 이미지 프롬프트 (한국어) */
  function buildPrompt(o) {
    const top = o.order.slice(0, 4).map(x => x.e.name + ' ' + Math.round(x.v * 100) + '%').join(', ');
    const dom = o.order.length ? o.order[0].e.name : '';
    return [
      '한국 시 「' + o.poem.title + '」(' + (o.poem.poet || '작자 미상') + ')의 정서를 담은 그림을 그려 주세요.',
      '- 장면: ' + (o.poem.scene || '시의 내용에서 떠오르는 장면'),
      '- 핵심 구절: "' + o.phrase.replace(/"/g, '') + '"',
      '- 정서: ' + top + '. 가장 강한 정서인 \'' + dom + '\'이 화면 전체의 색과 빛을 정해 주세요.',
      '- 꼭 넣을 소재: ' + (o.motifs.length ? o.motifs.join(', ') : '시에서 떠오르는 자연물'),
      '- 화풍: 한국화(수묵담채), 여백이 있는 세로 구도(3:4). 글씨나 로고는 넣지 마세요.'
    ].join('\n');
  }

  return { paint: paint, buildPrompt: buildPrompt, pickPhrase: pickPhrase, motifsOf: motifsOf };
})();
