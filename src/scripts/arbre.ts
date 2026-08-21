/**
 * L'arbre de collecte — interactions.
 *
 * · Focus clavier : la navigation parcourt la liste sémantique ; le fruit
 *   correspondant s'active sur l'arbre (mêmes styles que le survol) et
 *   défile en vue.
 * · Curseur d'échelle : un repère discret suit la position du scroll le long
 *   du tronc, sur l'échelle graduée de la planche.
 */
export const initArbre = (): (() => void) => {
  const conteneur = document.querySelector<HTMLElement>('[data-herbier] [data-view="nat"]');
  const svgs = [...(conteneur?.querySelectorAll<SVGSVGElement>('svg[data-arbre]') ?? [])];
  if (!conteneur || !svgs.length) return () => {};

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Deux ports (portrait, espalier) portent les mêmes fruits : les états
     s'appliquent aux deux, seul le port visible se voit. */
  const fruitsDe = (slug: string) =>
    svgs.flatMap((svg) => [...svg.querySelectorAll<SVGGElement>(`[data-fruit-groupe="${slug}"]`)]);
  const visible = (el: Element) => el.getBoundingClientRect().width > 0;

  /* ── Focus clavier ↔ fruit actif ── */
  const liens = [...conteneur.querySelectorAll<HTMLAnchorElement>('a[data-cible]')];
  const onFocus = (e: FocusEvent) => {
    const slug = (e.target as HTMLElement).dataset.cible;
    if (!slug) return;
    for (const fruit of fruitsDe(slug)) {
      fruit.classList.add('est-actif');
      if (visible(fruit)) fruit.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    }
  };
  const onBlur = (e: FocusEvent) => {
    const slug = (e.target as HTMLElement).dataset.cible;
    if (slug) for (const fruit of fruitsDe(slug)) fruit.classList.remove('est-actif');
  };
  for (const lien of liens) {
    lien.addEventListener('focus', onFocus);
    lien.addEventListener('blur', onBlur);
  }

  /* ── Curseur d'échelle — la position du relevé le long du tronc ── */
  let raf = 0;
  const placerCurseur = () => {
    raf = 0;
    for (const svg of svgs) {
      const curseur = svg.querySelector<SVGGElement>('[data-echelle-curseur]');
      if (!curseur || !visible(svg)) continue;
      const rect = svg.getBoundingClientRect();
      if (rect.height <= innerHeight) {
        curseur.setAttribute('opacity', '0');
        continue;
      }
      const progression = Math.min(1, Math.max(0, (innerHeight / 2 - rect.top) / rect.height));
      curseur.setAttribute('opacity', '0.85');
      curseur.setAttribute(
        'transform',
        `translate(0 ${(progression * svg.viewBox.baseVal.height).toFixed(0)})`,
      );
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(placerCurseur);
  };
  addEventListener('scroll', onScroll, { passive: true });
  placerCurseur();

  return () => {
    for (const lien of liens) {
      lien.removeEventListener('focus', onFocus);
      lien.removeEventListener('blur', onBlur);
    }
    removeEventListener('scroll', onScroll);
    cancelAnimationFrame(raf);
  };
};
