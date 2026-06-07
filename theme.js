/* ═══════════════════════════════════════════
   FamilyHub — theme.js
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
    
    // CORRECTION CRITIQUE : Appliquer à html ET body pour assurer la bascule sous WebView
    document.documentElement.setAttribute('data-theme', t);
    if (document.body) {
      document.body.setAttribute('data-theme', t);
    } else {
      // Si le DOM n'est pas encore prêt pour body, on attend la fin du chargement
      document.addEventListener('DOMContentLoaded', () => {
        document.body.setAttribute('data-theme', t);
      });
    }

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

  /* ── Basculer dynamiquement entre les 3 thèmes (Appelé par index.html) ── */
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    applyTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  /* ── Export public ── */
  window.FHTheme = { apply: applyTheme, init: initTheme };

  /* ── Initialisation immédiate ── */
  initTheme();
  
  // NOTE : L'appel automatique à `injectPicker()` a été retiré
  // pour éliminer le menu invisible qui parasitait l'interface.
})();
