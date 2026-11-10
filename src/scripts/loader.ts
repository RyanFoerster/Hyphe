// Le chargement : une planche de germination, plein écran, au rythme du
// chargement réel. La graine pulse sur la ligne de sol, les racines se
// ramifient dessous en caractères, la tige monte le long d'une règle
// d'herbier, les feuilles se déplient, le voile irisé s'ouvre en tournant et
// les étamines s'allument. Comme dans le hero, la lumière de la fleur se
// redessine en caractères autour d'elle. Une étiquette d'herbier se remplit
// à chaque étape. À la fin, la planche se consume en caractères depuis le
// cœur de la fleur : derrière, la vraie fleur se recompose.

import { scramble } from './text';
import { sound } from './sound';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;

const STAGES: [number, string][] = [
	[0, 'Planting an idea'],
	[0.14, 'Putting down roots'],
	[0.32, 'Growing a stem'],
	[0.48, 'Opening the leaves'],
	[0.66, 'Unfolding the petals'],
	[0.86, 'Adding the details'],
	[1, 'In bloom'],
];

/** Rampe de densité, la même que l'aura du hero */
const RAMP = ' .:-~=+*x%#@';
const AURA = RAMP.indexOf('x');
/** Le front qui brûle à la sortie */
const EMBERS = '/\\|<>^#*+';

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ss = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a));
	return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
};

type V2 = [number, number];
type V3 = [number, number, number];
type RGB = [number, number, number];

// Le voile irisé : bleu, violet, eau — la palette des pétales du hero
const IRIS: RGB[] = [
	[154, 180, 240],
	[192, 162, 246],
	[132, 226, 214],
	[154, 180, 240],
];
const iris = (t: number): RGB => {
	const f = (((t % 1) + 1) % 1) * (IRIS.length - 1);
	const i = Math.floor(f);
	const k = f - i;
	const a = IRIS[i];
	const b = IRIS[i + 1];
	return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};
const GREEN: RGB = [111, 207, 138];

