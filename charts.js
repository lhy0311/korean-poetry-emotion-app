/* charts.js — SVG 차트 (문자열을 돌려주는 순수 함수) */
const Charts = (function () {
  'use strict';
  const { EMOS, EIDX, WORD2K } = Engine;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = x => Math.round(x * 100);
  const emo = k => EMOS[EIDX[k]];
  const legendOf = idx => '<div class="legend">' + idx.map(i =>
    '<span><i style="background:' + EMOS[i].color + '"></i>' + EMOS[i].name + '</span>').join('') + '</div>';

  /* F-06 감정 프로필: 레이더 (축 이름 + 눈금 %) */
  function radar(vec, other, nameA, nameB) {
    const W = 420, H = 340, cx = W / 2, cy = H / 2 + 4, R = 100, n = EMOS.length;
    const top = Math.max.apply(null, vec.concat(other || [0]));
    const mx = Math.max(0.3, Math.ceil(top * 10) / 10);
    const ang = i => -Math.PI / 2 + 2 * Math.PI * i / n;
    const pt = (i, v) => [cx + R * (v / mx) * Math.cos(ang(i)), cy + R * (v / mx) * Math.sin(ang(i))];
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="감정 프로필 레이더 차트">';
    [0.25, 0.5, 0.75, 1].forEach(f => {
      s += '<polygon points="' + EMOS.map((_, i) => pt(i, mx * f).join(',')).join(' ') + '" fill="none" stroke="var(--rule)"/>';
      s += '<text class="mu" x="' + (cx + 4) + '" y="' + (cy - R * f + 10) + '" font-size="9">' + Math.round(mx * f * 100) + '%</text>';
    });
    EMOS.forEach((e, i) => {
      const p = pt(i, mx), a = ang(i), c = Math.cos(a), sn = Math.sin(a);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="var(--rule)"/>';
      const lx = cx + (R + 14) * c, ly = cy + (R + 14) * sn + (sn > 0.3 ? 10 : sn < -0.3 ? -2 : 4);
      const anchor = c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle';
      s += '<text x="' + lx + '" y="' + ly + '" font-size="11" text-anchor="' + anchor + '"><tspan style="fill:' + e.color + '">●</tspan> ' + e.name + '</text>';
    });
    if (other) s += '<polygon points="' + other.map((v, i) => pt(i, v).join(',')).join(' ') + '" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="5 4"/>';
    s += '<polygon points="' + vec.map((v, i) => pt(i, v).join(',')).join(' ') + '" fill="rgba(178,58,42,.22)" stroke="var(--seal)" stroke-width="2"/>';
    vec.forEach((v, i) => { if (v > 0) { const p = pt(i, v); s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.4" fill="var(--seal)"/>'; } });
    s += '</svg>';
    s += '<div class="legend"><span><i style="background:var(--seal)"></i>' + esc(nameA) + '(실선)</span>' +
      (other ? '<span><i style="background:var(--muted)"></i>추천 1위 ' + esc(nameB) + '(점선)</span>' : '') + '</div>';
    return s;
  }

  /* F-07 행별 감정 흐름: 가로 = 행 번호, 세로 = 감지 시어 수 (누적 막대) */
  function flow(lines) {
    const total = lines.reduce((a, l) => a + l.hits.length, 0);
    if (!lines.length || !total) return '<div class="empty">감지된 시어가 없어 표시할 흐름이 없습니다.</div>';
    const bw = 28, H = 190, L = 30, T = 12, B = 28, W = Math.max(320, L + lines.length * bw + 10);
    const mx = Math.max(2, Math.max.apply(null, lines.map(l => l.hits.length)));
    const u = (H - T - B) / mx;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="행별 감정 흐름 누적 막대 차트">';
    for (let g = 0; g <= mx; g++) {
      const y = H - B - g * u;
      s += '<line x1="' + L + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" stroke="var(--rule)"/><text class="mu" x="' + (L - 6) + '" y="' + (y + 3) + '" font-size="9" text-anchor="end">' + g + '</text>';
    }
    lines.forEach((l, i) => {
      let y = H - B;
      const x = L + i * bw + 5;
      l.counts.forEach((c, ei) => {
        if (c > 0) {
          const h = c * u; y -= h;
          s += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 10) + '" height="' + (h - 1) + '" rx="2" fill="' + EMOS[ei].color + '"><title>' + l.no + '행 ' + esc(l.text) + ' — ' + EMOS[ei].name + ' ' + c + '</title></rect>';
        }
      });
      s += '<text class="mu" x="' + (x + (bw - 10) / 2) + '" y="' + (H - 12) + '" font-size="9" text-anchor="middle">' + l.no + '</text>';
    });
    s += '<text class="mu" x="' + (W - 4) + '" y="' + (H - 1) + '" font-size="9" text-anchor="end">행 번호</text></svg>';
    const used = EMOS.map((_, i) => i).filter(i => lines.some(l => l.counts[i]));
    return s + legendOf(used);
  }

  /* F-08 시어 → 정서 → 주제 */
  /* F-08 시어 → 정서 → 주제 */
  function diagram(poem, res) {
    const ems = EMOS.map((e, i) => ({ e: e, v: res.vec[i] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    if (!ems.length) return '<div class="empty">감지된 정서가 없어 다이어그램을 그릴 수 없습니다.</div>';
    const wc = {};
    res.lines.forEach(l => l.hits.forEach(h => { wc[h] = (wc[h] || 0) + 1; }));
    const words = Object.keys(wc).map(w => [w, wc[w]]).sort((a, b) => b[1] - a[1]).slice(0, 8);

    /* 주제 텍스트 자동 줄바꿈 (어절 기준, 최대 13자) */
    const th = poem.theme || '(직접 입력한 시: 사전 기반 분석)';
    const tLines = [];
    let curLine = '';
    th.split(/\s+/).forEach(tok => {
      if (!tok) return;
      if (!curLine) {
        while (tok.length > 13) { tLines.push(tok.slice(0, 13)); tok = tok.slice(13); }
        curLine = tok;
      } else if (curLine.length + 1 + tok.length <= 13) {
        curLine += ' ' + tok;
      } else {
        tLines.push(curLine);
        while (tok.length > 13) { tLines.push(tok.slice(0, 13)); tok = tok.slice(13); }
        curLine = tok;
      }
    });
    if (curLine) tLines.push(curLine);

    const W = 780, x1 = 150, x2 = 400, x3 = 580, bw = 16;
    const thH = Math.max(96, 48 + tLines.length * 18);
    let acc = 34;
    const slot = {};
    ems.forEach(x => { const h = Math.max(24, x.v * 250); slot[x.e.k] = { y: acc, h: h }; acc += h + 8; });
    const Hd = Math.max(280, words.length * 36 + 50, acc + 24, thH + 60);
    const wy = i => 36 + i * ((Hd - 76) / Math.max(words.length - 1, 1));
    const ty = Hd / 2 - thH / 2;

    let s = '<svg viewBox="0 0 ' + W + ' ' + Hd + '" width="100%" style="min-width:600px" role="img" aria-label="시어 정서 주제 다이어그램">';
    s += '<text class="mu" x="' + x1 + '" y="16" font-size="10" text-anchor="end">핵심 시어 (×등장 횟수)</text><text class="mu" x="' + x2 + '" y="16" font-size="10">정서 (막대 높이 = 비율)</text><text class="mu" x="' + x3 + '" y="16" font-size="10">주제</text>';
    words.forEach((w, i) => {
      const k = WORD2K[w[0]], sl = slot[k];
      if (!sl) return;
      const y1 = wy(i), y2 = sl.y + sl.h / 2, mxp = (x1 + x2) / 2 + 20;
      s += '<path d="M' + (x1 + 8) + ',' + y1 + ' C' + mxp + ',' + y1 + ' ' + mxp + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="' + emo(k).color + '" stroke-opacity=".55" stroke-width="' + (1.5 + w[1]) + '"/>';
      s += '<text x="' + x1 + '" y="' + (y1 + 4) + '" font-size="12" text-anchor="end">' + esc(w[0]) + ' <tspan class="mu" font-size="9">×' + w[1] + '</tspan></text>';
    });
    ems.forEach(x => {
      const sl = slot[x.e.k], midY = sl.y + sl.h / 2;
      s += '<rect x="' + x2 + '" y="' + sl.y + '" width="' + bw + '" height="' + sl.h + '" rx="3" fill="' + x.e.color + '"/>';
      s += '<text x="' + (x2 + bw + 6) + '" y="' + (midY + 4) + '" font-size="11">' + x.e.name + ' ' + pct(x.v) + '%</text>';
      s += '<path d="M' + (x2 + bw + 92) + ',' + midY + ' C' + (x3 - 28) + ',' + midY + ' ' + (x3 - 28) + ',' + (ty + thH / 2) + ' ' + x3 + ',' + (ty + thH / 2) + '" fill="none" stroke="' + x.e.color + '" stroke-opacity=".35" stroke-width="' + Math.max(2, x.v * 20) + '"/>';
    });
    s += '<rect x="' + x3 + '" y="' + ty + '" width="190" height="' + thH + '" rx="10" fill="none" stroke="var(--rule)" stroke-width="1.5"/>';
    tLines.forEach((line, r) => {
      s += '<text x="' + (x3 + 12) + '" y="' + (ty + 24 + r * 18) + '" font-size="12.5" font-family="var(--serif)">' + esc(line) + '</text>';
    });
    s += '<text class="mu" x="' + (x3 + 12) + '" y="' + (ty + thH - 12) + '" font-size="10">지배 정서 · ' + ems[0].e.name + ' ' + pct(ems[0].v) + '%</text></svg>';
    if (!words.length) s += '<div class="note">이 시에서는 감정 사전에 맞는 시어가 감지되지 않아, 해석 프로필의 정서만 표시했습니다.</div>';
    return s;
  }

  /* F-10 전체 비교 히트맵 */
  function heat(poems, results, curId) {
    let h = '<table class="heat"><tr><th></th>' + EMOS.map(e => '<th><span style="color:' + e.color + '">●</span> ' + e.name + '</th>').join('') + '</tr>';
    poems.forEach(p => {
      const v = results[p.id].vec;
      h += '<tr class="' + (p.id === curId ? 'cur' : '') + '"><td class="t" data-id="' + p.id + '" tabindex="0">' + esc(p.title) + '</td>' +
        v.map(x => '<td style="background:rgba(178,58,42,' + Math.min(0.85, x * 1.4).toFixed(2) + ');color:' + (x > 0.38 ? '#fff' : 'inherit') + '">' + (x > 0 ? pct(x) : '–') + '</td>').join('') + '</tr>';
    });
    return h + '</table>';
  }

  /* F-12 감성 지도 (PCA) */
  function map(items, results, curId, recIds) {
    const ok = items.filter(p => results[p.id].vec.some(x => x > 0));
    if (ok.length < 3) return { svg: '<div class="empty">감정 벡터가 있는 시가 3편 이상일 때 표시됩니다.</div>', note: '' };
    const P = Engine.pca(ok.map(p => results[p.id].vec));
    const xs = P.pts.map(p => p[0]), ys = P.pts.map(p => p[1]);
    const rng = a => { const lo = Math.min.apply(null, a), hi = Math.max.apply(null, a), m = (hi - lo || 1) * 0.12; return [lo - m, hi + m]; };
    const xr = rng(xs), yr = rng(ys), W = 400, H = 320, pad = 24;
    const sx = x => pad + (x - xr[0]) / (xr[1] - xr[0]) * (W - 2 * pad);
    const sy = y => H - pad - (y - yr[0]) / (yr[1] - yr[0]) * (H - 2 * pad);
    const pos = {};
    ok.forEach((p, i) => { pos[p.id] = [sx(P.pts[i][0]), sy(P.pts[i][1])]; });
    const ex = (v, sign, n) => EMOS.map((e, i) => ({ n: e.name, l: v[i] * sign })).sort((a, b) => b.l - a.l).slice(0, n);
    const lab = (v, sign) => ex(v, sign, 2).map(x => x.n).join('·');
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="감정 벡터 PCA 감성 지도"><rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" fill="none" stroke="var(--rule)"/>';
    s += '<line x1="' + sx(0) + '" x2="' + sx(0) + '" y1="' + pad + '" y2="' + (H - pad) + '" stroke="var(--rule)" stroke-dasharray="3 3"/><line y1="' + sy(0) + '" y2="' + sy(0) + '" x1="' + pad + '" x2="' + (W - pad) + '" stroke="var(--rule)" stroke-dasharray="3 3"/>';
    s += '<text class="mu" font-size="9" x="' + (pad + 2) + '" y="' + (sy(0) - 4) + '">← ' + lab(P.axes[0].v, -1) + '</text><text class="mu" font-size="9" text-anchor="end" x="' + (W - pad - 2) + '" y="' + (sy(0) - 4) + '">' + lab(P.axes[0].v, 1) + ' →</text>';
    s += '<text class="mu" font-size="9" text-anchor="middle" x="' + (sx(0)) + '" y="' + (H - 8) + '">↓ ' + lab(P.axes[1].v, -1) + '</text><text class="mu" font-size="9" text-anchor="middle" x="' + sx(0) + '" y="' + 14 + '">↑ ' + lab(P.axes[1].v, 1) + '</text>';
    if (pos[curId]) (recIds || []).forEach(id => { if (pos[id]) s += '<line x1="' + pos[curId][0] + '" y1="' + pos[curId][1] + '" x2="' + pos[id][0] + '" y2="' + pos[id][1] + '" stroke="var(--seal)" stroke-opacity=".5" stroke-width="1.4"/>'; });
    ok.forEach(p => {
      const r = results[p.id], c = r.dominant ? emo(r.dominant).color : '#999', cur = p.id === curId, pp = pos[p.id];
      s += '<g data-id="' + p.id + '" style="cursor:pointer"><circle cx="' + pp[0] + '" cy="' + pp[1] + '" r="' + (cur ? 8 : 5.5) + '" fill="' + c + '" stroke="' + (cur ? 'var(--ink)' : 'var(--card)') + '" stroke-width="' + (cur ? 2.5 : 1) + '"><title>' + esc(p.title) + '</title></circle>' +
        '<text font-size="9.5" x="' + (pp[0] + 9) + '" y="' + (pp[1] + 3) + '">' + esc(p.title.length > 8 ? p.title.slice(0, 8) + '…' : p.title) + '</text></g>';
    });
    s += '</svg><div class="legend">점 색 = 지배 정서 · ' + EMOS.map(e => '<span><i style="background:' + e.color + '"></i>' + e.name + '</span>').join('') + '</div>';
    const ax = (a, name) => {
      const up = ex(a.v, 1, 3).map(x => x.n + ' ' + (x.l >= 0 ? '+' : '') + x.l.toFixed(2)).join(', ');
      const dn = ex(a.v, -1, 3).map(x => x.n + ' ' + (x.l >= 0 ? '+' : '') + x.l.toFixed(2)).join(', ');
      return '<b>' + name + '</b> (설명력 ' + pct(a.share) + '%) — 한쪽 끝: ' + up + ' / 반대쪽 끝: ' + dn;
    };
    return { svg: s, note: ax(P.axes[0], '가로축') + '<br>' + ax(P.axes[1], '세로축') + '<br>가까운 점일수록 감정 구성이 비슷합니다. 붉은 선은 추천 3편과의 연결입니다.' };
  }

  return { radar: radar, flow: flow, diagram: diagram, heat: heat, map: map, esc: esc, pct: pct, legendOf: legendOf };
})();
