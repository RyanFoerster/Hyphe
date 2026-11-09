// Hyphes : des fils fins qui relient des éléments de la page, comme un
// mycélium sous la terre. Courbes souples, petites ramifications, un nœud à
// chaque bout, une pulsation qui voyage, une valeur au milieu.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountHyphae(canvas: HTMLCanvasElement, selector: string) {
	const ctx = canvas.getContext('2d')!;
	let w = 0;
	let h = 0;
	let dpr = 1;
	let hovered = -1;
	let visible = true;
	const resize = () => {
		dpr = Math.min(devicePixelRatio, 2);
		w = innerWidth;
		h = innerHeight;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
	};
	resize();
	addEventListener('resize', resize);

	const els = () => [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => el.offsetParent);
	document.addEventListener('pointerover', (e) => {
		const list = els();
		hovered = list.findIndex((el) => el.closest('a')?.contains(e.target as Node));
	});

	// Ramifications : fixées une fois, pour ne pas trembler
	const branches = Array.from({ length: 64 }, (_, i) => ({
		at: 0.15 + ((i * 0.618) % 0.7),
		len: 8 + ((i * 37) % 18),
		side: i % 2 ? 1 : -1,
	}));

	const draw = (now: number) => {
		requestAnimationFrame(draw);
		if (document.hidden) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		if (!visible) return;
		const t = reduced ? 0 : now / 1000;
		const rects = els().map((el) => el.getBoundingClientRect());
		ctx.font = '9px "Fragment Mono", ui-monospace, monospace';
		ctx.lineWidth = 1;
		rects.forEach((a, i) => {
			for (const k of [1, 2]) {
				const b = rects[i + k];
				if (!b) continue;
				// Du bas de l'une au haut de l'autre, avec une courbe qui pend
				const ax = a.left + a.width * (0.3 + 0.4 * ((i * 0.37) % 1));
				const ay = a.bottom;
				const bx = b.left + b.width * (0.3 + 0.4 * (((i + k) * 0.53) % 1));
				const by = b.top;
				if (Math.max(ay, by) < -50 || Math.min(ay, by) > h + 50) continue;
				const lit = hovered === i || hovered === i + k;
				const alpha = (k === 1 ? 0.32 : 0.14) * (lit ? 2.4 : 1);
				const color = lit ? `rgba(200,245,60,${Math.min(1, alpha)})` : `rgba(222,232,228,${alpha})`;
				const sway = Math.sin(t * 0.6 + i) * 18;
				const c1x = ax + (bx - ax) * 0.1 + sway;
				const c1y = ay + (by - ay) * 0.55;
				const c2x = bx - (bx - ax) * 0.1 - sway;
				const c2y = by - (by - ay) * 0.45;
				ctx.strokeStyle = color;
				ctx.beginPath();
				ctx.moveTo(ax, ay);
				ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by);
				ctx.stroke();

				const pt = (u: number) => {
					const v = 1 - u;
					return {
						x: v * v * v * ax + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * bx,
						y: v * v * v * ay + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * by,
					};
				};
				// Petites ramifications le long du fil
				ctx.beginPath();
				for (let j = 0; j < 4; j++) {
					const br = branches[(i * 7 + k * 3 + j) % branches.length];
					const p = pt(br.at);
					const q = pt(br.at + 0.01);
					const nx = -(q.y - p.y);
					const ny = q.x - p.x;
					const n = Math.hypot(nx, ny) || 1;
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(p.x + (nx / n) * br.len * br.side + (q.x - p.x) * 3, p.y + (ny / n) * br.len * br.side + (q.y - p.y) * 3);
				}
				ctx.stroke();

				// Nœuds aux deux bouts, pulsation qui voyage, valeur au milieu
				ctx.fillStyle = color;
				for (const p of [pt(0), pt(1)]) {
					ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
				}
				if (!reduced) {
					const p = pt((t * 0.12 + i * 0.31 + k * 0.17) % 1);
					ctx.fillStyle = lit ? 'rgb(200,245,60)' : 'rgba(222,232,228,0.8)';
					ctx.beginPath();
					ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		});
	};
	requestAnimationFrame(draw);

	// Seulement quand la vue des planches est affichée
	const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
	const host = canvas.parentElement?.querySelector('[data-herbarium-view="sheets"]');
	if (host) io.observe(host);
}
