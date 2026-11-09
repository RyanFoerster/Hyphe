// Petites serres : la fleur du hero, en spécimens isolés hors du monde 3D.
// Même voile tramé et irisé, mêmes étamines et pollen, dans une toile à part.
//
//   <canvas data-specimen="corolla">   la fleur vue d'en haut, un pétale par
//                                      savoir-faire ; les étiquettes [data-petal-label]
//                                      suivent le bout de leur pétale
//   <canvas data-specimen="stages">    graine, pousse, fleur, côte à côte, qui
//                                      grandissent à l'apparition
//   <canvas data-specimen="footer">    une grande fleur qui s'ouvre au bord de la page
//
// Chaque toile ne dessine que lorsqu'elle est à l'écran.

import * as THREE from 'three';
import { Blooms, Strands, petalGeometry, veilMaterial } from './world/artefact';
import { smoothstep } from './world/shared';

type Uniforms = Record<string, THREE.IUniform>;

const C = (hex: number) => new THREE.Color(hex);

function uniforms(): Uniforms {
	return {
		uTime: { value: 0 },
		uEnergy: { value: 0 },
		uDissolve: { value: 0 },
		uTint: { value: new THREE.Color(0.78, 0.96, 0.24) },
		uScale: { value: 1 },
		uFocusDist: { value: 6 },
		uMotion: { value: 1 },
		uGround: { value: -100 },
		uPick: { value: new THREE.Vector4(0, -100, 0, 0) },
	};
}

interface PlantOptions {
	petals: number;
	/** Longueur de la tige (0 : pas de tige) */
	stem: number;
	leaves: number;
	/** Une graine lumineuse à la base */
	seed?: boolean;
	/** Pétales plus longs et plus larges */
	big?: boolean;
	/** Éclat du voile (vu de face, il paraît plus sombre que de profil) */
	glow?: number;
}

