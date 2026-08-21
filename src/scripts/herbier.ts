/**
 * Herbier — filtres et tri, partagés par les deux vues.
 *
 * Les deux vues (planches épinglées / tableau de télémétrie) sont rendues au
 * build et superposées : la loupe décide laquelle est lisible. Les filtres,
 * eux, agissent sur les deux en même temps — filtrer un spécimen en vue
 * naturaliste le retire aussi du tableau.
 */

type Direction = 1 | -1;

interface SortState {
  key: string;
  dir: Direction;
}

const numericOf = (value: string): number => {
  const match = value.replace(',', '.').match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]) : -1;
};

const NUMERIC_KEYS = new Set(['uptime', 'bundle', 'lh']);

export const initHerbier = (): (() => void) => {
  const root = document.querySelector<HTMLElement>('[data-herbier]');
  if (!root) return () => {};

  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-chip]')];
  const items = [...root.querySelectorAll<HTMLElement>('[data-specimen]')];
  const planches = [...root.querySelectorAll<HTMLElement>('[data-view="nat"] [data-specimen]')];
  const fruits = [...root.querySelectorAll<SVGGElement>('[data-fruit-groupe]')];
  const branchesSvg = [...root.querySelectorAll<SVGGElement>('[data-branche]')];
  const etatArbre = root.querySelector<SVGTextElement>('[data-arbre-etat]');
  const tbody = root.querySelector<HTMLElement>('[data-rows]');
  const heads = [...root.querySelectorAll<HTMLButtonElement>('[data-sort-key]')];
  const compteurs = [...root.querySelectorAll<HTMLElement>('[data-herbier-count]')];
  const sortLabel = root.querySelector<HTMLElement>('[data-sort-label]');

  const filtres: Record<string, Set<string>> = {
    tech: new Set(),
    mission: new Set(),
    livrable: new Set(),
  };
  let sort: SortState = { key: 'id', dir: 1 };

  const matches = (el: { dataset: DOMStringMap }) => {
    const techs = (el.dataset.techs ?? '').split('|');
    const mission = el.dataset.mission ?? '';
    const livrable = el.dataset.livrable ?? '';
    const okTech = filtres.tech!.size === 0 || techs.some((t) => filtres.tech!.has(t));
    const okMission = filtres.mission!.size === 0 || filtres.mission!.has(mission);
    const okLivrable = filtres.livrable!.size === 0 || filtres.livrable!.has(livrable);
    return okTech && okMission && okLivrable;
  };

  const applyFilters = () => {
    for (const el of items) el.hidden = !matches(el);
    // Les deux vues listent les mêmes spécimens : on ne compte que les planches.
    const total = planches.filter((el) => !el.hidden).length;
    for (const el of compteurs) el.textContent = String(total);

    // Sur l'arbre, rien ne disparaît : les rameaux non concernés se fanent,
    // la structure de la collection reste une information en soi.
    for (const fruit of fruits) fruit.classList.toggle('fane', !matches(fruit));
    for (const branche of branchesSvg) {
      const siens = fruits.filter((f) => branche.contains(f));
      branche.classList.toggle(
        'branche-fanee',
        siens.length > 0 && siens.every((f) => f.classList.contains('fane')),
      );
    }

    // L'étiquette de base dit la taille en cours, dans la voix du carnet.
    if (etatArbre) {
      const actifs = chips
        .filter((c) => c.dataset.active === 'true')
        .map((c) => c.textContent?.trim().toLowerCase() ?? '');
      etatArbre.textContent = actifs.length
        ? `taille en cours : ${actifs.join(' · ')} — ${total} spécimen${total > 1 ? 's' : ''}`
        : `sites web & applications — ${total} spécimens`;
    }
  };

  const applySort = () => {
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll<HTMLElement>('[data-specimen]')];
    rows.sort((a, b) => {
      const va = a.dataset[`sort${sort.key.charAt(0).toUpperCase()}${sort.key.slice(1)}`] ?? '';
      const vb = b.dataset[`sort${sort.key.charAt(0).toUpperCase()}${sort.key.slice(1)}`] ?? '';
      const cmp = NUMERIC_KEYS.has(sort.key)
        ? numericOf(va) - numericOf(vb)
        : va.localeCompare(vb, 'fr');
      return cmp * sort.dir;
    });
    for (const row of rows) tbody.appendChild(row);

    for (const head of heads) {
      const on = head.dataset.sortKey === sort.key;
      const label = head.dataset.sortLabel ?? '';
      head.textContent = on ? `${label} ${sort.dir === 1 ? '▲' : '▼'}` : label;
      head.style.color = on ? 'var(--color-tele-cyan)' : 'var(--color-nat-400)';
      head.setAttribute('aria-sort', on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');
    }
    if (sortLabel) sortLabel.textContent = `${sort.key.toUpperCase()} ${sort.dir === 1 ? 'ASC' : 'DESC'}`;
  };

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const groupe = chip.dataset.chip!;
      const valeur = chip.dataset.value!;
      const set = filtres[groupe]!;
      const on = !set.has(valeur);
      if (on) set.add(valeur);
      else set.delete(valeur);
      chip.dataset.active = String(on);
      chip.setAttribute('aria-pressed', String(on));
      applyFilters();
    });
  }

  for (const head of heads) {
    head.addEventListener('click', () => {
      const key = head.dataset.sortKey!;
      sort = { key, dir: sort.key === key ? ((sort.dir * -1) as Direction) : 1 };
      applySort();
    });
  }

  // L'aria-hidden suit la loupe : une seule des deux vues est annoncée.
  // Sa hauteur aussi : la vue effacée sort du flux, sinon la plus haute des
  // deux impose son scroll à l'autre. Le repli suit la courbe d'encre du
  // moteur de régime (`mix-runtime.js`) et n'a lieu qu'à ses extrêmes —
  // là où l'opacité est déjà nulle, donc rien ne saute à l'écran.
  const vues = [...root.querySelectorAll<HTMLElement>('[data-view]')];
  const syncVues = (t: number, encre: number) => {
    for (const vue of vues) {
      const nat = vue.dataset.view === 'nat';
      vue.setAttribute('aria-hidden', String(vue.dataset.view === (t >= 0.5 ? 'nat' : 'tel')));
      vue.classList.toggle('vue-repliee', nat ? encre > 0.999 : encre < 0.001);
    }
  };
  const onMix = (e: WindowEventMap['eco:mix']) => syncVues(e.detail.t, e.detail.encre);
  addEventListener('eco:mix', onMix);
  syncVues(window.__ecoMix.t, window.__ecoMix.encre);

  // Les cartes d'offres arrivent avec un filtre présélectionné dans l'URL
  // (/herbier?livrable=site, ?mission=design…) : on allume le chip correspondant.
  const params = new URLSearchParams(location.search);
  for (const groupe of Object.keys(filtres)) {
    const valeur = params.get(groupe);
    if (!valeur) continue;
    const chip = chips.find((c) => c.dataset.chip === groupe && c.dataset.value === valeur);
    if (chip) {
      filtres[groupe]!.add(valeur);
      chip.dataset.active = 'true';
      chip.setAttribute('aria-pressed', 'true');
    }
  }

  applyFilters();
  applySort();

  return () => removeEventListener('eco:mix', onMix);
};