export function createLoader(root: HTMLElement) {
	const canvas = root.querySelector<HTMLCanvasElement>('[data-loader-canvas]')!;
	const bar = root.querySelector<HTMLElement>('[data-loader-bar]')!;
	const pct = root.querySelector<HTMLElement>('[data-loader-pct]')!;
	const stageEl = root.querySelector<HTMLElement>('[data-loader-stage]')!;
	const fields = [...root.querySelectorAll<HTMLElement>('[data-loader-field]')];
	const ctx = canvas.getContext('2d')!;
	const html = document.documentElement;
	html.style.overflow = 'hidden';
	// Les entrées de texte du hero attendent la fin du chargement (voir global.css)
	html.classList.add('is-loading', 'is-unveiling');
	let gone = false;

	// La lumière de la plante, une cellule par caractère : elle sert au halo
	// et à l'aura en caractères
	const glow = document.createElement('canvas');
	const gctx = glow.getContext('2d', { willReadFrequently: true })!;
	const halo = document.createElement('canvas');
	const hctx = halo.getContext('2d')!;

	const CW = lowPower ? 10 : 8;
	const CH = lowPower ? 17 : 14;
	const FONT = `${CH - 3}px "Fragment Mono", ui-monospace, monospace`;

	let W = 1;
	let H = 1;
	let cols = 1;
	let rows = 1;
	let narrow = false;
	// La planche : ligne de sol, unité (hauteur de la plante), axe
	let soilY = 1;
	let unit = 1;
	let axis = 1;
	let soilRow = 1;
	let blur = new Float32Array(3);
	let tmp = new Float32Array(3);
	let haloData: ImageData | null = null;
	let roots: { c: number; r: number; g: string; t: number; d: number }[] = [];
	let soil: { c: number; r: number; g: string; a: number }[] = [];

	const resize = () => {
		const r = canvas.getBoundingClientRect();
		const dpr = Math.min(devicePixelRatio, lowPower ? 1.5 : 2);
		W = Math.max(1, r.width);
		H = Math.max(1, r.height);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		narrow = W < 640;
		soilY = narrow ? H * 0.64 : Math.min(H * 0.76, H - 150);
		const top = narrow ? H * 0.17 : H * 0.12;
		unit = Math.min((soilY - top) / 0.92, W * (narrow ? 1.15 : 0.9));
		axis = W / 2;
		cols = Math.ceil(W / CW);
		rows = Math.ceil(H / CH);
		soilRow = Math.floor(soilY / CH);
		glow.width = halo.width = cols;
		glow.height = halo.height = rows;
		gctx.setTransform(cols / W, 0, 0, rows / H, 0, 0);
		blur = new Float32Array(cols * rows * 3);
		tmp = new Float32Array(cols * rows * 3);
		haloData = hctx.createImageData(cols, rows);
		buildSoil();
	};

	// ------------------------------------------------------------ le sol
	/** Les racines : des marches au hasard (toujours les mêmes), du collet vers
	 *  le bas, qui bifurquent. Chaque cellule a son heure de naissance. */
	const buildSoil = () => {
		let seed = 11;
		const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
		roots = [];
		const c0 = Math.round(axis / CW);
		const r0 = soilRow + 1;
		// Sur téléphone, le compteur occupe le bas : le sol s'arrête au-dessus
		const floor = narrow ? Math.floor((H - 210) / CH) : rows - 1;
		const depth = Math.max(4, floor - r0);
		const taken = new Set<number>();
		const grow = (c: number, r: number, dir: number, t: number, len: number, gen: number) => {
			for (let s = 0; s < len; s++) {
				// Une racine garde son cap, puis dévie ; plus elle est fine, plus
				// elle court à l'horizontale
				if (rand() < 0.22) dir = Math.max(-1, Math.min(1, dir + (rand() < 0.5 ? -1 : 1)));
				const flat = rand() < 0.1 + gen * 0.12 + ((r - r0) / depth) * 0.25;
				const step = flat ? dir || (rand() < 0.5 ? -1 : 1) : dir;
				c += step;
				if (!flat) r += 1;
				if (r >= floor || c < 0 || c >= cols) return;
				t += 0.012 + rand() * 0.01 + gen * 0.006;
				const key = r * cols + c;
				if (taken.has(key)) continue;
				taken.add(key);
				const g = flat ? (rand() < 0.5 ? '~' : '-') : dir === 0 ? '|' : dir > 0 ? '\\' : '/';
				roots.push({ c, r, g, t, d: (r - r0) / depth });
				if (gen < 3 && rand() < 0.13 - gen * 0.025) grow(c, r, rand() < 0.5 ? -1 : 1, t, Math.round(len * 0.55), gen + 1);
			}
		};
		const main = Math.round(depth * (narrow ? 1.3 : 1.7));
		grow(c0, r0 - 1, 0, 0, main, 0);
		grow(c0 - 1, r0 - 1, -1, 0.05, Math.round(main * 0.8), 0);
		grow(c0 + 1, r0 - 1, 1, 0.08, Math.round(main * 0.8), 0);
		const end = Math.max(...roots.map((p) => p.t), 1e-3);
		roots.forEach((p) => (p.t /= end));
		// Le terreau : quelques grains, de moins en moins vers le fond
		soil = [];
		for (let r = r0; r < floor; r++) {
			const k = (r - r0) / depth;
			for (let c = 0; c < cols; c++) {
				const h = hash(c * 3.7 + r * 91.3);
				const edge = Math.abs(c * CW - axis) / (W / 2);
				if (h < 0.11 * (1 - k * 0.6) * (1 - edge * 0.4)) soil.push({ c, r, g: h < 0.03 ? ':' : '.', a: 0.08 + h * 0.9 });
			}
		}
	};

	resize();
	addEventListener('resize', resize);

	let target = 0;
	let shown = 0;
	let stage = -1;
	let raf = 0;
	let finished = false;
	let leaving = -1;
	const start = performance.now();

	// ------------------------------------------------------------ la plante
	// Repère : x à droite, y vers le haut, z vers nous ; unité = hauteur utile
	const STEM = 0.62;
	const stemAt = (t: number): V3 => [Math.sin(t * 2.6 + 0.4) * 0.05 - t * 0.02, t * STEM, Math.cos(t * 2.1) * 0.03];
	let spin = 0;
	const tilt = 0.42;
	// La plante tourne sur elle-même, vue un peu d'en haut
	const proj = (p: V3): V2 => {
		const c = Math.cos(spin);
		const s = Math.sin(spin);
		const x = p[0] * c + p[2] * s;
		const z = -p[0] * s + p[2] * c;
		const y = p[1] * Math.cos(tilt * 0.35) - z * Math.sin(tilt);
		return [axis + x * unit, soilY - y * unit];
	};
	const depth = (p: V3) => -p[0] * Math.sin(spin) + p[2] * Math.cos(spin);

	// Le dessin se fait deux fois : net sur la planche, épais dans la lumière
	let cx: CanvasRenderingContext2D = ctx;
	let boost = 1;
	const line = (pts: V2[], color: string, width = 1) => {
		if (pts.length < 2) return;
		cx.strokeStyle = color;
		cx.lineWidth = width * boost;
		cx.beginPath();
		cx.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
		cx.stroke();
	};
	const rgba = (c: RGB, a: number) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${a.toFixed(3)})`;

	/** Un pétale (ou une feuille) : longueur u, largeur v ; il se relève puis retombe */
	const leafPoint = (base: V3, yaw: number, len: number, width: number, lift: number, droop: number, u: number, v: number): V3 => {
		const elev = lift * (1 - u) + droop * u;
		const along = len * u;
		const r = Math.cos(elev) * along;
		const h = Math.sin(elev) * along;
		// Largeur : nulle à la base, ronde au milieu, pointue au bout
		const wv = width * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7 * v;
		// Gouttière : les bords se relèvent un peu
		const cup = Math.abs(v) ** 2 * width * 0.35 * Math.sin(u * Math.PI);
		const dx = Math.cos(yaw);
		const dz = Math.sin(yaw);
		return [base[0] + dx * r - dz * wv, base[1] + h + cup, base[2] + dz * r + dx * wv];
	};

	/** Le pétale au trait : un voile à peine teinté, des nervures en long qui
	 *  changent de teinte (l'irisation), une trame en travers */
	const drawSheet = (
		base: V3,
		yaw: number,
		len: number,
		width: number,
		lift: number,
		droop: number,
		grow: number,
		color: RGB | ((j: number) => RGB),
		alpha: number,
		rowsN: number,
		colsN: number,
	) => {
		if (grow <= 0.001) return;
		const U = 22;
		const P = (u: number, v: number) => proj(leafPoint(base, yaw, len * grow, width * grow, lift, droop, u, v));
		const tint = (j: number) => (typeof color === 'function' ? color(j) : color);
		// Le voile
		if (boost === 1) {
			cx.beginPath();
			for (let i = 0; i <= U; i++) {
				const p = P(i / U, -1);
				if (i === 0) cx.moveTo(p[0], p[1]);
				else cx.lineTo(p[0], p[1]);
			}
			for (let i = U; i >= 0; i--) {
				const p = P(i / U, 1);
				cx.lineTo(p[0], p[1]);
			}
			cx.fillStyle = rgba(tint(0.5), alpha * 0.07);
			cx.fill();
		}
		// Trame en long
		for (let j = 0; j <= colsN; j++) {
			const v = -1 + (2 * j) / colsN;
			const edge = j === 0 || j === colsN;
			const pts: V2[] = [];
			for (let i = 0; i <= U; i++) pts.push(P(i / U, v));
			line(pts, rgba(tint(j / colsN), alpha * (edge ? 0.95 : 0.34)), edge ? 1.1 : 0.7);
		}
		// Trame en travers
		for (let i = 1; i < rowsN; i++) {
			const u = i / rowsN;
			const pts: V2[] = [];
			for (let j = 0; j <= 10; j++) pts.push(P(u, -1 + j / 5));
			line(pts, rgba(tint(0.5), alpha * 0.22), 0.6);
		}
	};

	// Étamines : directions fixées une fois pour toutes
	const stamens = Array.from({ length: 18 }, (_, k) => {
		const a = (k / 18) * Math.PI * 2 + Math.sin(k * 7.3) * 0.3;
		return { a, reach: 0.05 + ((k * 37) % 11) / 105, h: 0.07 + ((k * 13) % 7) / 85, ember: k % 3 !== 0 };
	});
	// Le cœur : un amas de grains
	const heart = Array.from({ length: 36 }, (_, k) => ({ a: k * 2.39996, r: Math.sqrt(k / 36) * 0.032 }));
	// Le pollen, en caractères, qui monte une fois la fleur ouverte
	const pollen = Array.from({ length: 44 }, (_, k) => ({ x: Math.sin(k * 12.9) * 0.3, s: 0.3 + ((k * 7) % 10) / 14, o: (k * 0.137) % 1, g: '.·*+'[k % 4], ember: k % 5 === 0 }));

	/** Toute la plante, dans le contexte courant */
	const drawPlant = (g: { stem: number; leaf: number; petal: number; open: number; stamen: number }, elapsed: number) => {
		// La tige : deux traits (le tube) et une fibre au milieu
		const top = g.stem;
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
		line(sides[0], rgba(GREEN, 0.85), 1);
		line(sides[1], rgba(GREEN, 0.85), 1);
		line(sides[2], rgba(GREEN, 0.35), 0.6);

		// Les feuilles, au trait vert
		const leaves = [
			{ t: 0.3, yaw: 0.3, k: 0 },
			{ t: 0.52, yaw: Math.PI + 0.5, k: 0.25 },
		];
		for (const lf of leaves) {
			const k = ss(lf.k, lf.k + 0.75, g.leaf);
			if (lf.t > top) continue;
			drawSheet(stemAt(lf.t), lf.yaw, 0.3, 0.075, 0.9 - k * 0.5, -0.5, k, GREEN, 0.85, 5, 4);
		}

		// La fleur : six pétales voilés, du fond vers l'avant
		const head = stemAt(1);
		if (g.petal > 0) {
			const order = Array.from({ length: 6 }, (_, k) => (k / 6) * Math.PI * 2)
				.map((yaw) => ({ yaw, d: depth([Math.cos(yaw), 0, Math.sin(yaw)]) }))
				.sort((a, b) => a.d - b.d);
			for (const { yaw, d } of order) {
				// Fermés, les pétales se dressent en bouton ; ouverts, ils se couchent
				const lift = 1.35 - g.open * 0.95;
				const droop = 1.0 - g.open * 1.35;
				const front = 0.55 + (d + 1) * 0.25;
				const shift = yaw * 0.16 + elapsed * 0.06;
				drawSheet(head, yaw, 0.34, 0.15, lift, droop, g.petal, (j) => iris(shift + j * 0.55), front, 7, 7);
			}
		}

		// Le cœur, les étamines et le pollen
		if (g.stamen > 0) {
			for (const h of heart) {
				const q = proj([head[0] + Math.cos(h.a) * h.r * g.stamen, head[1] + 0.012, head[2] + Math.sin(h.a) * h.r * g.stamen]);
				cx.fillStyle = `rgb(222 232 130 / ${0.8 * g.stamen})`;
				cx.fillRect(q[0] - boost, q[1] - boost, 1.6 * boost, 1.6 * boost);
			}
			for (const s of stamens) {
				const end: V3 = [head[0] + Math.cos(s.a) * s.reach * g.stamen, head[1] + s.h * g.stamen, head[2] + Math.sin(s.a) * s.reach * g.stamen];
				const mid: V3 = [head[0] + Math.cos(s.a) * s.reach * 0.3 * g.stamen, head[1] + s.h * 0.7 * g.stamen, head[2] + Math.sin(s.a) * s.reach * 0.3 * g.stamen];
				line([proj(head), proj(mid), proj(end)], 'rgb(216 230 200 / 0.5)', 0.7);
				const e = proj(end);
				cx.fillStyle = s.ember ? 'rgb(240 122 42)' : 'rgb(200 245 60)';
				cx.beginPath();
				cx.arc(e[0], e[1], 2.2 * g.stamen * boost, 0, Math.PI * 2);
				cx.fill();
			}
		}
	};

	/** Légende de planche : un trait coudé et un libellé */
	const callout = (at: V2, dy: number, label: string, a: number) => {
		if (a <= 0.01) return;
		// La plante tourne : la légende part toujours vers l'extérieur
		const side = at[0] < axis ? -1 : 1;
		const reach = Math.min(W * (narrow ? 0.34 : 0.26), 190);
		const elbow: V2 = [at[0] + side * 36, at[1] + dy];
		const end: V2 = [Math.max(16, Math.min(W - 16, at[0] + side * reach)), at[1] + dy];
		const k = ss(0, 0.6, a);
		ctx.globalAlpha = a;
		ctx.fillStyle = 'rgb(200 245 60)';
		ctx.fillRect(at[0] - 2, at[1] - 2, 4, 4);
		const mid: V2 = [at[0] + (elbow[0] - at[0]) * Math.min(1, k * 2), at[1] + (elbow[1] - at[1]) * Math.min(1, k * 2)];
		const pts: V2[] = [at, mid];
		if (k > 0.5) pts.push([elbow[0] + (end[0] - elbow[0]) * (k - 0.5) * 2, elbow[1]]);
		cx = ctx;
		boost = 1;
		line(pts, 'rgb(230 228 220 / 0.45)', 0.8);
		if (k > 0.85) {
			ctx.font = '10px "Fragment Mono", ui-monospace, monospace';
			ctx.fillStyle = 'rgb(230 228 220 / 0.78)';
			ctx.textAlign = side > 0 ? 'right' : 'left';
			ctx.textBaseline = 'alphabetic';
			ctx.fillText(label.toUpperCase(), end[0], end[1] - 6);
		}
		ctx.globalAlpha = 1;
	};

	// Les styles de caractères, mis en cache (des milliers par image)
	const styles = new Map<number, string>();
	const styleOf = (r: number, g: number, b: number, a: number) => {
		const key = ((r >> 4) << 16) | ((g >> 4) << 11) | ((b >> 4) << 6) | Math.round(a * 31);
		let s = styles.get(key);
		if (!s) {
			s = `rgb(${(r >> 4) * 17} ${(g >> 4) * 17} ${(b >> 4) * 17} / ${(Math.round(a * 31) / 31).toFixed(3)})`;
			styles.set(key, s);
		}
		return s;
	};

	/** La lumière de la plante, floutée : un flou en boîte, en deux passes */
	const spread = (src: Uint8ClampedArray) => {
		const n = cols * rows;
		for (let i = 0; i < n; i++) {
			blur[i * 3] = src[i * 4];
			blur[i * 3 + 1] = src[i * 4 + 1];
			blur[i * 3 + 2] = src[i * 4 + 2];
		}
		const R = 2;
		for (let pass = 0; pass < 2; pass++) {
			const horiz = pass === 0;
			const a = blur;
			const o = tmp;
			for (let r = 0; r < rows; r++)
				for (let c = 0; c < cols; c++) {
					let sr = 0;
					let sg = 0;
					let sb = 0;
					let cnt = 0;
					for (let k = -R; k <= R; k++) {
						const cc = horiz ? c + k : c;
						const rr = horiz ? r : r + k;
						if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) continue;
						const j = (rr * cols + cc) * 3;
						sr += a[j];
						sg += a[j + 1];
						sb += a[j + 2];
						cnt++;
					}
					const j = (r * cols + c) * 3;
					o[j] = sr / cnt;
					o[j + 1] = sg / cnt;
					o[j + 2] = sb / cnt;
				}
			blur = o;
			tmp = a;
		}
	};

	/** Fin : la planche se consume en caractères depuis le cœur de la fleur.
	 *  Le front est un cadre carré qui s'élargit, jamais un cercle. */
	const burn = (p: number, origin: V2) => {
		const w = -0.05 + p * 1.12;
		const ax = Math.max(origin[0], W - origin[0]);
		const ay = Math.max(origin[1], H - origin[1]);
		ctx.globalCompositeOperation = 'destination-out';
		ctx.fillStyle = '#000';
		const front: [number, number, number][] = [];
		for (let r = 0; r < rows; r++) {
			let run = -1;
			for (let c = 0; c <= cols; c++) {
				let burned = false;
				if (c < cols) {
					const d = Math.max(Math.abs((c + 0.5) * CW - origin[0]) / ax, Math.abs((r + 0.5) * CH - origin[1]) / ay);
					const order = d * 0.92 + hash(c * 7.13 + r * 13.37) * 0.08;
					burned = order < w;
					if (!burned && order < w + 0.035) front.push([c, r, 1 - (order - w) / 0.035]);
				}
				if (burned && run < 0) run = c;
				if (!burned && run >= 0) {
					ctx.fillRect(run * CW, r * CH, (c - run) * CW, CH);
					run = -1;
				}
			}
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.font = FONT;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		// Le front : une rangée de caractères qui brûle à l'acide
		for (const [c, r, k] of front) {
			ctx.fillStyle = '#090c0a';
			ctx.fillRect(c * CW, r * CH, CW, CH);
			ctx.fillStyle = k > 0.6 ? `rgb(200 245 60 / ${k.toFixed(2)})` : `rgb(230 228 220 / ${(k * 0.8).toFixed(2)})`;
			ctx.fillText(EMBERS[Math.floor(hash(c * 3.1 + r * 5.7 + Math.floor(p * 30)) * EMBERS.length)], c * CW + CW / 2, r * CH + 1);
		}
	};

	// En dev seulement : `?loader=0.4` fige la croissance, `?loader=burn:0.4`
	// fige la sortie (pour juger chaque étape en capture)
	const pin = import.meta.env.DEV ? new URLSearchParams(location.search).get('loader') : null;
	const pinGrow = pin && !pin.startsWith('burn') ? clamp(parseFloat(pin)) : null;
	const pinBurn = pin?.startsWith('burn:') ? clamp(parseFloat(pin.slice(5))) : null;

	let onGone: (() => void) | null = null;
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
		if (pinGrow !== null) shown = pinGrow;
		if (pinBurn !== null) shown = 1;
		spin = reduced ? 0.6 : 0.6 + elapsed * 0.32;

		const g = {
			root: ss(0.02, 0.62, shown),
			stem: ss(0.1, 0.48, shown),
			leaf: ss(0.32, 0.66, shown),
			petal: ss(0.48, 0.9, shown),
			open: ss(0.66, 1, shown),
			stamen: ss(0.84, 1, shown),
		};
		const head = stemAt(1);
		const headPx = proj(head);

		// Le fond de la page : la planche est opaque jusqu'à la sortie
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = '#090c0a';
		ctx.fillRect(0, 0, W, H);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// ---- le sol : terreau et racines, en caractères
		ctx.font = FONT;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		const soilIn = ss(0, 0.12, shown);
		for (const s of soil) {
			ctx.fillStyle = `rgb(141 147 140 / ${(s.a * soilIn).toFixed(3)})`;
			ctx.fillText(s.g, s.c * CW + CW / 2, s.r * CH + 1);
		}
		const reach = g.root + Math.max(0, shown - 0.62) * 0.2;
		for (const p of roots) {
			if (p.t > reach) continue;
			const tip = reach - p.t < 0.035 && reach < 1;
			ctx.fillStyle = tip ? 'rgb(200 245 60 / 0.95)' : `rgb(${107 + (1 - p.d) * 40 | 0} ${150 + (1 - p.d) * 57 | 0} ${110 + (1 - p.d) * 28 | 0} / ${(0.7 - p.d * 0.45).toFixed(3)})`;
			ctx.fillText(p.g, p.c * CW + CW / 2, p.r * CH + 1);
		}

		// ---- la lumière : la plante en épais, dans une cellule par caractère
		gctx.globalCompositeOperation = 'source-over';
		gctx.fillStyle = '#000';
		gctx.fillRect(0, 0, W, H);
		gctx.globalCompositeOperation = 'lighter';
		gctx.lineCap = 'round';
		gctx.lineJoin = 'round';
		cx = gctx;
		boost = CW * 0.9;
		drawPlant(g, elapsed);
		const sharp = gctx.getImageData(0, 0, cols, rows).data;
		spread(sharp);
		// Le halo : la lumière floutée, posée en douceur sur la planche
		if (haloData) {
			const d = haloData.data;
			for (let i = 0, n = cols * rows; i < n; i++) {
				d[i * 4] = blur[i * 3];
				d[i * 4 + 1] = blur[i * 3 + 1];
				d[i * 4 + 2] = blur[i * 3 + 2];
				d[i * 4 + 3] = 255;
			}
			hctx.putImageData(haloData, 0, 0);
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = 0.42;
			ctx.imageSmoothingEnabled = true;
			ctx.drawImage(halo, 0, 0, W, H);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = 'source-over';
		}
		// L'aura : la même lumière, redessinée en caractères autour de la plante
		const shimmer = Math.floor(elapsed * 9);
		for (let r = 0; r < rows; r++) {
			if (r >= soilRow) break;
			for (let c = 0; c < cols; c++) {
				const i = r * cols + c;
				const R = blur[i * 3];
				const G = blur[i * 3 + 1];
				const B = blur[i * 3 + 2];
				const L = Math.max(R, G, B) / 255;
				if (L < 0.06) continue;
				const S = Math.max(sharp[i * 4], sharp[i * 4 + 1], sharp[i * 4 + 2]) / 255;
				if (S > 0.45) continue;
				// Une aura légère : la rampe s'arrête à « x », jamais de pâté
				let k = Math.min(AURA, 1 + Math.floor(Math.min(1, L * 1.5) * (AURA - 1)));
				if (hash(i * 1.7 + shimmer) > 0.93) k = Math.max(1, k - 1);
				const m = 255 / Math.max(1, R, G, B);
				ctx.fillStyle = styleOf(Math.min(255, R * m * 0.92), Math.min(255, G * m * 0.92), Math.min(255, B * m * 0.92), Math.min(0.6, L * 1.3));
				ctx.fillText(RAMP[k], c * CW + CW / 2, r * CH + 1);
			}
		}

		// ---- la plante, nette
		cx = ctx;
		boost = 1;
		drawPlant(g, elapsed);

		// La graine : elle pulse sur le sol avant que la tige ne parte
		const seedA = 1 - ss(0.2, 0.36, shown);
		if (seedA > 0) {
			const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.2);
			ctx.fillStyle = `rgb(200 245 60 / ${(0.12 * pulse * seedA).toFixed(3)})`;
			ctx.fillRect(axis - 9, soilY - 9, 18, 18);
			ctx.fillStyle = `rgb(200 245 60 / ${seedA.toFixed(3)})`;
			ctx.fillRect(axis - 3, soilY - 3, 6, 6);
		}
		// Le bourgeon qui pousse : une fibre acide au bout de la tige
		if (g.stem > 0 && g.stem < 1) {
			const tip = proj(stemAt(g.stem));
			ctx.fillStyle = 'rgb(200 245 60)';
			ctx.fillRect(tip[0] - 2, tip[1] - 2, 4, 4);
		}

		// Le pollen, en caractères
		if (g.stamen > 0) {
			ctx.font = FONT;
			ctx.textAlign = 'center';
			for (const p of pollen) {
				const k = (p.o + elapsed * 0.07 * p.s) % 1;
				const q = proj([head[0] + p.x * (0.5 + k * 1.4), head[1] + 0.05 + k * 0.55, head[2]]);
				ctx.fillStyle = p.ember ? `rgb(240 122 42 / ${((1 - k) * 0.8 * g.stamen).toFixed(3)})` : `rgb(212 230 122 / ${((1 - k) * 0.75 * g.stamen).toFixed(3)})`;
				ctx.fillText(p.g, q[0], q[1]);
			}
		}

		// ---- la planche : ligne de sol, règle, légendes
		ctx.setLineDash([3, 5]);
		line([[0, soilY], [W, soilY]], `rgb(230 228 220 / ${(0.2 * soilIn).toFixed(3)})`, 1);
		ctx.setLineDash([]);

		// La règle d'herbier : graduée en millimètres, un repère suit la tige
		const rx = narrow ? 14 : 28;
		const mm = unit / 100;
		const tall = Math.max(0, Math.round((soilY - proj(stemAt(g.stem))[1]) / mm));
		const rulerIn = ss(0.02, 0.16, shown);
		if (rulerIn > 0) {
			ctx.globalAlpha = rulerIn;
			line([[rx, soilY], [rx, soilY - 96 * mm]], 'rgb(230 228 220 / 0.22)', 1);
			ctx.font = '9px "Fragment Mono", ui-monospace, monospace';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			for (let i = 0; i <= 95; i += mm > 6 ? 1 : 5) {
				const y = soilY - i * mm;
				const major = i % 10 === 0;
				const mid = i % 5 === 0;
				const lit = i <= tall;
				line([[rx, y], [rx + (major ? 10 : mid ? 6 : 3), y]], lit ? `rgb(200 245 60 / ${major ? 0.8 : 0.45})` : `rgb(230 228 220 / ${major ? 0.35 : 0.16})`, 1);
				if (major && i > 0) {
					ctx.fillStyle = lit ? 'rgb(200 245 60 / 0.8)' : 'rgb(230 228 220 / 0.32)';
					ctx.fillText(String(i), rx + 14, y);
				}
			}
			// Le repère : la hauteur de la tige, reportée sur la règle
			if (g.stem > 0.02) {
				const tipY = proj(stemAt(g.stem))[1];
				ctx.setLineDash([2, 4]);
				line([[rx + 12, tipY], [axis - 0.12 * unit, tipY]], 'rgb(230 228 220 / 0.14)', 1);
				ctx.setLineDash([]);
				line([[rx - 4, tipY], [rx + 12, tipY]], 'rgb(200 245 60)', 1);
				ctx.fillStyle = 'rgb(200 245 60)';
				ctx.fillText(`${tall} mm`, rx + 16, tipY - 9);
			}
			ctx.globalAlpha = 1;
		}

		// Les légendes, chacune quand sa partie a poussé
		const side = narrow ? 0.6 : 1;
		// La racine légendée : à droite, juste sous le sol (loin du compteur)
		const rootTip = roots.filter((p) => p.d < 0.35 && p.t < 0.5).sort((a, b) => b.c - a.c)[0];
		callout([axis, soilY], -16 * side, 'fig. a — the idea', ss(0.02, 0.1, shown) * (1 - ss(0.3, 0.4, shown)));
		// Sur téléphone, seules les légendes du haut : en bas, elles se marchent dessus
		if (!narrow) {
			if (rootTip) callout([rootTip.c * CW + CW / 2, rootTip.r * CH + CH / 2], 12, 'fig. b — roots', ss(0.2, 0.3, shown));
			callout(proj(stemAt(0.2)), 18, 'fig. c — stem', ss(0.34, 0.44, shown));
			callout(proj(leafPoint(stemAt(0.3), 0.3, 0.3, 0.075, 0.4, -0.5, 0.6, 0)), 10, 'fig. d — leaves', ss(0.5, 0.6, shown));
		}
		callout(proj(leafPoint(head, Math.PI, 0.34 * g.petal, 0.15, 0.4, -0.35, 0.8, 0)), -24 * side, 'fig. e — petals', ss(0.72, 0.84, shown));
		callout(proj([head[0], head[1] + 0.13 * g.stamen, head[2]]), -40 * side, 'fig. f — the heart', ss(0.9, 1, shown));

		// ---- l'interface
		bar.style.transform = `scaleX(${shown.toFixed(4)})`;
		pct.textContent = String(Math.round(shown * 100)).padStart(3, '0');
		let s = 0;
		while (s + 1 < STAGES.length && shown >= STAGES[s + 1][0] - 1e-6) s++;
		if (s !== stage) {
			// L'étiquette se remplit, une ligne par étape franchie
			for (let k = Math.max(0, stage + 1); k <= s; k++) {
				const f = fields[k - 1];
				if (!f || !f.dataset.value) continue;
				f.dataset.scrambleText = f.dataset.value;
				f.classList.add('is-in');
				scramble(f, 520);
			}
			stage = s;
			// scramble garde le texte final en mémoire : on lui donne le nouveau
			stageEl.dataset.scrambleText = STAGES[s][1];
			scramble(stageEl, 420);
			if (s > 0) sound.stage(s);
		}

		// ---- la sortie
		if (pinBurn !== null) {
			root.classList.add('is-leaving');
			html.classList.remove('is-loading');
			burn(pinBurn, headPx);
		} else if (leaving >= 0) {
			const p = clamp((now - leaving) / 1350);
			burn(p * p * (3 - 2 * p) * 0.25 + p * 0.75, headPx);
			if (p >= 1) {
				onGone?.();
				return;
			}
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
		},		/** Fin : la fleur finit de s'ouvrir ; à la première visite, on choisit
		 *  d'entrer avec ou sans le son (c'est aussi le geste qui permet au
		 *  navigateur de jouer), puis la planche se consume */
		async done() {
			if (pin !== null) return;
			finished = true;
			target = 1;
			const minimum = 2200 - (performance.now() - start);
			await new Promise((res) => setTimeout(res, Math.max(reduced ? 0 : 700, minimum)));
			const until = performance.now() + 1600;
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
				await new Promise((res) => setTimeout(res, reduced ? 0 : 520));
			}
			this.dismiss();
		},
		dismiss() {
			if (gone) return;
			gone = true;
			html.style.overflow = '';
			// La fleur du hero se recompose pendant que la planche brûle
			html.classList.remove('is-loading');
			const end = () => {
				cancelAnimationFrame(raf);
				removeEventListener('resize', resize);
				html.classList.remove('is-unveiling');
				root.remove();
			};
			if (reduced || document.hidden) return end();
			onGone = end;
			root.classList.add('is-leaving');
			leaving = performance.now();
		},
	};
}
