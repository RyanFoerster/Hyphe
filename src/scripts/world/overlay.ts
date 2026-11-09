// Couche d'analyse, dessinée en 2D par-dessus le rendu : boîtes de suivi qui
// accrochent la tige et la fleur, grille de mesure reliée par
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
	/** Hyphes de la fleur vers les projets en orbite */
	roots: { x: number; y: number; a: number; lit: boolean }[];
	/** Curseur sur la fleur : un jardin en caractères pousse sur son passage */
	cursor: { x: number; y: number; on: boolean };
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

	// Le jardin : chaque passage du curseur sur la fleur plante une graine
	// qui germe, monte en tige, déplie ses feuilles, fleurit puis fane.
	type Plant = { dx: number; dy: number; born: number; len: number; lean: number; kind: number; seed: number };
	const plants: Plant[] = [];
	let lastSeed = { x: -1e4, y: -1e4 };
	const LIFE = 5.2;

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
			// Polyligne de mesure : des points de la tige, reliés, avec leurs valeurs
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

		// Hyphes : de la fleur vers chaque projet, un fil souple et ramifié
		if (f.focus.r > 0) {
			f.roots.forEach((r, i) => {
				if (r.a <= 0.02) return;
				const dx = r.x - f.focus.x;
				const dy = r.y - f.focus.y;
				const d = Math.hypot(dx, dy) || 1;
				const sx = f.focus.x + (dx / d) * f.focus.r * 0.45;
				const sy = f.focus.y + (dy / d) * f.focus.r * 0.35 + f.focus.r * 0.2;
				const sway = Math.sin(f.time * 0.7 + i * 1.7) * 14 * f.motion;
				const nx = -dy / d;
				const ny = dx / d;
				const cx = (sx + r.x) / 2 + nx * (30 + sway);
				const cy = (sy + r.y) / 2 + ny * (30 + sway) + 24;
				const color = (a: number) => (r.lit ? `rgba(200,245,60,${(a * r.a).toFixed(3)})` : bone(a * r.a));
				ctx.strokeStyle = color(r.lit ? 0.95 : 0.5);
				ctx.beginPath();
				ctx.moveTo(sx, sy);
				ctx.quadraticCurveTo(cx, cy, r.x, r.y);
				const q = (u: number) => ({
					x: (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cx + u * u * r.x,
					y: (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * r.y,
				});
				for (const [u, len, side] of [[0.3, 10, 1], [0.55, 14, -1], [0.75, 8, 1]] as const) {
					const p = q(u);
					const p2 = q(u + 0.02);
					const tx = p2.x - p.x;
					const ty = p2.y - p.y;
					const tl = Math.hypot(tx, ty) || 1;
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(p.x + (-ty / tl) * len * side + (tx / tl) * len * 0.6, p.y + (tx / tl) * len * side + (ty / tl) * len * 0.6);
				}
				ctx.stroke();
				ctx.fillStyle = color(0.9);
				ctx.fillRect(Math.round(sx) - 1.5, Math.round(sy) - 1.5, 3, 3);
				const pulse = q(((f.time * 0.18 + i * 0.27) % 1));
				ctx.beginPath();
				ctx.arc(pulse.x, pulse.y, 1.6, 0, Math.PI * 2);
				ctx.fill();
			});
		}

		// Le jardin : on plante en suivant le curseur, puis tout pousse et fane
		if (f.cursor.on && Math.hypot(f.cursor.x - lastSeed.x, f.cursor.y - lastSeed.y) > 26) {
			lastSeed = { x: f.cursor.x, y: f.cursor.y };
			plants.push({
				dx: f.cursor.x - f.focus.x,
				dy: f.cursor.y - f.focus.y,
				born: f.time,
				len: 3 + Math.floor(rand() * 6),
				lean: (rand() - 0.5) * 1.4,
				kind: Math.floor(rand() * 3),
				seed: rand(),
			});
			if (plants.length > 42) plants.shift();
		}
		if (!f.cursor.on) lastSeed = { x: -1e4, y: -1e4 };
		ctx.font = `11px "Fragment Mono", ui-monospace, monospace`;
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'center';
		const CW = 7;
		const CH = 11;
		for (let i = plants.length - 1; i >= 0; i--) {
			const pl = plants[i];
			const age = (f.time - pl.born) / (f.motion || 1);
			if (age > LIFE) {
				plants.splice(i, 1);
				continue;
			}
			const grow = Math.min(1, age / 1.3);
			const wilt = Math.max(0, (age - (LIFE - 1.4)) / 1.4);
			const a = (1 - wilt) * Math.min(1, f.alpha * 1.4 + 0.3);
			const bx = f.focus.x + pl.dx;
			const by = f.focus.y + pl.dy;
			// Racines : quelques points qui s'étalent sous la graine
			ctx.fillStyle = `rgba(222,232,228,${(0.45 * a).toFixed(3)})`;
			const spread = Math.min(1, age / 0.6);
			for (let r = -2; r <= 2; r++) if (r) ctx.fillText(Math.abs(r) === 2 ? '.' : ':', bx + r * CW * spread, by + CH * 0.6);
			// Tige : un caractère par étage, penché selon la plante, qui balance
			const n = Math.max(1, Math.round(pl.len * grow));
			const sway = Math.sin(f.time * 1.6 + pl.seed * 9) * 0.25 * f.motion;
			let x = bx;
			for (let k = 0; k < n; k++) {
				const tilt = (pl.lean + sway) * (k / pl.len);
				x += tilt * CW * 0.55;
				const y = by - k * CH;
				const ch = wilt > 0.5 ? '.' : tilt > 0.18 ? '/' : tilt < -0.18 ? '\\' : '|';
				ctx.fillStyle = `rgba(222,232,228,${(0.85 * a).toFixed(3)})`;
				ctx.fillText(ch, x, y);
				// Feuilles, une sur deux, de part et d'autre
				if (k > 0 && k % 2 === 0 && k < n - 1 && wilt < 0.7) {
					const side = (k / 2) % 2 ? 1 : -1;
					ctx.fillStyle = `rgba(150,190,90,${(0.9 * a).toFixed(3)})`;
					ctx.fillText(side > 0 ? '>' : '<', x + side * CW, y + 2);
				}
			}
			// Fleur au sommet, une fois la tige montée
			if (grow >= 1 && wilt < 0.85) {
				const top = by - n * CH;
				const open = Math.min(1, (age - 1.3) / 0.5);
				const warm = pl.kind === 0;
				ctx.fillStyle = warm ? `rgba(240,122,42,${a.toFixed(3)})` : `rgba(200,245,60,${a.toFixed(3)})`;
				const heart = wilt > 0.3 ? '.' : open < 0.5 ? 'o' : pl.kind === 2 ? String(Math.floor((f.time * 3 + pl.seed * 10) % 10)) : '@';
				ctx.fillText(heart, x, top);
				if (open > 0.5 && wilt < 0.3) {
					ctx.fillStyle = `rgba(230,228,220,${(0.75 * a).toFixed(3)})`;
					ctx.fillText('*', x - CW, top + 2);
					ctx.fillText('*', x + CW, top + 2);
					ctx.fillText('+', x, top - CH * 0.9);
				}
			}
		}
		ctx.textAlign = 'left';
		ctx.textBaseline = 'bottom';
		ctx.font = `8px "Fragment Mono", ui-monospace, monospace`;

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
