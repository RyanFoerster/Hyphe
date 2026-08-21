/**
 * Rail de gauche — position dans l'organisme.
 * Sur la page d'accueil, il suit le stade traversé ; ailleurs il sert de fil
 * d'Ariane statique et ce module ne s'accroche à rien.
 */

const ACTIF = '1';
const REPOS = '0.38';

export const initStageRail = (): (() => void) => {
  const items = [...document.querySelectorAll<HTMLElement>('[data-rail-stage]')];
  const sections = [...document.querySelectorAll<HTMLElement>('[data-stage]')];
  if (!items.length || !sections.length) return () => {};

  const setActive = (index: number) => {
    items.forEach((item, i) => {
      const on = i === index;
      item.style.opacity = on ? ACTIF : REPOS;
      const dot = item.querySelector<HTMLElement>('[data-rail-dot]');
      if (dot) dot.style.background = on ? 'var(--color-spore)' : 'var(--color-nat-700)';
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.stage));
      }
    },
    { rootMargin: '-40% 0px -50% 0px' },
  );

  for (const section of sections) observer.observe(section);
  setActive(0);

  return () => observer.disconnect();
};
