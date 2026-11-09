// Système de texte : les mots entrent comme des données qui se résolvent.
//
//   [data-scramble]   texte mono qui se décode depuis des caractères au hasard
//                     (à l'apparition, et au survol si c'est un lien)
//   [data-split]      titre découpé, deux manières de le faire entrer :
//                     · bloom (par défaut) : chaque lettre est une graine qui
//                       pousse — un caractère, une tige, puis la lettre éclot,
//                       du centre du titre vers les bords
//                     · scan (?text=scan) : les mots se révèlent par paliers,
//                       chacun encadré un instant par une boîte de suivi
//   mark.hl           mot mis en exergue : boîte de suivi qui reste acide
//
// Tout part de la classe .is-in posée par l'observateur d'apparition.

const POOL = '01#%*+=-:.x/\\<>^@';
const SEEDS = '.:+*';

// Choix de l'entrée des titres : ?text=scan ou ?text=bloom, mémorisé le temps de la visite
function textMode() {
	const asked = new URLSearchParams(location.search).get('text');
	try {
		if (asked === 'scan' || asked === 'bloom') sessionStorage.setItem('hyphe:text', asked);
		return sessionStorage.getItem('hyphe:text') === 'scan' ? 'scan' : 'bloom';
	} catch {
		return asked === 'scan' ? 'scan' : 'bloom';
	}
}
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

function split(el: HTMLElement, mode: 'bloom' | 'scan') {
	if (el.dataset.splitDone) return;
	el.dataset.splitDone = '';
	const label = el.textContent?.trim() ?? '';
	el.setAttribute('aria-label', label);
	let i = 0;
	// Ordre d'éclosion des lettres : du centre vers les bords, un peu au hasard
	const total = label.replace(/\s/g, '').length;
	let n = 0;
	const letters = (word: string) =>
		[...word]
			.map((c) => {
				const j = (Math.abs(n++ - (total - 1) / 2) / Math.max(1, total)) * 14 + Math.random() * 3;
				const seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
				const ch = c === '&' ? '&amp;' : c === '<' ? '&lt;' : c;
				return `<span class="l" data-seed="${seed}" style="--j:${j.toFixed(2)}"><span class="g">${ch}</span></span>`;
			})
			.join('');
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
					if (mode === 'bloom') w.innerHTML = letters(part);
					else w.textContent = part;
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
	const mode = textMode();
	document.documentElement.dataset.text = mode;
	root.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => split(el, mode));

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
