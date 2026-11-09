// Petites serres : la fleur du hero, en spécimens isolés hors du monde 3D.
// Même voile tramé et irisé, mêmes étamines et pollen, dans une toile à part.
//
//   <canvas data-specimen="corolla">   la fleur vue d'en haut, un pétale par
//                                      savoir-faire ; les étiquettes [data-petal-label]
//                                      suivent le bout de leur pétale
//   <canvas data-specimen="drift">      fin de galerie : pétales et pollen qui flottent
//   <canvas data-specimen="footer">    une grande fleur qui s'ouvre au bord de la page
//   <canvas data-specimen="sheet">     l'herbier : la fleur d'un projet (data-variant,
//                                      data-petals, data-veil, data-shape…), ses
//                                      savoir-faire légendés au bout des pétales
//
// Chaque toile ne dessine que lorsqu'elle est à l'écran.

import * as THREE from 'three';
import { Blooms, Strands, petalGeometry, veilMaterial } from './world/artefact';
import { createPost } from './world/post';
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
	/** Teinte du voile (bleu du hero par défaut) */
	veil?: number;
	/** Forme des pétales : longueur, largeur, port (base, pointe), creux, ondulation, torsion */
	shape?: Partial<{ len: number; width: number; base: number; tip: number; cup: number; ruffle: number; twist: number }>;
	/** Une variante : change le dessin des pétales et du cœur */
	variant?: number;
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
		const sh = o.shape ?? {};
		const g = petalGeometry(
			{
				len: sh.len ?? (o.big ? 1.25 : 0.9),
				width: sh.width ?? (o.big ? 0.95 : 0.7),
				base: sh.base ?? 0.55,
				tip: sh.tip ?? -0.45,
				cup: sh.cup ?? 0.22,
				ruffle: sh.ruffle ?? 0.09,
				twist: sh.twist ?? 0.35,
				seed: k * 3.1 + (o.variant ?? 0) * 17.3,
			},
			36,
			14,
		);
		const mat = veilMaterial(u, { base: C(o.veil ?? 0x9ab4f0).multiplyScalar(o.glow ?? 1), iris: o.glow ?? 1, flutter: 1, grid: new THREE.Vector2(24, 12) });
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
	let s = 7 + (o.variant ?? 0) * 7919;
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
	return { root, head, tips, mats, set };
}

/** Une toile, une scène, une caméra ; ne tourne que lorsqu'elle est visible.
 *  Même chaîne de rendu que le hero : tons, halo, grain, et la lumière de la
 *  fleur redessinée en caractères autour d'elle. */
