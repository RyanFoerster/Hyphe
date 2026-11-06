// Couche d'analyse, dessinée en 2D par-dessus le rendu : boîtes de suivi qui
// accrochent les reliefs de la roche et la fleur, grille de mesure reliée par
// des points et des valeurs brutes, courbes de légende vers les étiquettes.

import { rng } from './shared';

export interface Pt {
	x: number;
	y: number;
	/** 0 → caché (derrière, hors champ), 1 → bien visible */
	v: number;
}

export interface OverlayFrame {
	time: number;
	dpr: number;
	/** Intensité générale de la couche, 0 → 1 */
	alpha: number;
	/** Points suivis, en pixels CSS */
	points: Pt[];
	/** Indices des points de la fleur (dans points) */
	flowerFrom: number;
	/** Centre de l'artefact et taille apparente (pixels CSS) */
	focus: { x: number; y: number; r: number };
	/** Rectangles à encadrer (spécimens dans la galerie) */
	frames: { x: number; y: number; w: number; h: number; a: number; label: string }[];
	/** Courbes de légende : du point vers l'étiquette */
	callouts: { from: Pt; to: { x: number; y: number }; a: number }[];
	motion: number;
}

const LABELS = ['vector point', 'lichen', 'mineral', 'spore', 'node', 'hyphae', 'crystal', 'moss'];