/** Une plante articulée : on règle sa croissance et l'ouverture de sa fleur */
function plant(u: Uniforms, o: PlantOptions) {
	const root = new THREE.Group();
	const head = new THREE.Group();
	head.position.y = o.stem;
	root.add(head);

	// Pétales : chacun sur une charnière, couchés quand la fleur est ouverte
	const hinges: THREE.Group[] = [];
	const tips: THREE.Object3D[] = [];
	const mats: THREE.ShaderMaterial[] = [];
	for (let k = 0; k < o.petals; k++) {
		const phi = (k / o.petals) * Math.PI * 2;
		const yaw = new THREE.Group();
		yaw.rotation.y = -phi;
		const hinge = new THREE.Group();
		hinge.position.x = 0.05;
		const len = o.big ? 1.25 : 0.9;
		const g = petalGeometry({ len, width: o.big ? 0.95 : 0.7, base: 0.55, tip: -0.45, cup: 0.22, ruffle: 0.09, twist: 0.35, seed: k * 3.1 }, 36, 14);
		const mat = veilMaterial(u, { base: C(0x9ab4f0).multiplyScalar(o.glow ?? 1), iris: o.glow ?? 1, flutter: 1, grid: new THREE.Vector2(24, 12) });
		// Sa propre lumière : le survol n'éclaire que lui
		mat.uniforms.uEnergy = { value: 0 };
		const mesh = new THREE.Mesh(g, mat);
		mesh.frustumCulled = false;
		hinge.add(mesh);
		// Le bout du pétale : la dernière rangée, au milieu
		const pa = g.attributes.position as THREE.BufferAttribute;
		const tip = new THREE.Object3D();
		tip.position.fromBufferAttribute(pa, pa.count - 8);
		hinge.add(tip);
		yaw.add(hinge);
		head.add(yaw);
		hinges.push(hinge);
		tips.push(tip);
		mats.push(mat);
	}

	// Cœur : étamines et pollen
	const strands = new Strands();
	const blooms = new Blooms();
	let s = 7;
	const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	for (let k = 0; k < 26; k++) {
		const a = rand() * Math.PI * 2;
		const h = 0.18 + rand() * 0.22;
		const reach = 0.08 + rand() * 0.2;
		const pts: THREE.Vector3[] = [];
		for (let q = 0; q <= 5; q++) {
			const t = q / 5;
			pts.push(new THREE.Vector3(Math.cos(a) * (0.03 + reach * t * t), h * Math.sin(t * 1.35), Math.sin(a) * (0.03 + reach * t * t)));
		}
		strands.line(pts, C(0x1a2418).multiplyScalar(0.6), C(0xd8e6c8).multiplyScalar(0.5), rand(), 0.3);
		blooms.add(pts[5], rand() > 0.35 ? C(0xff8a3a) : C(0xc8f53c), 12 + rand() * 8, 0, 1, rand());
	}
	for (let k = 0; k < 220; k++) {
		const a = rand() * Math.PI * 2;
		const r = Math.sqrt(rand()) * 0.12;
		blooms.add(new THREE.Vector3(Math.cos(a) * r, 0.05 * (1 - (r / 0.12) ** 2) + rand() * 0.015, Math.sin(a) * r), C(0xd4e07a).multiplyScalar(0.3 + rand() * 0.3), 4 + rand() * 4, 0, 0.2, rand());
	}
	const heart = new THREE.Group();
	heart.add(strands.build(u), blooms.build(u));
	head.add(heart);

	// Tige et feuilles : le même voile, en vert
	const stemParts = new THREE.Group();
	root.add(stemParts);
	if (o.stem > 0) {
		const curve = new THREE.CatmullRomCurve3([
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0.12, o.stem * 0.35, 0.05),
			new THREE.Vector3(-0.08, o.stem * 0.7, -0.04),
			new THREE.Vector3(0, o.stem, 0),
		]);
		const tube = new THREE.TubeGeometry(curve, 48, 0.035, 8, false);
		const stemMat = veilMaterial(u, { base: C(0x6fcf8a), iris: 0.3, flutter: 0, grid: new THREE.Vector2(40, 4) });
		stemParts.add(new THREE.Mesh(tube, stemMat));
		for (let k = 0; k < o.leaves; k++) {
			const t = 0.25 + k * 0.22;
			const p = curve.getPointAt(t);
			const g = petalGeometry({ len: 0.75, width: 0.26, base: 0.7, tip: -0.4, cup: 0.12, ruffle: 0.03, twist: 0.7, seed: 40 + k }, 30, 6);
			g.applyMatrix4(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationY(k * 2.4 + 0.4)));
			const leaf = new THREE.Mesh(g, veilMaterial(u, { base: C(0x6fcf8a), iris: 0.4, flutter: 0.6, grid: new THREE.Vector2(26, 5) }));
			leaf.frustumCulled = false;
			stemParts.add(leaf);
		}
	}

	// Graine : un grain lumineux et ses premières radicelles
	const seedGroup = new THREE.Group();
	if (o.seed) {
		const sb = new Blooms();
		for (let k = 0; k < 160; k++) {
			const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.12 * Math.cbrt(rand()));
			sb.add(v, C(0xc8f53c).lerp(C(0xd4e07a), rand()).multiplyScalar(0.35 + rand() * 0.4), 5 + rand() * 6, 0, 0.3, rand());
		}
		const ss = new Strands();
		for (let k = 0; k < 7; k++) {
			const a = rand() * Math.PI * 2;
			const pts = [0, 1, 2, 3].map((q) => new THREE.Vector3(Math.cos(a) * 0.06 * q, -0.08 - q * 0.09 - rand() * 0.03, Math.sin(a) * 0.06 * q));
			ss.line(pts, C(0x9fd08a).multiplyScalar(0.5), C(0x9fd08a).multiplyScalar(0.12), rand());
		}
		seedGroup.add(sb.build(u), ss.build(u));
		root.add(seedGroup);
	}

	/** Croissance g (0 → 1) et ouverture de la fleur (0 → 1) */
	const set = (g: number, open: number) => {
		stemParts.scale.set(1, Math.max(0.001, smoothstep(0, 0.6, g)), 1);
		head.position.y = (o.stem - 0.05) * smoothstep(0, 0.6, g);
		head.scale.setScalar(Math.max(0.001, smoothstep(0.25, 0.8, g)));
		heart.scale.setScalar(Math.max(0.001, smoothstep(0.5, 1, open)));
		// Fermés, les pétales se relèvent en bouton ; ouverts, ils se couchent
		hinges.forEach((h, k) => (h.rotation.z = (1 - open) * 1.25 + Math.sin(k * 1.7) * 0.04));
	};
	return { root, tips, mats, set };
}

