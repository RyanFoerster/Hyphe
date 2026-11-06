// Le monde de la page d'accueil : un seul canvas fixe, piloté par le défilement.
//
//   hero      la roche au centre, les projets en orbite autour d'elle
//   plongée   la caméra fonce sur la roche, qui se dissout en particules ;
//             l'image bascule en caractères au passage de la surface
//   galerie   on avance dans la roche ; chaque chapitre du DOM correspond à un
//             spécimen posé dans la matière
//   sortie    une lumière au bout, puis le pied de page recouvre tout

import * as THREE from 'three';
import { createPost } from './post';
import { createArtefact, ROCK_SIZE } from './artefact';
import { createCavern } from './cavern';
import { createOverlay, type Pt } from './overlay';
import { clamp01, lerp, smoothstep } from './shared';

interface Options {
	canvas: HTMLCanvasElement;
	overlay: HTMLCanvasElement;
	onProgress?(fraction: number): void;
	onReady?(info: { triangles: number }): void;
}

const ACID = new THREE.Color(0.78, 0.96, 0.24);

export async function createWorld({ canvas, overlay, onProgress, onReady }: Options) {
	const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const finePointer = matchMedia('(pointer: fine)').matches;
	const small = matchMedia('(max-width: 767px)').matches;
	const lowPower = small || (navigator.hardwareConcurrency ?? 8) <= 4;
	const motion = reduced ? 0 : 1;
	let dpr = Math.min(devicePixelRatio, lowPower ? 1.25 : 1.75);

	const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);
	const $$ = <T extends Element>(sel: string) => [...document.querySelectorAll<T>(sel)];
	const dive = $<HTMLElement>('[data-dive]')!;
	const exit = $<HTMLElement>('[data-exit]')!;
	const worldRoot = $<HTMLElement>('[data-world-root]')!;
	const chapters = $$<HTMLElement>('[data-chapter]');
	const orbitItems = $$<HTMLElement>('[data-orbit-item]');
	const lensEls = $$<HTMLElement>('[data-lens]');
	const calloutLabel = $<HTMLElement>('[data-callout-label]');
	const frameEls = new Map($$<HTMLElement>('[data-specimen-frame]').map((el) => [el.dataset.specimenFrame!, el]));

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		alpha: true,
		premultipliedAlpha: true,
		powerPreference: 'high-performance',
	});
	renderer.setPixelRatio(dpr);
	renderer.shadowMap.enabled = !lowPower;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	renderer.autoClear = false;

	const post = createPost(renderer, { lowPower });
	const P = post.uniforms;
	const ext = await createArtefact({ renderer, lowPower, onProgress });
	const cave = createCavern(
		chapters.map((c) => ({ slug: c.dataset.slug!, accent: c.dataset.accent! })),
		{ lowPower },
	);
	const layer = createOverlay(overlay);

	const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 40);

	// ---------------------------------------------------------------- mise en page
	let width = 1;
	let height = 1;
	let narrow = false;
	let zHero = 8.6;
	let baseY = 0;
	let orbitScale = 1;
	let knots: [number, number][] = [];
	let diveEnd = 1;
	const halfTan = (fov: number) => Math.tan(THREE.MathUtils.degToRad(fov / 2));

	const measure = () => {
		const top = (el: HTMLElement) => el.getBoundingClientRect().top + scrollY;
		const vh = innerHeight;
		diveEnd = Math.max(1, top(dive) + dive.offsetHeight - vh);
		knots = [[diveEnd, 0]];
		chapters.forEach((c, i) => knots.push([top(c) + c.offsetHeight / 2 - vh / 2, cave.sChap[i]]));
		knots.push([top(exit) + exit.offsetHeight - vh, cave.sEnd + 4]);
	};

	const resize = () => {
		width = Math.max(1, innerWidth);
		height = Math.max(1, innerHeight);
		renderer.setPixelRatio(dpr);
		renderer.setSize(width, height, false);
		post.setSize(width, height, dpr);
		layer.resize(width, height, Math.min(devicePixelRatio, 2));
		const aspect = width / height;
		narrow = aspect < 0.9;
		const t = halfTan(26);
		if (narrow) {
			orbitScale = 0.56;
			zHero = Math.max(8.6, (ext.ring.rx * orbitScale * 1.4) / (t * aspect));
			baseY = 0.02 * zHero * t;
		} else {
			orbitScale = 1;
			zHero = Math.max(8.6, (ext.ring.rx * 1.18) / (t * aspect));
			baseY = -0.16;
		}
		cave.layout(narrow);
		P.uCell.value.set(7 * dpr, 12 * dpr);
		P.uTile.value = Math.round((narrow ? 64 : 104) * dpr);
		const pointScale = dpr * (height / 900) * 1.6;
		ext.uniforms.uScale.value = pointScale;
		cave.uniforms.uScale.value = pointScale;
		measure();
	};
	resize();
	addEventListener('resize', resize);
	const ro = new ResizeObserver(measure);
	ro.observe(document.body);

	// ---------------------------------------------------------------- pointeur
	const pointer = { x: 0, y: 0, px: -1e3, py: -1e3, free: false, target: null as Element | null };
	const smooth = { x: 0, y: 0, lens: 0, lx: -1e3, ly: -1e3 };
	const isUi = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('a, button, [data-lens], .glass, dialog');
	const onMove = (e: PointerEvent) => {
		pointer.px = e.clientX;
		pointer.py = e.clientY;
		pointer.x = (e.clientX / width) * 2 - 1;
		pointer.y = -((e.clientY / height) * 2 - 1);
		pointer.free = !isUi(e.target);
	};
	const onLeave = () => (pointer.free = false);
	addEventListener('pointermove', onMove, { passive: true });
	document.addEventListener('pointerleave', onLeave);

	// Orbite : survol = pause et teinte du projet ; focus clavier = le projet vient devant
	let hovered = -1;
	let focused = -1;
	orbitItems.forEach((el, i) => {
		el.addEventListener('pointerenter', () => (hovered = i));
		el.addEventListener('pointerleave', () => hovered === i && (hovered = -1));
		el.addEventListener('focus', () => (focused = i));
		el.addEventListener('blur', () => focused === i && (focused = -1));
	});

	// Spécimens cliquables dans la galerie
	let hoverSpecimen = -1;
	const onClick = (e: MouseEvent) => {
		if (hoverSpecimen < 0 || isUi(e.target)) return;
		chapters[hoverSpecimen]?.querySelector<HTMLAnchorElement>('a[data-portal]')?.click();
	};
	addEventListener('click', onClick);

	// ---------------------------------------------------------------- boucle
	const tmp = new THREE.Vector3();
	const tmp2 = new THREE.Vector3();
	const camDir = new THREE.Vector3();
	const tint = ACID.clone();
	const tintTarget = new THREE.Color();
	const project = (v: THREE.Vector3) => {
		tmp2.copy(v).project(camera);
		return { x: (tmp2.x * 0.5 + 0.5) * width, y: (-tmp2.y * 0.5 + 0.5) * height, behind: tmp2.z > 1 };
	};
	const viewDepth = (v: THREE.Vector3) => -tmp2.copy(v).applyMatrix4(camera.matrixWorldInverse).z;

	let sy = scrollY;
	let running = false;
	let visible = true;
	let raf = 0;
	let last = performance.now();
	let time = 0;
	let slowFrames = 0;
	let spinAngle = 0;
	let orbitAngle = 0.5;
	let energy = 0;
	let reveal = reduced ? 1 : 0;
	let readyAt = -1;
	let revealArmed = false;

	const sAt = (y: number) => {
		if (y <= knots[0][0]) return 0;
		for (let i = 1; i < knots.length; i++) {
			const [y1, s1] = knots[i];
			const [y0, s0] = knots[i - 1];
			if (y <= y1) return lerp(s0, s1, (y - y0) / Math.max(1, y1 - y0));
		}
		return knots[knots.length - 1][1];
	};

	const frame = (now: number) => {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		time += dt * motion;

		if (dt > 0.024) slowFrames++;
		else slowFrames = Math.max(0, slowFrames - 1);
		if (slowFrames > 40 && dpr > 1) {
			dpr = Math.max(1, dpr - 0.25);
			slowFrames = 0;
			resize();
		}

		const k = 1 - Math.pow(0.001, dt);
		sy = reduced ? scrollY : sy + (scrollY - sy) * Math.min(1, k * 1.6);
		smooth.x += (pointer.x - smooth.x) * k * 0.6;
		smooth.y += (pointer.y - smooth.y) * k * 0.6;
		smooth.lx += (pointer.px - smooth.lx) * (reduced ? 1 : Math.min(1, k * 2.2));
		smooth.ly += (pointer.py - smooth.ly) * (reduced ? 1 : Math.min(1, k * 2.2));
		// La roche se recompose une fois le loader parti
		if (readyAt < 0 && revealArmed && !document.documentElement.classList.contains('is-loading')) readyAt = now;
		if (readyAt >= 0 && !reduced) reveal = clamp01((now - readyAt) / 2400);

		const inside = sy >= diveEnd;
		let d = clamp01(sy / diveEnd);
		if (reduced) d = d < 0.5 ? 0 : 1;
		const lensOn = finePointer && pointer.free ? 1 : 0;
		smooth.lens += (lensOn - smooth.lens) * k * 1.4;

		let scene: THREE.Scene;
		let overlayAlpha = 0;
		const points: Pt[] = [];
		const frames: { x: number; y: number; w: number; h: number; a: number; label: string }[] = [];
		const callouts: { from: Pt; to: { x: number; y: number }; a: number }[] = [];
		let focusPx = { x: width / 2, y: height / 2, r: 0 };
		let flowerFrom = 0;
		hoverSpecimen = -1;

		if (!inside) {
			// ------------------------------------------------------------ dehors
			scene = ext.scene;
			const e = d * d * (3 - 2 * d);
			const accent = hovered >= 0 ? orbitItems[hovered].dataset.accent : focused >= 0 ? orbitItems[focused].dataset.accent : null;
			energy += ((accent ? 1 : 0) + d * 0.5 - energy) * k;
			tintTarget.set(accent ?? '#c8f53c');
			tint.lerp(tintTarget, k * 0.8);

			camera.fov = lerp(26, narrow ? 54 : 42, smoothstep(0.3, 1, d));
			camera.near = 0.05;
			camera.far = 30;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			camera.position.set(0, lerp(0.35, baseY + 0.12, e), lerp(zHero, 1.5, Math.pow(e, 1.15)));
			camera.lookAt(0, baseY + 0.22 * (1 - e), 0);
			camera.updateMatrixWorld();

			spinAngle += dt * 0.06 * (1 - d) * motion;
			ext.spin.rotation.y = spinAngle + smooth.x * 0.4 * motion * (1 - d);
			ext.artefact.rotation.x = (-smooth.y * 0.12 * motion + 0.06) * (1 - d);
			ext.artefact.position.y = baseY + Math.sin(time * 0.6) * 0.06 * motion;
			ext.uniforms.uDissolve.value = reduced ? (d > 0.5 ? 1 : 0) : smoothstep(0.28, 0.96, d);
			ext.uniforms.uRing.value = (1 - smoothstep(0.05, 0.4, d)) * smoothstep(0.3, 0.9, reveal);
			ext.uniforms.uFocusDist.value = camera.position.distanceTo(ext.artefact.position);
			ext.uniforms.uTint.value.copy(tint);
			ext.orbit.scale.setScalar(orbitScale * (1 + e * 1.6));
			ext.update({ dt, time, px: smooth.x, py: smooth.y, dive: d, energy, motion });
			ext.artefact.updateMatrixWorld(true);

			// Orbite des projets : la carte suit son point sur l'anneau
			const paused = hovered >= 0 || focused >= 0;
			if (focused >= 0) {
				const want = Math.PI / 2 - (focused * Math.PI * 2) / orbitItems.length;
				const diff = Math.atan2(Math.sin(want - orbitAngle), Math.cos(want - orbitAngle));
				orbitAngle += diff * k * 1.2;
			} else if (!paused) orbitAngle += dt * 0.07 * motion;
			const centreDepth = viewDepth(ext.artefact.position);
			const fadeOut = 1 - smoothstep(0.06, 0.32, d);
			const reveal2 = smoothstep(0.35, 1, reveal);
			orbitItems.forEach((el, i) => {
				const a = orbitAngle + (i * Math.PI * 2) / orbitItems.length + smooth.x * 0.25 * motion;
				tmp.set(Math.cos(a) * ext.ring.rx, 0, Math.sin(a) * ext.ring.rz);
				ext.orbit.localToWorld(tmp);
				const p = project(tmp);
				const dz = viewDepth(tmp);
				const back = clamp01((dz - centreDepth) / (ext.ring.rz * orbitScale) * 0.5 + 0.5);
				const sc = THREE.MathUtils.clamp(centreDepth / Math.max(dz, 0.1), 0.6, 3) * (narrow ? 0.9 : 1);
				const o = fadeOut * reveal2 * (1 - back * 0.55);
				el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
				el.style.zIndex = back > 0.5 ? '1' : '4';
				el.style.opacity = o.toFixed(3);
				el.style.setProperty('--back', back.toFixed(3));
				el.style.visibility = o < 0.02 ? 'hidden' : '';
				el.style.pointerEvents = back > 0.62 || o < 0.2 ? 'none' : '';
			});

			// Points suivis par l'analyse
			camera.getWorldDirection(camDir);
			ext.anchors.forEach((an, i) => {
				if (narrow && i % 2) return;
				if (an.kind === 'flower' && !flowerFrom) flowerFrom = points.length;
				tmp.copy(an.p).applyMatrix4(ext.spin.matrixWorld);
				const n = an.n.clone().transformDirection(ext.spin.matrixWorld);
				const p = project(tmp);
				const facing = an.kind === 'flower' ? 1 : smoothstep(-0.05, 0.35, -n.dot(camDir));
				points.push({ x: p.x, y: p.y, v: facing * (1 - smoothstep(0.02, 0.2, d)) });
			});
			const fp = project(tmp.copy(ext.flowerHead).applyMatrix4(ext.spin.matrixWorld));
			const centre = project(ext.artefact.position);
			focusPx = { x: centre.x, y: centre.y, r: (ROCK_SIZE / 2 / (centreDepth * halfTan(camera.fov))) * (height / 2) };
			overlayAlpha = (1 - smoothstep(0.04, 0.25, d)) * smoothstep(0.5, 1, reveal) * (0.85 + energy * 0.15);
			const labelBox = calloutLabel?.getBoundingClientRect();
			if (calloutLabel && labelBox?.width) {
				const r = labelBox;
				const left = fp.x < r.left;
				callouts.push({
					from: { x: fp.x, y: fp.y, v: 1 },
					to: { x: left ? r.left - 8 : r.right + 8, y: r.top + r.height / 2 },
					a: 1,
				});
				calloutLabel.style.opacity = String(overlayAlpha > 0 ? Math.min(1, overlayAlpha * 1.6) : 0);
			}

			// Post
			P.uInside.value = 0;
			P.uAscii.value = reduced ? (d > 0.5 ? 1 : 0) : smoothstep(0.6, 1, d);
			P.uAura.value = (1 - smoothstep(0.5, 0.95, d)) * reveal;
			P.uBloom.value = 1 + d * 0.6;
			P.uFlash.value = smoothstep(0.86, 1, d) * 0.7;
			P.uMosaic.value = narrow ? 0.08 : 0.11;
			P.uExposure.value = 1.25;
			P.uCell.value.set(7 * dpr * (1 + smoothstep(0.7, 1, d) * 1.4), 12 * dpr * (1 + smoothstep(0.7, 1, d) * 1.4));
			P.uFocus.value.set(centre.x / width, 1 - centre.y / height);
		} else {
			// ------------------------------------------------------------ dedans
			scene = cave.scene;
			orbitItems.forEach((el) => {
				el.style.visibility = 'hidden';
				el.style.opacity = '0';
			});
			if (calloutLabel) calloutLabel.style.opacity = '0';
			let s = sAt(sy);
			if (reduced) {
				const stops = knots.map((kn) => kn[1]);
				s = stops.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a), stops[0]);
			}

			// Teinte : celle du chapitre le plus proche
			let wsum = 0;
			tintTarget.setRGB(0, 0, 0);
			cave.specimens.forEach((sp) => {
				const w = Math.max(0, 1 - Math.abs(s - sp.s) / (cave.sChap[1] - cave.sChap[0]));
				tintTarget.r += sp.accent.r * w;
				tintTarget.g += sp.accent.g * w;
				tintTarget.b += sp.accent.b * w;
				wsum += w;
			});
			if (wsum > 0.01) tintTarget.multiplyScalar(1 / wsum);
			else tintTarget.copy(ACID);
			tint.lerp(tintTarget, k);
			cave.uniforms.uTint.value.copy(tint);
			cave.uniforms.uTime.value = time;
			cave.setExit(s);

			camera.fov = narrow ? 62 : 48;
			camera.near = 0.05;
			camera.far = 40;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			cave.at(Math.max(0, s), camera.position);
			camera.position.x += smooth.x * 0.25 * motion;
			camera.position.y += smooth.y * 0.15 * motion;
			const look = cave.at(s + 3, tmp);
			let best = Infinity;
			let near = cave.specimens[0];
			for (const sp of cave.specimens) {
				const dd = Math.abs(s - sp.s);
				if (dd < best) {
					best = dd;
					near = sp;
				}
			}
			const pull = (1 - smoothstep(0, 5, best)) * 0.3;
			look.lerp(near.mesh.position, pull);
			camera.lookAt(look);
			camera.updateMatrixWorld();

			// Spécimens : chargement en approche, recomposition, survol
			cave.specimens.forEach((sp, i) => {
				if (s > sp.s - 14) sp.load();
				const rev = reduced ? (s > sp.s - 6 ? 1 : 0) : smoothstep(sp.s - 7, sp.s - 0.6, s);
				sp.mat.uniforms.uReveal.value = rev;
				const base = sp.mesh.userData.base as THREE.Vector3;
				sp.mesh.position.y = base.y + Math.sin(time * 0.7 + i) * 0.04 * motion;
				sp.mesh.updateMatrixWorld();
				// Rectangle de l'image à l'écran (pour le portail et la mesure)
				let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
				let behind = false;
				for (const [cx, cy] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) {
					const p = project(tmp.set(cx, cy, 0).applyMatrix4(sp.mesh.matrixWorld));
					behind ||= p.behind;
					x0 = Math.min(x0, p.x);
					y0 = Math.min(y0, p.y);
					x1 = Math.max(x1, p.x);
					y1 = Math.max(y1, p.y);
				}
				const focus = 1 - smoothstep(0.5, 4.5, Math.abs(s - sp.s));
				const onScreen = !behind && x1 > 0 && x0 < width && y1 > 0 && y0 < height;
				const over = onScreen && focus > 0.3 && pointer.free && pointer.px > x0 && pointer.px < x1 && pointer.py > y0 && pointer.py < y1;
				if (over) hoverSpecimen = i;
				sp.mat.uniforms.uHover.value += ((over ? 1 : 0) - sp.mat.uniforms.uHover.value) * k * 1.5;
				const el = frameEls.get(sp.slug);
				if (el) {
					el.style.transform = onScreen ? `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)` : 'translate(-9999px, 0)';
					el.style.width = `${Math.max(0, x1 - x0).toFixed(1)}px`;
					el.style.height = `${Math.max(0, y1 - y0).toFixed(1)}px`;
				}
				if (onScreen) {
					frames.push({
						x: x0,
						y: y0,
						w: x1 - x0,
						h: y1 - y0,
						a: focus * smoothstep(0.6, 1, rev),
						label: `specimen.${String(i + 1).padStart(2, '0')} — ${sp.slug} — ${rev.toFixed(8)}`,
					});
				}
				chapters[i]?.style.setProperty('--focus', focus.toFixed(3));
			});
			overlayAlpha = 1;

			P.uInside.value = 1;
			P.uAscii.value = 1;
			P.uAura.value = 0;
			P.uBloom.value = 0.85;
			P.uFlash.value = (1 - smoothstep(0, 3, s)) * 0.7 + smoothstep(cave.sEnd - 2, cave.sEnd + 4, s) * 0.8;
			P.uExposure.value = 1.0;
			const zoom = 1 + (1 - smoothstep(0, 3.5, s)) * 1.4;
			P.uCell.value.set(7 * dpr * zoom, 12 * dpr * zoom);
		}
		document.documentElement.toggleAttribute('data-specimen-hover', hoverSpecimen >= 0);
		dive.style.setProperty('--t', String(inside ? 0 : smoothstep(0.35, 0.6, d) * (1 - smoothstep(0.88, 1, d))));
		if (!inside) chapters.forEach((c) => c.style.setProperty('--focus', '0'));

		// Lentilles (dehors) : fenêtres de verre clair et curseur
		let n = 0;
		if (!inside) {
			for (const el of lensEls) {
				if (n >= post.lenses.length) break;
				const r = (el.querySelector('.os-body') ?? el).getBoundingClientRect();
				if (!r.width || r.bottom < 0 || r.top > height) continue;
				post.lenses[n++].set(r.left * dpr, (height - r.bottom) * dpr, r.width * dpr, r.height * dpr);
			}
		}
		P.uLensCount.value = n;
		const radius = (inside ? 150 : 110) * dpr * smooth.lens;
		P.uCursor.value.set(smooth.lx * dpr, (height - smooth.ly) * dpr, radius, smooth.lens);
		P.uTime.value = time;
		P.uNear.value = camera.near;
		P.uFar.value = camera.far;
		P.uReveal.value = reveal;
		P.uTint.value.copy(tint);

		post.render(scene, camera);
		layer.draw({
			time,
			dpr,
			alpha: overlayAlpha,
			points,
			flowerFrom: flowerFrom || points.length,
			focus: focusPx,
			frames,
			callouts,
			motion,
		});
	};

	const start = () => {
		if (running || !visible || document.hidden) return;
		running = true;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	};
	const stop = () => {
		running = false;
		cancelAnimationFrame(raf);
	};
	const io = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		visible ? start() : stop();
	});
	io.observe(worldRoot);
	const onVisibility = () => (document.hidden ? stop() : start());
	document.addEventListener('visibilitychange', onVisibility);

	frame(performance.now());
	cancelAnimationFrame(raf);
	start();
	revealArmed = true;
	onReady?.({ triangles: ext.triangles });
	if (import.meta.env.DEV) Object.assign(window, { __world: { ext, cave, camera, post, knots: () => knots } });

	return {
		dispose() {
			stop();
			io.disconnect();
			ro.disconnect();
			removeEventListener('resize', resize);
			removeEventListener('pointermove', onMove);
			removeEventListener('click', onClick);
			document.removeEventListener('visibilitychange', onVisibility);
			document.removeEventListener('pointerleave', onLeave);
			renderer.dispose();
			post.dispose();
		},
	};
}
