/**
 * Dormance — le stade zéro du cycle de vie, avant la spore du hero.
 *
 * Ce fichier est injecté **en clair au tout début du <body>**, minifié par le
 * plugin `?inline-script` : le voile doit exister avant que le site ne soit
 * peint. Il n'a aucune dépendance et ne charge aucun asset — tout est inline
 * (SVG + CSS) ; le régime (papier/nuit) est déjà posé sur <html> par
 * `mix-runtime.js`, qui lit la loupe persistée puis `prefers-color-scheme`.
 *
 * Le visiteur assiste à la germination d'une graine : une radicule descend au
 * rythme du VRAI chargement (typographies, premier frame de l'organisme,
 * `window.load`), jamais d'un timer. À 100 %, la radicule plonge rejoindre la
 * bande mycélium — c'est elle qui l'a semée — et la graine devient la spore du
 * hero, mesurée sur le vrai DOM (`[data-hero-spore]`), pas codée en dur.
 * Aucun fondu au blanc ou au noir : le fond du voile EST le fond du site.
 *
 * Recette : `?loader=slow` simule un réseau lent (paliers visibles),
 * `?loader=force` montre la dormance même en cache chaud.
 */
(function () {
  'use strict';
  // Une seule dormance par fenêtre : les échanges de vue du ClientRouter ne
  // ré-exécutent pas ce script, et ce garde couvre le reste (bfcache inclus).
  if (window.__hypheDormance) return;
  window.__hypheDormance = true;

  var doc = document;
  var html = doc.documentElement;
  var params = new URLSearchParams(location.search);
  var FORCE = params.get('loader') === 'force';
  var SLOW = params.get('loader') === 'slow';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Première visite de la session : la dormance se joue toujours, en mode
  // narratif — la radicule pousse sur la durée (1,2 s), les paliers de
  // ramification sur le temps. Les chargements suivants restent honnêtes.
  // prefers-reduced-motion garde la priorité : jamais de dormance forcée.
  var seen = false;
  try {
    seen = sessionStorage.getItem('hyphe-dormance') === '1';
  } catch (e) {
    /* sessionStorage indisponible : on retombe sur le comportement honnête */
  }
  var FIRST = !seen && !reduced;

  // Prêt avant la fin du délai de grâce → on ne montre rien du tout.
  var GRACE_MS = FIRST || FORCE ? 0 : 300;
  // Durée minimale de lisibilité — uniquement si la scène a été montrée.
  var MIN_SHOW_MS = reduced ? 0 : 1200;
  // Un asset qui traîne ne retient pas le visiteur : entrée forcée.
  var WATCHDOG_MS = 8000;

  var t0 = performance.now();

  /* ── Étapes réelles, pondérées ─────────────────────────────────────────
     Les typographies pèsent le plus lourd (tout le site est composé en
     Fraunces/JetBrains Mono) ; vient ensuite le premier frame de l'organisme
     (`eco:ready`, émis par eco-canvas), puis le reste du chargement. */
  var STEPS = [
    { id: 'typo', log: 'chargement typographies', weight: 0.45, slow: 1400 },
    { id: 'sim', log: 'réveil simulation', weight: 0.35, slow: 2800 },
    { id: 'load', log: 'collecte des planches', weight: 0.2, slow: 4600 },
  ];
  var FONT_SPECS = ['600 1em Fraunces', '400 1em "JetBrains Mono"'];

  var done = {};
  var targetP = 0; // progression réelle, par paliers — jamais lissée
  var finished = false;
  var revealed = false;
  var visible = false;
  var shownAt = 0;
  var timers = [];
  var fontTimer = 0;
  var rafId = 0;

  /* ── CSS critique — tout est déjà dans les variables posées sur <html> ── */
  var CSS =
    '#okg-dormance{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:var(--color-bg-0);font-family:var(--font-mono);transition:opacity 450ms var(--ease-growth)}' +
    '#okg-dormance.okg-d-clear{opacity:0;pointer-events:none}' +
    '#okg-dormance.okg-d-veiled .okg-d-stage,#okg-dormance.okg-d-veiled .okg-d-notes{opacity:0}' +
    '.okg-d-stage,.okg-d-notes{transition:opacity 300ms var(--ease-eco)}' +
    '.okg-d-stage{display:flex;flex-direction:column;align-items:center}' +
    '#okg-dormance svg{overflow:visible}' +
    '.okg-d-ink{stroke:var(--color-nat-100);fill:none;stroke-width:1.4;stroke-linecap:round}' +
    "html[data-regime='night'] .okg-d-ink{stroke:var(--color-tele-cyan);stroke-width:1;filter:drop-shadow(0 0 4px rgba(77,240,208,.5))}" +
    "html[data-regime='night'] .okg-d-husk{display:none}" +
    // En papier, la graine est dessinée par sa cosse : le cœur plein resterait
    // une tache d'encre superposée au trait. Il reste dans le DOM (le handoff
    // mesure sa position) mais invisible — le point ne se matérialise qu'à la
    // contraction, quand la graine se condense en spore. `animation:none` est
    // indispensable : okgDPulse anime l'opacité, et une animation CSS
    // l'emporterait sur le `opacity:0`.
    "html[data-regime='paper'] .okg-d-core{opacity:0;animation:none}" +
    '.okg-d-core{fill:color-mix(in oklab,var(--color-tele-cyan) var(--mixp),var(--color-spore));filter:drop-shadow(0 0 12px var(--glow-a));transform-box:fill-box;transform-origin:center;animation:okgDPulse 3.2s var(--ease-eco) infinite}' +
    '@keyframes okgDPulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.4);opacity:.45}}' +
    '.okg-d-root{stroke-dasharray:100;stroke-dashoffset:100}' +
    '.okg-d-br{stroke-dasharray:100;stroke-dashoffset:100;stroke-width:1;transition:stroke-dashoffset 900ms var(--ease-eco)}' +
    '.okg-d-br.okg-d-on{stroke-dashoffset:0}' +
    '.okg-d-rootg{transition:transform 520ms var(--ease-growth),opacity 520ms var(--ease-growth)}' +
    '#okg-dormance.okg-d-plunge .okg-d-rootg{transform:translateY(46px);opacity:0}' +
    '#okg-dormance.okg-d-plunge .okg-d-notes,#okg-dormance.okg-d-plunge .okg-d-husk{opacity:0}' +
    '.okg-d-husk{transition:opacity 400ms var(--ease-eco)}' +
    '.okg-d-notes{position:absolute;inset:24px;pointer-events:none;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--color-nat-300)}' +
    '.okg-d-nw{position:absolute;top:0;left:0}.okg-d-ne{position:absolute;top:0;right:0}' +
    '.okg-d-sw{position:absolute;bottom:0;left:0}.okg-d-se{position:absolute;bottom:0;right:0}' +
    "html[data-regime='night'] .okg-d-paper{display:none}" +
    "html[data-regime='paper'] .okg-d-night{display:none}" +
    '.okg-d-log{display:flex;flex-direction:column;gap:4px;text-align:left;text-transform:none;letter-spacing:.08em}' +
    '.okg-d-log b{color:var(--color-tele-green);font-weight:400}' +
    '.okg-d-counter{color:var(--color-tele-cyan);font-size:12px}' +
    '.okg-d-dot{position:fixed;border-radius:50%;background:color-mix(in oklab,var(--color-tele-cyan) var(--mixp),var(--color-spore));box-shadow:0 0 24px var(--glow-a);transform:translate(-50%,-50%);transition:transform 450ms var(--ease-growth)}' +
    '.okg-d-dot.okg-d-beat{animation:okgDBeat 240ms var(--ease-eco)}' +
    '@keyframes okgDBeat{0%,100%{scale:1}45%{scale:.8}}' +
    '.okg-d-bar{display:none}' +
    '.okg-d-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}' +
    // Petit écran : les quatre coins n'ont pas la place — la date s'efface,
    // le relevé du bas s'empile au lieu de chevaucher.
    '@media (max-width:639px){' +
    '.okg-d-notes{font-size:10px;inset:18px}' +
    '.okg-d-ne{display:none}' +
    '.okg-d-sw{bottom:20px}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){' +
    '.okg-d-rootg{display:none}' +
    '.okg-d-bar{display:block;width:180px;height:1px;background:var(--color-nat-800);margin-top:20px}' +
    '.okg-d-bar b{display:block;height:100%;width:0;background:var(--color-nat-100);transition:none}' +
    "html[data-regime='night'] .okg-d-bar b{background:var(--color-tele-cyan)}" +
    '}';

  /* ── DOM du voile — SVG inline, géométrie identique dans les deux régimes ── */
  var dateStr = new Date().toLocaleDateString('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  var MARKUP =
    '<div class="okg-d-stage">' +
    '<svg viewBox="0 0 200 320" width="200" height="320" aria-hidden="true">' +
    '<g class="okg-d-seedg">' +
    '<ellipse class="okg-d-ink okg-d-husk" cx="100" cy="58" rx="10" ry="14"/>' +
    '<path class="okg-d-ink okg-d-husk" d="M95 50c4 3 5 9 5 16"/>' +
    '<path class="okg-d-ink okg-d-husk" d="M105 50c-4 3-5 9-5 16"/>' +
    '<circle class="okg-d-core" cx="100" cy="58" r="5"/>' +
    '</g>' +
    '<g class="okg-d-rootg">' +
    '<path class="okg-d-ink okg-d-root" pathLength="100" d="M100 74C97 108 104 142 100 176C96 210 103 246 99 288"/>' +
    '<path class="okg-d-ink okg-d-br" data-th="0.25" pathLength="100" d="M99 122C86 130 76 140 70 154"/>' +
    '<path class="okg-d-ink okg-d-br" data-th="0.45" pathLength="100" d="M102 152C114 160 122 170 127 186"/>' +
    '<path class="okg-d-ink okg-d-br" data-th="0.65" pathLength="100" d="M98 204C85 212 76 224 71 240"/>' +
    '<path class="okg-d-ink okg-d-br" data-th="0.85" pathLength="100" d="M101 244C112 252 119 264 122 280"/>' +
    '</g>' +
    '</svg>' +
    '<div class="okg-d-bar" aria-hidden="true"><b></b></div>' +
    '</div>' +
    '<div class="okg-d-notes" aria-hidden="true">' +
    '<span class="okg-d-paper okg-d-nw">Spécimen Nº 00 — dormance</span>' +
    '<span class="okg-d-paper okg-d-ne">relevé du ' + dateStr + '</span>' +
    '<span class="okg-d-paper okg-d-sw">germination en cours</span>' +
    '<span class="okg-d-paper okg-d-se" data-d-mm>profondeur : 0 mm</span>' +
    '<span class="okg-d-night okg-d-nw">okg.station — sys.boot</span>' +
    '<div class="okg-d-night okg-d-log okg-d-sw" data-d-log></div>' +
    '<span class="okg-d-night okg-d-counter okg-d-se" data-d-counter>0 %</span>' +
    '</div>';

  var styleEl = doc.createElement('style');
  styleEl.id = 'okg-dormance-style';
  styleEl.textContent = CSS;
  doc.head.appendChild(styleEl);

  var overlay = doc.createElement('div');
  overlay.id = 'okg-dormance';
  overlay.className = 'okg-d-veiled';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', 'Chargement du site');
  overlay.innerHTML = MARKUP;
  doc.body.appendChild(overlay);

  html.setAttribute('aria-busy', 'true');

  var rootPath = overlay.querySelector('.okg-d-root');
  var branches = [].map.call(overlay.querySelectorAll('.okg-d-br'), function (el) {
    return { el: el, th: parseFloat(el.getAttribute('data-th')), on: false };
  });
  var counterEl = overlay.querySelector('[data-d-counter]');
  var mmEl = overlay.querySelector('[data-d-mm]');
  var logEl = overlay.querySelector('[data-d-log]');
  var barEl = overlay.querySelector('.okg-d-bar b');

  /* ── Affichages par paliers — le texte dit le vrai, jamais lissé ── */
  var shownP = 0;
  function paintStepped(p) {
    if (p < shownP) p = shownP;
    shownP = p;
    var pct = Math.round(p * 100);
    counterEl.textContent = pct + ' %';
    mmEl.textContent = 'profondeur : ' + Math.round(p * 120) + ' mm';
    barEl.style.width = pct + '%';
  }

  function logLine(text, ms) {
    var line = doc.createElement('div');
    line.textContent = text + '… ';
    var ok = doc.createElement('b');
    ok.textContent = ms === undefined ? 'ok' : 'ok · ' + Math.round(ms) + ' ms';
    line.appendChild(ok);
    logEl.appendChild(line);
  }

  /* ── Croissance de la radicule — lissage purement visuel, monotone ── */
  var vDepth = 0;
  var lastFrame = 0;
  var PALIERS = [0.25, 0.45, 0.65, 0.85, 1];
  var palierIdx = 0;
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    var dt = lastFrame ? now - lastFrame : 16;
    lastFrame = now;
    var eff = targetP;
    if (FIRST) {
      // Narratif : le temps fait pousser la racine, pleine juste avant le
      // handoff. Le réel garde le dernier mot — jamais 100 % tant que le
      // chargement n'est pas vraiment fini.
      var timeP = Math.min(1, (now - shownAt) / (MIN_SHOW_MS * 0.85));
      if (!finished) timeP = Math.min(timeP, 0.92);
      eff = Math.max(targetP, timeP);
      // Les paliers du texte suivent le temps, par crans — jamais lissés.
      while (palierIdx < PALIERS.length && eff >= PALIERS[palierIdx]) {
        paintStepped(PALIERS[palierIdx]);
        palierIdx++;
      }
    }
    // La racine tend vers sa cible : elle ne recule jamais, ne saute jamais.
    vDepth += (eff - vDepth) * Math.min(1, dt * 0.003);
    if (eff - vDepth < 0.0015) vDepth = eff;
    rootPath.style.strokeDashoffset = (100 - vDepth * 100).toFixed(2);
    for (var i = 0; i < branches.length; i++) {
      if (!branches[i].on && vDepth >= branches[i].th) {
        branches[i].on = true;
        branches[i].el.classList.add('okg-d-on');
      }
    }
  }

  /* ── Moteur d'étapes ── */
  function complete(step) {
    if (finished || done[step.id]) return;
    done[step.id] = true;
    targetP = Math.min(1, targetP + step.weight);
    logLine(step.log, performance.now() - t0);
    // Première visite : le texte suit les paliers temporels (mode narratif),
    // pas les étapes réelles — le boot log, lui, reste véridique.
    if (!FIRST) paintStepped(targetP);
    var all = true;
    for (var i = 0; i < STEPS.length; i++) if (!done[STEPS[i].id]) all = false;
    if (all) allDone();
  }

  // `?loader=slow` retarde l'enregistrement des étapes, pour voir les paliers.
  function mark(step) {
    if (SLOW) timers.push(setTimeout(complete, step.slow, step));
    else complete(step);
  }

  // Typographies : on tient la promesse ET la vérité — check() jusqu'à ce que
  // les deux faces soient réellement utilisables (la feuille Google Fonts peut
  // ne pas encore être là quand fonts.ready résout une première fois).
  if (!doc.fonts || !doc.fonts.check) mark(STEPS[0]);
  else {
    fontTimer = setInterval(function () {
      try {
        for (var i = 0; i < FONT_SPECS.length; i++) doc.fonts.load(FONT_SPECS[i]);
        var okAll = true;
        for (var j = 0; j < FONT_SPECS.length; j++) if (!doc.fonts.check(FONT_SPECS[j])) okAll = false;
        if (okAll) {
          clearInterval(fontTimer);
          mark(STEPS[0]);
        }
      } catch (e) {
        clearInterval(fontTimer);
        mark(STEPS[0]);
      }
    }, 120);
  }

  // Simulation : premier frame dessiné par <eco-canvas> (évènement eco:ready).
  if (window.__ecoReady) mark(STEPS[1]);
  else {
    addEventListener('eco:ready', function () { mark(STEPS[1]); }, { once: true });
    doc.addEventListener('DOMContentLoaded', function () {
      // Pas de canevas sur cette page (ou JS partiel) : l'étape ne bloque pas.
      if (!doc.querySelector('eco-canvas')) mark(STEPS[1]);
    });
  }

  // Le reste du chargement (planches, feuilles) : le vrai window.load.
  if (doc.readyState === 'complete') mark(STEPS[2]);
  else addEventListener('load', function () { mark(STEPS[2]); }, { once: true });

  /* ── Grâce, montre, chien de garde ── */
  function show() {
    if (visible || revealed) return;
    visible = true;
    shownAt = performance.now();
    overlay.classList.remove('okg-d-veiled');
    if (!reduced) rafId = requestAnimationFrame(frame);
    if (pendingHandoff) scheduleHandoff();
  }
  // Première visite : la scène se joue quoi qu'il arrive — mais dévoilée deux
  // frames après le premier paint, pour que celui-ci reste léger (le FCP/LCP
  // se mesure sur un paint sans la scène, comme en mode honnête).
  if (FIRST) {
    requestAnimationFrame(function () {
      requestAnimationFrame(show);
    });
  } else {
    timers.push(setTimeout(show, GRACE_MS));
  }

  timers.push(
    setTimeout(function () {
      if (finished) return;
      logLine('délai dépassé — entrée forcée');
      targetP = 1;
      for (var i = 0; i < STEPS.length; i++) done[STEPS[i].id] = true;
      paintStepped(1);
      allDone();
    }, WATCHDOG_MS),
  );

  var pendingHandoff = false;
  function scheduleHandoff() {
    var wait = Math.max(0, shownAt + MIN_SHOW_MS - performance.now());
    timers.push(setTimeout(handoff, wait));
  }

  function allDone() {
    if (finished) return;
    finished = true;
    clearInterval(fontTimer);
    if (!visible) {
      if (FIRST) {
        // Première visite : la dormance se joue quoi qu'il arrive — la montre
        // (deux frames plus loin) déclenchera le handoff après la durée fixe.
        pendingHandoff = true;
        return;
      }
      // Jamais montré : aucun cérémonial, le site apparaît sans détour.
      revealSite(true);
      return;
    }
    scheduleHandoff();
  }

  /* ── Le handoff — la graine devient la spore du hero ── */
  function heroRect() {
    var el = doc.querySelector('[data-hero-spore]');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    // Scroll restauré au milieu de la page : la spore n'est pas là, on s'efface.
    if (r.bottom < 0 || r.top > innerHeight || r.width === 0) return null;
    return r;
  }

  function handoff() {
    counterEl.textContent = '100 %';
    mmEl.textContent = 'profondeur : 120 mm';
    logLine('prêt.');
    if (reduced) {
      revealSite(false);
      return;
    }
    // 1–2 · l'encre sèche, la radicule plonge rejoindre la bande mycélium.
    overlay.classList.add('okg-d-plunge');
    timers.push(
      setTimeout(function () {
        var target = heroRect();
        var core = overlay.querySelector('.okg-d-core');
        var from = core.getBoundingClientRect();
        if (!target) {
          revealSite(false);
          return;
        }
        // 3 · la graine se contracte puis relâche — et rejoint la position
        // mesurée de la spore du hero (même référentiel : le vrai DOM).
        core.style.visibility = 'hidden';
        var dot = doc.createElement('div');
        dot.className = 'okg-d-dot okg-d-beat';
        dot.style.left = from.left + from.width / 2 + 'px';
        dot.style.top = from.top + from.height / 2 + 'px';
        dot.style.width = from.width + 'px';
        dot.style.height = from.height + 'px';
        overlay.appendChild(dot);
        var dx = target.left + target.width / 2 - (from.left + from.width / 2);
        var dy = target.top + target.height / 2 - (from.top + from.height / 2);
        timers.push(
          setTimeout(function () {
            dot.style.transform = 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px)';
            // 4–5 · le fond ne bouge pas ; le contrôle passe au hero, dont la
            // spore est déjà exactement sous le point posé.
            timers.push(setTimeout(function () { revealSite(false); }, 470));
          }, 260),
        );
      }, 540),
    );
  }

  /* ── Révélation & nettoyage ── */
  function revealSite(instant) {
    if (revealed) return;
    revealed = true;
    finished = true;
    try {
      sessionStorage.setItem('hyphe-dormance', '1');
    } catch (e) {
      /* tant pis : la prochaine visite rejouera la dormance */
    }
    html.removeAttribute('aria-busy');
    // Le signal « on peut animer », source de vérité unique du site. Il part
    // d'ici parce que `revealSite` est l'entonnoir des DEUX chemins : handoff
    // joué, et loader jamais montré. `visible` dit lequel — l'entrée du hero
    // enchaîne sans pause dans le premier cas, après un souffle dans l'autre.
    window.__ecoPret = true;
    dispatchEvent(new CustomEvent('eco:pret', { detail: { loader: visible } }));
    // Le site est peint depuis le début sous le voile opaque (le LCP reste
    // mesuré sur le vrai contenu) : révéler = laisser le voile s'effacer.
    if (instant) overlay.style.transition = 'none';
    overlay.classList.add('okg-d-clear');
    // Annonce de fin, discrète — puis tout est démonté, rien ne reste masqué.
    var sr = doc.createElement('span');
    sr.className = 'okg-d-sr';
    sr.setAttribute('role', 'status');
    doc.body.appendChild(sr);
    setTimeout(function () { sr.textContent = 'Site chargé.'; }, 60);
    setTimeout(function () { sr.remove(); }, 2500);
    setTimeout(cleanup, instant ? 0 : 500);
  }

  function onPageshow(e) {
    // Retour bfcache pendant une dormance interrompue : on efface tout.
    if (e.persisted && overlay.isConnected) revealSite(true);
  }
  addEventListener('pageshow', onPageshow);

  function cleanup() {
    cancelAnimationFrame(rafId);
    clearInterval(fontTimer);
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    removeEventListener('pageshow', onPageshow);
    overlay.remove();
    styleEl.remove();
    html.removeAttribute('aria-busy');
  }
})();
