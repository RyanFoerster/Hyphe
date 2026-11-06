// Visuels génératifs des projets (SVG calculés au build).
// Trois familles qui parlent la même langue topographique que l'ASCII du site :
//   topo   → lignes de niveau d'un relief de bruit
//   strata → couches géologiques déformées
//   bloom  → une fleur tracée en isolignes concentriques

import type { Project } from '../data/projects';

const W = 1600;
const H = 1000;

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeNoise(seed: number) {
	const rand = mulberry32(seed);
	const SIZE = 256;
	const values = Float32Array.from({ length: SIZE * SIZE }, rand);
	const at = (x: number, y: number) => values[(y & (SIZE - 1)) * SIZE + (x & (SIZE - 1))];
	const smooth = (t: number) => t * t * (3 - 2 * t);
	const noise = (x: number, y: number) => {
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		const u = smooth(x - xi);
		const v = smooth(y - yi);
		const a = at(xi, yi);
		const b = at(xi + 1, yi);
		const c = at(xi, yi + 1);
		const d = at(xi + 1, yi + 1);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	};
	return (x: number, y: number, octaves = 4) => {
		let sum = 0;
		let amp = 0.5;
		let freq = 1;
		for (let i = 0; i < octaves; i++) {
			sum += amp * noise(x * freq, y * freq);
			freq *= 2;
			amp *= 0.5;
		}
		return sum;
	};
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Marching squares : segments de l'isoligne `level` sur une grille de valeurs. */
function isoline(grid: Float32Array, cols: number, rows: number, level: number, cw: number, ch: number) {
	let d = '';
	const v = (x: number, y: number) => grid[y * cols + x];
	const lerp = (a: number, b: number) => (level - a) / (b - a);
	for (let y = 0; y < rows - 1; y++) {
		for (let x = 0; x < cols - 1; x++) {
			const a = v(x, y);
			const b = v(x + 1, y);
			const c = v(x + 1, y + 1);
			const e = v(x, y + 1);
			const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (e > level ? 1 : 0);
			if (idx === 0 || idx === 15) continue;
			const top = [(x + lerp(a, b)) * cw, y * ch];
			const right = [(x + 1) * cw, (y + lerp(b, c)) * ch];
			const bottom = [(x + lerp(e, c)) * cw, (y + 1) * ch];
			const left = [x * cw, (y + lerp(a, e)) * ch];
			const seg = (p: number[], q: number[]) => {
				d += `M${r1(p[0])} ${r1(p[1])}L${r1(q[0])} ${r1(q[1])}`;
			};
			switch (idx) {
				case 1: case 14: seg(left, bottom); break;
				case 2: case 13: seg(bottom, right); break;
				case 3: case 12: seg(left, right); break;
				case 4: case 11: seg(top, right); break;
				case 6: case 9: seg(top, bottom); break;
				case 7: case 8: seg(left, top); break;
				case 5: seg(left, top); seg(bottom, right); break;
				case 10: seg(top, right); seg(left, bottom); break;
			}
		}
	}
	return d;
}

function topo(p: Project['visual']) {
	const fbm = makeNoise(p.seed);
	const rand = mulberry32(p.seed * 31);
	const cols = 120;
	const rows = 75;
	const cw = W / (cols - 1);
	const ch = H / (rows - 1);
	// Deux ou trois « collines » donnent un relief lisible au lieu d'un bruit uniforme
	const hills = Array.from({ length: 3 }, () => ({
		x: 0.2 + rand() * 0.6,
		y: 0.2 + rand() * 0.6,
		r: 0.12 + rand() * 0.18,
	}));
	const grid = new Float32Array(cols * rows);
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const u = x / (cols - 1);
			const v = y / (rows - 1);
			let h = fbm(u * 3.2, v * 2.2) * 0.9;
			for (const k of hills) {
				const dx = (u - k.x) * 1.6;
				const dy = v - k.y;
				h += Math.exp(-(dx * dx + dy * dy) / (k.r * k.r)) * 0.55;
			}
			grid[y * cols + x] = h;
		}
	}
	let paths = '';
	const levels = 14;
	for (let i = 1; i <= levels; i++) {
		const level = 0.18 + (i / levels) * 0.95;
		const d = isoline(grid, cols, rows, level, cw, ch);
		if (!d) continue;
		const accent = i === levels - 3;
		paths += `<path d="${d}" stroke="${accent ? p.accent : p.line}" stroke-opacity="${accent ? 0.9 : 0.25 + (i / levels) * 0.45}" stroke-width="${accent ? 1.6 : 1.1}"/>`;
	}
	return paths;
}

