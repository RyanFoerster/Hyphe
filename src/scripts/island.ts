// L'île : une forme qui grandit et rétrécit selon la vue qu'elle montre.
// La taille de la coque suit la vue active (transition CSS sur width/height),
// les autres vues restent dedans, invisibles et inertes.

import { scramble } from './text';

type View = 'bar' | 'menu' | 'about';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPORE = '.:*+*:';

export function mountIsland(island: HTMLElement) {
	const shell = island.querySelector<HTMLElement>('[data-shell]')!;
	const views = new Map(
		[...island.querySelectorAll<HTMLElement>('[data-view-name]')].map((v) => [v.dataset.viewName as View, v]),
	);
	const trigger = island.querySelector<HTMLButtonElement>('.view-bar button')!;
	const status = island.querySelector<HTMLElement>('[data-island-status]')!;
	let current: View = 'bar';
	let scanEnd = 0;

	const fit = () => {
		const v = views.get(current)!;
		shell.style.width = `${v.offsetWidth}px`;
		shell.style.height = `${v.offsetHeight}px`;
	};

	const show = (next: View, { focus = true } = {}) => {
		if (next === current) return;
		const from = current;
		current = next;
		island.dataset.view = next;
		for (const [name, v] of views) {
			const on = name === next;
			v.toggleAttribute('data-active', on);
			v.inert = !on;
		}
		trigger.setAttribute('aria-expanded', String(next !== 'bar'));
		fit();
		if (!reduced) {
			shell.removeAttribute('data-scan');
			void shell.offsetWidth;
			shell.setAttribute('data-scan', '');
			clearTimeout(scanEnd);
			scanEnd = setTimeout(() => shell.removeAttribute('data-scan'), 950);
		}
		const v = views.get(next)!;
		v.scrollTop = 0;
		v.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => scramble(el, 500));
		if (!focus) return;
		if (next === 'bar') {
			if (from !== 'bar') trigger.focus({ preventScroll: true });
		} else {
			v.querySelector<HTMLElement>('a, button:not(.close)')?.focus({ preventScroll: true });
		}
	};

	views.get('bar')!.setAttribute('data-active', '');
	fit();
	// Les polices changent les mesures : on recale une fois chargées
	document.fonts.ready.then(fit);
	addEventListener('resize', fit);

	island.addEventListener('click', (e) => {
		const go = (e.target as HTMLElement).closest<HTMLElement>('[data-island-go]');
		if (go) {
			const next = go.dataset.islandGo as View;
			show(current === 'menu' && next === 'menu' ? 'bar' : next);
			return;
		}
		if ((e.target as HTMLElement).closest('[data-island-close]')) show('bar', { focus: false });
	});
	// Les autres boutons « about » du site ouvrent la fiche dans l'île
	document.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('[data-open-about]')) show('about');
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && current !== 'bar') show('bar');
	});
	document.addEventListener('pointerdown', (e) => {
		if (current !== 'bar' && !island.contains(e.target as Node)) show('bar', { focus: false });
	});

	// L'état de la page, envoyé par le monde 3D (surface, descente, spécimen…)
	addEventListener('hyphe:status', ((e: CustomEvent<string>) => {
		status.textContent = e.detail;
		status.dataset.scrambleText = e.detail;
		if (current === 'bar') fit();
		scramble(status, 360);
	}) as EventListener);

	// Survol de la barre : l'état se redécode
	trigger.addEventListener('pointerenter', () => scramble(status, 320));

	// La spore respire
	if (!reduced) {
		const spores = island.querySelectorAll<HTMLElement>('[data-spore]');
		let i = 0;
		setInterval(() => {
			i = (i + 1) % SPORE.length;
			spores.forEach((s) => (s.textContent = SPORE[i]));
		}, 220);
	}
}
