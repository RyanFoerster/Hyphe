// Pièces communes au monde WebGL : bruit GLSL, mélange additif qui préserve
// l'alpha, triangle plein écran, atlas de caractères.
//
// Convention d'alpha dans la cible de rendu : 0 = vide, 1 = matière (peut
// passer en ASCII), 2 = image nette (spécimens, jamais convertie).

import * as THREE from 'three';

/** Caractères de l'atlas : chiffres 0-9, rampe de densité 10-21, traits 22-27 */
export const GLYPHS = '0123456789' + ' .:-~=+*x%#@' + '/\\|<>^';
export const GLYPH_SLOTS = 32;

export const NOISE = /* glsl */ `
	float h3(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 271.3))) * 43758.5453); }
	float n3(vec3 p) {
		vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
		return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
			mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
	}
	float fbm3(vec3 p) { return n3(p) * 0.55 + n3(p * 2.07) * 0.3 + n3(p * 4.3) * 0.15; }
`;

/** Lumière ajoutée sans toucher à l'alpha (qui sert de masque à la passe finale) */
export function additive<T extends THREE.Material>(material: T): T {
	material.transparent = true;
	material.depthWrite = false;
	material.blending = THREE.CustomBlending;
	material.blendEquation = THREE.AddEquation;
	material.blendSrc = THREE.OneFactor;
	material.blendDst = THREE.OneFactor;
	material.blendSrcAlpha = THREE.ZeroFactor;
	material.blendDstAlpha = THREE.OneFactor;
	return material;
}

export function fullscreenTriangle() {
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
	return geo;
}

export const FULLSCREEN_VERT = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = position.xy * 0.5 + 0.5;
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

export function glyphAtlas() {
	const tileW = 36;
	const tileH = 60;
	const c = document.createElement('canvas');
	c.width = tileW * GLYPH_SLOTS;
	c.height = tileH;
	const g = c.getContext('2d')!;
	g.fillStyle = '#000';
	g.fillRect(0, 0, c.width, c.height);
	g.fillStyle = '#fff';
	g.font = `44px "Fragment Mono", ui-monospace, monospace`;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	[...GLYPHS].forEach((ch, i) => g.fillText(ch, i * tileW + tileW / 2, tileH / 2 + 2));
	const tex = new THREE.CanvasTexture(c);
	tex.minFilter = THREE.LinearFilter;
	tex.generateMipmaps = false;
	return tex;
}

/** Bruit de valeur en JS (mêmes usages que n3, pas la même fonction) */
export function noise3(x: number, y: number, z: number) {
	const h = (a: number, b: number, c: number) => {
		const s = Math.sin(a * 17.1 + b * 113.7 + c * 271.3) * 43758.5453;
		return s - Math.floor(s);
	};
	const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
	let fx = x - ix, fy = y - iy, fz = z - iz;
	fx = fx * fx * (3 - 2 * fx);
	fy = fy * fy * (3 - 2 * fy);
	fz = fz * fz * (3 - 2 * fz);
	const l = (a: number, b: number, t: number) => a + (b - a) * t;
	return l(
		l(l(h(ix, iy, iz), h(ix + 1, iy, iz), fx), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), fx), fy),
		l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), fx), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), fx), fy),
		fz,
	);
}

export function rng(seed: number) {
	let a = seed >>> 0 || 1;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
