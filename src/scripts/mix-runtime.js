/**
 * La loupe de terrain — moteur de fondu papier ⇄ nuit.
 *
 * Ce fichier est injecté **en clair dans le <head>**, avant tout rendu :
 * le régime doit être posé sur la première frame, sinon la page clignote.
 * Il n'a donc aucune dépendance et n'exporte rien ; il pose `window.__ecoMix`,
 * consommé ensuite par les modules `loupe.ts` et `eco-canvas.ts`.
 *
 * Un seul curseur `t ∈ [0,1]` pilote deux fondus décorrélés :
 *  · les surfaces (fonds, scrims) suivent `t` linéairement ;
 *  · l'encre (texte, accents, courbes) suit `uInk`, une bascule raide autour
 *    de 0,5 — sans quoi le texte croiserait le fond dans la zone morte de
 *    contraste, au milieu du fondu.
 *
 * `--mix` (= uInk) pilote les fondus croisés naturaliste ⇄ télémétrie dans les
 * composants ; `--mixp` est sa version en pourcentage, pour `color-mix()`.
 */
(function () {
  var STORAGE_KEY = 'hyphe-loupe';

  /** Régime papier : strictement noir et blanc — aucune couleur, aucune lueur. */
  var PAPER = {
    '--color-bg-0': '#FAF8F4',
    '--color-bg-1': '#F1EEE8',
    '--color-bg-2': '#EDEAE3',
    '--color-nat-100': '#12100E',
    '--color-nat-200': '#2A2724',
    '--color-nat-300': '#6E6A64',
    '--color-nat-400': '#6E6A64',
    '--color-nat-500': '#2A2724',
    '--color-nat-600': '#55514B',
    '--color-nat-700': '#B4AFA6',
    '--color-nat-800': '#DEDAD2',
    '--color-nat-900': '#F1EEE8',
    '--color-spore': '#12100E',
    '--color-bloom': '#12100E',
    '--color-tele-cyan': '#12100E',
    '--color-tele-green': '#12100E',
    '--color-tele-coral': '#12100E',
    '--shadow-card': '0 1px 2px rgba(18,16,14,0.08), 0 3px 10px rgba(18,16,14,0.10)',
    '--shadow-raised': '0 2px 4px rgba(18,16,14,0.10), 0 10px 24px rgba(18,16,14,0.16)',
    '--shadow-glow': '0 0 0 1px #12100E',
    '--glow-a': 'transparent',
    '--scrim-a': 'rgba(250,248,244,0.94)',
    '--scrim-b': 'rgba(250,248,244,0.85)',
    '--img-filter': 'grayscale(1) contrast(1.1)',
    '--loupe-track': '#12100E',
  };

  /** Régime nuit : la rampe naturaliste complète et la télémétrie vivante. */
  var NIGHT = {
    '--color-bg-0': '#0E1410',
    '--color-bg-1': '#1A2119',
    '--color-bg-2': '#232C21',
    '--color-nat-100': '#E8E4D9',
    '--color-nat-200': '#C9CDB8',
    '--color-nat-300': '#A8B89A',
    '--color-nat-400': '#8AA372',
    '--color-nat-500': '#6B8F4E',
    '--color-nat-600': '#56753D',
    '--color-nat-700': '#42592E',
    '--color-nat-800': '#2E3D20',
    '--color-nat-900': '#1C2614',
    '--color-spore': '#D4A24C',
    '--color-bloom': '#E0507E',
    '--color-tele-cyan': '#4DF0D0',
    '--color-tele-green': '#9CFF57',
    '--color-tele-coral': '#FF6B5A',
    '--shadow-card': '0 1px 0 rgba(232,228,217,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
    '--shadow-raised': '0 1px 0 rgba(232,228,217,0.06) inset, 0 16px 40px rgba(0,0,0,0.5)',
    '--shadow-glow': '0 0 0 1px #4DF0D0, 0 0 16px rgba(77,240,208,0.35)',
    '--glow-a': 'rgba(77,240,208,0.7)',
    '--scrim-a': 'rgba(14,20,16,0.92)',
    '--scrim-b': 'rgba(14,20,16,0.75)',
    '--img-filter': 'grayscale(0.85) sepia(0.3) hue-rotate(55deg) brightness(0.72) contrast(1.05)',
    '--loupe-track': 'linear-gradient(90deg, #12100E, #4DF0D0)',
  };

  /** Surfaces : fondu linéaire sur `t`. Tout le reste suit la courbe d'encre. */
  var SURFACE = {
    '--color-bg-0': 1,
    '--color-bg-1': 1,
    '--color-bg-2': 1,
    '--scrim-a': 1,
    '--scrim-b': 1,
  };
  /** Interpolées en rgba() plutôt qu'en hexadécimal. */
  var RGBA = { '--scrim-a': 1, '--scrim-b': 1, '--glow-a': 1 };

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function lerpHex(a, b, u) {
    var pa = a.match(/\w\w/g).map(function (x) {
      return parseInt(x, 16);
    });
    var pb = b.match(/\w\w/g).map(function (x) {
      return parseInt(x, 16);
    });
    return (
      '#' +
      pa
        .map(function (v, i) {
          return Math.round(v + (pb[i] - v) * u)
            .toString(16)
            .padStart(2, '0');
        })
        .join('')
    );
  }

  function parseRgba(s, fallback) {
    if (s === 'transparent') return [fallback[0], fallback[1], fallback[2], 0];
    return s.match(/[\d.]+/g).map(Number).concat(1).slice(0, 4);
  }

  function lerpRgba(a, b, u) {
    var seed = b === 'transparent' ? [0, 0, 0, 0] : parseRgba(b, [0, 0, 0, 0]);
    var pa = parseRgba(a, seed);
    var pb = parseRgba(b, pa);
    var m = pa.map(function (v, i) {
      return v + (pb[i] - v) * u;
    });
    return (
      'rgba(' + Math.round(m[0]) + ',' + Math.round(m[1]) + ',' + Math.round(m[2]) + ',' + m[3].toFixed(3) + ')'
    );
  }

  /** Position de la loupe : session en cours, sinon préférence système. */
  function read() {
    try {
      var saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved !== null) return clamp01(parseFloat(saved) || 0);
    } catch (e) {
      /* sessionStorage indisponible */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
  }

  function apply(t) {
    var v = clamp01(t);
    var night = v >= 0.5;
    var uInk = clamp01((v - 0.42) / 0.16);
    var root = document.documentElement;

    root.style.setProperty('--mix', String(uInk));
    root.style.setProperty('--mixp', uInk * 100 + '%');
    root.setAttribute('data-regime', night ? 'night' : 'paper');

    for (var key in PAPER) {
      var from = PAPER[key];
      var to = NIGHT[key];
      var u = SURFACE[key] ? v : uInk;
      var value;
      if (from.charAt(0) === '#' && to.charAt(0) === '#') value = lerpHex(from, to, u);
      else if (RGBA[key]) value = lerpRgba(from, to, u);
      else value = night ? to : from;
      root.style.setProperty(key, value);
    }

    var pageBg = lerpHex('#FAF8F4', '#0E1410', v);
    root.style.backgroundColor = pageBg;

    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', pageBg);

    try {
      sessionStorage.setItem(STORAGE_KEY, String(v));
    } catch (e) {
      /* rien à persister */
    }

    window.__ecoMix.t = v;
    window.__ecoMix.encre = uInk;
    window.dispatchEvent(new CustomEvent('eco:mix', { detail: { t: v, encre: uInk } }));
  }

  window.__ecoMix = { read: read, apply: apply, t: 0, encre: 0 };
  apply(read());
})();
