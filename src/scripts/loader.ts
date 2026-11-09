// Le chargement : la fleur du hero pousse au trait, au rythme du chargement
// réel. La tige monte, les feuilles se déplient, les pétales (un voile tramé)
// s'ouvrent en tournant, puis les étamines s'allument. Chaque partie reçoit sa
// légende de planche d'herbier. En bas, le compteur en grand et l'étape.
// À la fin, l'écran part en mosaïque comme une transition de page.

import { mosaic } from './tiles';
import { scramble } from './text';
import { sound } from './sound';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAGES: [number, string][] = [
	[0, 'Sowing'],
	[0.2, 'Rooting the stem'],
	[0.4, 'Unfurling leaves'],
	[0.62, 'Opening the veil'],
	[0.86, 'Lighting the stamens'],
	[1, 'In bloom'],
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ss = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a));
	return t * t * (3 - 2 * t);
};

type V2 = [number, number];
type V3 = [number, number, number];

export function createLoader(root: HTMLElement) {
	const canvas = root.querySelector<HTMLCanvasElement>('[data-loader-canvas]')!;
	const bar = root.querySelector<HTMLElement>('[data-loader-bar]')!;
	const pct = root.querySelector<HTMLElement>('[data-loader-pct]')!;
	const stageEl = root.querySelector<HTMLElement>('[data-loader-stage]')!;
	const ctx = canvas.getContext('2d')!;
	const html = document.documentElement;
	html.style.overflow = 'hidden';
	// Les entrées de texte du hero attendent la fin du chargement (voir global.css)
	html.classList.add('is-loading', 'is-unveiling');
	let gone = false;

	let W = 1;
	let H = 1;
	const resize = () => {
		const r = canvas.getBoundingClientRect();
		const dpr = Math.min(devicePixelRatio, 2);
		W = Math.max(1, r.width);
		H = Math.max(1, r.height);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	resize();
	addEventListener('resize', resize);

	let target = 0;
	let shown = 0;
	let stage = -1;
	let raf = 0;
	let finished = false;
	const start = performance.now();

	// ------------------------------------------------------------ la plante
	// Repère : x à droite, y vers le haut, z vers nous ; unité = hauteur utile
	const stemAt = (t: number): V3 => {
		// Une tige qui ondule un peu, comme celle du hero
		const y = t * 0.62;
		return [Math.sin(t * 2.6 + 0.4) * 0.05 - t * 0.02, y, Math.cos(t * 2.1) * 0.03];
	};
	const HEAD_T = 1;
	let spin = 0;
	const tilt = 0.42;
	// Projection : la plante tourne sur elle-même, vue un peu d'en haut
	const proj = (p: V3): V2 & { z?: number } => {
		const c = Math.cos(spin);
		const s = Math.sin(spin);
		const x = p[0] * c + p[2] * s;
		const z = -p[0] * s + p[2] * c;
		const y = p[1] * Math.cos(tilt * 0.35) - z * Math.sin(tilt);
		const unit = H * 0.9;
		return [W / 2 + x * unit, H * 0.96 - y * unit];
	};
	const depth = (p: V3) => -p[0] * Math.sin(spin) + p[2] * Math.cos(spin);

	const line = (pts: V2[], color: string, width = 1) => {
		if (pts.length < 2) return;
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
		ctx.stroke();
	};

	/** Un pétale (ou une feuille) : longueur u, largeur v ; il se relève puis retombe */
	const leafPoint = (
		base: V3,
		yaw: number,
		len: number,
		width: number,
		lift: number,
		droop: number,
		u: number,
		v: number,
	): V3 => {
		const elev = lift * (1 - u) + droop * u;
		const along = len * u;
		const r = Math.cos(elev) * along;
		const h = Math.sin(elev) * along + Math.sin(u * Math.PI) * 0.0;
		// Largeur : nulle à la base, ronde au milieu, pointue au bout
		const wv = width * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7 * v;
		// Gouttière : les bords se relèvent un peu
		const cup = Math.abs(v) ** 2 * width * 0.35 * Math.sin(u * Math.PI);
		const dx = Math.cos(yaw);
		const dz = Math.sin(yaw);
		return [base[0] + dx * r - dz * wv, base[1] + h + cup, base[2] + dz * r + dx * wv];
	};

	/** Le pétale au trait : contour, nervures en long, trame en travers */
	const drawSheet = (
		base: V3,
		yaw: number,
		len: number,
		width: number,
		lift: number,
		droop: number,
		grow: number,
		color: [number, number, number],
		alpha: number,
		rows: number,
		cols: number,
	) => {
		if (grow <= 0.001) return;
		const U = 22;
		const P = (u: number, v: number) => proj(leafPoint(base, yaw, len * grow, width * grow, lift, droop, u, v));
		const rgb = `${color[0]} ${color[1]} ${color[2]}`;
		// Trame en long
		for (let j = 0; j <= cols; j++) {
			const v = -1 + (2 * j) / cols;
			const edge = j === 0 || j === cols;
			const pts: V2[] = [];
			for (let i = 0; i <= U; i++) pts.push(P(i / U, v));
			line(pts, `rgb(${rgb} / ${alpha * (edge ? 0.95 : 0.32)})`, edge ? 1.1 : 0.7);
		}
		// Trame en travers
		for (let i = 1; i < rows; i++) {
			const u = i / rows;
			const pts: V2[] = [];
			for (let j = 0; j <= 10; j++) pts.push(P(u, -1 + j / 5));
			line(pts, `rgb(${rgb} / ${alpha * 0.22})`, 0.6);
		}
	};

	// Étamines : directions fixées une fois pour toutes
	const stamens = Array.from({ length: 16 }, (_, k) => {
		const a = (k / 16) * Math.PI * 2 + Math.sin(k * 7.3) * 0.3;
		return { a, reach: 0.05 + ((k * 37) % 11) / 110, h: 0.07 + ((k * 13) % 7) / 90, orange: k % 3 !== 0 };
	});
	// Pollen qui monte une fois la fleur ouverte
	const pollen = Array.from({ length: 34 }, (_, k) => ({ x: Math.sin(k * 12.9) * 0.25, s: 0.3 + ((k * 7) % 10) / 14, o: (k * 0.137) % 1 }));

	/** Légende de planche : un trait coudé et un libellé */
	const callout = (at: V2, _side: 1 | -1, dy: number, label: string, a: number) => {
		if (a <= 0.01) return;
		// La plante tourne : la légende part toujours vers l'extérieur
		const side = at[0] < W / 2 ? -1 : 1;
		const elbow: V2 = [at[0] + side * 40, at[1] + dy];
		const end: V2 = [Math.max(16, Math.min(W - 16, at[0] + side * Math.min(W * 0.32, 150))), at[1] + dy];
		const k = ss(0, 0.6, a);
		ctx.globalAlpha = a;
		ctx.fillStyle = 'rgb(200 245 60)';
		ctx.fillRect(at[0] - 2, at[1] - 2, 4, 4);
		const mid: V2 = [at[0] + (elbow[0] - at[0]) * Math.min(1, k * 2), at[1] + (elbow[1] - at[1]) * Math.min(1, k * 2)];
		const pts: V2[] = [at, mid];
		if (k > 0.5) pts.push([elbow[0] + (end[0] - elbow[0]) * (k - 0.5) * 2, elbow[1]]);
		line(pts, 'rgb(230 228 220 / 0.45)', 0.8);
		if (k > 0.85) {
			ctx.font = '10px "Fragment Mono", ui-monospace, monospace';
			ctx.fillStyle = 'rgb(230 228 220 / 0.75)';
			ctx.textAlign = side > 0 ? 'right' : 'left';
			ctx.fillText(label.toUpperCase(), end[0], end[1] - 6);
		}
		ctx.globalAlpha = 1;
	};

	let last = performance.now();
	const draw = (now: number) => {
		const elapsed = (now - start) / 1000;
		const dt = Math.min(0.25, (now - last) / 1000);
		last = now;
		// La plante avance au rythme réel, sans jamais sembler figée
		const floor = finished ? 1 : Math.min(0.3, elapsed * 0.14);
		const goal = Math.max(target, floor);
		shown = reduced ? goal : shown + (goal - shown) * (1 - Math.pow(0.01, dt));
		if (goal - shown < 0.002) shown = goal;
		spin = reduced ? 0.6 : 0.6 + elapsed * 0.35;

		ctx.clearRect(0, 0, W, H);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		const gStem = ss(0, 0.42, shown);
		const gLeaf = ss(0.24, 0.6, shown);
		const gPetal = ss(0.42, 0.92, shown);
		const open = ss(0.6, 1, shown);
		const gStamen = ss(0.78, 1, shown);

		// Le sol : un trait pointillé, et les radicelles
		ctx.setLineDash([3, 5]);
		line([proj([-0.42, 0, 0]), proj([0.42, 0, 0])], 'rgb(230 228 220 / 0.18)', 1);
		ctx.setLineDash([]);
		for (let k = 0; k < 5; k++) {
			const a = (k / 5) * Math.PI * 2 + 0.4;
			const r = 0.05 + (k % 3) * 0.025;
			const pts: V2[] = [];
			for (let q = 0; q <= 6; q++) {
				const t = (q / 6) * ss(0, 0.25, shown);
				pts.push(proj([Math.cos(a) * r * t * 2, -t * 0.1, Math.sin(a) * r * t]));
			}
			line(pts, 'rgb(159 208 138 / 0.45)', 0.8);
		}

		// La tige : deux traits (le tube) et une fibre acide au bout qui pousse
		const top = gStem * HEAD_T;
		const N = 60;
		const sides: V2[][] = [[], [], []];
		for (let i = 0; i <= N; i++) {
			const t = (i / N) * top;
			const p = stemAt(t);
			const r = 0.012 * (1 - t * 0.35);
			sides[0].push(proj([p[0] - r, p[1], p[2]]));
			sides[1].push(proj([p[0] + r, p[1], p[2]]));
			sides[2].push(proj([p[0] + Math.sin(t * 30) * r * 0.6, p[1], p[2]]));
		}
		line(sides[0], 'rgb(111 207 138 / 0.85)', 1);
		line(sides[1], 'rgb(111 207 138 / 0.85)', 1);
		line(sides[2], 'rgb(111 207 138 / 0.35)', 0.6);
		if (gStem < 1 && gStem > 0) {
			const tip = proj(stemAt(top));
			ctx.fillStyle = 'rgb(200 245 60)';
			ctx.beginPath();
			ctx.arc(tip[0], tip[1], 2.2, 0, Math.PI * 2);
			ctx.fill();
		}

		// Les feuilles, au trait vert
		const leaves = [
			{ t: 0.3, yaw: 0.3, k: 0 },
			{ t: 0.52, yaw: Math.PI + 0.5, k: 0.25 },
		];
		for (const lf of leaves) {
			const g = ss(lf.k, lf.k + 0.75, gLeaf);
			if (lf.t > top) continue;
			drawSheet(stemAt(lf.t), lf.yaw, 0.3, 0.07, 0.9 - g * 0.5, -0.5, g, [111, 207, 138], 0.85, 5, 4);
		}

		// La fleur : six pétales voilés, du fond vers l'avant
		const head = stemAt(HEAD_T);
		const petals = Array.from({ length: 6 }, (_, k) => (k / 6) * Math.PI * 2);
		const order = petals
			.map((yaw) => ({ yaw, d: depth([Math.cos(yaw), 0, Math.sin(yaw)]) }))
			.sort((a, b) => a.d - b.d);
		if (gPetal > 0) {
			for (const { yaw, d } of order) {
				// Fermés, les pétales se dressent en bouton ; ouverts, ils se couchent
				const lift = 1.35 - open * 0.95;
				const droop = 1.0 - open * 1.35;
				const front = 0.55 + (d + 1) * 0.25;
				drawSheet(head, yaw, 0.3, 0.13, lift, droop, gPetal, [154, 180, 240], front, 7, 6);
			}
		}

		// Étamines et pollen
		if (gStamen > 0) {
			for (const s of stamens) {
				const end: V3 = [head[0] + Math.cos(s.a) * s.reach * gStamen, head[1] + s.h * gStamen, head[2] + Math.sin(s.a) * s.reach * gStamen];
				const mid: V3 = [head[0] + Math.cos(s.a) * s.reach * 0.3 * gStamen, head[1] + s.h * 0.7 * gStamen, head[2] + Math.sin(s.a) * s.reach * 0.3 * gStamen];
				line([proj(head), proj(mid), proj(end)], 'rgb(216 230 200 / 0.45)', 0.7);
				const e = proj(end);
				ctx.fillStyle = s.orange ? 'rgb(255 138 58)' : 'rgb(200 245 60)';
				ctx.beginPath();
				ctx.arc(e[0], e[1], 2.1 * gStamen, 0, Math.PI * 2);
				ctx.fill();
			}
			for (const p of pollen) {
				const k = (p.o + elapsed * 0.08 * p.s) % 1;
				const q = proj([head[0] + p.x * (0.4 + k), head[1] + 0.05 + k * 0.4, head[2]]);
				ctx.fillStyle = `rgb(212 224 122 / ${(1 - k) * 0.7 * gStamen})`;
				ctx.fillRect(q[0], q[1], 1.6, 1.6);
			}
		}

		// Les légendes, chacune quand sa partie a poussé
		const side = W < 480 ? 0.6 : 1;
		callout(proj(stemAt(0.18)), -1, 18 * side, 'fig. a — stem', ss(0.16, 0.3, shown));
		callout(proj(leafPoint(stemAt(0.3), 0.3, 0.3, 0.07, 0.4, -0.5, 0.6, 0)), 1, 10 * side, 'fig. b — leaf', ss(0.42, 0.56, shown));
		callout(proj(leafPoint(head, Math.PI, 0.3 * gPetal, 0.13, 0.4, -0.35, 0.8, 0)), -1, -24 * side, 'fig. c — petal, veil', ss(0.7, 0.84, shown));
		callout(proj([head[0], head[1] + 0.12 * gStamen, head[2]]), 1, -40 * side, 'fig. d — stamen', ss(0.9, 1, shown));

		bar.style.transform = `scaleX(${shown.toFixed(4)})`;
		pct.textContent = String(Math.round(shown * 100)).padStart(3, '0');
		let s = 0;
		while (s + 1 < STAGES.length && shown >= STAGES[s + 1][0] - 1e-6) s++;
		if (s !== stage) {
			stage = s;
			// scramble garde le texte final en mémoire : on lui donne le nouveau
			stageEl.dataset.scrambleText = STAGES[s][1];
			scramble(stageEl, 420);
			if (s > 0) sound.stage(s);
		}
		raf = requestAnimationFrame(draw);
	};
	raf = requestAnimationFrame(draw);

	// Le choix d'entrée : deux boutons, la touche Entrée vaut « avec le son »
	const choose = () =>
		new Promise<void>((resolve) => {
			const box = root.querySelector<HTMLElement>('[data-loader-enter]');
			if (!box) return resolve();
			box.hidden = false;
			root.classList.add('is-ready');
			stageEl.dataset.scrambleText = 'In bloom — choose how to enter';
			scramble(stageEl, 500);
			const pick = (on: boolean) => {
				removeEventListener('keydown', key);
				sound.choose(on);
				resolve();
			};
			const key = (e: KeyboardEvent) => e.key === 'Enter' && pick(true);
			addEventListener('keydown', key);
			box.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((b) =>
				b.addEventListener('click', () => pick(b.dataset.enter === 'sound'), { once: true }),
			);
			box.querySelector<HTMLButtonElement>('[data-enter="sound"]')?.focus({ preventScroll: true });
		});

	return {
		/** Avancement réel, 0 → 1 */
		progress(f: number) {
			target = Math.max(target, Math.min(0.95, f * 0.9));
		},
		/** Fin : la fleur finit de s'ouvrir ; à la première visite, on choisit
		 *  d'entrer avec ou sans le son (c'est aussi le geste qui permet au
		 *  navigateur de jouer), puis l'écran part en tuiles */
		async done() {
			finished = true;
			target = 1;
			const minimum = 1800 - (performance.now() - start);
			await new Promise((res) => setTimeout(res, Math.max(reduced ? 0 : 700, minimum)));
			const until = performance.now() + 1400;
			while (shown < 1 && performance.now() < until) await new Promise((res) => setTimeout(res, 50));
			let entered = false;
			try {
				entered = sessionStorage.getItem('hyphe:entered') === '1';
			} catch {}
			if (!entered && !gone) {
				await choose();
				try {
					sessionStorage.setItem('hyphe:entered', '1');
				} catch {}
			} else {
				await new Promise((res) => setTimeout(res, reduced ? 0 : 420));
			}
			this.dismiss();
		},
		dismiss() {
			if (gone) return;
			gone = true;
			cancelAnimationFrame(raf);
			removeEventListener('resize', resize);
			html.style.overflow = '';
			html.classList.remove('is-loading');
			if (reduced) {
				html.classList.remove('is-unveiling');
				root.remove();
				return;
			}
			// Le voile de tuiles est plein dès sa première image : il remplace le loader.
			// Le titre du hero attend qu'il soit parti pour germer (voir global.css)
			void mosaic({ x: innerWidth / 2, y: innerHeight / 2 }, false, 1100).then(() => html.classList.remove('is-unveiling'));
			root.remove();
		},
	};
}
