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
    
    // Correction : On l'applique sur la racine ET sur le body pour assurer la cascade CSS
    document.documentElement.setAttribute('data-theme', t);
    if (document.body) {
      document.body.setAttribute('data-theme', t);
    }

    localStorage.setItem(KEY, t);
    
    // Mettre à jour les points actifs si existants
    document.querySelectorAll('.theme-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.t === t);
    });
    
    // Mise à jour de l'icône du bouton principal
    const btn = document.getElementById('thbtn');
    if (btn) btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';
  }

  /* ── Initialisation au chargement ── */
  function initTheme() {
    const saved = localStorage.getItem(KEY);
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (sys ? 'dark' : 'light'));
  }

  /* ── Basculer dynamiquement ── */
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    applyTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  /* ── Export public ── */
  window.FHTheme = { apply: applyTheme, init: initTheme };

  /* ── Init immédiate ── */
  initTheme();
  
  // On applique une deuxième couche de sécurité dès que le DOM est complètement chargé
  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(KEY) || 'light';
    applyTheme(saved);
  });
})();