export function createOverlay(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext('2d')!;
	let w = 0;
	let h = 0;
	let dpr = 1;
	const rand = rng(404);
	// Chaque point suivi a son propre cycle de vie (apparition, maintien, disparition)
	const tracks = Array.from({ length: 80 }, () => ({
		period: 2.5 + rand() * 5,
		phase: rand() * 10,
		size: 6 + rand() * rand() * 34,
		label: LABELS[Math.floor(rand() * LABELS.length)],
		value: rand(),
		group: Math.floor(rand() * 6),
	}));
	// Grille de mesure : un motif de cellules autour de l'artefact, en croix
	const cells: [number, number][] = [];
	for (let gx = -2; gx < 2; gx++)
		for (let gy = -2; gy < 2; gy++) if (Math.abs(gx + 0.5) + Math.abs(gy + 0.5) < 3 || rand() > 0.6) cells.push([gx, gy]);

	const resize = (cssW: number, cssH: number, ratio: number) => {
		w = cssW;
		h = cssH;
		dpr = ratio;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
	};

	const fmt = (v: number) => (v < 0.5 ? v.toFixed(1) : (v + 0.00000004).toFixed(8).replace(/0+$/, ''));

	const draw = (f: OverlayFrame) => {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		if (f.alpha <= 0.01) return;
		ctx.lineWidth = 1;
		ctx.font = `8px "Fragment Mono", ui-monospace, monospace`;
		ctx.textBaseline = 'bottom';
		const bone = (a: number) => `rgba(222,232,228,${(a * f.alpha).toFixed(3)})`;

		// Grille : cellules carrées autour du centre, quelques nœuds reliés
		if (f.focus.r > 0) {
			const c = f.focus.r * 0.62;
			ctx.strokeStyle = bone(0.13);
			ctx.beginPath();
			for (const [gx, gy] of cells) {
				ctx.rect(Math.round(f.focus.x + gx * c) + 0.5, Math.round(f.focus.y + gy * c) + 0.5, Math.round(c), Math.round(c));
			}
			ctx.stroke();
			// Polyligne de mesure : des points de la roche, reliés, avec leurs valeurs
			const chain = f.points.slice(0, 7).filter((p) => p.v > 0.5);
			if (chain.length > 2) {
				ctx.strokeStyle = bone(0.5);
				ctx.beginPath();
				chain.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
				ctx.stroke();
				ctx.fillStyle = bone(0.85);
				chain.forEach((p, i) => {
					ctx.beginPath();
					ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillText(fmt(tracks[i].value + Math.sin(f.time * 0.3 + i) * 0.05 * f.motion), p.x + 5, p.y - 4);
				});
			}
		}

		// Boîtes de suivi : petites sur les reliefs, plus grandes autour de groupes
		const groups = new Map<number, { x0: number; y0: number; x1: number; y1: number; n: number }>();
		f.points.forEach((p, i) => {
			const t = tracks[i % tracks.length];
			if (p.v < 0.3) return;
			const cycle = ((f.time * f.motion + t.phase) % t.period) / t.period;
			const life = cycle < 0.08 ? cycle / 0.08 : cycle > 0.8 ? (1 - cycle) / 0.2 : 1;
			if (life <= 0) return;
			const jitter = Math.sin(f.time * 7 + i) * 1.2 * f.motion;
			const s = t.size * (i >= f.flowerFrom ? 0.7 : 1);
			const x = Math.round(p.x - s / 2 + jitter) + 0.5;
			const y = Math.round(p.y - s / 2) + 0.5;
			const a = life * p.v;
			ctx.strokeStyle = bone(0.7 * a);
			ctx.strokeRect(x, y, Math.round(s), Math.round(s * (1.1 + (i % 3) * 0.3)));
			ctx.fillStyle = bone(0.9 * a);
			ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
			if (s > 14) ctx.fillText(i >= f.flowerFrom ? 'organism' : t.label, x, y - 2);
			const g = groups.get(t.group) ?? { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0 };
			g.x0 = Math.min(g.x0, x);
			g.y0 = Math.min(g.y0, y);
			g.x1 = Math.max(g.x1, x + s);
			g.y1 = Math.max(g.y1, y + s);
			g.n++;
			groups.set(t.group, g);
		});
		groups.forEach((g, k) => {
			if (g.n < 3) return;
			const pad = 8;
			ctx.strokeStyle = bone(0.32);
			ctx.strokeRect(Math.round(g.x0 - pad) + 0.5, Math.round(g.y0 - pad) + 0.5, Math.round(g.x1 - g.x0 + pad * 2), Math.round(g.y1 - g.y0 + pad * 2));
			ctx.fillStyle = bone(0.6);
			ctx.fillText(`cluster ${String(k).padStart(2, '0')} — ${g.n}`, Math.round(g.x0 - pad), Math.round(g.y0 - pad - 2));
		});

		// Spécimens : cadre de mesure, valeur, croix de visée
		for (const fr of f.frames) {
			if (fr.a <= 0.01) continue;
			ctx.strokeStyle = bone(0.5 * fr.a);
			const x = Math.round(fr.x) + 0.5;
			const y = Math.round(fr.y) + 0.5;
			ctx.strokeRect(x - 10, y - 10, Math.round(fr.w) + 20, Math.round(fr.h) + 20);
			ctx.beginPath();
			ctx.moveTo(x + fr.w / 2, y - 22);
			ctx.lineTo(x + fr.w / 2, y - 10);
			ctx.moveTo(x - 22, y + fr.h / 2);
			ctx.lineTo(x - 10, y + fr.h / 2);
			ctx.stroke();
			ctx.fillStyle = bone(0.8 * fr.a);
			ctx.fillText(fr.label, x - 10, y - 13);
			ctx.textAlign = 'right';
			ctx.fillText(`${fr.w.toFixed(0)} × ${fr.h.toFixed(0)}`, x + fr.w + 10, y - 13);
			ctx.textAlign = 'left';
		}

		// Courbes de légende : une ligne fine et souple, un point à chaque bout
		for (const c of f.callouts) {
			if (c.a <= 0.01 || c.from.v < 0.2) continue;
			const a = c.a * c.from.v;
			ctx.strokeStyle = bone(0.55 * a);
			ctx.beginPath();
			ctx.moveTo(c.from.x, c.from.y);
			const mx = (c.from.x + c.to.x) / 2;
			ctx.bezierCurveTo(mx, c.from.y - 40, mx, c.to.y + 30, c.to.x, c.to.y);
			ctx.stroke();
			ctx.fillStyle = bone(0.95 * a);
			ctx.beginPath();
			ctx.arc(c.from.x, c.from.y, 2.5, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(c.to.x, c.to.y, 2, 0, Math.PI * 2);
			ctx.fill();
		}
	};

	return { resize, draw };
}
