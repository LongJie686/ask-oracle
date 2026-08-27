/* 阅读站前端。数据来自 data/book.js（window.BOOK），无网络请求，file:// 也能跑。 */
(function () {
  'use strict';

  var BOOK = window.BOOK;
  if (!BOOK || !BOOK.index || !BOOK.index.length) {
    document.getElementById('article').innerHTML =
      '<p>没有读到章节数据。请先运行 <code>python -X utf8 build_site.py</code> 重新生成。</p>';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    progress: $('progress').firstElementChild,
    topbar: $('topbar'), chapTitle: $('chapTitle'),
    toc: $('toc'), tocList: $('tocList'), tocSearch: $('tocSearch'), tocStats: $('tocStats'),
    settings: $('settings'), scrim: $('scrim'),
    article: $('article'), main: $('main'),
    prev: $('btnPrev'), next: $('btnNext'), pagerInfo: $('pagerInfo'),
    fsVal: $('fsVal'), lhVal: $('lhVal'), wVal: $('wVal')
  };

  // ---------- 偏好 ----------
  var KEY = 'askoracle.reader.v1';
  var DEFAULTS = { theme: 'night', font: 'song', fs: 19, lh: 1.95, w: 34, idx: 0, scroll: 0, seen: [] };
  var prefs = load();

  function load() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { p = {}; }
    var out = {};
    for (var k in DEFAULTS) out[k] = (p && p[k] !== undefined) ? p[k] : DEFAULTS[k];
    if (!Array.isArray(out.seen)) out.seen = [];
    return out;
  }
  var saveTimer = null;
  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* 隐私模式下写不进，忽略 */ }
    }, 250);
  }

  var LIMITS = { fs: [14, 26, 1], lh: [1.5, 2.4, .05], w: [26, 46, 2] };
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function applyPrefs() {
    var r = document.documentElement;
    r.setAttribute('data-theme', prefs.theme);
    r.setAttribute('data-font', prefs.font);
    r.style.setProperty('--fs', prefs.fs + 'px');
    r.style.setProperty('--lh', String(prefs.lh));
    r.style.setProperty('--measure', prefs.w + 'em');
    el.fsVal.textContent = prefs.fs;
    el.lhVal.textContent = prefs.lh.toFixed(2);
    el.wVal.textContent = prefs.w;
    each('#themeSeg button', function (b) { b.classList.toggle('on', b.dataset.theme === prefs.theme); });
    each('#fontSeg button', function (b) { b.classList.toggle('on', b.dataset.font === prefs.font); });
  }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  // ---------- 目录 ----------
  var items = BOOK.index;
  var liByIdx = [];

  function buildToc() {
    var frag = document.createDocumentFragment();
    items.forEach(function (it, i) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="num">' + it.n + '</span><span class="name"></span>';
      li.querySelector('.name').textContent = it.title;
      li.title = it.title;
      li.addEventListener('click', function () { open(i, true); closeToc(); });
      frag.appendChild(li);
      liByIdx.push(li);
    });
    el.tocList.appendChild(frag);
    el.tocStats.textContent = '共 ' + BOOK.stats.chapters + ' 章 · ' +
      (BOOK.stats.words / 10000).toFixed(1) + ' 万字';
  }

  function markToc() {
    liByIdx.forEach(function (li, i) {
      li.classList.toggle('active', i === prefs.idx);
      li.classList.toggle('read', prefs.seen.indexOf(items[i].id) !== -1 && i !== prefs.idx);
    });
  }

  el.tocSearch.addEventListener('input', function () {
    var q = this.value.trim();
    liByIdx.forEach(function (li, i) {
      var hit = !q || items[i].title.indexOf(q) !== -1 || String(items[i].n).indexOf(q) === 0;
      li.hidden = !hit;
    });
  });

  // ---------- 章节 ----------
  function open(i, toTop) {
    i = clamp(i, 0, items.length - 1);
    var it = items[i];
    var data = BOOK.chapters[it.id];
    if (!data) return;

    prefs.idx = i;
    if (prefs.seen.indexOf(it.id) === -1) prefs.seen.push(it.id);

    el.article.innerHTML = '<h1>第' + it.n + '章　' + escapeHtml(it.title) + '</h1>' + data.html;
    el.chapTitle.textContent = '第' + it.n + '章 ' + it.title;
    document.title = it.title + ' · ' + BOOK.title;
    el.pagerInfo.textContent = it.n + ' / ' + items[items.length - 1].n;
    el.prev.disabled = i === 0;
    el.next.disabled = i === items.length - 1;

    markToc();
    var active = liByIdx[i];
    if (active) active.scrollIntoView({ block: 'nearest' });

    if (toTop !== false) {
      window.scrollTo(0, 0);
      prefs.scroll = 0;
    }
    save();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- 抽屉与面板 ----------
  function openToc() { el.toc.classList.add('open'); el.toc.setAttribute('aria-hidden', 'false'); el.scrim.hidden = false; }
  function closeToc() { el.toc.classList.remove('open'); el.toc.setAttribute('aria-hidden', 'true'); maybeHideScrim(); }
  function openSet() { el.settings.classList.add('open'); el.settings.setAttribute('aria-hidden', 'false'); el.scrim.hidden = false; }
  function closeSet() { el.settings.classList.remove('open'); el.settings.setAttribute('aria-hidden', 'true'); maybeHideScrim(); }
  function maybeHideScrim() {
    if (!el.toc.classList.contains('open') && !el.settings.classList.contains('open')) el.scrim.hidden = true;
  }

  $('btnToc').addEventListener('click', function () {
    closeSet();
    el.toc.classList.contains('open') ? closeToc() : openToc();
  });
  $('btnSet').addEventListener('click', function () {
    closeToc();
    el.settings.classList.contains('open') ? closeSet() : openSet();
  });
  el.scrim.addEventListener('click', function () { closeToc(); closeSet(); });

  // ---------- 设置交互 ----------
  each('#themeSeg button', function (b) {
    b.addEventListener('click', function () { prefs.theme = b.dataset.theme; applyPrefs(); save(); });
  });
  each('#fontSeg button', function (b) {
    b.addEventListener('click', function () { prefs.font = b.dataset.font; applyPrefs(); save(); });
  });
  el.settings.addEventListener('click', function (e) {
    var act = e.target && e.target.dataset ? e.target.dataset.act : null;
    if (!act) return;
    var key = act.slice(0, -1), dir = act.slice(-1) === '+' ? 1 : -1;
    var lim = LIMITS[key === 'w' ? 'w' : key];
    if (!lim) return;
    var v = prefs[key] + dir * lim[2];
    prefs[key] = Math.round(clamp(v, lim[0], lim[1]) * 100) / 100;
    applyPrefs(); save();
  });
  $('btnReset').addEventListener('click', function () {
    ['theme', 'font', 'fs', 'lh', 'w'].forEach(function (k) { prefs[k] = DEFAULTS[k]; });
    applyPrefs(); save();
  });

  // ---------- 翻页 ----------
  el.prev.addEventListener('click', function () { open(prefs.idx - 1); });
  el.next.addEventListener('click', function () { open(prefs.idx + 1); });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') {
      if (e.key === 'Escape') { e.target.blur(); closeToc(); }
      return;
    }
    switch (e.key) {
      case 'ArrowLeft': open(prefs.idx - 1); break;
      case 'ArrowRight': open(prefs.idx + 1); break;
      case 't': case 'T': el.toc.classList.contains('open') ? closeToc() : (closeSet(), openToc()); break;
      case 's': case 'S': el.settings.classList.contains('open') ? closeSet() : (closeToc(), openSet()); break;
      case 'Escape': closeToc(); closeSet(); break;
      case ' ':
        e.preventDefault();
        window.scrollBy({ top: window.innerHeight - 96, behavior: 'smooth' });
        break;
      default: return;
    }
  });

  // ---------- 滚动：进度条、顶栏让位、记住位置 ----------
  var lastY = 0, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || document.documentElement.scrollTop;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      el.progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';

      el.topbar.classList.toggle('lifted', y > 4);
      // 往下读就收起顶栏，往上翻立刻还回来；顶部区域始终显示
      if (y > 120 && y > lastY + 6) el.topbar.classList.add('hidden');
      else if (y < lastY - 6 || y < 120) el.topbar.classList.remove('hidden');
      lastY = y;

      prefs.scroll = y;
      save();
    });
  }, { passive: true });

  // ---------- 启动 ----------
  applyPrefs();
  buildToc();
  open(clamp(prefs.idx, 0, items.length - 1), false);
  // 恢复上次滚动位置：等一帧让排版稳定，否则位置会偏
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { window.scrollTo(0, prefs.scroll || 0); });
  });
})();
