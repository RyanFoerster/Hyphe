// ASCII vivant : des organismes (pousses, fleurs, racines, mycélium) tracés en
// caractères mono. Ils poussent à l'apparition, ondulent, mutent par endroits
// et réagissent au curseur. Les fleurs sont remplies de chiffres par bandes,
// comme des lignes de niveau : la même langue que la lentille de l'artefact.
//
// <canvas data-ascii data-ascii-kind="flower|sprout|roots|mycelium"
//         data-ascii-seed="3" data-ascii-size="11" data-ascii-accent="ember|acid">

type Kind = 'flower' | 'sprout' | 'roots' | 'mycelium';
/** Point d'un tracé : x, y (unités normalisées) et g, l'âge de croissance 0→1 */
type P = { x: number; y: number; g: number };
type Stroke = { pts: P[]; tone: 0 | 1 };
type Head = { x: number; y: number; r: number; petals: number; g: number; spin: number };

const BONE = '230 228 220';
const COLORS = {
	acid: '200 245 60',
	ember: '240 122 42',
};

function rng(seed: number) {
	let a = seed >>> 0 || 1;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const hash = (a: number, b: number, c = 0) => {
	let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Tige courbe de (x0,y0) vers le haut, avec une flexion douce */
function stem(rand: () => number, x0: number, y0: number, len: number, lean: number, g0: number, g1: number, steps = 26): P[] {
	const pts: P[] = [];
	const bend = (rand() - 0.5) * 0.5 + lean;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		pts.push({
			x: x0 + Math.sin(t * 1.6) * bend * len * 0.6 + lean * t * len * 0.3,
			y: y0 - t * len,
			g: g0 + (g1 - g0) * t,
		});
	}
	return pts;
}

function leaf(from: P, side: number, size: number): P[] {
	const pts: P[] = [];
	for (let i = 0; i <= 10; i++) {
		const t = i / 10;
		pts.push({
			x: from.x + side * t * size,
			y: from.y - Math.sin(t * Math.PI * 0.9) * size * 0.45 - t * size * 0.15,
			g: Math.min(1, from.g + t * 0.15),
		});
	}
	return pts;
}

function grow(kind: Kind, seed: number, A: number) {
	const rand = rng(seed);
	const strokes: Stroke[] = [];
	const heads: Head[] = [];

	if (kind === 'flower' || kind === 'sprout') {
		const count = kind === 'flower' ? 1 : 3 + Math.floor(rand() * 3);
		for (let i = 0; i < count; i++) {
			const main = kind === 'flower' || i === 0;
			const x0 = A / 2 + (kind === 'flower' ? 0 : (rand() - 0.5) * A * 0.35);
			const len = main ? (kind === 'flower' ? 0.6 : 0.62 + rand() * 0.2) : 0.3 + rand() * 0.35;
			const lean = (rand() - 0.5) * (main ? 0.2 : 0.7);
			const pts = stem(rand, x0, 1.02, len, lean, 0, 0.7);
			strokes.push({ pts, tone: 0 });
			const leaves = main ? 2 : rand() > 0.5 ? 1 : 0;
			for (let l = 0; l < leaves; l++) {
				const at = pts[Math.floor(pts.length * (0.25 + rand() * 0.35))];
				strokes.push({ pts: leaf(at, l % 2 ? -1 : 1, 0.12 + rand() * 0.1), tone: 0 });
			}
			const tip = pts[pts.length - 1];
			const r = main ? (kind === 'flower' ? 0.26 : 0.13) : 0.04 + rand() * 0.05;
			heads.push({ x: tip.x, y: tip.y - r * 0.4, r, petals: 5 + Math.floor(rand() * 4), g: 0.7, spin: rand() * 6 });
		}
	}

	if (kind === 'roots') {
		const branch = (x: number, y: number, angle: number, len: number, depth: number, g: number) => {
			const pts: P[] = [];
			const steps = 14;
			let cx = x;
			let cy = y;
			let a = angle;
			for (let i = 0; i <= steps; i++) {
				pts.push({ x: cx, y: cy, g: g + (i / steps) * 0.18 });
				a += (rand() - 0.5) * 0.35;
				cx += Math.cos(a) * (len / steps);
				cy += Math.sin(a) * (len / steps);
			}
			strokes.push({ pts, tone: depth > 2 ? 1 : 0 });
			if (depth < 5) {
				const n = 1 + (rand() > 0.45 ? 1 : 0);
				for (let k = 0; k < n; k++) {
					const at = pts[Math.floor(pts.length * (0.4 + rand() * 0.6)) - 1];
					branch(at.x, at.y, a + (rand() - 0.5) * 1.4, len * (0.55 + rand() * 0.2), depth + 1, at.g);
				}
			}
		};
		branch(A / 2, -0.02, Math.PI / 2, 0.45, 0, 0);
	}

	if (kind === 'mycelium') {
		const nodes = 4 + Math.floor(rand() * 3);
		for (let n = 0; n < nodes; n++) {
			let x = rand() * A;
			let y = 0.2 + rand() * 0.6;
			let a = rand() * Math.PI * 2;
			const pts: P[] = [];
			const steps = 40 + Math.floor(rand() * 40);
			for (let i = 0; i <= steps; i++) {
				pts.push({ x, y, g: (i / steps) * 0.9 });
				a += (rand() - 0.5) * 0.5;
				x += Math.cos(a) * 0.02;
				y += Math.sin(a) * 0.012;
			}
			strokes.push({ pts, tone: n % 2 ? 1 : 0 });
			if (rand() > 0.4) {
				const tip = pts[pts.length - 1];
				heads.push({ x: tip.x, y: tip.y, r: 0.03 + rand() * 0.03, petals: 0, g: 0.9, spin: 0 });
			}
		}
	}

	return { strokes, heads };
}

function dirChar(dx: number, dy: number) {
	const a = Math.atan2(-dy, dx);
	const d = ((a * 180) / Math.PI + 180) % 180;
	if (d < 22.5 || d >= 157.5) return '-';
	if (d < 67.5) return '/';
	if (d < 112.5) return '|';
	return '\\';
}

const MUTATE: Record<string, string> = { '|': ':', '/': '.', '\\': '.', '-': '~' };

class Organism {
	private ctx: CanvasRenderingContext2D;
	private cols = 0;
	private rows = 0;
	private cw = 0;
	private ch = 0;
	private A = 1;
	private shape: ReturnType<typeof grow> = { strokes: [], heads: [] };
	private grid: string[] = [];
	private tone: Uint8Array = new Uint8Array(0);
	private progress = 0;
	private visible = false;
	private pointer = { x: -1e3, y: -1e3, active: false };
	private last = 0;
	private raf = 0;
	private kind: Kind;
	private seed: number;
	private size: number;
	private accent: string;

	constructor(
		private canvas: HTMLCanvasElement,
		private still: boolean,
	) {
		this.ctx = canvas.getContext('2d')!;
		this.kind = (canvas.dataset.asciiKind as Kind) ?? 'sprout';
		this.seed = Number(canvas.dataset.asciiSeed ?? 1);
		this.size = Number(canvas.dataset.asciiSize ?? 11);
		this.accent = COLORS[(canvas.dataset.asciiAccent as keyof typeof COLORS) ?? 'acid'] ?? COLORS.acid;
		if (still) this.progress = 1;

		new ResizeObserver(() => this.resize()).observe(canvas);
		new IntersectionObserver(([entry]) => {
			this.visible = entry.isIntersecting;
			if (this.visible) this.start();
		}).observe(canvas);

		if (!still) {
			const host = canvas.parentElement ?? canvas;
			host.addEventListener('pointermove', (e) => {
				const r = canvas.getBoundingClientRect();
				this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, active: true };
			});
			host.addEventListener('pointerleave', () => (this.pointer.active = false));
		}
	}

	private resize() {
		const r = this.canvas.getBoundingClientRect();
		if (!r.width || !r.height) return;
		const dpr = Math.min(devicePixelRatio, 2);
		this.canvas.width = Math.round(r.width * dpr);
		this.canvas.height = Math.round(r.height * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.cw = this.size * 0.62;
		this.ch = this.size * 1.18;
		this.cols = Math.max(1, Math.floor(r.width / this.cw));
		this.rows = Math.max(1, Math.floor(r.height / this.ch));
		this.A = (this.cols * this.cw) / (this.rows * this.ch);
		this.shape = grow(this.kind, this.seed, this.A);
		this.grid = new Array(this.cols * this.rows).fill('');
		this.tone = new Uint8Array(this.cols * this.rows);
		this.draw(performance.now());
	}

	private start() {
		if (this.raf || this.still) {
			if (this.still) this.draw(0);
			return;
		}
		const loop = (now: number) => {
			if (!this.visible) {
				this.raf = 0;
				return;
			}
			this.raf = requestAnimationFrame(loop);
			if (now - this.last < 33) return; // ~30 i/s suffisent pour de l'ASCII
			this.last = now;
			this.progress = Math.min(1, this.progress + 0.012);
			this.draw(now);
		};
		this.raf = requestAnimationFrame(loop);
	}

	private put(cx: number, cy: number, ch: string, tone: number) {
		if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
		const i = cy * this.cols + cx;
		if (tone >= this.tone[i] || !this.grid[i]) {
			this.grid[i] = ch;
			this.tone[i] = tone;
		}
	}

	private draw(now: number) {
		const { ctx, cols, rows, cw, ch, A } = this;
		if (!cols) return;
		const t = now / 1000;
		this.grid.fill('');
		this.tone.fill(0);

		const px = this.pointer.active ? (this.pointer.x / (cols * cw)) * A : -9;
		const py = this.pointer.active ? this.pointer.y / (rows * ch) : -9;
		const toCell = (x: number, y: number) => [Math.floor((x / A) * cols), Math.floor(y * rows)];
		const sway = (p: P) => {
			let x = p.x + Math.sin(t * 0.8 + p.g * 3 + this.seed) * 0.018 * p.g * p.g;
			let y = p.y;
			const dx = x - px;
			const dy = y - py;
			const d2 = dx * dx + dy * dy;
			if (d2 < 0.02) {
				const push = (0.02 - d2) * 2.2;
				x += dx * push * 8;
				y += dy * push * 4;
			}
			return { x, y };
		};

		// Tiges, racines, filaments
		for (const s of this.shape.strokes) {
			for (let i = 1; i < s.pts.length; i++) {
				const a = s.pts[i - 1];
				const b = s.pts[i];
				if (b.g > this.progress) break;
				const pa = sway(a);
				const pb = sway(b);
				const [ax, ay] = toCell(pa.x, pa.y);
				const [bx, by] = toCell(pb.x, pb.y);
				const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1) * 2;
				const c = dirChar((bx - ax) * cw, (by - ay) * ch);
				for (let k = 0; k <= steps; k++) {
					const cx = Math.round(ax + ((bx - ax) * k) / steps);
					const cy = Math.round(ay + ((by - ay) * k) / steps);
					const mutate = hash(cx, cy, Math.floor(t * 1.5)) < 0.04;
					this.put(cx, cy, mutate ? (MUTATE[c] ?? c) : c, s.tone ? 1 : 2);
				}
			}
		}

		// Têtes : fleurs en bandes de chiffres, spores en anneaux
		for (const h of this.shape.heads) {
			if (h.g > this.progress) continue;
			const bloom = Math.min(1, (this.progress - h.g) / 0.3);
			const c = sway({ x: h.x, y: h.y, g: 1 });
			const R = h.r * bloom;
			const [ccx, ccy] = toCell(c.x, c.y);
			const spanX = Math.ceil(((R * 1.1) / A) * cols) + 1;
			const spanY = Math.ceil(R * 1.1 * rows) + 1;
			for (let cy = ccy - spanY; cy <= ccy + spanY; cy++) {
				for (let cx = ccx - spanX; cx <= ccx + spanX; cx++) {
					const x = ((cx + 0.5) / cols) * A - c.x;
					const y = (cy + 0.5) / rows - c.y;
					const d = Math.hypot(x, y);
					const th = Math.atan2(y, x) + h.spin + t * 0.05;
					const edge = h.petals
						? R * (0.32 + 0.68 * Math.pow(Math.abs(Math.cos((h.petals * th) / 2)), 0.7))
						: R;
					const cellR = 1 / rows;
					if (Math.abs(d - edge) < cellR * 0.75) {
						this.put(cx, cy, h.petals ? dirChar(-y, x) : 'o', 3);
					} else if (d < edge) {
						if (d < R * 0.16) {
							this.put(cx, cy, d < R * 0.08 ? '@' : '*', 4);
							continue;
						}
						const band = Math.floor((d / edge) * 4);
						if (hash(cx, cy, band) < 0.5) {
							const digit = (band * 3 + Math.floor(t * 1.4 - band * 0.6) + 100) % 10;
							this.put(cx, cy, String(digit), 4);
						}
					}
				}
			}
		}

		// Rendu
		const W = cols * cw;
		const H = rows * ch;
		ctx.clearRect(0, 0, W + cw, H + ch);
		ctx.font = `${this.size}px "Fragment Mono", ui-monospace, monospace`;
		ctx.textBaseline = 'top';
		const pr = 90;
		for (let i = 0; i < this.grid.length; i++) {
			let glyph = this.grid[i];
			if (!glyph) continue;
			const cx = i % cols;
			const cy = (i / cols) | 0;
			const x = cx * cw;
			const y = cy * ch;
			const tone = this.tone[i];
			let color = tone >= 3 ? `rgb(${this.accent} / ${tone === 4 ? 0.85 : 0.7})` : `rgb(${BONE} / ${tone === 2 ? 0.55 : 0.3})`;
			if (this.pointer.active) {
				const d = Math.hypot(x - this.pointer.x, y - this.pointer.y);
				if (d < pr) {
					if (hash(cx, cy, Math.floor(t * 8)) < 0.35) glyph = hash(cx, cy) < 0.5 ? '0' : '1';
					color = `rgb(${COLORS.acid} / ${0.95 - (d / pr) * 0.5})`;
				}
			}
			ctx.fillStyle = color;
			ctx.fillText(glyph, x, y);
		}
	}
}

export async function mountAscii(root: ParentNode = document) {
	const canvases = root.querySelectorAll<HTMLCanvasElement>('canvas[data-ascii]:not([data-ascii-ready])');
	if (!canvases.length) return;
	await document.fonts.load('11px "Fragment Mono"').catch(() => {});
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	for (const c of canvases) {
		c.dataset.asciiReady = '';
		new Organism(c, still);
	}
}
