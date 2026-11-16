// La page perdue : rien n'y a poussé. Un petit jeu, chargé sur la page 404
// seulement, qui prend toute la page et se joue à la souris.
//
//   On appuie sur le sol et on tire : une tige pousse en suivant le curseur,
//   des feuilles sortent en chemin, la fleur s'ouvre quand on relâche. On
//   dessine ses plantes.
//   Dans le ciel, « 4 0 4 » en caractères. Une plante qui atteint un chiffre le
//   remplace par une fleur. La sève est comptée : le premier chiffre est à
//   portée, les deux autres demandent de passer par le pollen, qui en redonne.
//   Sans appuyer, la souris fait du vent : il s'écrit en caractères derrière le
//   curseur, pousse le pollen et couche les plantes.
//   Les trois chiffres fleuris, le chrono s'arrête. On peut continuer à planter.
//
// Clavier : les flèches déplacent un viseur, espace appuie. Tout est dessiné en
// WebGL avec la chaîne du hero (createPost) : voile tramé, étamines, pollen, et
// une couche de caractères (terre, chiffres, vent) calée sur la grille de l'aura.
//
// En dev, window.__lost pilote la partie pour les captures :
//   __lost.auto([[fx, fy], …])       fait pousser une plante par ces points (fractions de la page)
//   __lost.blow(fx0, fy0, fx1, fy1)  un coup de vent
//   __lost.win()                     finit la partie

import * as THREE from 'three';
import { Blooms, Strands, petalGeometry, veilMaterial } from './world/artefact';
import { createPost } from './world/post';
import { FULLSCREEN_VERT, GLYPH_SLOTS, additive, clamp01, fullscreenTriangle, lerp, rng, smoothstep } from './world/shared';
import { kit, sound } from './sound';
import { mountText, scramble } from './text';

type Uniforms = Record<string, THREE.IUniform>;

const C = (hex: number) => new THREE.Color(hex);
const TAU = Math.PI * 2;
const ease = (x: number) => 1 - (1 - clamp01(x)) ** 3;

/** Hauteur du ciel, du sol au haut de la page, en unités du monde */
const SKY = 6;
/** Une tige : nombre de points au plus, côtés du tube, pas entre deux points */
const MAX_PTS = 132;
const RING = 6;
const STEP = 0.065;
const SPEED = 2.3;
const TURN = 5.5;
const DIGITS = [4, 0, 4];
const BEST = 'hyphe:lost-best';
/** Champ de vent : une case par caractère (ou par bloc sur les très grands écrans) */
const FIELD_W = 256;
const FIELD_H = 128;
const MAX_SEEDS = 12;

/** Une fleur par plante : la première est celle du hero */
const VARIANTS = [
	{ petals: 6, veil: 0x9ab4f0, len: 0.9, width: 0.7, tip: -0.45, ruffle: 0.09 },
	{ petals: 8, veil: 0xc4a6f5, len: 0.95, width: 0.5, tip: -0.7, ruffle: 0.05 },
	{ petals: 5, veil: 0xf5c79c, len: 0.8, width: 0.9, tip: -0.25, ruffle: 0.14 },
	{ petals: 7, veil: 0x9aefd0, len: 1, width: 0.6, tip: -0.55, ruffle: 0.07 },
	{ petals: 6, veil: 0xf0a4c4, len: 0.85, width: 0.82, tip: -0.3, ruffle: 0.12 },
];

// ------------------------------------------------------------------ les plantes