function strata(p: Project['visual']) {
	const fbm = makeNoise(p.seed);
	let paths = '';
	const lines = 46;
	for (let i = 0; i < lines; i++) {
		const base = 80 + (i / (lines - 1)) * (H - 160);
		let d = '';
		for (let s = 0; s <= 100; s++) {
			const x = (s / 100) * W;
			const warp =
				(fbm(s / 100 * 2.5, i * 0.07) - 0.5) * 220 +
				Math.sin(s / 100 * Math.PI * 1.3 + i * 0.05) * 60 * (i / lines);
			d += `${s ? 'L' : 'M'}${r1(x)} ${r1(base + warp)}`;
		}
		const accent = i === 29;
		paths += `<path d="${d}" stroke="${accent ? p.accent : p.line}" stroke-opacity="${accent ? 0.95 : 0.18 + (i % 5 === 0 ? 0.35 : 0.12)}" stroke-width="${accent ? 2 : 1}"/>`;
	}
	// Carotte : une coupe verticale à travers les couches
	paths += `<rect x="${W * 0.68}" y="60" width="64" height="${H - 120}" fill="none" stroke="${p.accent}" stroke-opacity=".55" stroke-dasharray="2 6"/>`;
	return paths;
}

function bloom(p: Project['visual']) {
	const fbm = makeNoise(p.seed);
	const rand = mulberry32(p.seed * 17);
	const petals = 5 + Math.floor(rand() * 4);
	const cx = W * (0.5 + (rand() - 0.5) * 0.2);
	const cy = H * 0.52;
	let paths = '';
	const rings = 22;
	for (let i = 1; i <= rings; i++) {
		const scale = i / rings;
		let d = '';
		for (let s = 0; s <= 360; s++) {
			const t = (s / 360) * Math.PI * 2;
			const petal = Math.pow(Math.abs(Math.cos((petals * t) / 2)), 0.6 + scale * 0.8);
			const wobble = (fbm(Math.cos(t) * 1.5 + 5, Math.sin(t) * 1.5 + i * 0.08) - 0.5) * 0.35;
			const r = H * 0.46 * scale * (0.35 + 0.65 * petal + wobble * scale);
			d += `${s ? 'L' : 'M'}${r1(cx + Math.cos(t) * r)} ${r1(cy + Math.sin(t) * r)}`;
		}
		const accent = i === 6;
		paths += `<path d="${d}Z" stroke="${accent ? p.accent : p.line}" stroke-opacity="${accent ? 0.9 : 0.12 + scale * 0.5}" stroke-width="${accent ? 1.8 : 1.1}"/>`;
	}
	// Pollen : quelques points autour du cœur
	for (let i = 0; i < 40; i++) {
		const a = rand() * Math.PI * 2;
		const r = 10 + rand() * 60;
		paths += `<circle cx="${r1(cx + Math.cos(a) * r)}" cy="${r1(cy + Math.sin(a) * r)}" r="${r1(1 + rand() * 2.2)}" fill="${p.accent}" fill-opacity="${r1(0.4 + rand() * 0.5)}"/>`;
	}
	return paths;
}

export function projectSvg(project: Project) {
	const p = project.visual;
	const body = p.kind === 'topo' ? topo(p) : p.kind === 'strata' ? strata(p) : bloom(p);
	// Grille de points discrète, commune aux trois familles
	const dots = `<pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${p.line}" fill-opacity=".18"/></pattern>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${dots}<radialGradient id="v" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${p.line}" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs><rect width="${W}" height="${H}" fill="${p.bg}"/><rect width="${W}" height="${H}" fill="url(#g)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</g><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`;
}
