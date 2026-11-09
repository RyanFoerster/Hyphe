// Couche d'analyse, dessinée en 2D par-dessus le rendu, volontairement légère :
// les hyphes vers les projets, une courbe de légende, le nom de ce que vise la
// loupe du curseur.

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
	/** Loupe : la partie de la plante visée, nommée à côté du cercle */
	pick?: { x: number; y: number; r: number; label: string; sub: string } | null;
	motion: number;
}

export function createOverlay(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext('2d')!;
	let w = 0;
	let h = 0;
	let dpr = 1;

	const resize = (cssW: number, cssH: number, ratio: number) => {
		w = cssW;
		h = cssH;
		dpr = ratio;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
	};


	const draw = (f: OverlayFrame) => {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		if (f.alpha <= 0.01) return;
		ctx.lineWidth = 1;
		ctx.font = `8px "Fragment Mono", ui-monospace, monospace`;
		ctx.textBaseline = 'bottom';
		const bone = (a: number) => `rgba(222,232,228,${(a * f.alpha).toFixed(3)})`;

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

		ctx.textAlign = 'left';
		ctx.textBaseline = 'bottom';

		// Loupe : un trait part du cercle, le nom de la partie visée au bout
		if (f.pick && f.pick.r > 4) {
			const { x, y, r } = f.pick;
			const ex = x + r * 0.71;
			const ey = y - r * 0.71;
			ctx.strokeStyle = 'rgba(200,245,60,0.75)';
			ctx.beginPath();
			ctx.moveTo(ex, ey);
			ctx.lineTo(ex + 14, ey - 14);
			ctx.lineTo(ex + 30, ey - 14);
			ctx.stroke();
			// Une étiquette sur un fond sombre, lisible même devant les pétales
			ctx.font = `10px "Fragment Mono", ui-monospace, monospace`;
			const label = f.pick.label.toUpperCase();
			const bw = Math.max(ctx.measureText(label).width, ctx.measureText(f.pick.sub).width) + 16;
			ctx.fillStyle = 'rgba(13,15,14,0.78)';
			ctx.fillRect(ex + 30, ey - 26, bw, 34);
			ctx.fillStyle = 'rgba(230,228,220,0.95)';
			ctx.fillText(label, ex + 38, ey - 11);
			ctx.fillStyle = 'rgba(200,245,60,0.9)';
			ctx.fillText(f.pick.sub, ex + 38, ey + 3);
			ctx.font = `8px "Fragment Mono", ui-monospace, monospace`;
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
