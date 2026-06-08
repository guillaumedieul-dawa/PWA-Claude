/* ═══════════════════════════════════════════
   FamilyHub — theme.js
   Gestion des thèmes (light, dark, sepia)
═══════════════════════════════════════════ */
(function () {
  'use strict';

  const THEMES = ['light', 'dark', 'sepia'];
  const KEY = 'fh_theme';

  // 1. Détermination du thème de départ de manière synchrone (bloque le flash blanc)
  const savedTheme = localStorage.getItem(KEY) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Fonction centrale de mise à jour
  function applyTheme(t, triggerEvent = false) {
    if (!THEMES.includes(t)) t = 'light';
    
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(KEY, t);
    
    // Mise à jour visuelle immédiate des boutons si présents dans le DOM
    const btn = document.getElementById('thbtn');
    if (btn) {
      btn.textContent = t === 'dark' ? '🌙' : t === 'sepia' ? '📜' : '☀️';
    }

    // Notification globale pour les modules dépendants
    if (triggerEvent) {
      window.dispatchEvent(new CustomEvent('fhThemeChanged', { detail: { theme: t } }));
    }
  }

  // Fonction de bascule séquentielle
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(cur);
    const next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next, true);
  };

  // 2. Gestion de la finalisation de l'affichage après construction du DOM
  function init() {
    applyTheme(localStorage.getItem(KEY) || 'light', false);
    
    // On active les transitions CSS seulement après le rendu initial de l'application
    requestAnimationFrame(() => {
      document.documentElement.classList.add('theme-ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
