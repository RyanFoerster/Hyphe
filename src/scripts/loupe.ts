/** Branche le curseur de la loupe sur le moteur de régime. */
export const initLoupe = (): void => {
  const range = document.querySelector<HTMLInputElement>('[data-loupe]');
  if (!range) return;

  range.value = String(Math.round(window.__ecoMix.t * 100));
  range.addEventListener('input', () => {
    window.__ecoMix.apply(Number(range.value) / 100);
  });
};
