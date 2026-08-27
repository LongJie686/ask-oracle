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
  var PREF_VER = 2;               // 默认值调整过就加一，让老访客跟着更新一次
  var DEFAULTS = {
    v: PREF_VER,
    theme: 'night', font: 'song', fs: 19, lh: 1.95, w: 44,
    idx: 0, scroll: 0, seen: [],
    reverse: false, collapsed: []
  };
  var prefs = load();

  function load() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { p = {}; }
    var out = {};
    for (var k in DEFAULTS) out[k] = (p && p[k] !== undefined) ? p[k] : DEFAULTS[k];
    if (!Array.isArray(out.seen)) out.seen = [];
    if (!Array.isArray(out.collapsed)) out.collapsed = [];
    // 老访客存过旧的窄页宽，光改默认值对他们不生效，这里跟着走一次
    if (out.v !== PREF_VER) { out.w = DEFAULTS.w; out.v = PREF_VER; }
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

  var LIMITS = { fs: [14, 26, 1], lh: [1.5, 2.4, .05], w: [26, 72, 2] };
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
  var GROUP = 10;
  var query = '';

  function groupKey(n) { return Math.floor((n - 1) / GROUP) * GROUP + 1; }

  function matches(it) {
    if (!query) return true;
    return it.title.indexOf(query) !== -1 || String(it.n).indexOf(query) === 0;
  }

  function renderToc() {
    el.tocList.innerHTML = '';
    el.tocStats.textContent = BOOK.stats.chapters + ' 章 · ' +
      (BOOK.stats.words / 10000).toFixed(1) + ' 万字';

    var map = {}, order = [];
    items.forEach(function (it, i) {
      var k = groupKey(it.n);
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(i);
    });
    order.sort(function (a, b) { return a - b; });
    if (prefs.reverse) order.reverse();

    var frag = document.createDocumentFragment();
    order.forEach(function (k) {
      var idxs = map[k].filter(function (i) { return matches(items[i]); });
      if (!idxs.length) return;                 // 搜索时整节没命中就不显示
      if (prefs.reverse) idxs = idxs.slice().reverse();

      var hasActive = idxs.indexOf(prefs.idx) !== -1;
      // 正在读的那一节永远展开；搜索时也一律展开，否则搜了看不见
      var shut = prefs.collapsed.indexOf(k) !== -1 && !hasActive && !query;

      var grp = document.createElement('div');
      grp.className = 'grp' + (shut ? ' collapsed' : '');

      var head = document.createElement('div');
      head.className = 'grp-head' + (hasActive ? ' has-active' : '');
      var caret = document.createElement('span');
      caret.className = 'caret';
      caret.textContent = '▾';
      var label = document.createElement('span');
      label.textContent = k + '-' + (k + GROUP - 1);
      var cnt = document.createElement('span');
      cnt.className = 'cnt';
      cnt.textContent = idxs.length;
      head.appendChild(caret); head.appendChild(label); head.appendChild(cnt);
      head.addEventListener('click', function () {
        var at = prefs.collapsed.indexOf(k);
        if (at === -1) prefs.collapsed.push(k); else prefs.collapsed.splice(at, 1);
        save(); renderToc();
      });
      grp.appendChild(head);

      var ul = document.createElement('ul');
      ul.className = 'grp-items';
      idxs.forEach(function (i) {
        var it = items[i];
        var li = document.createElement('li');
        li.innerHTML = '<span class="num"></span><span class="name"></span>';
        li.querySelector('.num').textContent = it.n;
        li.querySelector('.name').textContent = it.title;
        li.title = it.title;
        if (i === prefs.idx) li.className = 'active';
        else if (prefs.seen.indexOf(it.id) !== -1) li.className = 'read';
        // 宽屏目录是停靠的，选完章留着；窄屏是浮层，选完收起让路
        li.addEventListener('click', function () { open(i, true); if (!wide()) closeToc(); });
        ul.appendChild(li);
      });
      grp.appendChild(ul);
      frag.appendChild(grp);
    });
    el.tocList.appendChild(frag);
  }

  function scrollActiveIntoView() {
    var a = el.tocList.querySelector('li.active');
    if (a) a.scrollIntoView({ block: 'nearest' });
  }

  el.tocSearch.addEventListener('input', function () {
    query = this.value.trim();
    renderToc();
  });

  $('btnOrder').addEventListener('click', function () {
    prefs.reverse = !prefs.reverse;
    this.classList.toggle('on', prefs.reverse);
    this.textContent = prefs.reverse ? '倒序' : '正序';
    save(); renderToc(); scrollActiveIntoView();
  });

  $('btnFold').addEventListener('click', function () {
    if (prefs.collapsed.length) prefs.collapsed = [];
    else {
      prefs.collapsed = [];
      items.forEach(function (it) {
        var k = groupKey(it.n);
        if (prefs.collapsed.indexOf(k) === -1) prefs.collapsed.push(k);
      });
    }
    this.textContent = prefs.collapsed.length ? '展开' : '折叠';
    save(); renderToc(); scrollActiveIntoView();
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

    renderToc();
    scrollActiveIntoView();

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
  // 宽屏上目录是停靠的（把正文推开），不该再压一层遮罩
  function wide() { return window.innerWidth >= 1200; }

  function openToc() {
    el.toc.classList.add('open');
    document.body.classList.add('toc-open');
    el.toc.setAttribute('aria-hidden', 'false');
    if (!wide()) el.scrim.hidden = false;
  }
  function closeToc() {
    el.toc.classList.remove('open');
    document.body.classList.remove('toc-open');
    el.toc.setAttribute('aria-hidden', 'true');
    maybeHideScrim();
  }
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

  // ---------- 更新检查 ----------
  // 静态站没有文件监听，改用内容指纹：站点重新编译后指纹会变，
  // 页面回到前台时轻量比一下，变了就提示，不自作主张刷新（正读着呢）。
  var dismissed = '';

  function checkUpdate() {
    if (location.protocol === 'file:') return;      // 本地打开时 fetch 会被拦，直接跳过
    if (!BOOK.version) return;                      // 老数据没有指纹，不检查
    fetch('data/version.json?_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!v || !v.version) return;
        if (v.version === BOOK.version || v.version === dismissed) return;
        var more = v.chapters - BOOK.stats.chapters;
        $('newbarText').textContent = more > 0 ? ('更新了 ' + more + ' 章') : '内容有更新';
        $('newbar').hidden = false;
        $('btnReload').onclick = function () { location.reload(); };
        $('btnDismiss').onclick = function () { dismissed = v.version; $('newbar').hidden = true; };
      })
      .catch(function () { /* 断网或没部署 version.json，静默忽略 */ });
  }

  window.addEventListener('focus', checkUpdate);
  setTimeout(checkUpdate, 3000);
  setInterval(checkUpdate, 10 * 60 * 1000);

  // ---------- 启动 ----------
  applyPrefs();
  $('btnOrder').classList.toggle('on', prefs.reverse);
  $('btnOrder').textContent = prefs.reverse ? '倒序' : '正序';
  $('btnFold').textContent = prefs.collapsed.length ? '展开' : '折叠';
  renderToc();
  open(clamp(prefs.idx, 0, items.length - 1), false);
  // 恢复上次滚动位置：等一帧让排版稳定，否则位置会偏
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { window.scrollTo(0, prefs.scroll || 0); });
  });
})();