/** Racines : des traits qui descendent de la graine, révélés par uGrow */
function rootsMesh(u: Uniforms, rand: () => number) {
	const pos: number[] = [];
	const along: number[] = [];
	const branch = (x: number, y: number, z: number, a: number, len: number, t0: number, t1: number, steps: number, depth: number) => {
		const step = len / steps;
		for (let q = 0; q < steps; q++) {
			const ta = lerp(t0, t1, q / steps);
			const tb = lerp(t0, t1, (q + 1) / steps);
			a = a * 0.9 + (rand() - 0.5) * 0.55;
			const nx = x + Math.sin(a) * step;
			const ny = y - Math.cos(a) * step * (1 - 0.25 * Math.abs(a));
			const nz = z + (rand() - 0.5) * 0.03;
			pos.push(x, y, z, nx, ny, nz);
			along.push(ta, tb);
			x = nx;
			y = ny;
			z = nz;
			// Une radicelle part sur le côté
			if (depth === 0 && q > 2 && q < steps - 2 && rand() < 0.3) {
				branch(x, y, z, a + (rand() > 0.5 ? 0.9 : -0.9), len * 0.3, tb, Math.min(1, tb + 0.3), 4, 1);
			}
		}
	};
	const n = 7;
	for (let k = 0; k < n; k++) {
		const a = (k / (n - 1) - 0.5) * 2.3 + (rand() - 0.5) * 0.3;
		const delay = rand() * 0.3;
		branch(0, 0, (rand() - 0.5) * 0.1, a, 0.34 + rand() * 0.28 - Math.abs(a) * 0.08, delay, delay + 0.7, 10, 0);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
	const grow = { value: 0 };
	const lines = new THREE.LineSegments(
		g,
		additive(
			new THREE.ShaderMaterial({
				uniforms: { uGrow: grow, uTint: u.uTint, uDissolve: u.uDissolve },
				vertexShader: /* glsl */ `
					attribute float along;
					varying float vAlong;
					void main() {
						vAlong = along;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: /* glsl */ `
					uniform float uGrow;
					uniform float uDissolve;
					uniform vec3 uTint;
					varying float vAlong;
					void main() {
						float shown = step(vAlong, uGrow);
						// La pointe qui avance est la plus vive
						float tip = smoothstep(0.1, 0.0, uGrow - vAlong) * step(uGrow, 0.995);
						vec3 col = vec3(0.4, 0.62, 0.42) * (0.75 - 0.4 * vAlong) + uTint * tip * 1.6;
						gl_FragColor = vec4(col * shown * (1.0 - uDissolve), 0.0);
					}
				`,
			}),
		),
	);
	lines.frustumCulled = false;
	return { lines, grow };
}

/** Une plante dessinée : sa tige suit un chemin qui s'allonge, point par point */
function makePlant(base: Uniforms, x: number, run: number, leafGeo: THREE.BufferGeometry) {
	const v = VARIANTS[run % VARIANTS.length];
	const rand = rng(11 + run * 97);
	// Sa propre dissolution : chaque plante se défait seule
	const u: Uniforms = { ...base, uDissolve: { value: 0 }, uEnergy: { value: 0 } };
	const group = new THREE.Group();
	group.position.x = x;

	// La graine et ses racines
	const seedBlooms = new Blooms();
	for (let k = 0; k < 60; k++) {
		const p = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.06 * Math.cbrt(rand()));
		p.y = p.y * 0.8 + 0.02;
		seedBlooms.add(p, C(0xc8f53c).lerp(C(0xd4e07a), rand()).multiplyScalar(0.35 + rand() * 0.4), 4 + rand() * 5, 0, 0.3, rand());
	}
	group.add(seedBlooms.build(u));
	const roots = rootsMesh(u, rand);
	group.add(roots.lines);

	// La tige : un tube dont on écrit les anneaux à mesure qu'elle avance
	const count = MAX_PTS * (RING + 1);
	const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
	const nor = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
	const uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
	pos.setUsage(THREE.DynamicDrawUsage);
	nor.setUsage(THREE.DynamicDrawUsage);
	const idx: number[] = [];
	for (let i = 0; i < MAX_PTS - 1; i++)
		for (let j = 0; j < RING; j++) {
			const a = i * (RING + 1) + j;
			const b = a + RING + 1;
			idx.push(a, b, a + 1, b, b + 1, a + 1);
		}
	for (let i = 0; i < MAX_PTS; i++)
		// Le voile s'efface vers uv.x = 0 (c'est fait pour les pétales, qui se
		// recouvrent au cœur) : la tige part de plus haut, elle se voit jusqu'au sol
		for (let j = 0; j <= RING; j++) uv.setXY(i * (RING + 1) + j, 0.42 + (0.5 * i) / MAX_PTS, j / RING);
	const stemGeo = new THREE.BufferGeometry();
	stemGeo.setAttribute('position', pos);
	stemGeo.setAttribute('normal', nor);
	stemGeo.setAttribute('uv', uv);
	stemGeo.setIndex(idx);
	stemGeo.setDrawRange(0, 0);
	const green = C(0x6fcf8a);
	const stem = new THREE.Mesh(stemGeo, veilMaterial(u, { base: green, iris: 0.3, flutter: 0, grid: new THREE.Vector2(90, 4) }));
	stem.frustumCulled = false;
	group.add(stem);

	const pts: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.01, 0)];
	const ring = (i: number) => {
		const n = pts.length;
		// La pente : d'un voisin à l'autre. Un point qui vient d'être posé est
		// encore sur le précédent : on remonte jusqu'à trouver une pente, sinon
		// l'anneau n'a pas de normale et le voile y écrit une valeur invalide
		// (que le halo étale en un bloc noir autour de la plante).
		let tx = 0;
		let ty = 1;
		for (let k = Math.min(n - 1, i + 1); k > 0; k--) {
			const dx = pts[k].x - pts[Math.max(0, Math.min(k, i) - 1)].x;
			const dy = pts[k].y - pts[Math.max(0, Math.min(k, i) - 1)].y;
			const l = Math.hypot(dx, dy);
			if (l > 1e-5) {
				tx = dx / l;
				ty = dy / l;
				break;
			}
		}
		const r = 0.03 * (1 - (0.55 * i) / MAX_PTS);
		const p = pts[i];
		for (let j = 0; j <= RING; j++) {
			const an = (j / RING) * TAU;
			const c = Math.cos(an);
			const s = Math.sin(an);
			const k = i * (RING + 1) + j;
			pos.setXYZ(k, p.x - ty * c * r, p.y + tx * c * r, p.z + s * r);
			nor.setXYZ(k, -ty * c, tx * c, s);
		}
	};
	/** Réécrit le tube : sa fin seulement (le dernier point bouge, son voisin
	 *  change de pente), ou tout le chemin */
	const sync = (all = false) => {
		const n = pts.length;
		for (let i = all ? 0 : Math.max(0, n - 3); i < n; i++) ring(i);
		pos.needsUpdate = true;
		nor.needsUpdate = true;
		stemGeo.setDrawRange(0, (n - 1) * RING * 6);
	};
	sync(true);

	const leafMat = veilMaterial(u, { base: green, iris: 0.4, flutter: 0.6, grid: new THREE.Vector2(22, 5) });
	const leaves: { mesh: THREE.Mesh; age: number }[] = [];
	const addLeaf = (at: THREE.Vector3, angle: number, side: number) => {
		const mesh = new THREE.Mesh(leafGeo, leafMat);
		mesh.frustumCulled = false;
		mesh.position.copy(at);
		mesh.rotation.set(0, (side > 0 ? 0 : Math.PI) + (rand() - 0.5) * 1.1, angle - Math.PI / 2, 'ZYX');
		mesh.scale.setScalar(0.001);
		group.add(mesh);
		leaves.push({ mesh, age: 0 });
	};

	// La fleur : montée quand la tige s'arrête
	const head = new THREE.Group();
	head.visible = false;
	group.add(head);
	const hinges: THREE.Group[] = [];
	const petals: THREE.Mesh[] = [];
	let heart: THREE.Group | null = null;
	const bloomAt = (at: THREE.Vector3, angle: number, size: number) => {
		head.position.copy(at);
		head.rotation.set(0.45, rand() * TAU, angle - Math.PI / 2, 'ZXY');
		head.scale.setScalar(size);
		head.visible = true;
		const mat = veilMaterial(u, { base: C(v.veil).multiplyScalar(1.5), iris: 1.5, flutter: 1, grid: new THREE.Vector2(22, 11) });
		for (let k = 0; k < v.petals; k++) {
			const yaw = new THREE.Group();
			const order = ((k * 2) % v.petals) + (v.petals % 2 === 0 && k >= v.petals / 2 ? 1 : 0);
			yaw.rotation.y = -(order / v.petals) * TAU;
			const hinge = new THREE.Group();
			hinge.position.x = 0.05;
			const g = petalGeometry({ len: v.len, width: v.width, base: 0.55, tip: v.tip, cup: 0.22, ruffle: v.ruffle, twist: 0.35, seed: k * 3.1 + run * 17.3 }, 28, 10);
			const mesh = new THREE.Mesh(g, mat);
			mesh.frustumCulled = false;
			mesh.scale.setScalar(0.001);
			hinge.add(mesh);
			yaw.add(hinge);
			head.add(yaw);
			hinges.push(hinge);
			petals.push(mesh);
		}
		const strands = new Strands();
		const blooms = new Blooms();
		for (let k = 0; k < 20; k++) {
			const a = rand() * TAU;
			const h = 0.18 + rand() * 0.22;
			const reach = 0.08 + rand() * 0.2;
			const sp: THREE.Vector3[] = [];
			for (let q = 0; q <= 5; q++) {
				const t = q / 5;
				sp.push(new THREE.Vector3(Math.cos(a) * (0.03 + reach * t * t), h * Math.sin(t * 1.35), Math.sin(a) * (0.03 + reach * t * t)));
			}
			strands.line(sp, C(0x1a2418).multiplyScalar(0.6), C(0xd8e6c8).multiplyScalar(0.5), rand(), 0.3);
			blooms.add(sp[5], rand() > 0.35 ? C(0xff8a3a) : C(0xc8f53c), 12 + rand() * 8, 0, 1, rand());
		}
		for (let k = 0; k < 120; k++) {
			const a = rand() * TAU;
			const r = Math.sqrt(rand()) * 0.12;
			blooms.add(new THREE.Vector3(Math.cos(a) * r, 0.05 * (1 - (r / 0.12) ** 2) + rand() * 0.015, Math.sin(a) * r), C(0xd4e07a).multiplyScalar(0.3 + rand() * 0.3), 4 + rand() * 4, 0, 0.2, rand());
		}
		heart = new THREE.Group();
		heart.add(strands.build(u), blooms.build(u));
		heart.scale.setScalar(0.001);
		head.add(heart);
	};
	/** La fleur s'ouvre : t en secondes depuis l'arrêt de la tige */
	const open = (t: number) => {
		const o = ease((t - 0.35) / 1.3);
		petals.forEach((petal, k) => {
			petal.scale.setScalar(Math.max(0.001, ease((t - k * 0.05) / 0.6)));
			hinges[k].rotation.z = (1 - o) * 1.25 + Math.sin(k * 1.7) * 0.04;
		});
		heart?.scale.setScalar(Math.max(0.001, smoothstep(0.6, 1.6, t)));
	};

	const dispose = () => {
		group.traverse((o) => {
			const m = o as THREE.Mesh;
			if (m.geometry && m.geometry !== leafGeo) m.geometry.dispose();
			(Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((mm) => mm.dispose());
		});
	};

	return {
		group,
		u,
		pts,
		sync,
		roots,
		leaves,
		addLeaf,
		head,
		bloomAt,
		open,
		dispose,
		x,
		/** 'grow' : la tige avance ; 'bloom' : la fleur est là ; 'die' : elle se défait */
		state: 'grow' as 'grow' | 'bloom' | 'die',
		t: 0,
		age: 0,
		len: 0,
		sap: 0,
		dir: Math.PI / 2,
		nextLeaf: 0.3,
		side: rand() > 0.5 ? 1 : -1,
		sway: 0,
		/** Elle a remplacé un chiffre : elle reste jusqu'à la partie suivante */
		kept: false,
	};
}
type Plant = ReturnType<typeof makePlant>;

// ------------------------------------------- la terre, les chiffres et le vent, en caractères

/** Une couche plein écran, sur la grille de caractères de la passe finale :
 *  sous la ligne de sol, la terre (plus vive autour des graines) ; au-dessus,
 *  « 4 0 4 » en gros blocs de caractères, et le vent que laisse le curseur. */
function glyphLayer(glyphs: THREE.Texture, cell: THREE.Vector2, res: THREE.Vector2, wind: THREE.Texture) {
	const uniforms = {
		tGlyphs: { value: glyphs },
		tWind: { value: wind },
		uRes: { value: res },
		uCell: { value: cell },
		uTime: { value: 0 },
		/** Hauteur du sol, en pixels de la cible (origine en bas) */
		uGround: { value: 100 },
		/** Pixels par unité du monde */
		uUnit: { value: 100 },
		/** Les graines : x en pixels, force */
		uSeeds: { value: Array.from({ length: MAX_SEEDS }, () => new THREE.Vector2(0, 0)) },
		/** Les chiffres : centre en pixels, chiffre, effacement (0 → 1) */
		uDigits: { value: DIGITS.map((d) => new THREE.Vector4(0, 0, d, 0)) },
		/** Taille d'un point de chiffre, en pixels */
		uBlock: { value: new THREE.Vector2(20, 24) },
		/** Champ de vent : cases de caractères par texel, taille de la texture */
		uField: { value: new THREE.Vector3(1, FIELD_W, FIELD_H) },
		/** L'invitation, avant la première plante : x en pixels, force */
		uInvite: { value: new THREE.Vector2(0, 0) },
	};
	const mesh = new THREE.Mesh(
		fullscreenTriangle(),
		additive(
			new THREE.ShaderMaterial({
				uniforms,
				depthTest: false,
				vertexShader: FULLSCREEN_VERT,
				fragmentShader: /* glsl */ `
					precision highp float;
					uniform sampler2D tGlyphs;
					uniform sampler2D tWind;
					uniform vec2 uRes;
					uniform vec2 uCell;
					uniform vec2 uSeeds[${MAX_SEEDS}];
					uniform vec4 uDigits[3];
					uniform vec2 uBlock;
					uniform vec3 uField;
					uniform vec2 uInvite;
					uniform float uTime;
					uniform float uGround;
					uniform float uUnit;
					float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
					float vnoise(vec2 p) {
						vec2 i = floor(p);
						vec2 f = fract(p);
						f = f * f * (3.0 - 2.0 * f);
						return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
					}
					float glyph(float index, vec2 uv) {
						return texture2D(tGlyphs, vec2((index + clamp(uv.x, 0.0, 1.0)) / ${GLYPH_SLOTS}.0, clamp(uv.y, 0.0, 1.0))).r;
					}
					// Les chiffres en points, 5 de large sur 7 de haut (un nombre par rangée)
					float rowBits(float d, float row) {
						if (d > 2.0) {
							return row < 0.5 ? 2.0 : row < 1.5 ? 6.0 : row < 2.5 ? 10.0 : row < 3.5 ? 18.0 : row < 4.5 ? 31.0 : 2.0;
						}
						return row < 0.5 ? 14.0 : row < 1.5 ? 17.0 : row < 2.5 ? 19.0 : row < 3.5 ? 21.0 : row < 4.5 ? 25.0 : row < 5.5 ? 17.0 : 14.0;
					}
					void main() {
						vec2 px = gl_FragCoord.xy;
						vec2 cell = floor(px / uCell);
						vec2 f = fract(px / uCell);
						vec2 c = (cell + 0.5) * uCell;
						vec3 col = vec3(0.0);
						float groundRow = floor(uGround / uCell.y);
						vec3 acid = vec3(0.78, 0.96, 0.24);

						if (cell.y <= groundRow) {
							// Ce que les graines donnent à la terre
							float fed = 0.0;
							for (int i = 0; i < ${MAX_SEEDS}; i++) {
								vec2 s = uSeeds[i];
								vec2 d = (c - vec2(s.x, uGround)) / uUnit;
								fed += s.y * exp(-(d.x * d.x + d.y * d.y * 2.2) / 0.1);
							}
							fed = min(fed, 1.2);
							float inv = uInvite.y * exp(-pow((c.x - uInvite.x) / (uUnit * 0.5), 2.0)) * (0.6 + 0.4 * sin(uTime * 3.0));
							if (cell.y < groundRow) {
								// La terre : des caractères clairsemés, serrés autour des racines
								float depth = (uGround - c.y) / uGround;
								float n = vnoise(cell * vec2(0.22, 0.4) + 3.7) * 0.6 + vnoise(cell * vec2(0.6, 0.9)) * 0.4;
								float dens = smoothstep(0.4, 0.85, n) * exp(-depth * 3.4) * 0.42 + fed * (0.45 + 0.55 * n);
								dens *= smoothstep(1.0, 0.5, depth);
								float idx = 11.0 + floor(clamp(dens, 0.0, 0.999) * 7.0);
								// La sève compte : quelques chiffres s'allument près des racines
								float t = floor(uTime * 1.6 + hash(cell) * 9.0);
								if (hash(cell + t) < fed * 0.14) idx = floor(hash(cell * 1.7 + t) * 10.0);
								float g = glyph(idx, f) * step(0.05, dens);
								col += mix(vec3(0.42, 0.5, 0.4), vec3(0.62, 0.9, 0.3), clamp(fed * 1.4, 0.0, 1.0)) * g * (0.08 + dens * 0.55);
							} else {
								// La ligne de sol : une rangée de tirets, d'un bord à l'autre
								float gap = step(0.14, hash(vec2(cell.x, 2.0)));
								float lit = clamp(fed + inv, 0.0, 1.0);
								col += mix(vec3(0.62, 0.66, 0.6), acid, lit) * glyph(13.0, f) * gap * (0.3 + 0.6 * lit);
							}
						} else {
							// L'invitation : des chevrons qui montent du sol, là où appuyer
							float up = cell.y - groundRow;
							if (uInvite.y > 0.01 && up < 10.0 && abs(c.x - uInvite.x) < uCell.x * 0.5) {
								float wave = smoothstep(0.45, 1.0, sin(up * 0.9 - uTime * 5.0) * 0.5 + 0.5);
								col += acid * glyph(27.0, f) * wave * (1.0 - up / 10.0) * uInvite.y;
							}
							// « 4 0 4 » : chaque point du chiffre est un bloc de caractères
							for (int i = 0; i < 3; i++) {
								vec4 d = uDigits[i];
								vec2 q = (c - d.xy) / uBlock + vec2(2.5, 3.5);
								if (q.x >= 0.0 && q.x < 5.0 && q.y >= 0.0 && q.y < 7.0 && d.w < 0.999) {
									float bits = rowBits(d.z, 6.0 - floor(q.y));
									float on = mod(floor(bits / pow(2.0, 4.0 - floor(q.x))), 2.0);
									// Atteint, il s'éteint case par case
									float keep = step(d.w, hash(cell + 3.1) * 0.96 + 0.02);
									if (on > 0.5 && keep > 0.5) {
										float t = floor(uTime * 2.4 + hash(cell) * 8.0);
										float idx = hash(cell + t) < 0.16 ? floor(hash(cell * 1.3 + t) * 10.0) : d.z;
										float lum = 0.3 + 0.5 * hash(cell + floor(uTime * 1.3 + hash(cell + 9.0) * 5.0));
										lum += d.w * 2.0;
										col += mix(vec3(0.86, 0.87, 0.8), acid, 0.3 + d.w) * glyph(idx, f) * lum;
									}
								}
							}
							// Le vent : ce que le curseur laisse derrière lui
							vec4 wv = texture2D(tWind, (floor(cell / uField.x) + 0.5) / uField.yz);
							float I = wv.b;
							if (I > 0.03 && hash(cell + floor(uTime * 9.0 + hash(cell) * 4.0)) < I * 1.25) {
								vec2 dir = wv.rg * 2.0 - 1.0;
								float ax = abs(dir.x);
								float ay = abs(dir.y);
								float pick = hash(cell * 1.9 + 4.0);
								float idx;
								if (ax > ay * 2.2) idx = pick < 0.5 ? 14.0 : pick < 0.8 ? 13.0 : (dir.x > 0.0 ? 26.0 : 25.0);
								else if (ay > ax * 2.2) idx = pick < 0.7 || dir.y < 0.0 ? 24.0 : 27.0;
								else idx = dir.x * dir.y > 0.0 ? 22.0 : 23.0;
								col += vec3(0.84, 0.86, 0.8) * glyph(idx, f) * (0.12 + I * 0.75);
							}
						}
						gl_FragColor = vec4(col, 0.0);
					}
				`,
			}),
		),
	);
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	return { mesh, uniforms };
}

/** Le pollen : de gros grains de lumière qui flottent, redonnent de la sève */
function motePoints(u: Uniforms, count: number) {
	const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
	const info = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
	pos.setUsage(THREE.DynamicDrawUsage);
	info.setUsage(THREE.DynamicDrawUsage);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', pos);
	g.setAttribute('info', info);
	const points = new THREE.Points(
		g,
		additive(
			new THREE.ShaderMaterial({
				uniforms: { uTime: u.uTime, uScale: u.uScale },
				vertexShader: /* glsl */ `
					uniform float uTime;
					uniform float uScale;
					attribute vec2 info; // présence, graine
					varying float vA;
					varying float vSeed;
					void main() {
						vec4 mv = modelViewMatrix * vec4(position, 1.0);
						gl_Position = projectionMatrix * mv;
						gl_PointSize = (30.0 + 8.0 * sin(uTime * 2.0 + info.y * 30.0)) * info.x * uScale * (5.0 / -mv.z);
						vA = info.x;
						vSeed = info.y;
					}
				`,
				fragmentShader: /* glsl */ `
					varying float vA;
					varying float vSeed;
					void main() {
						float d = length(gl_PointCoord - 0.5) * 2.0;
						float halo = smoothstep(1.0, 0.0, d);
						float core = smoothstep(0.3, 0.05, d);
						vec3 c = vSeed > 0.66 ? vec3(0.94, 0.48, 0.16) : vec3(0.78, 0.96, 0.24);
						gl_FragColor = vec4((c * halo * halo * 0.5 + (c * 0.6 + 0.4) * core * 1.8) * vA, 0.0);
					}
				`,
			}),
		),
	);
	points.frustumCulled = false;
	return { points, pos, info };
}

/** Une bouffée de pollen : elle part d'un point et retombe lentement */
function pollenBurst(u: Uniforms, count: number, seed: number) {
	const rand = rng(seed);
	const dir = new Float32Array(count * 3);
	const col = new Float32Array(count * 3);
	const sd = new Float32Array(count);
	const tints = [C(0xc8f53c), C(0xf07a2a), C(0xe6e4dc), C(0xd4e07a)];
	for (let i = 0; i < count; i++) {
		const d = new THREE.Vector3(rand() - 0.5, rand() - 0.4, rand() - 0.5).normalize();
		dir.set([d.x, d.y, d.z], i * 3);
		const c = tints[i % 4];
		col.set([c.r, c.g, c.b], i * 3);
		sd[i] = rand();
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
	g.setAttribute('dir', new THREE.BufferAttribute(dir, 3));
	g.setAttribute('color', new THREE.BufferAttribute(col, 3));
	g.setAttribute('seed', new THREE.BufferAttribute(sd, 1));
	const age = { value: -1 };
	const points = new THREE.Points(
		g,
		additive(
			new THREE.ShaderMaterial({
				uniforms: { uTime: u.uTime, uScale: u.uScale, uAge: age },
				vertexShader: /* glsl */ `
					uniform float uTime;
					uniform float uScale;
					uniform float uAge;
					attribute vec3 dir;
					attribute vec3 color;
					attribute float seed;
					varying vec3 vColor;
					varying float vA;
					void main() {
						float t = max(uAge, 0.0);
						vec3 p = dir * (1.0 - exp(-t * (0.9 + seed))) * (0.3 + seed * 1.1);
						p.y += t * 0.08 * (0.4 + seed) - t * t * 0.006;
						p.x += sin(t * 0.8 + seed * 30.0) * 0.06 * t;
						vec4 mv = modelViewMatrix * vec4(p, 1.0);
						gl_Position = projectionMatrix * mv;
						gl_PointSize = (2.5 + seed * 5.0) * uScale * (5.0 / -mv.z);
						vColor = color;
						vA = step(0.0, uAge) * smoothstep(0.0, 0.2, t) * (1.0 - smoothstep(3.0, 8.0, t)) * (0.55 + 0.45 * sin(uTime * (2.0 + seed * 3.0) + seed * 40.0));
					}
				`,
				fragmentShader: /* glsl */ `
					varying vec3 vColor;
					varying float vA;
					void main() {
						float d = length(gl_PointCoord - 0.5);
						float a = smoothstep(0.5, 0.0, d);
						gl_FragColor = vec4(vColor * a * a * vA * 2.4, 0.0);
					}
				`,
			}),
		),
	);
	points.frustumCulled = false;
	return { points, age };
}

/** La lueur de la pousse : un point de lumière là où la sève arrive */
function glowSprite() {
	const uniforms = { uGlow: { value: 0 }, uCol: { value: new THREE.Color(0.78, 0.96, 0.24) } };
	const mesh = new THREE.Mesh(
		new THREE.PlaneGeometry(1, 1),
		additive(
			new THREE.ShaderMaterial({
				uniforms,
				depthTest: false,
				vertexShader: /* glsl */ `
					varying vec2 vUv;
					void main() {
						vUv = uv;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: /* glsl */ `
					uniform float uGlow;
					uniform vec3 uCol;
					varying vec2 vUv;
					void main() {
						float d = length(vUv - 0.5) * 2.0;
						float a = smoothstep(1.0, 0.0, d);
						gl_FragColor = vec4(uCol * (a * a * a * 2.2 + smoothstep(0.22, 0.0, d) * 2.0) * uGlow, 0.0);
					}
				`,
			}),
		),
	);
	mesh.frustumCulled = false;
	return { mesh, uniforms };
}

// ------------------------------------------------------------------ le jeu

export async function mountLost(host: HTMLElement): Promise<boolean> {
	const canvas = host.querySelector<HTMLCanvasElement>('[data-lost-canvas]');
	if (!canvas) return false;
	const q = <T extends HTMLElement = HTMLElement>(sel: string) => host.querySelector<T>(sel);
	const words = q('[data-lost-words]');
	const kickerEl = q('[data-lost-kicker]');
	const titleBox = q('[data-lost-title]');
	const ledeEl = q('[data-lost-lede]');
	const hintEl = q('[data-lost-hint]');
	const timeEl = q('[data-lost-time]');
	const sapEls = [...host.querySelectorAll<HTMLElement>('[data-lost-sap] i')];
	const markEls = [...host.querySelectorAll<HTMLElement>('[data-lost-marks] i')];
	const againEl = q<HTMLButtonElement>('[data-lost-again]');
	const cursorEl = q('[data-lost-cursor]');
	const inviteEl = q('[data-lost-invite]');
	const waysEl = q('[data-lost-ways]');

	// L'atlas de caractères se dessine avec la mono du site : on l'attend un peu
	try {
		await Promise.race([document.fonts.load('44px "Fragment Mono"'), new Promise((r) => setTimeout(r, 1500))]);
	} catch {}

	let renderer: THREE.WebGLRenderer;
	try {
		renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false });
	} catch {
		return false;
	}
	renderer.setClearColor(0x090c0a, 1);
	const coarse = matchMedia('(pointer: coarse)').matches;
	const lowPower = coarse || (navigator.hardwareConcurrency ?? 8) <= 4;
	// Comme les fleurs isolées (specimen.ts) : la passe finale écrit sa propre
	// opacité, le fond de la page transparaît, rien à ajouter
	const post = createPost(renderer, { lowPower });
	const P = post.uniforms;
	P.uReveal.value = 1;
	P.uScanAll.value = 0;
	P.uMosaic.value = 0;
	P.uAura.value = 0.8;
	P.uAscii.value = 0;
	P.uRays.value = 0;
	P.uExposure.value = 1.15;
	P.uVignette.value = 0;
	P.uFloor.value = 0.04;
	P.uGrainMask.value = 1;

	const scene = new THREE.Scene();
	const FOV = 30;
	const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
	const u: Uniforms = {
		uTime: { value: 0 },
		uEnergy: { value: 0 },
		uDissolve: { value: 0 },
		uTint: { value: new THREE.Color(0.78, 0.96, 0.24) },
		uScale: { value: 1 },
		uFocusDist: { value: 10 },
		uMotion: { value: 1 },
		uGround: { value: -100 },
		uPick: { value: new THREE.Vector4(0, -100, 0, 0) },
	};

	// ---- le champ de vent : une case par caractère, écrite par le curseur
	const fI = new Float32Array(FIELD_W * FIELD_H);
	const fX = new Float32Array(FIELD_W * FIELD_H);
	const fY = new Float32Array(FIELD_W * FIELD_H);
	const fData = new Uint8Array(FIELD_W * FIELD_H * 4);
	const windTex = new THREE.DataTexture(fData, FIELD_W, FIELD_H, THREE.RGBAFormat);
	windTex.minFilter = windTex.magFilter = THREE.NearestFilter;
	windTex.needsUpdate = true;
	let cols = 1;
	let rows = 1;
	/** Pixels CSS par case du champ */
	let fw = 7;
	let fh = 12;

	const layer = glyphLayer(P.tGlyphs.value, P.uCell.value, P.uRes.value, windTex);
	const L = layer.uniforms;
	scene.add(layer.mesh);
	const MOTES = lowPower ? 6 : 9;
	const motes = motePoints(u, MOTES);
	scene.add(motes.points);
	const moteData = Array.from({ length: MOTES }, (_, i) => ({ x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, ph: i * 2.1, on: 0, wait: 0 }));
	const bursts = DIGITS.map((_, i) => pollenBurst(u, lowPower ? 90 : 160, 41 + i));
	bursts.forEach((b) => scene.add(b.points));
	const glow = glowSprite();
	scene.add(glow.mesh);
	const leafGeo = petalGeometry({ len: 0.46, width: 0.17, base: 0.7, tip: -0.4, cup: 0.12, ruffle: 0.03, twist: 0.7, seed: 41 }, 20, 5);

	// ---- la mise en page : le sol en bas, le ciel au-dessus, tout en unités du monde
	let w = 1;
	let h = 1;
	let dpr = 1;
	let unit = 100; // pixels par unité
	let groundPx = 1; // le sol, en pixels depuis le haut
	let halfW = 5;
	let skyTop = 5; // hauteur libre au-dessus du sol
	let sap0 = 2.2;
	let moteSap = 1;
	const digits = DIGITS.map((d) => ({ d, x: 0, y: 0, hw: 0.4, hh: 0.6, gone: 0, hit: false }));
	const toWorldX = (px: number) => (px - w / 2) / unit;
	const toWorldY = (py: number) => (groundPx - py) / unit;
	const moteRand = rng(73);
	const placeMote = (m: (typeof moteData)[number]) => {
		const narrow = w < 900;
		const x0 = narrow ? -halfW + 0.35 : -halfW * 0.12;
		const x1 = halfW - 0.35;
		for (let tries = 0; tries < 12; tries++) {
			m.hx = lerp(x0, x1, moteRand());
			m.hy = lerp(skyTop * 0.16, skyTop * 0.72, moteRand());
			// Pas dans un chiffre
			if (!digits.some((d) => !d.hit && Math.abs(m.hx - d.x) < d.hw + 0.25 && Math.abs(m.hy - d.y) < d.hh + 0.25)) break;
		}
		m.x = m.hx;
		m.y = m.hy;
		m.vx = m.vy = 0;
		m.on = 0;
	};
	const resize = () => {
		const r = host.getBoundingClientRect();
		const narrow = r.width < 900;
		w = Math.max(1, r.width);
		h = Math.max(1, r.height);
		dpr = Math.min(devicePixelRatio, lowPower ? 1.25 : 1.6);
		renderer.setPixelRatio(dpr);
		renderer.setSize(w, h, false);
		post.setSize(w, h, dpr);
		const cw = Math.round(7 * dpr);
		const ch = Math.round(12 * dpr);
		P.uCell.value.set(cw, ch);
		groundPx = Math.round(h * (narrow ? 0.74 : 0.8));
		unit = groundPx / SKY;
		halfW = w / 2 / unit;
		const dist = h / unit / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
		const cy = (groundPx - h / 2) / unit;
		camera.aspect = w / h;
		camera.position.set(0, cy, dist);
		camera.lookAt(0, cy, 0);
		camera.updateProjectionMatrix();
		u.uFocusDist.value = dist;
		u.uScale.value = dpr * (h / 900) * 1.6 + 0.6;
		L.uGround.value = (h - groundPx) * dpr;
		L.uUnit.value = unit * dpr;

		// Le ciel libre : sous l'en-tête sur un grand écran, sous le texte sur un téléphone
		const wb = words ? words.getBoundingClientRect().bottom - r.top : 0;
		skyTop = narrow ? (groundPx - wb - 14) / unit : (groundPx - 84) / unit;
		sap0 = skyTop * 0.42;
		moteSap = skyTop * 0.2;
		// Les chiffres : des blocs de caractères entiers, alignés sur la grille
		const bw = Math.max(2, Math.round((unit * (narrow ? 0.13 : 0.17)) / 7));
		const bh = Math.max(1, Math.round((unit * (narrow ? 0.1 : 0.17)) / 12));
		L.uBlock.value.set(bw * cw, bh * ch);
		const fx = narrow ? [-0.27, 0.27, 0] : [0.09, 0.25, 0.41];
		const fy = [0.36, 0.6, 0.84];
		digits.forEach((d, i) => {
			d.hw = (2.5 * bw * 7) / unit;
			d.hh = (3.5 * bh * 12) / unit;
			// Centre calé sur la grille : les blocs tombent juste sur les cases
			const pxX = Math.round(((w / 2 + fx[i] * w) * dpr) / cw) * cw + (bw % 2 ? cw / 2 : 0);
			const mid = Math.min(skyTop - d.hh - 0.1, skyTop * fy[i]);
			const pxY = Math.round(((h - groundPx + mid * unit) * dpr) / ch) * ch + (bh % 2 ? ch / 2 : 0);
			d.x = toWorldX(pxX / dpr);
			d.y = (pxY / dpr - (h - groundPx)) / unit;
			L.uDigits.value[i].set(pxX, pxY, d.d, d.gone);
		});
		L.uInvite.value.x = (digits[0].x * unit + w / 2) * dpr;
		// L'invitation (DOM) se pose sur le sol, sous le premier chiffre
		if (inviteEl) inviteEl.style.transform = `translate(${(digits[0].x * unit + w / 2).toFixed(1)}px, ${groundPx}px)`;
		// Sur téléphone, la consigne se range au-dessus des liens, quelle que soit leur hauteur
		if (waysEl) host.style.setProperty('--ways-h', `${waysEl.offsetHeight}px`);

		// Le champ de vent couvre l'écran, une case par caractère
		const k = Math.max(1, Math.ceil(Math.ceil((w * dpr) / cw) / FIELD_W), Math.ceil(Math.ceil((h * dpr) / ch) / FIELD_H));
		cols = Math.min(FIELD_W, Math.ceil((w * dpr) / cw / k));
		rows = Math.min(FIELD_H, Math.ceil((h * dpr) / ch / k));
		fw = (cw * k) / dpr;
		fh = (ch * k) / dpr;
		L.uField.value.set(k, FIELD_W, FIELD_H);
		moteData.forEach((m) => placeMote(m));
	};
	new ResizeObserver(resize).observe(host);
	if (waysEl) new ResizeObserver(() => host.style.setProperty('--ways-h', `${waysEl.offsetHeight}px`)).observe(waysEl);
	resize();

	// ---- l'état de la partie
	const plants: Plant[] = [];
	let active: Plant | null = null;
	let run = 0;
	let started = false;
	let done = false;
	let clock = 0;
	let grown = 0;
	let flash = 0;
	let wipe = -1;
	let invite = 1;
	const MAX_PLANTS = lowPower ? 7 : 10;
	// Le curseur : en pixels de la page
	const ptr = { x: w / 2, y: groundPx, px: w / 2, py: groundPx, down: false, seen: false, keys: false };
	const held = { up: false, down: false, left: false, right: false, space: false };
	let touched = false;
	let auto: { pts: [number, number][]; i: number } | null = null;

	// ---- l'affichage (DOM) : consigne, sève, chiffres, chrono
	const say = (el: HTMLElement | null, text: string) => {
		if (!el || el.dataset.scrambleText === text) return;
		el.dataset.scrambleText = text;
		scramble(el, 380);
	};
	const HINT = 'Press the ground and drag up';
	const retitle = (text: string) => {
		const h1 = titleBox?.querySelector<HTMLElement>('h1');
		if (!titleBox || !h1 || h1.getAttribute('aria-label') === text) return;
		h1.textContent = text;
		delete h1.dataset.splitDone;
		h1.classList.remove('is-in');
		mountText(titleBox);
		requestAnimationFrame(() => requestAnimationFrame(() => h1.classList.add('is-in')));
	};
	const readBest = () => {
		try {
			const b = Number(localStorage.getItem(BEST));
			return b > 0 ? b : 0;
		} catch {
			return 0;
		}
	};
	let lastTime = '';
	const showTime = () => {
		const text = `${clock.toFixed(1)} s`;
		if (timeEl && text !== lastTime) timeEl.textContent = lastTime = text;
	};
	const marks = () => {
		markEls.forEach((el, i) => (el.dataset.state = digits[i].hit ? 'done' : ''));
		say(kickerEl, `[ Error ${digits.map((d) => (d.hit ? '*' : d.d)).join('')} ]`);
	};
	let lastSap = -1;
	const showSap = (f: number) => {
		const n = Math.round(clamp01(f) * sapEls.length);
		if (n === lastSap) return;
		lastSap = n;
		sapEls.forEach((el, i) => (el.dataset.state = i < n ? 'on' : ''));
	};
	say(hintEl, HINT);

	// ---- les sons du jeu, avec les briques du site
	let tone: { ac: AudioContext; a: OscillatorNode; b: OscillatorNode; g: GainNode } | null = null;
	let toneAt = 0;
	/** La sève : une note tenue tant que la tige avance ; elle monte avec elle */
	const sapTone = (level: number, midi: number, now: number) => {
		if (now - toneAt < 0.07) return;
		toneAt = now;
		const c = kit.ctx();
		if (!c || c.ac.state !== 'running') return;
		if (!tone || tone.ac !== c.ac) {
			const g = c.ac.createGain();
			g.gain.value = 0;
			const f = c.ac.createBiquadFilter();
			f.type = 'lowpass';
			f.frequency.value = 1300;
			const send = c.ac.createGain();
			send.gain.value = 0.6;
			g.connect(f);
			f.connect(c.duck);
			f.connect(send).connect(c.verb);
			const a = c.ac.createOscillator();
			a.type = 'triangle';
			const b = c.ac.createOscillator();
			b.type = 'sine';
			const bg = c.ac.createGain();
			bg.gain.value = 0.4;
			a.connect(g);
			b.connect(bg).connect(g);
			a.start();
			b.start();
			tone = { ac: c.ac, a, b, g };
		}
		const t = c.ac.currentTime;
		tone.g.gain.setTargetAtTime(level, t, 0.09);
		tone.a.frequency.setTargetAtTime(kit.note(midi), t, 0.1);
		tone.b.frequency.setTargetAtTime(kit.note(midi + 12.07), t, 0.1);
	};
	// Ré mineur, comme la nappe : la hauteur de la tige choisit la note
	const SCALE = [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74];
	const HIGH = [74, 76, 77, 79, 81, 84, 86, 88];
	const noteAt = (y: number) => SCALE[Math.min(SCALE.length - 1, Math.max(0, Math.floor((y / Math.max(1, skyTop)) * SCALE.length)))];
	let moteNote = 0;

	// ---- planter, pousser, fleurir
	const tipW = new THREE.Vector3();
	const tipOf = (p: Plant) => {
		const last = p.pts[p.pts.length - 1];
		return tipW.set(p.x + last.x, last.y, last.z);
	};
	const win = () => {
		done = true;
		const best = readBest();
		const record = !best || clock < best;
		if (record) {
			try {
				localStorage.setItem(BEST, clock.toFixed(1));
			} catch {}
		}
		showTime();
		setTimeout(() => sound.bloom(), 350);
		retitle('Something grows here.');
		const many = grown <= 3 ? 'three plants, not one wasted' : `${grown} plants`;
		const tail = record ? (best ? 'That is your best so far.' : 'The page is still lost, but it looks better now.') : `Your best is ${best.toFixed(1)} seconds.`;
		if (ledeEl) ledeEl.textContent = `No more error. You grew over it in ${clock.toFixed(1)} seconds, with ${many}. ${tail}`;
		say(hintEl, 'Keep growing, the ground is yours');
		if (againEl) againEl.hidden = false;
	};
	const finish = (p: Plant, on: number) => {
		const n = p.pts.length;
		const a = p.pts[n - 1];
		const b = p.pts[Math.max(0, n - 3)];
		const angle = p.len > 0.12 ? Math.atan2(a.y - b.y, a.x - b.x) : Math.PI / 2;
		// Sur un écran étroit les fleurs se serrent : elles sont plus petites
		const size = (on >= 0 ? 0.92 : p.len < 0.25 ? 0.28 : clamp01(0.36 + p.len * 0.1) * 0.9) * (w < 900 ? 0.72 : 1);
		p.bloomAt(a, angle, size);
		p.state = 'bloom';
		p.t = 0;
		p.kept = on >= 0;
		if (active === p) active = null;
		grown++;
		kit.bell(kit.note(noteAt(a.y) + 12), 0.05, 2.2, 0.75);
		kit.bell(kit.note(noteAt(a.y) + 19), 0.03, 2.4, 0.8, 0.1);
		if (on < 0) return;
		// Un chiffre atteint : il se défait en pollen, la fleur prend sa place
		const d = digits[on];
		d.hit = true;
		const hits = digits.filter((x) => x.hit).length;
		bursts[on].points.position.set(d.x, d.y, 0);
		bursts[on].age.value = 0;
		flash = 0.25;
		sound.stage(hits + 1);
		kit.whoosh(500, 3000, 0.7, 0.07);
		marks();
		// Un coup dans la main, seulement si c'est un doigt qui joue
		if (touched) {
			try {
				navigator.vibrate?.(30);
			} catch {}
		}
		if (hits === DIGITS.length) win();
		else say(hintEl, hits === 1 ? 'Two to go, the pollen gives more sap' : 'One to go');
	};
	const plant = (x: number) => {
		if (active) finish(active, -1);
		// Le sol est plein : la plus ancienne plante libre laisse sa place
		const free = plants.filter((p) => !p.kept && p.state !== 'die');
		if (free.length >= MAX_PLANTS) {
			free[0].state = 'die';
			free[0].t = 0;
		}
		const p = makePlant(u, Math.min(halfW - 0.15, Math.max(-halfW + 0.15, x)), run++, leafGeo);
		p.sap = sap0;
		plants.push(p);
		scene.add(p.group);
		active = p;
		if (!started) {
			started = true;
			clock = 0;
		}
		moteNote = 0;
		kit.thump(0.1);
		kit.ticks(4, 0.05, 0.04);
		if (!done) say(hintEl, digits.some((d) => d.hit) ? (digits.filter((d) => d.hit).length === 1 ? 'Two to go, the pollen gives more sap' : 'One to go') : 'Reach the 4, the 0 and the 4');
	};
	const restart = () => {
		if (wipe >= 0) return;
		wipe = 0;
		if (againEl) {
			againEl.blur();
			againEl.hidden = true;
		}
		active = null;
		plants.forEach((p) => {
			if (p.state !== 'die') {
				p.state = 'die';
				p.t = 0;
			}
		});
		kit.whoosh(2400, 300, 0.8, 0.1);
	};
	const reset = () => {
		wipe = -1;
		started = done = false;
		clock = grown = 0;
		invite = 1;
		digits.forEach((d) => {
			d.hit = false;
		});
		lastTime = '';
		if (timeEl) timeEl.textContent = '0.0 s';
		marks();
		retitle('Nothing grows here.');
		if (ledeEl) ledeEl.textContent = 'The error is back. You know what to do.';
		say(hintEl, HINT);
	};
	againEl?.addEventListener('click', restart);

	// ---- les gestes
	const menuOpen = () => document.querySelector<HTMLElement>('[data-island]')?.dataset.view !== 'bar';
	const at = (e: PointerEvent) => {
		const r = host.getBoundingClientRect();
		ptr.x = e.clientX - r.left;
		ptr.y = e.clientY - r.top;
		if (!ptr.seen) {
			ptr.px = ptr.x;
			ptr.py = ptr.y;
			ptr.seen = true;
		}
		if (ptr.keys) {
			ptr.keys = false;
			if (cursorEl) cursorEl.hidden = true;
		}
	};
	const press = () => {
		if (ptr.down || wipe >= 0) return;
		ptr.down = true;
		plant(toWorldX(ptr.x));
	};
	const lift = () => {
		ptr.down = false;
	};
	host.addEventListener('pointermove', (e) => {
		if (e.isPrimary) at(e);
	});
	host.addEventListener('pointerdown', (e) => {
		if (!e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest('a, button')) return;
		at(e);
		touched = e.pointerType === 'touch';
		// Au doigt, pas de vent entre deux touches : le curseur saute
		if (e.pointerType !== 'mouse') {
			ptr.px = ptr.x;
			ptr.py = ptr.y;
		}
		press();
	});
	addEventListener('pointerup', lift);
	addEventListener('pointercancel', lift);
	addEventListener('blur', () => {
		lift();
		held.up = held.down = held.left = held.right = held.space = false;
	});
	// Un appui long au doigt ne doit ouvrir ni menu ni sélection
	host.addEventListener('contextmenu', (e) => {
		if (!(e.target as HTMLElement).closest('a')) e.preventDefault();
	});
	const KEYS: Record<string, keyof typeof held> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Space: 'space' };
	addEventListener('keydown', (e) => {
		const k = KEYS[e.code];
		if (!k) return;
		const a = document.activeElement;
		if ((a && a !== document.body && a.matches('a, button, input, textarea, select')) || menuOpen()) return;
		e.preventDefault();
		if (!ptr.keys) {
			// Le viseur du clavier part du sol, sous le premier chiffre
			ptr.keys = true;
			if (!ptr.seen) {
				ptr.x = ptr.px = digits[0].x * unit + w / 2;
				ptr.y = ptr.py = groundPx - 4;
				ptr.seen = true;
			}
			if (cursorEl) cursorEl.hidden = false;
		}
		if (k === 'space' && !held.space) press();
		held[k] = true;
	});
	addEventListener('keyup', (e) => {
		const k = KEYS[e.code];
		if (!k) return;
		held[k] = false;
		if (k === 'space') lift();
	});

	// ---- le vent : le curseur écrit dans le champ, qui s'efface
	const stamp = (x0: number, y0: number, x1: number, y1: number, strength: number) => {
		const dx = x1 - x0;
		const dy = y1 - y0;
		const len = Math.hypot(dx, dy);
		if (len < 0.5 || strength <= 0.02) return;
		const ux = dx / len;
		const uy = -dy / len; // l'écran descend, le monde monte
		const R = 30 + strength * 46;
		const steps = Math.max(1, Math.ceil(len / (R * 0.5)));
		for (let s = 0; s <= steps; s++) {
			const cx = x0 + (dx * s) / steps;
			const cy = y0 + (dy * s) / steps;
			const c0 = Math.max(0, Math.floor((cx - R) / fw));
			const c1 = Math.min(cols - 1, Math.floor((cx + R) / fw));
			const r0 = Math.max(0, Math.floor((h - cy - R) / fh));
			const r1 = Math.min(rows - 1, Math.floor((h - cy + R) / fh));
			for (let r = r0; r <= r1; r++)
				for (let c = c0; c <= c1; c++) {
					const d = Math.hypot((c + 0.5) * fw - cx, h - (r + 0.5) * fh - cy) / R;
					if (d >= 1) continue;
					const v = strength * (1 - d * d);
					const i = r * FIELD_W + c;
					if (v > fI[i]) {
						fI[i] = v;
						fX[i] = ux;
						fY[i] = uy;
					}
				}
		}
	};
	/** Le vent à un point du monde (x, y) : direction × force */
	const wv = { x: 0, y: 0 };
	const windAt = (x: number, y: number) => {
		const c = Math.floor((x * unit + w / 2) / fw);
		const r = Math.floor((h - groundPx + y * unit) / fh);
		if (c < 0 || r < 0 || c >= cols || r >= rows) {
			wv.x = wv.y = 0;
			return wv;
		}
		const i = r * FIELD_W + c;
		wv.x = fX[i] * fI[i];
		wv.y = fY[i] * fI[i];
		return wv;
	};

	// ---- la boucle
	let raf = 0;
	let last = 0;
	const frame = (ms: number) => {
		raf = requestAnimationFrame(frame);
		const t = ms / 1000;
		const dt = Math.min(0.05, t - (last || t));
		last = t;
		u.uTime.value = t;
		P.uTime.value = t;
		L.uTime.value = t;

		// Le viseur du clavier
		if (ptr.keys) {
			const sp = 420 * dt;
			ptr.x = Math.min(w - 6, Math.max(6, ptr.x + ((held.right ? 1 : 0) - (held.left ? 1 : 0)) * sp));
			ptr.y = Math.min(groundPx, Math.max(70, ptr.y + ((held.down ? 1 : 0) - (held.up ? 1 : 0)) * sp));
			if (cursorEl) cursorEl.style.transform = `translate(${ptr.x.toFixed(1)}px, ${ptr.y.toFixed(1)}px)`;
		}
		// Les captures : un curseur écrit d'avance fait pousser une plante
		if (auto) {
			const [fx, fy] = auto.pts[auto.i];
			ptr.x = ptr.px = fx * w;
			ptr.y = ptr.py = fy * h;
			ptr.seen = true;
			if (!ptr.down && auto.i === 0) press();
			const grower = active as Plant | null;
			if (!grower) {
				auto = null;
				lift();
			} else {
				const tip = tipOf(grower);
				if (Math.hypot(tip.x - toWorldX(ptr.x), tip.y - toWorldY(ptr.y)) < 0.14 && ++auto.i >= auto.pts.length) {
					auto = null;
					lift();
				}
			}
		}

		// Le vent : sans appuyer, le curseur qui file pousse l'air
		const speed = Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py) / Math.max(dt, 1e-3);
		if (ptr.seen && !ptr.down) stamp(ptr.px, ptr.py, ptr.x, ptr.y, clamp01((speed - 160) / 1500));
		ptr.px = ptr.x;
		ptr.py = ptr.y;
		const decay = Math.exp(-dt * 2.1);
		for (let r = 0; r < rows; r++) {
			let i = r * FIELD_W;
			for (let c = 0; c < cols; c++, i++) {
				const v = fI[i] * decay;
				fI[i] = v < 0.01 ? 0 : v;
				const k = i * 4;
				fData[k] = (fX[i] * 0.5 + 0.5) * 255;
				fData[k + 1] = (fY[i] * 0.5 + 0.5) * 255;
				fData[k + 2] = fI[i] * 255;
			}
		}
		windTex.needsUpdate = true;

		if (started && !done && wipe < 0) clock += dt;
		invite += ((started ? 0 : 1) - invite) * (1 - Math.exp(-dt * 4));
		L.uInvite.value.y = invite;
		if (inviteEl && inviteEl.dataset.off !== String(started)) inviteEl.dataset.off = String(started);

		// La tige suit le curseur, à son pas, tant qu'elle a de la sève
		let growing = false;
		const a = active as Plant | null;
		if (a && a.state === 'grow') {
			const lastP = a.pts[a.pts.length - 1];
			const dx = toWorldX(ptr.x) - a.x - lastP.x;
			const dy = Math.max(0.05, toWorldY(ptr.y)) - lastP.y;
			const dist = Math.hypot(dx, dy);
			if (!ptr.down) finish(a, -1);
			else if (dist > 0.07) {
				growing = true;
				// Elle tourne vers le curseur sans jamais casser sa courbe
				let da = Math.atan2(dy, dx) - a.dir;
				da = Math.atan2(Math.sin(da), Math.cos(da));
				a.dir += Math.sign(da) * Math.min(Math.abs(da), TURN * dt * (a.len < 0.2 ? 3 : 1));
				const move = Math.min(SPEED * dt, a.sap, dist);
				lastP.x += Math.cos(a.dir) * move;
				lastP.y = Math.max(0.03, lastP.y + Math.sin(a.dir) * move);
				lastP.x = Math.min(halfW - 0.1 - a.x, Math.max(-halfW + 0.1 - a.x, lastP.x));
				lastP.z = Math.sin(a.len * 2.3 + a.x) * 0.05;
				a.sap -= move;
				a.len += move;
				if (lastP.distanceTo(a.pts[a.pts.length - 2]) >= STEP && a.pts.length < MAX_PTS) a.pts.push(lastP.clone());
				a.sync();
				if (a.len >= a.nextLeaf && a.pts.length > 3) {
					a.addLeaf(a.pts[a.pts.length - 3], a.dir, a.side);
					a.side = -a.side;
					a.nextLeaf += 0.36 + ((a.len * 7.3) % 0.2);
				}
				// Le pollen redonne de la sève
				const tip = tipOf(a);
				for (const m of moteData) {
					if (m.on < 0.6 || Math.hypot(m.x - tip.x, m.y - tip.y) > 0.3) continue;
					m.on = 0;
					m.wait = 2.5 + Math.random() * 2;
					a.sap += moteSap;
					a.u.uEnergy.value = 10;
					kit.bell(kit.note(HIGH[moteNote++ % HIGH.length]), 0.05, 1.4, 0.6);
				}
				// Un chiffre atteint
				let on = -1;
				digits.forEach((d, i) => {
					if (!d.hit && Math.abs(tip.x - d.x) < d.hw && Math.abs(tip.y - d.y) < d.hh * 0.9) on = i;
				});
				if (on >= 0) finish(a, on);
				else if (a.sap <= 0.001 || a.pts.length >= MAX_PTS) finish(a, -1);
			}
			sapTone(growing ? 0.05 : 0.012, noteAt(lastP.y), t);
			showSap(a.sap / sap0);
		} else {
			sapTone(0, 50, t);
			showSap(1);
		}

		// Chaque plante vit : racines, feuilles, fleur, et le vent qui la couche
		let seeds = 0;
		for (let i = plants.length - 1; i >= 0; i--) {
			const p = plants[i];
			p.age += dt;
			p.t += dt;
			p.roots.grow.value = Math.min(1, p.age / 1.6);
			p.u.uEnergy.value += ((p === a && growing ? 3 : 0) - p.u.uEnergy.value) * (1 - Math.exp(-dt * 4));
			for (const leaf of p.leaves) {
				if (leaf.age >= 1) continue;
				leaf.age = Math.min(1, leaf.age + dt / 0.7);
				leaf.mesh.scale.setScalar(Math.max(0.001, ease(leaf.age)));
			}
			if (p.state === 'bloom') {
				if (p.t < 2.2) p.open(p.t);
				p.head.rotation.y += dt * 0.25;
				const tip = p.pts[p.pts.length - 1];
				windAt(p.x + tip.x, tip.y);
				p.sway += ((-wv.x * 0.16) / (1 + tip.y * 0.25) - p.sway) * (1 - Math.exp(-dt * 6));
				p.group.rotation.z = p.sway + Math.sin(t * 0.9 + p.x * 3) * 0.012;
			} else if (p.state === 'die') {
				p.u.uDissolve.value = clamp01(p.t / 0.9);
				if (p.t >= 0.9) {
					scene.remove(p.group);
					p.dispose();
					plants.splice(i, 1);
					continue;
				}
			}
			if (seeds < MAX_SEEDS) L.uSeeds.value[seeds++].set((p.x * unit + w / 2) * dpr, p.roots.grow.value * (1 - p.u.uDissolve.value));
		}
		for (let i = seeds; i < MAX_SEEDS; i++) L.uSeeds.value[i].set(0, 0);

		// La lueur au bout de la tige : elle baisse avec la sève
		const live = active as Plant | null;
		if (live) {
			const f = clamp01(live.sap / sap0);
			glow.mesh.position.copy(tipOf(live));
			glow.mesh.quaternion.copy(camera.quaternion);
			glow.mesh.scale.setScalar(0.2 + 0.14 * f);
			glow.uniforms.uGlow.value += (0.16 + 0.3 * f - glow.uniforms.uGlow.value) * (1 - Math.exp(-dt * 10));
		} else glow.uniforms.uGlow.value *= Math.exp(-dt * 8);

		// Le pollen flotte autour de sa place ; le vent l'emporte
		moteData.forEach((m, i) => {
			if (m.wait > 0) {
				m.wait -= dt;
				if (m.wait <= 0) placeMote(m);
			} else m.on = Math.min(1, m.on + dt * 1.6);
			windAt(m.x, m.y);
			m.vx += (wv.x * 7 + (m.hx + Math.sin(t * 0.5 + m.ph) * 0.22 - m.x) * 0.5) * dt;
			m.vy += (wv.y * 7 + (m.hy + Math.cos(t * 0.4 + m.ph * 1.7) * 0.16 - m.y) * 0.5) * dt;
			const damp = Math.exp(-dt * 1.4);
			m.vx *= damp;
			m.vy *= damp;
			m.x = Math.min(halfW - 0.2, Math.max(-halfW + 0.2, m.x + m.vx * dt));
			m.y = Math.min(skyTop - 0.1, Math.max(0.35, m.y + m.vy * dt));
			// Le vent l'a déplacé pour de bon : il reste là où on l'a poussé
			m.hx += (m.x - m.hx) * Math.min(1, dt * 0.6);
			m.hy += (m.y - m.hy) * Math.min(1, dt * 0.6);
			motes.pos.setXYZ(i, m.x, m.y, 0);
			motes.info.setXY(i, m.wait > 0 ? 0 : ease(m.on), (i * 0.37) % 1);
		});
		motes.pos.needsUpdate = true;
		motes.info.needsUpdate = true;

		// Les chiffres atteints s'effacent ; à la partie suivante, ils reviennent
		digits.forEach((d, i) => {
			d.gone = clamp01(d.gone + (d.hit ? dt / 0.7 : -dt / 0.9));
			L.uDigits.value[i].w = d.gone;
		});
		for (const b of bursts) if (b.age.value >= 0) b.age.value += dt;

		// Une nouvelle partie : tout se défait, l'erreur revient
		if (wipe >= 0) {
			wipe += dt;
			if (wipe >= 1) reset();
		}

		flash *= Math.exp(-dt * 5);
		P.uFlash.value = flash;
		if (started && !done) showTime();

		camera.updateMatrixWorld();
		post.render(scene, camera);
	};

	const wake = () => {
		if (document.hidden) {
			cancelAnimationFrame(raf);
			raf = 0;
			lift();
			sapTone(0, 50, toneAt + 1);
		} else if (!raf) {
			last = 0;
			raf = requestAnimationFrame(frame);
		}
	};
	document.addEventListener('visibilitychange', wake);
	raf = requestAnimationFrame(frame);

	// Le contexte graphique peut être repris par le système : la page revient à
	// sa version fixe
	canvas.addEventListener('webglcontextlost', (e) => {
		e.preventDefault();
		cancelAnimationFrame(raf);
		document.removeEventListener('visibilitychange', wake);
		host.dataset.lost = '';
	});

	if (import.meta.env.DEV) {
		(window as unknown as { __lost: object }).__lost = {
			/** Fait pousser une plante par ces points (fractions de la page), puis relâche */
			auto(pts: [number, number][]) {
				lift();
				auto = { pts, i: 0 };
			},
			/** Un coup de vent d'un point à l'autre (fractions de la page) */
			blow(x0: number, y0: number, x1: number, y1: number, strength = 1) {
				stamp(x0 * w, y0 * h, x1 * w, y1 * h, strength);
			},
			win() {
				started = true;
				clock = 31.4;
				digits.forEach((d, i) => {
					if (d.hit) return;
					const p = makePlant(u, d.x + (i - 1) * 0.3, run++, leafGeo);
					plants.push(p);
					scene.add(p.group);
					const n = 40;
					for (let k = 2; k < n; k++) p.pts.push(new THREE.Vector3(Math.sin(k * 0.16 + i) * 0.3 * (1 - k / n) - (i - 1) * 0.3 * (k / n), (k / n) * (d.y - d.hh * 0.5), 0));
					p.sync(true);
					p.len = d.y;
					for (let k = 8; k < n - 4; k += 7) p.addLeaf(p.pts[k], Math.PI / 2, k % 2 ? 1 : -1);
					finish(p, i);
				});
			},
			state: () => ({ list: plants.map((p) => [p.state, p.pts.length, +p.group.rotation.z.toFixed(3), +p.len.toFixed(2), p.head.visible, +p.t.toFixed(2), p.pts[p.pts.length - 1].toArray().map((v) => +v.toFixed(2))]), plants: plants.length, hits: digits.map((d) => d.hit), clock, sap0, skyTop, halfW, digits: digits.map((d) => [d.x, d.y, d.hw, d.hh]), motes: moteData.map((m) => [m.x, m.y, m.on]) }),
		};
	}

	host.dataset.lost = 'live';
	return true;
}
