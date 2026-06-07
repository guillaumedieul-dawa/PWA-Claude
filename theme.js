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
    
    // Mise à jour visuelle du bouton principal
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

  // Lecture et application immédiate à la racine HTML pour bloquer le flash blanc
  const savedTheme = localStorage.getItem(KEY) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Ajustement final une fois que les éléments graphiques existent
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTheme(savedTheme));
  } else {
    applyTheme(savedTheme);
  }
})();
