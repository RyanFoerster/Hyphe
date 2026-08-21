/**
 * Relevé de contact — validation puis remise au client mail.
 * Aucun serveur : le formulaire compose un mailto et bascule sur l'accusé.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HINTS: Record<string, string> = {
  nom: 'Comme sur le carnet',
  email: 'Pour la réponse',
  message: '',
};

export const initContactForm = (): void => {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;

  const accuse = document.querySelector<HTMLElement>('[data-contact-sent]');
  const global = form.querySelector<HTMLElement>('[data-form-error]');
  const email = form.dataset.email ?? '';

  const setHint = (champ: string, message: string) => {
    const hint = form.querySelector<HTMLElement>(`[data-hint="${champ}"]`);
    if (!hint) return;
    const invalide = message !== HINTS[champ];
    hint.textContent = message;
    hint.style.color = invalide ? 'var(--color-tele-coral)' : 'var(--color-nat-400)';
    const input = form.querySelector<HTMLElement>(`[name="${champ}"]`);
    input?.setAttribute('aria-invalid', String(invalide));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const nom = String(data.get('nom') ?? '').trim();
    const adresse = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    const mission = form.querySelector<HTMLSelectElement>('[name="mission"]');
    const budget = form.querySelector<HTMLSelectElement>('[name="budget"]');

    const erreurs: Record<string, string> = {};
    if (!nom) erreurs.nom = 'Nom requis.';
    if (!EMAIL_RE.test(adresse)) erreurs.email = 'E-mail invalide.';
    if (!message) erreurs.message = 'Message requis.';

    for (const champ of ['nom', 'email', 'message']) {
      setHint(champ, erreurs[champ] ?? HINTS[champ]!);
    }

    if (Object.keys(erreurs).length) {
      if (global) {
        global.textContent = 'Signal incomplet — corrigez les champs signalés.';
        global.hidden = false;
      }
      return;
    }
    if (global) global.hidden = true;

    const missionLabel = mission?.selectedOptions[0]?.textContent ?? '';
    const budgetLabel = budget?.selectedOptions[0]?.textContent ?? '';
    const corps = [
      `Nom : ${nom}`,
      `Mission : ${missionLabel}`,
      `Budget : ${budgetLabel}`,
      '',
      message,
      '',
      /* D'où part le message — lu sur la page, jamais à re-régler. */
      `— envoyé depuis ${location.host}${location.pathname}`,
    ].join('\n');

    location.href = `mailto:${email}?subject=${encodeURIComponent(`Pollinisation — ${nom}`)}&body=${encodeURIComponent(corps)}`;

    form.hidden = true;
    if (accuse) accuse.hidden = false;
  });
};
