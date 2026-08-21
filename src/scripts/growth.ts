/**
 * Le scroll fait pousser l'organisme et accumule de la biomasse.
 * La biomasse ne redescend jamais : elle enregistre le point le plus
 * profond atteint pendant la visite.
 */

const BIOMASSE_MAX = 12437;

export const initGrowth = (): (() => void) => {
  const compteurs = [...document.querySelectorAll<HTMLElement>('[data-biomass]')];
  let peak = 0;
  let affiche = -1;

  const onScroll = () => {
    const doc = document.documentElement;
    const p = Math.max(0, Math.min(1, doc.scrollTop / Math.max(1, doc.scrollHeight - innerHeight)));

    dispatchEvent(new CustomEvent('eco:growth', { detail: { g: 0.18 + 0.82 * p } }));

    if (p > peak) peak = p;
    const biomasse = Math.round(peak * BIOMASSE_MAX);
    if (Math.abs(biomasse - affiche) > 60 || (biomasse === BIOMASSE_MAX && affiche !== biomasse)) {
      affiche = biomasse;
      const texte = biomasse.toLocaleString('fr-BE');
      for (const el of compteurs) el.textContent = texte;
    }
  };

  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return () => removeEventListener('scroll', onScroll);
};
