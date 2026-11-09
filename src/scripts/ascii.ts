// Organismes vivants : pousses, fleurs, racines, mycélium, tracés au trait fin
// comme une planche d'herbier. Ils poussent à l'apparition, ondulent au vent et
// s'écartent sous le curseur. Les fleurs sont des voiles translucides nervurés.
// (Le nom « ascii » reste celui des attributs data-ascii, historiques.)
//
// <canvas data-ascii data-ascii-kind="flower|sprout|roots|mycelium"
//         data-ascii-seed="3" data-ascii-size="11" data-ascii-accent="ember|acid">

type Kind = 'flower' | 'sprout' | 'roots' | 'mycelium';
/** Point d'un tracé : x, y (unités normalisées) et g, l'âge de croissance 0→1 */
type P = { x: number; y: number; g: number };
type Stroke = { pts: P[]; tone: 0 | 1 };
type Head = { x: number; y: number; r: number; petals: number; g: number; spin: number };

const BONE = '230 228 220';
const MOSS = '150 196 120';
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

class Organism {
	private ctx: CanvasRenderingContext2D;
	private W = 0;
	private H = 0;
	private A = 1;
	private shape: ReturnType<typeof grow> = { strokes: [], heads: [] };
	private progress = 0;
	private visible = false;
	private pointer = { x: -1e3, y: -1e3, active: false };
	private raf = 0;
	private kind: Kind;
	private seed: number;
	private accent: string;

	constructor(
		private canvas: HTMLCanvasElement,
		private still: boolean,
	) {
		this.ctx = canvas.getContext('2d')!;
		this.kind = (canvas.dataset.asciiKind as Kind) ?? 'sprout';
		this.seed = Number(canvas.dataset.asciiSeed ?? 1);
		this.accent = COLORS[(canvas.dataset.asciiAccent as keyof typeof COLORS) ?? 'acid'] ?? COLORS.acid;
		// Arrivée en continu : l'organisme du hero est déjà poussé, comme sur la page d'avant
		if (still || (canvas.hasAttribute('data-hero-ascii') && document.documentElement.classList.contains('continued'))) this.progress = 1;

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
		this.W = r.width;
		this.H = r.height;
		this.A = r.width / r.height;
		this.shape = grow(this.kind, this.seed, this.A);
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
			this.progress = Math.min(1, this.progress + 0.006);
			this.draw(now);
		};
		this.raf = requestAnimationFrame(loop);
	}

	private draw(now: number) {
		const { ctx, W, H, A } = this;
		if (!W) return;
		const t = now / 1000;
		ctx.clearRect(0, 0, W, H);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		const px = this.pointer.active ? (this.pointer.x / W) * A : -9;
		const py = this.pointer.active ? this.pointer.y / H : -9;
		// Le vent, et le curseur qui écarte doucement les tiges
		const at = (p: P) => {
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
			return { x: (x / A) * W, y: y * H };
		};

		// Tiges, racines, filaments : un trait fin doublé d'un halo léger
		for (const s of this.shape.strokes) {
			const pts: { x: number; y: number }[] = [];
			for (const p of s.pts) {
				if (p.g > this.progress) break;
				pts.push(at(p));
			}
			if (pts.length < 2) continue;
			const line = () => {
				ctx.beginPath();
				ctx.moveTo(pts[0].x, pts[0].y);
				for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
				ctx.stroke();
			};
			ctx.strokeStyle = `rgb(${s.tone ? BONE : MOSS} / 0.08)`;
			ctx.lineWidth = s.tone ? 2.5 : 3.5;
			line();
			ctx.strokeStyle = `rgb(${s.tone ? BONE : MOSS} / ${s.tone ? 0.32 : 0.55})`;
			ctx.lineWidth = s.tone ? 0.6 : 0.9;
			line();
		}

		// Têtes : fleurs en voile translucide, nervurées, cœur de pollen
		for (const h of this.shape.heads) {
			if (h.g > this.progress) continue;
			const bloom = Math.min(1, (this.progress - h.g) / 0.3);
			const c = at({ x: h.x, y: h.y, g: 1 });
			const R = h.r * bloom * H;
			if (R < 0.5) continue;
			const spin = h.spin + t * 0.05;
			if (!h.petals) {
				ctx.strokeStyle = `rgb(${this.accent} / 0.6)`;
				ctx.lineWidth = 0.8;
				ctx.beginPath();
				ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
				ctx.stroke();
				continue;
			}
			const edge = (th: number) => R * (0.32 + 0.68 * Math.pow(Math.abs(Math.cos((h.petals * (th - spin)) / 2)), 0.7));
			ctx.beginPath();
			for (let k = 0; k <= 96; k++) {
				const th = (k / 96) * Math.PI * 2;
				const r = edge(th);
				const x = c.x + Math.cos(th) * r;
				const y = c.y + Math.sin(th) * r;
				if (k) ctx.lineTo(x, y);
				else ctx.moveTo(x, y);
			}
			const fill = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
			fill.addColorStop(0, `rgb(${this.accent} / 0.22)`);
			fill.addColorStop(1, `rgb(${BONE} / 0.04)`);
			ctx.fillStyle = fill;
			ctx.fill();
			ctx.strokeStyle = `rgb(${BONE} / 0.55)`;
			ctx.lineWidth = 0.7;
			ctx.stroke();
			// Nervures : du cœur vers le bout de chaque pétale
			ctx.strokeStyle = `rgb(${BONE} / 0.18)`;
			ctx.lineWidth = 0.5;
			ctx.beginPath();
			for (let k = 0; k < h.petals * 3; k++) {
				const th = spin + (k / (h.petals * 3)) * Math.PI * 2;
				const r = edge(th) * 0.92;
				ctx.moveTo(c.x + Math.cos(th) * R * 0.12, c.y + Math.sin(th) * R * 0.12);
				ctx.lineTo(c.x + Math.cos(th) * r, c.y + Math.sin(th) * r);
			}
			ctx.stroke();
			// Cœur : quelques grains de pollen
			ctx.fillStyle = `rgb(${this.accent} / 0.85)`;
			for (let k = 0; k < 9; k++) {
				const a2 = k * 2.4 + h.spin;
				const r2 = R * 0.12 * Math.sqrt(k / 9);
				ctx.beginPath();
				ctx.arc(c.x + Math.cos(a2) * r2, c.y + Math.sin(a2) * r2, 1.1, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}

export async function mountAscii(root: ParentNode = document) {
	const canvases = root.querySelectorAll<HTMLCanvasElement>('canvas[data-ascii]:not([data-ascii-ready])');
	if (!canvases.length) return;
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	for (const c of canvases) {
		c.dataset.asciiReady = '';
		new Organism(c, still);
	}
}
