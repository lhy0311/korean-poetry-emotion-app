/* app.js — 상태, 화면 그리기, 이벤트 */
(function () {
  'use strict';
  const { EMOS, EIDX, WORD2K, mkRe, analyze, cos } = Engine;
  const { esc, pct } = Charts;
  const $ = id => document.getElementById(id);
  const emo = k => EMOS[EIDX[k]];

  const S = { w: 0.4, id: POEMS[0].id, custom: null, res: {}, seed: 0 };
  const all = () => (S.custom ? POEMS.concat([S.custom]) : POEMS);
  const cur = () => all().find(p => p.id === S.id) || POEMS[0];

  function recompute() { S.res = {}; all().forEach(p => { S.res[p.id] = analyze(p, S.w); }); }

  /* F-09: 선택한 시를 뺀 15편 중 코사인 유사도 상위 3편 */
  function recommend(id, vec) {
    return POEMS.filter(q => q.id !== id && S.res[q.id].vec.some(x => x > 0))
      .map(q => ({ poem: q, vec: S.res[q.id].vec, sim: cos(vec, S.res[q.id].vec) }))
      .sort((a, b) => b.sim - a.sim).slice(0, 3);
  }

  /* F-01 책장 */
  function renderShelf() {
    $('shelf').innerHTML = POEMS.map(p => {
      const d = S.res[p.id].dominant, c = d ? emo(d).color : '#999';
      return '<button type="button" class="spine" style="--c:' + c + '" data-id="' + p.id + '" aria-pressed="' + (p.id === S.id) + '" title="' + esc(p.title + ' · ' + p.poet + (d ? ' · ' + emo(d).name : '')) + '">' +
        '<span class="t">' + esc(p.title) + '</span><span class="p">' + esc(p.poet) + '</span></button>';
    }).join('');
    $('shelf').querySelectorAll('.spine').forEach(b => b.addEventListener('click', () => select(b.dataset.id)));
    const on = $('shelf').querySelector('[aria-pressed="true"]');
    if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /* F-02 본문 + 시어 형광 표시 */
  function renderSheet(p, r) {
    const head = '<h2 class="title">' + esc(p.title) + '</h2><div class="byline">' + esc(p.poet) + (p.year ? ' · ' + esc(p.year) + '년' : '') + '</div>';
    const stanzas = (p.text || '').trim().split(/\n\s*\n/).filter(s => s.trim());
    if (!stanzas.length) return head + '<div class="empty">본문이 아직 입력되지 않았습니다.<br>poems.js의 text에 출처에서 확인한 원문을 붙여넣어 주세요.</div>';
    let html = head;
    stanzas.forEach(st => {
      html += '<div class="stanza">';
      st.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
        const re = mkRe(); let last = 0, m, o = '';
        while ((m = re.exec(l))) {
          const e = emo(WORD2K[m[0]]);
          o += esc(l.slice(last, m.index)) + '<mark style="--c:' + e.color + '" title="' + e.name + '">' + esc(m[0]) + '</mark>';
          last = m.index + m[0].length;
        }
        html += '<div class="line">' + o + esc(l.slice(last)) + '</div>';
      });
      html += '</div>';
    });
    const used = []; r.lines.forEach(l => l.hits.forEach(h => { const i = EIDX[WORD2K[h]]; if (used.indexOf(i) < 0) used.push(i); }));
    return html + '<div class="legend"><span>감지된 시어:</span>' + (used.length ? used.map(i => '<span><i style="background:' + EMOS[i].color + '"></i>' + EMOS[i].name + '</span>').join('') : '<span>없음</span>') + '</div>';
  }

  /* F-03, F-05 지배 정서 · 감정 비율 · 주제 · 해석 */
  function renderReading(p, r) {
    const hasText = (p.text || '').trim().length > 0;
    if (!r.dominant) {
      return '<div class="empty">' + (hasText ? '감지된 시어가 없습니다. 감정 사전에 시어를 추가하거나 다른 시를 선택해 보세요.' : '본문이 비어 있어 분석할 수 없습니다.') + '</div>';
    }
    const order = EMOS.map((e, i) => ({ e: e, v: r.vec[i] })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const top = order[0], sec = order[1];
    const interp = p.interp || '감정 사전으로 분석한 결과입니다. 사전 기반 분석은 반어나 역설을 읽지 못하므로 시의 문맥과 함께 확인해야 합니다.';
    return '<div class="note">지배 정서</div>' +
      '<div class="domrow"><div class="dom-seal" style="--c:' + top.e.color + '"><span>' + top.e.name + '<small>' + pct(top.v) + '%</small></span></div>' +
      '<div>' + (sec ? '<span class="pill">2위 ' + sec.e.name + ' ' + pct(sec.v) + '%</span>' : '') + '<div class="note">' + (r.method === 'hybrid' ? '해석 프로필 + 감정 사전 (사전 ' + Math.round(S.w * 100) + '%)' : '감정 사전만 사용') + '</div></div></div>' +
      order.map(x => '<div class="bar"><span>' + x.e.name + '</span><span class="t"><i style="width:' + pct(x.v) + '%;background:' + x.e.color + '"></i></span><span class="v">' + pct(x.v) + '%</span></div>').join('') +
      '<dl class="meta"><dt>주제</dt><dd>' + esc(p.theme || '—') + '</dd><dt>화자</dt><dd>' + esc(p.speaker || '—') + '</dd><dt>표현</dt><dd>' + esc(p.devices || '—') + '</dd></dl>' +
      '<div class="note">감상과 해석</div><p class="interp">' + esc(interp) + '</p>';
  }

  /* F-13 감정 이미지 */
  function renderArt(p, r, force) {
    const cv = $('cv'), ok = r.vec.some(x => x > 0);
    const phrase = Art.pickPhrase(p, r.lines);
    const motifs = Art.motifsOf(p);
    const order = EMOS.map((e, i) => ({ e: e, v: r.vec[i] })).filter(x => x.v > 0.01).sort((a, b) => b.v - a.v);
    $('promptBox').value = ok ? Art.buildPrompt({ poem: p, order: order, phrase: phrase.text, motifs: motifs }) : '';
    if (!ok) {
      cv.width = 720; cv.height = 960; cv.getContext('2d').clearRect(0, 0, 720, 960);
      $('artChips').innerHTML = ''; $('artRules').innerHTML = '<li>감지된 정서가 없어 그림을 그릴 수 없습니다.</li>';
      return;
    }
    const res = Art.paint(cv, { poem: p, vec: r.vec, emos: EMOS, motifs: motifs, phrase: phrase.text, seed: S.seed });
    $('artChips').innerHTML = res.order.slice(0, 4).map(x => '<span class="chip"><i style="background:' + x.e.color + '"></i>' + x.e.name + ' ' + pct(x.v) + '%</span>').join('') +
      motifs.map(m => '<span class="chip">소재 · ' + esc(m) + '</span>').join('');
    $('artRules').innerHTML = res.rules.map(t => '<li>' + esc(t) + '</li>').join('') +
      '<li>소재: ' + (motifs.length ? esc(motifs.join(', ')) : '없음 (색과 붓질만)') + '</li>' +
      '<li>글씨: ' + esc(phrase.from) + '을 세로로 썼습니다</li>';
  }

  function renderRec(p, r) {
    const el = $('rec');
    if (!r.vec.some(x => x > 0)) { el.innerHTML = '<div class="empty" style="grid-column:1/-1">감정 벡터가 없어 추천할 수 없습니다.</div>'; return []; }
    const rs = recommend(p.id, r.vec);
    el.innerHTML = rs.map((q, i) => {
      const common = EMOS.filter((e, j) => r.vec[j] > 0.05 && q.vec[j] > 0.05).map(e => e.name).join(', ') || '—';
      return '<button type="button" class="rc" data-id="' + q.poem.id + '"><div class="note">추천 ' + (i + 1) + '</div><b>' + esc(q.poem.title) + '</b>' +
        '<div class="note">' + esc(q.poem.poet) + (q.poem.theme ? ' · ' + esc(q.poem.theme) : '') + '</div>' +
        '<div style="color:var(--seal);font-weight:700;font-size:.85rem">유사도 ' + pct(q.sim) + '%</div><div class="sim"><i style="width:' + pct(q.sim) + '%"></i></div>' +
        '<div class="note">공통 정서: ' + common + '</div></button>';
    }).join('');
    el.querySelectorAll('.rc').forEach(b => b.addEventListener('click', () => { select(b.dataset.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
    return rs;
  }

  function renderFooter() {
    const rows = POEMS.map(p => '<tr><td>' + esc(p.title) + '</td><td>' + esc(p.poet) + '</td><td>' + esc(p.year) + '</td><td>' + p.poetDeath + '</td><td>' + (p.source ? esc(p.source) : '(출처 미입력)') + '</td></tr>').join('');
    $('foot').innerHTML = '수록 작품은 모두 시인 사망 연도가 1962년 이전인 작품입니다. 감정 사전 분석은 단어 일치에 기반하므로 반어·비유·문맥을 읽지 못합니다.' +
      '<details><summary>본문 출처 보기</summary><div class="scroll"><table><tr><th>제목</th><th>시인</th><th>발표</th><th>사망</th><th>출처</th></tr>' + rows + '</table></div></details>';
  }

  function renderAll() {
    recompute();
    const p = cur(), r = S.res[p.id];
    renderShelf();
    $('sheet').innerHTML = renderSheet(p, r);
    $('reading').innerHTML = renderReading(p, r);
    const rs = renderRec(p, r);
    const rec1 = rs[0];
    $('radar').innerHTML = r.vec.some(x => x > 0) ? Charts.radar(r.vec, rec1 ? rec1.vec : null, '「' + p.title + '」', rec1 ? '「' + rec1.poem.title + '」' : '') : '<div class="empty">감지된 정서가 없어 차트를 그릴 수 없습니다.</div>';
    $('flow').innerHTML = Charts.flow(r.lines);
    $('diagram').innerHTML = Charts.diagram(p, r);
    renderArt(p, r);
    $('heat').innerHTML = Charts.heat(POEMS, S.res, S.id);
    const m = Charts.map(all(), S.res, S.id, rs.map(x => x.poem.id));
    $('map').innerHTML = m.svg; $('mapnote').innerHTML = m.note;
    $('heat').querySelectorAll('td.t').forEach(td => {
      td.addEventListener('click', () => select(td.dataset.id));
      td.addEventListener('keydown', e => { if (e.key === 'Enter') select(td.dataset.id); });
    });
    $('map').querySelectorAll('g[data-id]').forEach(g => g.addEventListener('click', () => select(g.getAttribute('data-id'))));
    renderFooter();
  }

  function select(id) { S.id = id; S.seed = 0; renderAll(); }

  /* 탭 */
  function setTab(which) {
    const ink = which === 'ink';
    $('tab-ink').setAttribute('aria-selected', ink); $('tab-ai').setAttribute('aria-selected', !ink);
    $('pane-ink').hidden = !ink; $('pane-ai').hidden = ink;
  }
  $('tab-ink').addEventListener('click', () => setTab('ink'));
  $('tab-ai').addEventListener('click', () => setTab('ai'));

  $('redraw').addEventListener('click', () => { S.seed++; const p = cur(); renderArt(p, S.res[p.id]); });
  $('savePng').addEventListener('click', () => {
    $('cv').toBlob(b => {
      if (!b) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = cur().title + '_감정이미지.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  });

  /* AI 이미지 탭 */
  function copyPrompt() {
    const t = $('promptBox').value;
    const fallback = () => { $('promptBox').select(); try { return document.execCommand('copy'); } catch (e) { return false; } };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fallback());
    return Promise.resolve(fallback());
  }
  $('copyOnly').addEventListener('click', () => copyPrompt().then(ok => { $('aiMsg').textContent = ok ? '프롬프트를 복사했습니다.' : '복사하지 못했습니다. 상자 안의 글을 직접 선택해 복사해 주세요.'; }));
  $('copyOpen').addEventListener('click', () => {
    if (!$('promptBox').value) { $('aiMsg').textContent = '감지된 정서가 없어 프롬프트를 만들 수 없습니다.'; return; }
    copyPrompt().then(ok => {
      $('aiMsg').textContent = ok ? '프롬프트를 복사했습니다. 새 탭의 입력창에 붙여넣으세요(Ctrl+V).' : '복사하지 못했습니다. 상자 안의 글을 직접 복사해 새 탭에 붙여넣어 주세요.';
      window.open('https://gemini.google.com/app', '_blank', 'noopener');
    });
  });
  $('loadImg').addEventListener('click', () => $('fileIn').click());
  $('fileIn').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { $('aiMsg').textContent = '이미지 파일만 불러올 수 있습니다.'; return; }
    const rd = new FileReader();
    rd.onload = () => { $('aiBox').innerHTML = '<img alt="불러온 AI 이미지">'; $('aiBox').firstChild.src = rd.result; $('aiMsg').textContent = '이미지를 불러왔습니다. 수묵화 탭과 오가며 비교해 보세요.'; };
    rd.readAsDataURL(f);
  });
  $('quickGen').addEventListener('click', () => {
    const t = $('promptBox').value.trim();
    if (!t) { $('aiMsg').textContent = '감지된 정서가 없어 프롬프트를 만들 수 없습니다.'; return; }
    $('aiBox').innerHTML = '<div class="ph">그림을 만드는 중입니다… (외부 무료 서비스라 오래 걸리거나 실패할 수 있습니다)</div>';
    const img = new Image(); img.alt = '빠른 생성 이미지';
    img.onload = () => { $('aiBox').innerHTML = ''; $('aiBox').appendChild(img); $('aiMsg').textContent = '무료 빠른 생성 결과입니다(품질 낮음). 더 좋은 결과는 Gemini에서 만들어 보세요.'; };
    img.onerror = () => { $('aiBox').innerHTML = '<div class="ph">이미지를 만들지 못했습니다. 잠시 뒤 다시 시도하거나 Gemini를 이용해 주세요.</div>'; };
    img.src = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(t) + '?width=768&height=1024&nologo=true&seed=' + (S.seed + 1);
  });

  /* F-14 가중치 */
  $('wrange').addEventListener('input', e => { S.w = e.target.value / 100; $('wlabel').textContent = e.target.value + '%'; renderAll(); });

  /* F-11 내 시 분석 */
  const dlg = $('dlg');
  $('openCustom').addEventListener('click', () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
  $('cclose').addEventListener('click', () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); });
  $('cbtn').addEventListener('click', () => {
    const t = $('ctext').value.trim();
    if (!t) { $('cmsg').textContent = '시 본문을 입력해 주세요. 빈 입력은 분석하지 않습니다.'; return; }
    S.custom = { id: 'custom', title: $('ctitle').value.trim() || '제목 없음', poet: '직접 입력', year: '', poetDeath: null, text: t, theme: '', interp: '', source: '', motifs: [] };
    S.id = 'custom'; S.seed = 0;
    $('cmsg').textContent = '분석했습니다. 직접 입력한 시는 감정 사전으로만 분석합니다.';
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    renderAll();
    $('sheet').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* 글꼴이 로드된 뒤 수묵화 글씨가 제대로 나오도록 한 번 더 그린다 */
  renderAll();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('700 34px "Nanum Myeongjo"'), document.fonts.load('800 38px "Nanum Myeongjo"')])
      .then(() => { const p = cur(); renderArt(p, S.res[p.id]); }).catch(() => {});
  }
})();
