// Le chargement : une spore germe. Un réseau d'hyphes en caractères pousse
// depuis le centre au rythme du chargement réel, dans une boîte de suivi ;
// en bas, une barre en caractères, la valeur brute et un journal de démarrage.
// À la fin, l'écran part en mosaïque comme une transition de page.

import { mosaic } from './tiles';
import { scramble } from './text';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

type Step = { x: number; y: number; px: number; py: number; t: number; node: boolean };

const LOG: [number, string][] = [
	[0, 'sow     hyphae_floralis'],
	[0.18, 'grow    stem — spiral, fibres'],
	[0.42, 'open    petals — veil, iris'],
	[0.66, 'warm    light — pollen, sap'],
	[0.86, 'hollow  stem — 04 specimens'],
	[1, 'ready   entering the flower'],
];

function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), a | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Le réseau : des marches au hasard qui se ramifient, chaque pas daté */
function grow(cols: number, rows: number, seed: number) {
	const rand = rng(seed);
	const dirs = [
		[1, 0],
		[1, -1],
		[0, -1],
		[-1, -1],
		[-1, 0],
		[-1, 1],
		[0, 1],
		[1, 1],
	] as const;
	const cx = Math.floor(cols / 2);
	const cy = Math.floor(rows / 2);
	const taken = new Set<number>([cy * cols + cx]);
	const steps: Step[] = [{ x: cx, y: cy, px: cx, py: cy, t: 0, node: true }];
	let tips = Array.from({ length: 9 }, (_, i) => ({ x: cx, y: cy, d: i % 8, t: 0 }));
	const rx = cols * 0.48;
	const ry = rows * 0.46;
	const free = (x: number, y: number) =>
		((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && !taken.has(y * cols + x);
	while (tips.length && steps.length < cols * rows * 0.3) {
		const next: typeof tips = [];
		for (const tip of tips) {
			// Une hyphe dérive en cherchant ; bloquée, elle tente de contourner
			const turn = rand() < 0.35 ? (rand() < 0.5 ? 1 : 7) : 0;
			let d = (tip.d + turn) % 8;
			let ok = false;
			for (const alt of [0, 1, 7, 2, 6]) {
				const dd = (d + alt) % 8;
				if (free(tip.x + dirs[dd][0], tip.y + dirs[dd][1])) {
					d = dd;
					ok = true;
					break;
				}
			}
			if (!ok) continue;
			const [dx, dy] = dirs[d];
			const x = tip.x + dx;
			const y = tip.y + dy;
			taken.add(y * cols + x);
			const branch = rand() < 0.11;
			steps.push({ x, y, px: tip.x, py: tip.y, t: tip.t + 1, node: branch });
			if (rand() > 0.004) next.push({ x, y, d, t: tip.t + 1 });
			if (branch) next.push({ x, y, d: (d + (rand() < 0.5 ? 2 : 6)) % 8, t: tip.t + 1 });
		}
		tips = next;
	}
	const maxT = steps.reduce((m, s) => Math.max(m, s.t), 1);
	return { steps, maxT };
}

export function createLoader(root: HTMLElement) {
	const canvas = root.querySelector<HTMLCanvasElement>('[data-loader-canvas]')!;
	const bar = root.querySelector<HTMLElement>('[data-loader-bar]')!;
	const pct = root.querySelector<HTMLElement>('[data-loader-pct]')!;
	const log = root.querySelector<HTMLElement>('[data-loader-log]')!;
	const ctx = canvas.getContext('2d')!;
	const html = document.documentElement;
	html.style.overflow = 'hidden';
	// Les entrées de texte du hero attendent la fin du chargement (voir global.css)
	html.classList.add('is-loading');
	let gone = false;

	const cw = 8;
	const ch = 13;
	let net = grow(1, 1, 1);
	const resize = () => {
		const r = canvas.getBoundingClientRect();
		const dpr = Math.min(devicePixelRatio, 2);
		canvas.width = Math.round(r.width * dpr);
		canvas.height = Math.round(r.height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		net = grow(Math.floor(r.width / cw), Math.floor(r.height / ch), 7);
	};
	resize();

	let target = 0;
	let shown = 0;
	let logged = 0;
	let raf = 0;
	let finished = false;
	const start = performance.now();

	const writeLog = () => {
		while (logged < LOG.length && shown >= LOG[logged][0] - 1e-6) {
			const li = document.createElement('li');
			const [, text] = LOG[logged];
			li.innerHTML = `<span class="text-mineral-dim">${String(logged).padStart(2, '0')}</span> <span>${text}</span>`;
			log.append(li);
			scramble(li.lastElementChild as HTMLElement, 420);
			logged++;
		}
	};

	let last = performance.now();
	const draw = (now: number) => {
		const elapsed = (now - start) / 1000;
		const dt = Math.min(0.25, (now - last) / 1000);
		last = now;
		// Le réseau avance au rythme réel, sans jamais sembler figé
		const floor = finished ? 1 : Math.min(0.25, elapsed * 0.12);
		const goal = Math.max(target, floor);
		// Lissage réglé sur le temps, pas sur le nombre d'images
		shown = reduced ? goal : shown + (goal - shown) * (1 - Math.pow(0.006, dt));
		if (goal - shown < 0.002) shown = goal;

		const r = canvas.getBoundingClientRect();
		ctx.clearRect(0, 0, r.width, r.height);
		// Le réseau au trait fin : chaque pas relie la cellule à la précédente
		const front = shown * net.maxT;
		ctx.lineCap = 'round';
		ctx.lineWidth = 0.9;
		// Chaque nœud est décalé un peu au hasard : un réseau vivant, pas une grille
		const jit = (x: number, y: number, k: number) => {
			const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
			return (v - Math.floor(v) - 0.5) * 0.8;
		};
		const X = (x: number, y: number) => (x + 0.5 + jit(x, y, 1)) * cw;
		const Y = (x: number, y: number) => (y + 0.5 + jit(x, y, 2)) * ch;
		for (const s of net.steps) {
			if (s.t > front || !s.t) continue;
			const age = front - s.t;
			ctx.strokeStyle = age < 2.5 ? 'rgb(200 245 60)' : `rgb(230 228 220 / ${Math.max(0.14, 0.55 - age * 0.012)})`;
			ctx.beginPath();
			ctx.moveTo(X(s.px, s.py), Y(s.px, s.py));
			ctx.lineTo(X(s.x, s.y), Y(s.x, s.y));
			ctx.stroke();
			if (s.node) {
				ctx.fillStyle = age < 2.5 ? 'rgb(200 245 60)' : 'rgb(230 228 220 / 0.7)';
				ctx.beginPath();
				ctx.arc(X(s.x, s.y), Y(s.x, s.y), 1.6 + Math.sin(elapsed * 3 + s.x) * 0.4, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		bar.style.width = `${(shown * 100).toFixed(1)}%`;
		pct.textContent = `${String(Math.round(shown * 100)).padStart(3, '0')}%`;
		writeLog();
		raf = requestAnimationFrame(draw);
	};
	raf = requestAnimationFrame(draw);

	return {
		/** Avancement réel, 0 → 1 */
		progress(f: number) {
			target = Math.max(target, Math.min(0.95, f * 0.9));
		},
		/** Fin : le réseau termine sa pousse, puis l'écran part en tuiles */
		async done() {
			finished = true;
			target = 1;
			const minimum = 1400 - (performance.now() - start);
			await new Promise((res) => setTimeout(res, Math.max(reduced ? 0 : 650, minimum)));
			const until = performance.now() + 1200;
			while (shown < 1 && performance.now() < until) await new Promise((res) => setTimeout(res, 50));
			await new Promise((res) => setTimeout(res, reduced ? 0 : 280));
			this.dismiss();
		},
		dismiss() {
			if (gone) return;
			gone = true;
			cancelAnimationFrame(raf);
			html.style.overflow = '';
			html.classList.remove('is-loading');
			if (reduced) {
				root.remove();
				return;
			}
			// Le voile de tuiles est plein dès sa première image : il remplace le loader
			void mosaic({ x: innerWidth / 2, y: innerHeight / 2 }, false, 1100);
			root.remove();
		},
	};
}
