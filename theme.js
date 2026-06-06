/* ═══════════════════════════════════════════
   FamilyHub — theme.js (Corrigé)
   Gestion thème : light | dark | sepia
   Persistance : localStorage key 'fh_theme'
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const THEMES = ['light', 'dark', 'sepia'];
  const KEY = 'fh_theme';

  /* ── Appliquer un thème ── */
  function applyTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(KEY, t);

    // Mettre à jour l'icône du bouton d'origine de la page
    const btn = document.getElementById('thbtn');
    if (btn) {
      btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';
    }
  }

  /* ── Initialisation au chargement ── */
  function initTheme() {
    const saved = localStorage.getItem(KEY);
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (sys ? 'dark' : 'light'));
  }

  /* ── Basculer dynamiquement entre les 3 thèmes ── */
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    applyTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  /* ── Export public ── */
  window.FHTheme = { apply: applyTheme, init: initTheme };

  /* ── Initialisation immédiate (évite le flash blanc) ── */
  initTheme();
  
  // NOTE : L'injection de l'élément `#theme-picker` a été retirée 
  // pour éviter les conflits de clics et la superposition sur l'interface.
})();