/** Une toile, une scène, une caméra ; ne tourne que lorsqu'elle est visible */
function stage(canvas: HTMLCanvasElement, fov: number) {
	// Toile opaque, du noir de la page : la fleur est de la lumière additive
	// (alpha nul), que Safari et Firefox jettent sur une toile transparente
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
	renderer.setClearColor(0x090c0a, 1);
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 50);
	const u = uniforms();
	let w = 1;
	let h = 1;
	const resize = () => {
		const r = canvas.getBoundingClientRect();
		w = Math.max(1, r.width);
		h = Math.max(1, r.height);
		const dpr = Math.min(devicePixelRatio, 1.75);
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		u.uScale.value = dpr * (h / 900) * 1.6 + 0.6;
	};
	new ResizeObserver(resize).observe(canvas);
	resize();
	let visible = false;
	let raf = 0;
	const loop = (frame: (t: number) => void) => {
		const tick = (now: number) => {
			raf = visible ? requestAnimationFrame(tick) : 0;
			u.uTime.value = now / 1000;
			frame(now / 1000);
			renderer.render(scene, camera);
		};
		new IntersectionObserver(([e]) => {
			visible = e.isIntersecting;
			if (visible && !raf) raf = requestAnimationFrame(tick);
		}).observe(canvas);
	};
	return { scene, camera, u, loop, size: () => ({ w, h }) };
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** La corolle des savoir-faire : vue d'en haut, chaque étiquette suit son pétale */
function corolla(canvas: HTMLCanvasElement) {
	const host = canvas.parentElement!;
	const labels = [...host.querySelectorAll<HTMLElement>('[data-petal-label]')];
	const st = stage(canvas, 34);
	const p = plant(st.u, { petals: labels.length || 6, stem: 0, leaves: 0, big: true, glow: 2.6 });
	p.root.scale.setScalar(0.92);
	st.scene.add(p.root);
	st.camera.position.set(0, 3.1, 2.5);
	st.camera.lookAt(0, -0.05, 0);
	st.u.uFocusDist.value = 4;

	// Survol d'une étiquette : son pétale s'éclaire
	let hot = -1;
	labels.forEach((l, i) => {
		l.addEventListener('pointerenter', () => (hot = i));
		l.addEventListener('pointerleave', () => hot === i && (hot = -1));
	});
	let open = reduced() ? 1 : 0;
	let shown = false;
	new IntersectionObserver(([e]) => e.isIntersecting && (shown = true), { threshold: 0.25 }).observe(canvas);
	let last = 0;
	const v = new THREE.Vector3();
	st.loop((t) => {
		const dt = Math.min(0.05, t - (last || t));
		last = t;
		if (shown) open = Math.min(1, open + dt * 0.45);
		p.set(1, 1 - (1 - open) ** 3);
		p.root.rotation.y = reduced() ? 0 : t * 0.06 + (hot >= 0 ? 0 : 0);
		p.root.updateMatrixWorld(true);
		const { w, h } = st.size();
		p.mats.forEach((m, i) => {
			const on = i === hot ? 1 : 0;
			m.uniforms.uEnergy.value += (on * 6 - m.uniforms.uEnergy.value) * 0.12;
		});
		p.tips.forEach((tip, i) => {
			const l = labels[i];
			if (!l) return;
			tip.getWorldPosition(v);
			v.multiplyScalar(1.18).project(st.camera);
			l.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -50%)`;
			l.style.opacity = String(Math.min(1, open * 1.5));
		});
	});
}

/** Graine, pousse, fleur : trois plantes alignées sur les trois colonnes */
function stages(canvas: HTMLCanvasElement) {
	const st = stage(canvas, 30);
	const plants = [
		{ p: plant(st.u, { petals: 5, stem: 0.5, leaves: 0, seed: true, glow: 1.4 }), g: 0.12, open: 0 },
		{ p: plant(st.u, { petals: 5, stem: 1.1, leaves: 2, glow: 1.4 }), g: 0.75, open: 0.08 },
		{ p: plant(st.u, { petals: 6, stem: 1.25, leaves: 3, glow: 1.4 }), g: 1, open: 1 },
	];
	plants.forEach(({ p }, i) => {
		// La graine, seule, a besoin d'être un peu plus grande pour se lire
		if (i === 0) p.root.scale.setScalar(1.8);
		st.scene.add(p.root);
	});
	st.camera.position.set(0, 0.95, 4.4);
	st.camera.lookAt(0, 0.6, 0);
	st.u.uFocusDist.value = 4.4;
	let start = -1;
	new IntersectionObserver(([e]) => e.isIntersecting && start < 0 && (start = performance.now() / 1000), { threshold: 0.35 }).observe(canvas);
	st.loop((t) => {
		// Une plante par colonne : on cale leur écartement sur la largeur visible
		const { w, h } = st.size();
		const half = Math.tan(THREE.MathUtils.degToRad(15)) * 4.4 * (w / h);
		const k = start < 0 ? 0 : reduced() ? 1 : t - start;
		plants.forEach(({ p, g, open }, i) => {
			p.root.position.set(((i - 1) * 2 * half) / 3, i === 0 ? -0.1 : -0.45, 0);
			const gi = Math.min(1, Math.max(0, (k - i * 0.5) / 2.2));
			const e = 1 - (1 - gi) ** 3;
			p.set(g * e, open * smoothstep(0.55, 1, e));
			p.root.rotation.y = t * 0.12 + i;
			p.root.rotation.z = Math.sin(t * 0.8 + i) * 0.04;
		});
	});
}

/** Le pied de page : une grande fleur qui s'ouvre et respire */
function footer(canvas: HTMLCanvasElement) {
	const st = stage(canvas, 32);
	const p = plant(st.u, { petals: 7, stem: 1.6, leaves: 2, big: true });
	st.scene.add(p.root);
	st.camera.position.set(0, 1.1, 4.2);
	st.camera.lookAt(0, 0.15, 0);
	st.u.uFocusDist.value = 4.2;
	let open = reduced() ? 1 : 0;
	let shown = false;
	new IntersectionObserver(([e]) => e.isIntersecting && (shown = true), { threshold: 0.2 }).observe(canvas);
	let last = 0;
	let px = 0;
	let tx = 0;
	addEventListener('pointermove', (e) => (tx = (e.clientX / innerWidth) * 2 - 1), { passive: true });
	st.loop((t) => {
		const dt = Math.min(0.05, t - (last || t));
		last = t;
		if (shown) open = Math.min(1, open + dt * 0.3);
		px += (tx - px) * 0.04;
		const breathe = reduced() ? 1 : 0.92 + Math.sin(t * 0.7) * 0.08;
		p.set(Math.min(1, open * 1.6), (1 - (1 - open) ** 3) * breathe);
		p.root.rotation.y = t * 0.08 + px * 0.5;
		p.root.rotation.z = Math.sin(t * 0.5) * 0.05;
		// La toile couvre tout le pied de page : la fleur se tient à droite, la
		// tige plantée dans le bas, sans jamais toucher un bord de la toile
		const { w, h } = st.size();
		const half = Math.tan(THREE.MathUtils.degToRad(16)) * 4.2 * (w / h);
		const scale = Math.min(1, Math.max(0.55, h / 900));
		p.root.scale.setScalar(scale * (w < 768 ? 0.8 : 1));
		p.root.position.set(w < 768 ? half * 0.35 : half * 0.48, -1.4 + (1 - scale) * 0.6, 0);
	});
}

export function mountSpecimens(root: ParentNode = document) {
	const canvases = root.querySelectorAll<HTMLCanvasElement>('canvas[data-specimen]:not([data-specimen-ready])');
	if (!canvases.length) return;
	if (!document.createElement('canvas').getContext('webgl2')) {
		root.querySelectorAll('[data-specimen-fallback]').forEach((el) => el.removeAttribute('hidden'));
		return;
	}
	for (const c of canvases) {
		c.dataset.specimenReady = '';
		const kind = c.dataset.specimen;
		if (kind === 'corolla') corolla(c);
		else if (kind === 'stages') stages(c);
		else if (kind === 'footer') footer(c);
	}
}
