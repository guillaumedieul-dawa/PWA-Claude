/* ═══════════════════════════════════════════
   FamilyHub — theme.js
   Gestion des thèmes (light, dark, sepia)
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const THEMES = ['light', 'dark', 'sepia'];
  const KEY = 'fh_theme';

  function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    
    document.documentElement.setAttribute('data-theme', t);
    if (document.body) {
      document.body.setAttribute('data-theme', t);
    }
    
    localStorage.setItem(KEY, t);
    
    // Synchronisation visuelle de l'émoji du bouton
    const btn = document.getElementById('thbtn');
    if (btn) {
      btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';
    }
  }

  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    const next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next);
  };

  // Synchronisation du bouton dès que le DOM est disponible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(current);
    });
  } else {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current);
  }
})();
