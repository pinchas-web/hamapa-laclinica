// הופעה עדינה בגלילה, והמפה האינטראקטיבית: שביל שמצטייר, תחנות שנחתמות, ומפה אישית בסוף.
document.addEventListener('DOMContentLoaded', () => {
  // ---------- הופעה בגלילה, פעם אחת ----------
  const items = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(el => io.observe(el));
  } else items.forEach(el => el.classList.add('in'));

  // ---------- המפה ----------
  const DRAFT = 'clinic-map-draft';
  const trail = document.querySelector('.trail');
  if (!trail) return;
  const stations = [...trail.querySelectorAll('.station')];
  const svg = trail.querySelector('.trail__svg');
  const base = svg.querySelector('.trail__base');
  const done = svg.querySelector('.trail__done');
  const reveal = svg.querySelector('.trail__reveal');
  const walker = trail.querySelector('.walker');
  const countEl = document.querySelector('.js-count');
  const dots = [...document.querySelectorAll('.progress__dots i')];
  const summary = document.querySelector('.js-summary');
  const finaleForm = document.querySelector('form[data-lead]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const read = () => { try { return JSON.parse(localStorage.getItem(DRAFT)) || {}; } catch { return {}; } };
  const save = d => { try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* בלי שמירה */ } };
  const draft = read();

  const answerOf = st => {
    const ta = st.querySelector('.station__input');
    if (ta) return ta.value.trim();
    return [...st.querySelectorAll('.chips li[aria-pressed="true"]')].map(li => li.textContent.trim()).join(', ');
  };

  // נקודות העצירה של השביל: מרכז הסיכה של כל תחנה
  let points = [], len = 0, anchors = [];
  function layout() {
    const box = trail.getBoundingClientRect();
    points = stations.map(st => {
      const r = st.querySelector('.station__pin').getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    });
    const last = points[points.length - 1];
    const fin = document.getElementById('finale').getBoundingClientRect();
    points.push([box.width / 2, Math.min(fin.top - box.top + 20, last[1] + 260)]);
    let d = `M ${points[0][0]} ${points[0][1] - 90} L ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      const my = (y0 + y1) / 2;
      d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`;
    }
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    [base, done, reveal].forEach(p => p.setAttribute('d', d));
    len = base.getTotalLength();
    reveal.style.strokeDasharray = `${len} ${len}`;
    // אורך השביל עד כל תחנה
    anchors = points.map(([, y]) => {
      let lo = 0, hi = len;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (base.getPointAtLength(mid).y < y) lo = mid; else hi = mid; }
      return hi;
    });
    paint();
  }

  // השביל מצטייר לפי הגלילה, והנקודה עומדת בתחנה שהגעת אליה
  let current = 0;
  function paint() {
    if (!len) return;
    const box = trail.getBoundingClientRect();
    const view = innerHeight * 0.62;
    const y = Math.max(0, Math.min(box.height, view - box.top));
    let lo = 0, hi = len;
    for (let k = 0; k < 20; k++) { const mid = (lo + hi) / 2; if (base.getPointAtLength(mid).y < y) lo = mid; else hi = mid; }
    reveal.style.strokeDashoffset = reduce ? 0 : len - hi;
    const at = base.getPointAtLength(Math.max(0, (anchors[current] ?? 0) - 78));
    walker.style.transform = `translate(${at.x}px, ${at.y}px)`;
  }

  function update() {
    const sealed = stations.filter(s => s.classList.contains('is-sealed')).length;
    countEl.textContent = sealed;
    dots.forEach((d, i) => d.classList.toggle('on', i < sealed));
    const next = stations.findIndex(s => !s.classList.contains('is-sealed'));
    current = next === -1 ? stations.length : next;
    stations.forEach((s, i) => s.classList.toggle('is-active', i === current));
    paint();
    // המפה האישית
    summary.replaceChildren(...stations.map(st => {
      const li = document.createElement('li');
      const small = document.createElement('small');
      small.textContent = st.querySelector('.station__prompt').textContent.replace(/\(.*?\)/g, '').trim();
      const span = document.createElement('span');
      const a = answerOf(st);
      span.textContent = a || 'עוד לא מילאת';
      if (!a) span.className = 'empty';
      li.classList.toggle('is-done', st.classList.contains('is-sealed'));
      li.append(small, span);
      return li;
    }));
    // ההודעה שנשמרת עם הפנייה
    const msg = finaleForm.querySelector('[name="message"]');
    msg.value = 'המפה לקליניקה:\n' + stations.map((st, i) =>
      `${i + 1}. ${st.querySelector('.station__title').textContent.trim()}: ${answerOf(st) || '—'}`).join('\n');
  }

  function persist() {
    const d = {};
    stations.forEach(st => {
      const n = st.dataset.step;
      const ta = st.querySelector('.station__input');
      d[n] = { a: ta ? ta.value : answerOf(st), sealed: st.classList.contains('is-sealed') };
    });
    save(d);
  }

  function seal(st, on, quiet) {
    st.classList.toggle('is-sealed', on);
    const ta = st.querySelector('.station__input');
    if (ta) ta.readOnly = on;
    st.querySelector('.station__edit').hidden = !on;
    if (on && !quiet) {
      const i = stations.indexOf(st);
      const nxt = stations[i + 1] || document.getElementById('finale');
      setTimeout(() => {
        nxt.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        const f = nxt.querySelector('.station__input, .chips li, input[name="name"]');
        if (f && f.tagName !== 'LI') f.focus({ preventScroll: true });
      }, reduce ? 0 : 650);
    }
  }

  stations.forEach(st => {
    const ta = st.querySelector('.station__input');
    const foot = st.querySelector('.station__foot');
    const hint = document.createElement('span');
    hint.className = 'station__hint';
    hint.setAttribute('role', 'status');
    foot.append(hint);

    // ערוצי שיווק: בוחרים עד שניים
    const chips = st.querySelector('.chips');
    if (chips) {
      const sync = () => chips.querySelectorAll('li').forEach(li => {
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        if (!li.hasAttribute('aria-pressed')) li.setAttribute('aria-pressed', 'false');
      });
      sync();
      new MutationObserver(sync).observe(chips, { childList: true });
      const toggle = li => {
        if (st.classList.contains('is-sealed')) return;
        const on = li.getAttribute('aria-pressed') === 'true';
        const picked = chips.querySelectorAll('li[aria-pressed="true"]').length;
        if (!on && picked >= 2) { hint.textContent = 'שניים מספיקים. אפשר להחליף'; return; }
        li.setAttribute('aria-pressed', String(!on));
        hint.textContent = '';
        update(); persist();
      };
      chips.addEventListener('click', e => { const li = e.target.closest('li'); if (li) toggle(li); });
      chips.addEventListener('keydown', e => {
        const li = e.target.closest('li');
        if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(li); }
      });
    }

    if (ta) ta.addEventListener('input', () => { hint.textContent = ''; update(); persist(); });

    st.querySelector('.btn--seal').addEventListener('click', () => {
      const a = answerOf(st);
      if (a.length < 2) { hint.textContent = chips ? 'בחרו לפחות ערוץ אחד' : 'כתבו כמה מילים, ואז חותמים'; (ta || chips.querySelector('li')).focus(); return; }
      hint.textContent = '';
      seal(st, true); update(); persist();
    });
    st.querySelector('.station__edit').addEventListener('click', () => {
      seal(st, false); update(); persist();
      if (ta) ta.focus();
    });
  });

  // משחזרים טיוטה קודמת מאותו דפדפן
  stations.forEach(st => {
    const s = draft[st.dataset.step];
    if (!s) return;
    const ta = st.querySelector('.station__input');
    if (ta) ta.value = s.a || '';
    else if (s.a) {
      const picked = s.a.split(',').map(x => x.trim());
      st.querySelectorAll('.chips li').forEach(li => li.setAttribute('aria-pressed', String(picked.includes(li.textContent.trim()))));
    }
    if (s.sealed && s.a) seal(st, true, true);
  });

  update();
  requestAnimationFrame(layout);
  addEventListener('load', layout);
  addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 120); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(layout.t); layout.t = setTimeout(layout, 120); }).observe(trail);
  addEventListener('scroll', () => requestAnimationFrame(paint), { passive: true });

  // אחרי שליחה: שומרים את המפה כ-PDF
  document.addEventListener('lead:sent', e => {
    if (e.target === finaleForm) { const n = finaleForm.querySelector('[name="name"]').value.trim(); if (n) document.querySelector('.finale__title').textContent = `הגעת ליעד, ${n}. זאת המפה שלך.`; }
  });
  document.querySelector('.js-print')?.addEventListener('click', () => print());

  // כפתורי המסלולים בוחרים מראש את המסלול בטופס
  document.querySelectorAll('[data-pick]').forEach(a => a.addEventListener('click', () => {
    const sel = document.querySelector('#lead-form [name="service"]');
    if (sel) sel.selectedIndex = Number(a.dataset.pick);
  }));
});