function stage(canvas: HTMLCanvasElement, fov: number, opts: { aura?: number; ascii?: number } = {}) {
	// Toile opaque, du noir de la page : la fleur est de la lumière additive
	// (alpha nul), que Safari et Firefox jettent sur une toile transparente
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false });
	renderer.setClearColor(0x090c0a, 1);
	const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
	const post = createPost(renderer, { lowPower });
	const P = post.uniforms;
	P.uReveal.value = 1;
	P.uScanAll.value = 0;
	P.uMosaic.value = 0;
	P.uAura.value = opts.aura ?? 0.8;
	P.uAscii.value = opts.ascii ?? 0;
	P.uRays.value = lowPower ? 0 : 0.6;
	P.uExposure.value = 1.15;
	P.uVignette.value = 0;
	P.uFloor.value = 0.04;
	P.uGrainMask.value = 1;
	// La passe finale écrit sa propre opacité (comme le hero) : le fond de la
	// page transparaît, rien à ajouter
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 50);
	const u = uniforms();
	let w = 1;
	let h = 1;
	const resize = () => {
		const r = canvas.getBoundingClientRect();
		w = Math.max(1, r.width);
		h = Math.max(1, r.height);
		const dpr = Math.min(devicePixelRatio, lowPower ? 1.25 : 1.6);
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		post.setSize(w, h, dpr);
		P.uCell.value.set(7 * dpr, 12 * dpr);
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
			P.uTime.value = now / 1000;
			frame(now / 1000);
			camera.updateMatrixWorld();
			post.render(scene, camera);
		};
		new IntersectionObserver(([e]) => {
			visible = e.isIntersecting;
			if (visible && !raf) raf = requestAnimationFrame(tick);
		}).observe(canvas);
	};
	return { scene, camera, u, P, loop, size: () => ({ w, h }) };
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
	let spinT = 0;

	// Survol d'un repère, ou du pétale lui-même : le pétale s'éclaire et sa
	// fenêtre s'ouvre
	let hover = -1;
	labels.forEach((l, i) => {
		l.addEventListener('pointerenter', () => (hover = i));
		l.addEventListener('pointerleave', () => hover === i && (hover = -1));
	});
	const pointer = { x: 0, y: 0, in: false };
	host.addEventListener('pointermove', (e) => {
		const r = host.getBoundingClientRect();
		pointer.x = e.clientX - r.left;
		pointer.y = e.clientY - r.top;
		pointer.in = true;
	});
	host.addEventListener('pointerleave', () => (pointer.in = false));
	let hot = -1;
	let open = reduced() ? 1 : 0;
	let shown = false;
	new IntersectionObserver(([e]) => e.isIntersecting && (shown = true), { threshold: 0.25 }).observe(canvas);
	let last = 0;
	const v = new THREE.Vector3();
	const c = new THREE.Vector3();
	const pts: { x: number; y: number }[] = [];
	st.loop((t) => {
		const dt = Math.min(0.05, t - (last || t));
		last = t;
		if (shown) open = Math.min(1, open + dt * 0.45);
		p.set(1, 1 - (1 - open) ** 3);
		// La fleur s'arrête de tourner quand on lit l'un de ses pétales
		spinT += hot >= 0 || reduced() ? 0 : dt * 0.06;
		p.root.rotation.y = spinT;
		p.root.updateMatrixWorld(true);
		const { w, h } = st.size();
		c.set(0, 0, 0).applyMatrix4(p.root.matrixWorld).project(st.camera);
		const cx = (c.x * 0.5 + 0.5) * w;
		const cy = (-c.y * 0.5 + 0.5) * h;
		p.tips.forEach((tip, i) => {
			tip.getWorldPosition(v);
			v.multiplyScalar(1.18).project(st.camera);
			pts[i] = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
		});
		// Le pétale sous le curseur : le plus proche en angle, dans le rayon de la fleur
		let petal = -1;
		if (pointer.in && hover < 0) {
			const a = Math.atan2(pointer.y - cy, pointer.x - cx);
			const dist = Math.hypot(pointer.x - cx, pointer.y - cy);
			let best = Infinity;
			pts.forEach((q, i) => {
				const r = Math.hypot(q.x - cx, q.y - cy);
				if (dist < r * 0.18 || dist > r * 1.05) return;
				const da = Math.abs(Math.atan2(Math.sin(a - Math.atan2(q.y - cy, q.x - cx)), Math.cos(a - Math.atan2(q.y - cy, q.x - cx))));
				if (da < best && da < Math.PI / labels.length) {
					best = da;
					petal = i;
				}
			});
		}
		hot = hover >= 0 ? hover : petal;
		host.style.cursor = petal >= 0 ? 'pointer' : '';
		p.mats.forEach((m, i) => {
			const on = i === hot ? 1 : 0;
			m.uniforms.uEnergy.value += (on * 6 - m.uniforms.uEnergy.value) * 0.12;
		});
		pts.forEach((q, i) => {
			const l = labels[i];
			if (!l) return;
			const left = q.x < cx;
			if ((l.dataset.side === 'left') !== left) l.dataset.side = left ? 'left' : 'right';
			l.toggleAttribute('data-hot', i === hot && hover < 0);
			// Le repère carré se pose sur le bout du pétale
			l.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) translate(${left ? 'calc(-100% + 5px)' : '-5px'}, -50%)`;
			l.style.opacity = String(Math.min(1, open * 1.5));
		});
	});
}

/** Une planche de l'herbier : chaque projet a sa fleur (sa forme, sa teinte),
 *  qui pousse quand la planche arrive, tourne lentement et s'éclaire au
 *  survol. Les savoir-faire du projet sont légendés au bout des pétales. */
function sheet(canvas: HTMLCanvasElement) {
	const host = canvas.parentElement!;
	const plate = canvas.closest<HTMLElement>('[data-plate]') ?? host;
	const labels = [...host.querySelectorAll<HTMLElement>('[data-petal-label]')];
	const d = canvas.dataset;
	const variant = Number(d.variant ?? 0);
	const petals = Number(d.petals ?? 6);
	const st = stage(canvas, 32, { aura: 0.85 });
	const p = plant(st.u, {
		petals,
		stem: 1.3,
		leaves: Number(d.leaves ?? 2),
		big: true,
		glow: Number(d.glow ?? 1.25),
		veil: parseInt(d.veil ?? '9ab4f0', 16),
		shape: JSON.parse(d.shape ?? '{}'),
		variant,
	});
	st.scene.add(p.root);
	st.u.uFocusDist.value = 5.6;
	// Chaque spécimen penche un peu à sa façon
	p.root.rotation.z = Math.sin(variant * 2.3) * 0.07;
	// Les légendes se répartissent sur les pétales
	const of = labels.map((_, i) => Math.round((i * petals) / labels.length) % petals);
	const widths: number[] = [];
	addEventListener('resize', () => (widths.length = 0));

	let grow = reduced() ? 1 : 0;
	let shown = false;
	new IntersectionObserver(([e]) => e.isIntersecting && (shown = true), { threshold: 0.2 }).observe(canvas);
	let hover = false;
	plate.addEventListener('pointerenter', () => (hover = true));
	plate.addEventListener('pointerleave', () => (hover = false));
	let energy = 0;
	let spin = variant * 1.1;
	let last = 0;
	const v = new THREE.Vector3();
	const c = new THREE.Vector3();
	const cam = new THREE.Vector3();
	st.loop((t) => {
		const dt = Math.min(0.05, t - (last || t));
		last = t;
		if (shown) grow = Math.min(1, grow + dt * 0.42);
		const open = smoothstep(0.35, 1, grow);
		const breathe = reduced() ? 1 : 0.94 + Math.sin(t * 0.6 + variant) * 0.06;
		p.set(Math.min(1, grow * 1.5), (1 - (1 - open) ** 3) * breathe * (hover ? 1.04 : 1));
		// Elle tourne lentement ; au survol, elle ralentit et s'éclaire
		spin += reduced() ? 0 : dt * (hover ? 0.05 : 0.14);
		p.root.rotation.y = spin;
		energy += ((hover ? 2.2 : 0) - energy) * 0.08;
		p.mats.forEach((m) => (m.uniforms.uEnergy.value = energy));

		// La toile se cadre sur la plante, quel que soit son format
		const { w, h } = st.size();
		const aspect = w / h;
		const dist = 5.6 * Math.max(1, 0.95 / aspect);
		st.camera.position.set(0, 1.9, dist);
		st.camera.lookAt(0, 0.6, 0);
		p.root.position.y = -0.55;
		p.root.scale.setScalar(1.12);
		p.root.updateMatrixWorld(true);
		if (!widths.length || !widths[0]) labels.forEach((l, i) => (widths[i] = l.getBoundingClientRect().width));

		// Les légendes : un repère au bout du pétale, poussé vers l'extérieur
		p.head.getWorldPosition(c);
		const hz = c.clone().applyMatrix4(st.camera.matrixWorldInverse).z;
		c.project(st.camera);
		const cx = (c.x * 0.5 + 0.5) * w;
		const cy = (-c.y * 0.5 + 0.5) * h;
		labels.forEach((l, i) => {
			p.tips[of[i]].getWorldPosition(v);
			cam.copy(v).applyMatrix4(st.camera.matrixWorldInverse);
			v.project(st.camera);
			let x = (v.x * 0.5 + 0.5) * w;
			let y = (-v.y * 0.5 + 0.5) * h;
			x = cx + (x - cx) * 1.1;
			y = cy + (y - cy) * 1.1;
			const left = x < cx;
			if ((l.dataset.side === 'left') !== left) l.dataset.side = left ? 'left' : 'right';
			// La légende reste dans la planche : elle glisse plutôt que d'être coupée
			x = left ? Math.max(widths[i] + 6, x) : Math.min(w - widths[i] - 6, x);
			// Derrière la fleur, la légende s'efface à moitié
			const behind = cam.z < hz - 0.05;
			l.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${left ? 'calc(-100% + 4px)' : '-4px'}, -50%)`;
			// (sur téléphone, elle se cache : la place manque)
			l.style.opacity = String(Math.min(1, smoothstep(0.55, 0.9, grow) * (behind ? (w < 560 ? 0 : 0.32) : 1)));
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

/** Fin de galerie : des pétales détachés et du pollen qui flottent dans tout
 *  l'écran, la caméra suit doucement le curseur */
function drift(canvas: HTMLCanvasElement) {
	const st = stage(canvas, 40, { aura: 0.9 });
	st.camera.position.set(0, 0, 6);
	st.u.uFocusDist.value = 6;
	let seed = 7;
	const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const N = 34;
	const petals = new THREE.InstancedMesh(
		petalGeometry({ len: 1, width: 0.6, base: 0.3, tip: -0.35, cup: 0.2, ruffle: 0.06, twist: 0.45, seed: 3 }, 20, 9),
		veilMaterial(st.u, { base: C(0x9ab4f0).multiplyScalar(1.5), iris: 1.4, flutter: 1, grid: new THREE.Vector2(14, 7) }),
		N,
	);
	petals.frustumCulled = false;
	st.scene.add(petals);
	const data = Array.from({ length: N }, () => ({
		p: new THREE.Vector3((rand() - 0.5) * 14, (rand() - 0.5) * 8, -rand() * 7 + 1.5),
		v: 0.08 + rand() * 0.16,
		s: 0.25 + rand() * 0.55,
		r: new THREE.Vector3(rand() * 6, rand() * 6, rand() * 6),
		w: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.9),
		ph: rand() * 10,
	}));

	// Le pollen : des grains de lumière qui montent, acides et ambrés
	const M = 420;
	const pos = new Float32Array(M * 3);
	const col = new Float32Array(M * 3);
	const tints = [C(0xc8f53c), C(0xf07a2a), C(0x9ab4f0), C(0xe6e4dc)];
	for (let i = 0; i < M; i++) {
		pos.set([(rand() - 0.5) * 16, (rand() - 0.5) * 10, -rand() * 8 + 2], i * 3);
		const c = tints[i % 7 === 0 ? 1 : i % 3 === 0 ? 2 : i % 5 === 0 ? 3 : 0];
		col.set([c.r, c.g, c.b], i * 3);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	const pollen = new THREE.Points(
		geo,
		new THREE.ShaderMaterial({
			uniforms: { uTime: st.u.uTime, uScale: st.u.uScale },
			vertexShader: /* glsl */ `
				uniform float uTime;
				uniform float uScale;
				attribute vec3 color;
				varying vec3 vColor;
				varying float vA;
				void main() {
					vec3 p = position;
					float k = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
					p.y = mod(p.y + uTime * (0.08 + k * 0.2) + 5.0, 10.0) - 5.0;
					p.x += sin(uTime * 0.4 + k * 30.0) * 0.25;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					gl_Position = projectionMatrix * mv;
					gl_PointSize = (2.0 + k * 4.0) * uScale * (5.0 / -mv.z);
					vColor = color;
					vA = (0.45 + 0.55 * sin(uTime * (1.0 + k * 2.0) + k * 40.0)) * smoothstep(5.0, 3.6, abs(p.y));
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec3 vColor;
				varying float vA;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					float a = smoothstep(0.5, 0.0, d);
					gl_FragColor = vec4(vColor * a * a * vA * 2.2, 0.0);
				}
			`,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			transparent: true,
		}),
	);
	pollen.frustumCulled = false;
	st.scene.add(pollen);

	let tx = 0;
	let ty = 0;
	let px = 0;
	let py = 0;
	addEventListener('pointermove', (e) => ((tx = (e.clientX / innerWidth) * 2 - 1), (ty = (e.clientY / innerHeight) * 2 - 1)), { passive: true });
	const dummy = new THREE.Object3D();
	let last = 0;
	st.loop((t) => {
		const dt = Math.min(0.05, t - (last || t));
		last = t;
		const still = reduced();
		px += (tx - px) * 0.03;
		py += (ty - py) * 0.03;
		st.camera.position.set(px * 0.6, -py * 0.35, 6);
		const { w, h } = st.size();
		const aspect = w / h;
		st.camera.lookAt(0, 0, 0);
		data.forEach((d, i) => {
			if (!still) {
				d.p.y += d.v * dt;
				if (d.p.y > 4.8) d.p.y = -4.8;
			}
			dummy.position.set(d.p.x + Math.sin(t * 0.3 + d.ph) * 0.4, d.p.y, d.p.z);
			dummy.rotation.set(d.r.x + t * d.w.x, d.r.y + t * d.w.y, d.r.z + t * d.w.z);
			// Un pétale ne touche jamais le bord de la toile : il fond avant
			const halfH = Math.tan(THREE.MathUtils.degToRad(20)) * (6 - d.p.z);
			const halfW = halfH * aspect;
			const edge = Math.min(halfH - Math.abs(d.p.y), halfW - Math.abs(dummy.position.x));
			dummy.scale.setScalar(d.s * smoothstep(0, 1.1, edge));
			dummy.updateMatrix();
			petals.setMatrixAt(i, dummy.matrix);
		});
		petals.instanceMatrix.needsUpdate = true;
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
		else if (kind === 'drift') drift(c);
		else if (kind === 'footer') footer(c);
		else if (kind === 'sheet') sheet(c);
	}
}
