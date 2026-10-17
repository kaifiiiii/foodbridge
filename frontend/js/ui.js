// frontend/js/ui.js
// Shared UI behaviour: theme toggle, toasts, brand mark, password toggle,
// scroll reveal, count-up numbers, tabs. Purely cosmetic: no security logic here.

(function () {
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Theme (remembered in localStorage; always wrapped in try/catch) ----
  function storedTheme() { try { return localStorage.getItem('fb-theme'); } catch (e) { return null; } }
  function applyTheme(t) { root.setAttribute('data-theme', t); }
  const prefersDark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(storedTheme() || (prefersDark ? 'dark' : 'light'));

  const nav = document.querySelector('.navbar .nav-links');
   if (nav && !nav.querySelector('.icon-btn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    const sync = () => { btn.textContent = root.getAttribute('data-theme') === 'dark' ? '\u2600' : '\u263E'; };
    sync();
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('fb-theme', next); } catch (e) { /* storage may be blocked */ }
      sync();
    });
    nav.append(btn);
  }

  // ---- Brand mark ----
  document.querySelectorAll('.brand').forEach((b) => {
    if (b.querySelector('.brand-mark')) return;
    const mark = document.createElement('span');
    mark.className = 'brand-mark';
    mark.setAttribute('aria-hidden', 'true');
    b.prepend(mark);
  });

  // ---- Toasts ----
  let wrap = null;
  function toast(type, text) {
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('aria-live', 'polite');
      document.body.append(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'error' : 'success');
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = type === 'error' ? '!' : '\u2713';
    const msg = document.createElement('span');
    msg.textContent = text;              // textContent: safe even if text came from a server
    t.append(icon, msg);
    wrap.append(t);
    const close = () => { t.classList.add('leaving'); setTimeout(() => t.remove(), 250); };
    t.addEventListener('click', close);
    setTimeout(close, type === 'error' ? 7000 : 4000);
  }
  window.toast = toast;

  // Route showMessage() (from validation.js) to toasts, so existing page code needs no edits.
  if (typeof window.showMessage === 'function') {
    window.showMessage = function (type, text) {
      const box = document.getElementById('form-message');
      if (box) { box.className = 'form-message'; box.textContent = ''; }
      toast(type, text);
    };
  }

  // ---- Password show/hide ----
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    const wrapEl = document.createElement('div');
    wrapEl.className = 'pw-wrap';
    input.parentNode.insertBefore(wrapEl, input);
    wrapEl.append(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pw-toggle';
    toggle.textContent = 'Show';
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
    });
    wrapEl.append(toggle);
  });

  // ---- Count-up numbers ----
  function animateNumber(el, target, suffix) {
    suffix = suffix || '';
    if (reduceMotion || target === 0) { el.textContent = target + suffix; return; }
    const start = performance.now(), duration = 900;
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // dashboard stats are rendered by page scripts; animate whenever they re-render
  const stats = document.getElementById('stats');
  if (stats) {
    new MutationObserver(() => {
      stats.querySelectorAll('.stat-number').forEach((n) => {
        const target = parseInt(n.textContent, 10);
        if (!Number.isNaN(target)) animateNumber(n, target);
      });
    }).observe(stats, { childList: true });   // not subtree, so our own text changes don't loop
  }

  // ---- Scroll reveal + landing count-up ----
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        const counter = entry.target.querySelector('[data-count]');
        if (counter) animateNumber(counter, parseInt(counter.dataset.count, 10), counter.dataset.suffix);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }

  // ---- Tabs ----
  document.querySelectorAll('[data-tabs]').forEach((group) => {
    const tabs = group.querySelectorAll('[data-tab]');
    const panels = group.querySelectorAll('[data-panel]');
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    }));
  });
})();