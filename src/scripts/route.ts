/**
 * Annonce la route courante au canevas : chaque page recompose l'organisme.
 * Le mode est posé sur <body data-eco-mode> au rendu.
 */
export const announceRoute = (): void => {
  const mode = document.body.dataset.ecoMode ?? 'home';
  window.__ecoMode = mode;
  dispatchEvent(new CustomEvent('eco:route', { detail: { mode } }));
};
