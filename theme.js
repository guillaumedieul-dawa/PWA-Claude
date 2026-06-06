(function () {
  'use strict';

  const THEMES = ['light', 'dark', 'sepia'];
  const KEY = 'fh_theme';
  const COLORS = { light: '#faf7f2', dark: '#1a1714', sepia: '#f4ecd8' };

  function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(KEY, t);
    
    document.querySelectorAll('.theme-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.t === t);
    });

    const btn = document.getElementById('thbtn');
    if (btn) btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';

    const meta = document.getElementById('meta-theme');
    if (meta) meta.setAttribute('content', COLORS[t]);
  }

  function initTheme() {
    const saved = localStorage.getItem(KEY);
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (sys ? 'dark' : 'light'));
  }

  function injectPicker() {
    if (document.getElementById('theme-picker')) return;
    const picker = document.createElement('div');
    picker.id = 'theme-picker';
    picker.setAttribute('aria-label', 'Choisir le thème');
    THEMES.forEach(t => {
      const dot = document.createElement('button');
      dot.className = 'theme-dot';
      dot.dataset.t = t;
      dot.title = { light: 'Clair', dark: 'Sombre', sepia: 'Sépia' }[t];
      dot.addEventListener('click', () => applyTheme(t));
      picker.appendChild(dot);
    });
    document.body.appendChild(picker);
    
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    document.querySelectorAll('.theme-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.t === cur);
    });
  }

  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
  };

  window.initTheme = initTheme; 

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initTheme(); injectPicker(); });
  } else {
    initTheme();
    injectPicker();
  }
})();
