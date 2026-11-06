// Système de texte : les mots entrent comme des données qui se résolvent.
//
//   [data-scramble]   texte mono qui se décode depuis des caractères au hasard
//                     (à l'apparition, et au survol si c'est un lien)
//   [data-split]      titre découpé en mots, révélés par paliers, chacun
//                     encadré un instant par une boîte de suivi
//   mark.hl           mot mis en exergue : boîte de suivi, point, valeur
//
// Tout part de la classe .is-in posée par l'observateur d'apparition.

const POOL = '01#%*+=-:.x/\\<>^@';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scramble(el: HTMLElement, duration = 700) {
	const final = el.dataset.scrambleText ?? (el.dataset.scrambleText = el.textContent ?? '');
	if (reduced) return;
	const start = performance.now();
	const chars = [...final];
	const order = chars.map((_, i) => i / chars.length * 0.6 + Math.random() * 0.4);
	const tick = (now: number) => {
		const t = Math.min(1, (now - start) / duration);
		el.textContent = chars
			.map((c, i) => (c === ' ' || t >= order[i] ? c : POOL[Math.floor(Math.random() * POOL.length)]))
			.join('');
		if (t < 1) requestAnimationFrame(tick);
		else el.textContent = final;
	};
	requestAnimationFrame(tick);
}

function split(el: HTMLElement) {
	if (el.dataset.splitDone) return;
	el.dataset.splitDone = '';
	const label = el.textContent?.trim() ?? '';
	el.setAttribute('aria-label', label);
	let i = 0;
	const walk = (node: Node) => {
		for (const child of [...node.childNodes]) {
			if (child.nodeType === Node.TEXT_NODE) {
				const parts = child.textContent!.split(/(\s+)/);
				const frag = document.createDocumentFragment();
				for (const part of parts) {
					if (!part) continue;
					if (/^\s+$/.test(part)) {
						frag.append(document.createTextNode(part));
						continue;
					}
					const w = document.createElement('span');
					w.className = 'w';
					w.setAttribute('aria-hidden', 'true');
					w.style.setProperty('--i', String(i++));
					w.textContent = part;
					frag.append(w);
				}
				child.replaceWith(frag);
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				walk(child);
			}
		}
	};
	walk(el);
}

export function mountText(root: ParentNode = document) {
	root.querySelectorAll<HTMLElement>('[data-split]').forEach(split);

	// Valeurs des mots en exergue : un nombre brut, comme une mesure
	root.querySelectorAll<HTMLElement>('mark.hl:not([data-hl])').forEach((m, i) => {
		const v = ((Math.sin(i * 12.9898 + (m.textContent?.length ?? 0)) * 43758.5453) % 1 + 1) % 1;
		m.dataset.hl = v < 0.5 ? (0.5 + v).toFixed(1) : (0.5 + v * 0.5 + 0.00000004).toFixed(8);
	});

	// Décodage à l'apparition (les éléments observés reçoivent .is-in)
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				scramble(e.target as HTMLElement, Number((e.target as HTMLElement).dataset.scrambleMs ?? 700));
				io.unobserve(e.target);
			}
		},
		{ threshold: 0.2 },
	);
	root.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
		el.dataset.scrambleText = el.textContent ?? '';
		io.observe(el);
		const host = el.closest('a, button');
		if (host && !host.hasAttribute('data-scramble-bound')) {
			host.setAttribute('data-scramble-bound', '');
			host.addEventListener('pointerenter', () => host.querySelectorAll<HTMLElement>('[data-scramble]').forEach((s) => scramble(s, 420)));
		}
	});
}
