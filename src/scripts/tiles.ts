// Transition entre pages : des cellules. Au clic, des disques s'ouvrent et
// recouvrent l'écran en partant du point cliqué ; la page suivante se dévoile
// cellule par cellule depuis ce même point, chacune bordée un instant d'acide.

const KEY = 'hyphe:tiles';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Origin {
	x: number;
	y: number;
	t: number;
}

function overlay() {
	const c = document.createElement('canvas');
	c.setAttribute('aria-hidden', 'true');
	c.className = 'tile-veil';
	const dpr = Math.min(devicePixelRatio, 2);
	c.width = Math.round(innerWidth * dpr);
	c.height = Math.round(innerHeight * dpr);
	document.body.append(c);
	const ctx = c.getContext('2d')!;
	ctx.scale(dpr, dpr);
	return { c, ctx };
}

/** Anime la mosaïque : `cover` = les tuiles apparaissent, sinon elles partent (le voile
 *  est alors plein dès la première image, il peut donc remplacer un écran) */
export async function mosaic(origin: { x: number; y: number }, cover: boolean, duration: number) {
	const { c, ctx } = overlay();
	const size = innerWidth < 768 ? 56 : 80;
	const cols = Math.ceil(innerWidth / size);
	const rows = Math.ceil(innerHeight / size);
	const maxD = Math.hypot(innerWidth, innerHeight);
	const tiles: { x: number; y: number; delay: number }[] = [];
	for (let j = 0; j < rows; j++)
		for (let i = 0; i < cols; i++) {
			const x = i * size;
			const y = j * size;
			const d = Math.hypot(x + size / 2 - origin.x, y + size / 2 - origin.y) / maxD;
			tiles.push({
				x,
				y,
				delay: d * 0.62 + Math.random() * 0.22,
			});
		}
	// Le voile doit être plein dès la première image, avant de lever html.tiles-cover
	if (!cover) {
		ctx.fillStyle = '#090c0a';
		ctx.fillRect(0, 0, innerWidth, innerHeight);
	}

	await new Promise<void>((resolve) => {
		const start = performance.now();
		const tick = (now: number) => {
			const t = (now - start) / duration;
			ctx.clearRect(0, 0, innerWidth, innerHeight);
			for (const tile of tiles) {
				// p : 0 → 1, avancement de la tuile ; s : 1 = tuile pleine
				const p = Math.min(1, Math.max(0, (t - tile.delay) / 0.16));
				const s = cover ? p : 1 - p;
				if (s <= 0 && p >= 1) continue;
				// Chaque cellule est un disque qui s'ouvre ou se referme ; plein, il
				// déborde assez pour que les disques voisins couvrent tout l'écran
				const cx = tile.x + size / 2;
				const cy = tile.y + size / 2;
				const r = size * 0.74 * (1 - (1 - s) ** 2);
				if (s > 0) {
					ctx.fillStyle = '#090c0a';
					ctx.beginPath();
					ctx.arc(cx, cy, r, 0, Math.PI * 2);
					ctx.fill();
				}
				// Pendant la bascule, un fin liseré acide sur le bord de la cellule
				if (p > 0 && p < 1) {
					ctx.strokeStyle = `rgba(200,245,60,${(0.55 * Math.sin(p * Math.PI)).toFixed(3)})`;
					ctx.beginPath();
					ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
					ctx.stroke();
				}
			}
			if (t < 1 + 0.2) requestAnimationFrame(tick);
			else resolve();
		};
		requestAnimationFrame(tick);
	});
	if (!cover) c.remove();
}

/** Quitte la page en mosaïque, depuis `origin` ; la page suivante se recompose depuis là */
export function go(href: string, origin = { x: innerWidth / 2, y: innerHeight / 2 }) {
	if (reduced) {
		location.href = href;
		return;
	}
	sessionStorage.setItem(KEY, JSON.stringify({ ...origin, t: Date.now() }));
	void mosaic(origin, true, 700).then(() => (location.href = href));
}

export function mountTiles() {
	// Arrivée : la page était masquée par html.tiles-cover (script de tête)
	const raw = sessionStorage.getItem(KEY);
	sessionStorage.removeItem(KEY);
	const root = document.documentElement;
	if (root.classList.contains('tiles-cover')) {
		const o: Origin = raw ? JSON.parse(raw) : { x: innerWidth / 2, y: innerHeight / 2, t: 0 };
		void mosaic(o, false, 1050);
		root.classList.remove('tiles-cover');
	}

	if (reduced) return;
	document.addEventListener('click', (e) => {
		const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
		if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		if (a.target && a.target !== '_self') return;
		if (a.hasAttribute('download')) return;
		const url = new URL(a.href, location.href);
		if (url.origin !== location.origin) return;
		if (url.pathname === location.pathname && url.hash) return;
		e.preventDefault();
		// Le portail part de la vignette du projet si elle existe
		const frameSel = a.dataset.portalTarget;
		const frame = (frameSel && document.querySelector(frameSel)) || a.querySelector('[data-portal-frame]') || a;
		const r = frame.getBoundingClientRect();
		go(url.href, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
	});

	// Retour arrière depuis le cache : on enlève un éventuel voile resté en place
	addEventListener('pageshow', (e) => {
		if (e.persisted) document.querySelectorAll('.tile-veil').forEach((v) => v.remove());
	});
}
