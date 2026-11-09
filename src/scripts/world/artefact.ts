// Le spécimen, vu de dehors : une plante qui n'existe pas. Une tige qui
// s'enroule sur elle-même, couverte de fibres et de fleurs sauvages ; au
// sommet, une grande fleur translucide, tramée comme un relevé et irisée
// comme un film. Tout est généré : pas de modèle à charger.
// Quand on plonge, la plante se défait en pollen par l'avant.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, additive, lerp, noise3, rng } from './shared';

/** Taille du spécimen (diamètre de la fleur et de son orbite), en unités du monde */
export const SPECIMEN_SIZE = 2.6;
/** Cœur de la fleur, dans le repère du spécimen */
const HEAD = new THREE.Vector3(0, 0.36, 0);
/** Échelle de la plante dans la scène */
const SCALE = 1.3;
const STEM_BASE = -3.1;

export interface ArtefactState {
	dt: number;
	time: number;
	/** Curseur lissé, -1 → 1 */
	px: number;
	py: number;
	/** Plongée 0 → 1 */
	dive: number;
	/** Lumière de la sève (survol d'un projet, approche) */
	energy: number;
	motion: number;
}

// Même champ de dissolution dans la plante (fragment) et ses particules (sommet)
const DISSOLVE = /* glsl */ `
	float dissolveField(vec3 objP, float worldZ) {
		float n = n3(objP * 3.0) * 0.7 + n3(objP * 9.0) * 0.3;
		return n * 0.72 + 0.28 * (0.5 - 0.5 * clamp(worldZ / 1.2, -1.0, 1.0));
	}
`;
const DISSOLVE_CUT = /* glsl */ `
	float dField = dissolveField(vObjP, vWz) - (uDissolve * 1.15 - 0.05);
	if (dField < 0.0) discard;
	float burn = (1.0 - smoothstep(0.0, 0.05, dField)) * step(0.001, uDissolve);
`;

const SURFACE_VERT = /* glsl */ `
	uniform float uTime;
	uniform float uMotion;
	uniform float uFlutter;
	varying vec2 vUv;
	varying vec3 vN;
	varying vec3 vObjP;
	varying vec3 vWorld;
	varying float vWz;
	void main() {
		vec3 p = position;
		// Les pétales respirent un peu, plus au bout qu'à la base
		p += normal * sin(uTime * 1.1 + position.x * 3.0 + position.z * 2.0) * 0.012 * uv.x * uFlutter * uMotion;
		vec4 local = vec4(p, 1.0);
		vec3 nrm = normal;
		#ifdef USE_INSTANCING
			local = instanceMatrix * local;
			nrm = mat3(instanceMatrix) * nrm;
		#endif
		vObjP = local.xyz;
		vec4 w = modelMatrix * local;
		vWorld = w.xyz;
		vWz = w.z;
		vN = normalize(mat3(modelMatrix) * nrm);
		vUv = uv;
		gl_Position = projectionMatrix * viewMatrix * w;
	}
`;

/** La tige : des fibres serrées qui suivent sa longueur, la sève qui monte.
 *  Opaque (alpha 1) : c'est la matière que le scan transforme en chiffres. */
function stemMaterial(u: Record<string, THREE.IUniform>) {
	return new THREE.ShaderMaterial({
		uniforms: { ...u, uFlutter: { value: 0 } },
		vertexShader: SURFACE_VERT,
		fragmentShader: /* glsl */ `
			uniform float uTime;
			uniform float uEnergy;
			uniform float uDissolve;
			uniform float uGround;
			uniform vec3 uTint;
			varying vec2 vUv;
			varying vec3 vN;
			varying vec3 vObjP;
			varying vec3 vWorld;
			varying float vWz;
			${NOISE}
			${DISSOLVE}
			void main() {
				${DISSOLVE_CUT}
				// Au ras du titre, la tige se défait en blocs, comme si elle entrait sous terre
				float ground = smoothstep(uGround, uGround + 0.55, vWorld.y);
				if (h3(vec3(floor(gl_FragCoord.xy / 4.0), 0.0)) > ground) discard;
				vec3 n = normalize(vN);
				vec3 v = normalize(cameraPosition - vWorld);
				if (dot(n, v) < 0.0) n = -n;
				float k = vUv.y * 70.0 + n3(vec3(vUv.x * 9.0, vUv.y * 14.0, 0.0)) * 3.0;
				float strand = smoothstep(0.35, 1.0, 0.5 + 0.5 * sin(k * 6.2831)) * (0.55 + 0.45 * n3(vec3(vUv.x * 120.0, vUv.y * 40.0, 1.0)));
				vec3 deep = vec3(0.01, 0.03, 0.028);
				vec3 moss = mix(vec3(0.08, 0.15, 0.05), vec3(0.05, 0.12, 0.13), n3(vec3(vUv.x * 5.0, vUv.y * 2.0, 4.0)));
				vec3 col = mix(deep, moss, strand);
				vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
				float dif = max(dot(n, L), 0.0);
				float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
				col *= 0.4 + dif * 1.4;
				col += vec3(0.45, 0.85, 0.7) * fres * 0.3;
				// La sève : des pulsations qui montent dans les fibres
				float sap = smoothstep(0.9, 1.0, 0.5 + 0.5 * sin(vUv.x * 36.0 - uTime * 1.8 + vUv.y * 6.2831)) * strand;
				col += mix(vec3(0.6, 1.0, 0.5), uTint, 0.6) * sap * (0.3 + uEnergy * 1.2);
				col += uTint * burn * 2.0;
				gl_FragColor = vec4(col, 1.0);
			}
		`,
	});
}

/** Pétales et feuilles : verre tramé (la grille du relevé), nervures fines,
 *  réseau de fibres, nappes irisées qui glissent. Lumière additive. */
function veilMaterial(u: Record<string, THREE.IUniform>, opts: { base: THREE.Color; iris: number; flutter: number; grid: THREE.Vector2 }) {
	return additive(
		new THREE.ShaderMaterial({
			uniforms: {
				...u,
				uBase: { value: opts.base },
				uIris: { value: opts.iris },
				uFlutter: { value: opts.flutter },
				uGrid: { value: opts.grid },
			},
			side: THREE.DoubleSide,
			vertexShader: SURFACE_VERT,
			fragmentShader: /* glsl */ `
				uniform float uTime;
				uniform float uEnergy;
				uniform float uDissolve;
				uniform float uGround;
				uniform vec3 uTint;
				uniform vec3 uBase;
				uniform float uIris;
				uniform vec2 uGrid;
				varying vec2 vUv;
				varying vec3 vN;
				varying vec3 vObjP;
				varying vec3 vWorld;
				varying float vWz;
				${NOISE}
				${DISSOLVE}
				void main() {
					${DISSOLVE_CUT}
					vec3 n = normalize(vN);
					vec3 v = normalize(cameraPosition - vWorld);
					float facing = abs(dot(n, v));
					float fres = pow(1.0 - facing, 2.2);
					// La trame
					vec2 g = vUv * uGrid;
					vec2 gd = abs(fract(g - 0.5) - 0.5) / max(fwidth(g), vec2(1e-4));
					float grid = 1.0 - clamp(min(gd.x, gd.y), 0.0, 1.0);
					// Nervures depuis la base, réseau de fibres
					float vk = vUv.y * 54.0 + n3(vObjP * 5.0) * 3.0;
					float vd = abs(fract(vk) - 0.5) / max(fwidth(vk), 1e-4);
					float vein = (1.0 - clamp(vd * 0.7, 0.0, 1.0)) * (1.0 - vUv.x * 0.55);
					float net = smoothstep(0.88, 0.985, 1.0 - abs(n3(vObjP * 26.0) * 2.0 - 1.0));
					// Le film irisé
					float sheen = smoothstep(0.42, 0.78, fbm3(vObjP * 1.7 + vec3(0.0, uTime * 0.05, uTime * 0.02)));
					vec3 film = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fres * 1.2 + fbm3(vObjP * 2.4) * 1.1 + uTime * 0.025));
					float rim = smoothstep(0.82, 1.0, abs(vUv.y - 0.5) * 2.0) * smoothstep(0.1, 0.4, vUv.x) + smoothstep(0.94, 1.0, vUv.x);
					vec3 col = uBase * (0.03 + fres * 0.2)
						+ uBase * grid * 0.14
						+ vec3(0.55, 0.95, 0.6) * vein * 0.12
						+ vec3(0.6, 0.9, 0.75) * net * 0.07
						+ film * sheen * (0.06 + fres * 0.3) * uIris * smoothstep(0.3, 0.75, vUv.x)
						+ vec3(0.85, 0.92, 1.0) * rim * 0.42;
					// Les deux faces s'additionnent et les pétales se recouvrent : on reste discret
					// et vers le cœur ils se superposent tous : la base s'efface
					col *= 0.42 * (0.03 + 0.97 * smoothstep(0.15, 0.72, vUv.x));
					col += uTint * (burn * 0.5 + uEnergy * 0.02);
					col *= smoothstep(uGround, uGround + 0.55, vWorld.y);
					gl_FragColor = vec4(col, 0.0);
				}
			`,
		}),
	);
}

/** Traits fins (fibres de la tige, tiges des fleurs, étamines), au vent */
function strandMaterial(u: Record<string, THREE.IUniform>) {
	return additive(
		new THREE.ShaderMaterial({
			uniforms: u,
			vertexShader: /* glsl */ `
				attribute vec3 color;
				attribute vec2 sway;
				uniform float uTime;
				uniform float uMotion;
				uniform float uDissolve;
				uniform float uGround;
				varying vec3 vCol;
				varying float vA;
				${NOISE}
				${DISSOLVE}
				void main() {
					vec3 p = position;
					float s = sway.x;
					p += vec3(sin(uTime * 1.3 + sway.y * 20.0), 0.0, cos(uTime * 1.1 + sway.y * 13.0)) * 0.014 * s * uMotion;
					vec4 w = modelMatrix * vec4(p, 1.0);
					float field = dissolveField(position, w.z) - (uDissolve * 1.15 - 0.05);
					vA = smoothstep(0.0, 0.04, field) * smoothstep(uGround, uGround + 0.55, w.y);
					vCol = color;
					gl_Position = projectionMatrix * viewMatrix * w;
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec3 vCol;
				varying float vA;
				void main() {
					gl_FragColor = vec4(vCol * vA, 0.0);
				}
			`,
		}),
	);
}

/** Fleurs sauvages, épis, capitules, pollen : des points dessinés en forme */
function bloomMaterial(u: Record<string, THREE.IUniform>) {
	return additive(
		new THREE.ShaderMaterial({
			uniforms: u,
			vertexShader: /* glsl */ `
				attribute vec3 color;
				attribute vec4 info; // taille, forme, balancement, graine
				uniform float uTime;
				uniform float uMotion;
				uniform float uScale;
				uniform float uFocusDist;
				uniform float uDissolve;
				uniform float uGround;
				varying vec3 vCol;
				varying float vA;
				varying float vKind;
				varying float vSpin;
				${NOISE}
				${DISSOLVE}
				void main() {
					vec3 p = position;
					p += vec3(sin(uTime * 1.3 + info.w * 20.0), 0.0, cos(uTime * 1.1 + info.w * 13.0)) * 0.014 * info.z * uMotion;
					vec4 w = modelMatrix * vec4(p, 1.0);
					vec4 mv = viewMatrix * w;
					gl_Position = projectionMatrix * mv;
					float coc = abs(-mv.z - uFocusDist);
					gl_PointSize = (info.x + coc * 3.0) * uScale / max(-mv.z, 0.2);
					float field = dissolveField(position, w.z) - (uDissolve * 1.15 - 0.05);
					vA = smoothstep(0.0, 0.04, field) * smoothstep(uGround, uGround + 0.55, w.y) / (1.0 + coc * coc * 1.5);
					vCol = color;
					vKind = info.y;
					vSpin = info.w * 6.2831;
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec3 vCol;
				varying float vA;
				varying float vKind;
				varying float vSpin;
				void main() {
					vec2 q = gl_PointCoord - 0.5;
					float r = length(q) * 2.0;
					float a = atan(q.y, q.x) + vSpin;
					float shape;
					vec3 c = vCol;
					if (vKind < 0.5) {
						shape = smoothstep(1.0, 0.55, r);
					} else {
						float pet = 0.5 + 0.5 * pow(abs(cos(a * 2.5)), 0.6);
						shape = smoothstep(pet, pet - 0.22, r);
						float heart = smoothstep(0.32, 0.12, r);
						c = mix(c, vec3(1.0, 0.82, 0.35), heart);
						shape = max(shape, heart);
					}
					gl_FragColor = vec4(c * shape * vA, 0.0);
				}
			`,
		}),
	);
}

/** Particules de dissolution : un point par sommet, détaché quand la plante se défait */
function specimenDust(geo: THREE.BufferGeometry, count: number, u: Record<string, THREE.IUniform>) {
	const src = geo.attributes.position as THREE.BufferAttribute;
	const nor = geo.attributes.normal as THREE.BufferAttribute;
	const pos = new Float32Array(count * 3);
	const nrm = new Float32Array(count * 3);
	const seed = new Float32Array(count);
	const rand = rng(17);
	for (let i = 0; i < count; i++) {
		const k = Math.floor(rand() * src.count);
		pos.set([src.getX(k), src.getY(k), src.getZ(k)], i * 3);
		nrm.set([nor.getX(k), nor.getY(k), nor.getZ(k)], i * 3);
		seed[i] = rand();
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
	g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
	const mat = additive(
		new THREE.ShaderMaterial({
			uniforms: u,
			vertexShader: /* glsl */ `
				attribute float seed;
				uniform float uTime;
				uniform float uDissolve;
				uniform float uScale;
				uniform float uFocusDist;
				varying float vAlpha;
				varying float vSeed;
				${NOISE}
				${DISSOLVE}
				void main() {
					vec3 p = position;
					float wz = (modelMatrix * vec4(p, 1.0)).z;
					float age = clamp(((uDissolve * 1.15 - 0.05) - dissolveField(p, wz)) * 5.0, 0.0, 3.0);
					vec3 swirl = vec3(sin(seed * 40.0 + uTime * 0.7), 0.35, cos(seed * 31.0 + uTime * 0.6));
					p += normal * age * 0.9 + swirl * age * age * 0.25;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					gl_Position = projectionMatrix * mv;
					float coc = abs(-mv.z - uFocusDist);
					gl_PointSize = (1.4 + seed * 2.2 + coc * 5.0) * uScale / max(-mv.z, 0.12);
					vAlpha = step(0.0001, age) * (1.0 - smoothstep(2.2, 3.0, age)) / (1.0 + coc * coc * 3.0);
					vSeed = seed;
				}
			`,
			fragmentShader: /* glsl */ `
				uniform vec3 uTint;
				varying float vAlpha;
				varying float vSeed;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					float a = smoothstep(0.5, 0.15, d) * vAlpha;
					vec3 c = vSeed < 0.25 ? vec3(0.62, 0.5, 0.95) : vSeed < 0.4 ? vec3(1.0, 0.55, 0.2) : mix(vec3(0.75, 0.95, 0.7), uTint, step(0.7, vSeed));
					gl_FragColor = vec4(c * a * 1.6, 0.0);
				}
			`,
		}),
	);
	const points = new THREE.Points(g, mat);
	points.frustumCulled = false;
	return points;
}

/** La tige : une spirale qui s'élève et se resserre sous la fleur */
function stemCurve() {
	const pts: THREE.Vector3[] = [];
	for (let i = 0; i <= 48; i++) {
		const t = i / 48;
		const env = Math.pow(Math.sin(Math.PI * t), 0.85) * (1 - t * 0.3);
		const a = t * Math.PI * 2.6 + 0.5;
		pts.push(new THREE.Vector3(Math.cos(a) * 0.6 * env, lerp(STEM_BASE, HEAD.y - 0.1, t), Math.sin(a) * 0.5 * env));
	}
	return new THREE.CatmullRomCurve3(pts);
}
const stemRadius = (t: number) => 0.035 + 0.13 * Math.pow(1 - t, 0.7) * (1 + 0.12 * Math.sin(t * 40));

function taperedTube(curve: THREE.Curve<THREE.Vector3>, frames: ReturnType<THREE.Curve<THREE.Vector3>['computeFrenetFrames']>, segs: number, radial: number) {
	const pos: number[] = [];
	const nor: number[] = [];
	const uv: number[] = [];
	const idx: number[] = [];
	const p = new THREE.Vector3();
	const n = new THREE.Vector3();
	for (let i = 0; i <= segs; i++) {
		const t = i / segs;
		curve.getPointAt(t, p);
		const r = stemRadius(t);
		for (let j = 0; j <= radial; j++) {
			const a = (j / radial) * Math.PI * 2;
			n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
			pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
			nor.push(n.x, n.y, n.z);
			uv.push(t, j / radial);
		}
	}
	for (let i = 0; i < segs; i++)
		for (let j = 0; j < radial; j++) {
			const a = i * (radial + 1) + j;
			const b = a + radial + 1;
			idx.push(a, b, a + 1, b, b + 1, a + 1);
		}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	return g;
}

interface PetalSpec {
	len: number;
	width: number;
	/** Angle au-dessus de l'horizontale, à la base puis au bout (radians) */
	base: number;
	tip: number;
	cup: number;
	ruffle: number;
	twist: number;
	seed: number;
}

/** Un pétale (ou une feuille) : il part selon +x, se relève puis retombe,
 *  se creuse en gouttière, ondule sur ses bords. uv = (longueur, largeur). */
function petalGeometry(p: PetalSpec, nu = 44, nv = 18) {
	const spine: [number, number, number][] = [];
	let x = 0;
	let y = 0;
	for (let i = 0; i <= nu; i++) {
		const u = i / nu;
		const th = lerp(p.base, p.tip, Math.pow(u, 1.25));
		if (i > 0) {
			x += (Math.cos(th) * p.len) / nu;
			y += (Math.sin(th) * p.len) / nu;
		}
		spine.push([x, y, th]);
	}
	const pos: number[] = [];
	const uv: number[] = [];
	const idx: number[] = [];
	for (let i = 0; i <= nu; i++) {
		const u = i / nu;
		const [sx, sy, th] = spine[i];
		let w = p.width * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.75) + 0.05 * p.width * (1 - u);
		w *= 1 + 0.07 * Math.sin(u * 23 + p.seed * 5);
		const nx = -Math.sin(th);
		const ny = Math.cos(th);
		for (let j = 0; j <= nv; j++) {
			const v = (j / nv) * 2 - 1;
			const s = v * w * 0.5;
			const tw = p.twist * u * v;
			const lift = p.cup * v * v * w + s * Math.sin(tw);
			const rf = p.ruffle * (noise3(u * 6 + p.seed * 3, v * 2.6, p.seed) * 2 - 1) * Math.pow(Math.abs(v), 1.4) * Math.min(1, u * 1.6);
			pos.push(sx + nx * (lift + rf), sy + ny * (lift + rf), s * Math.cos(tw));
			uv.push(u, j / nv);
		}
	}
	for (let i = 0; i < nu; i++)
		for (let j = 0; j < nv; j++) {
			const a = i * (nv + 1) + j;
			const b = a + nv + 1;
			idx.push(a, b, a + 1, b, b + 1, a + 1);
		}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

/** Tampon de traits (paires de points) avec couleur et balancement */
class Strands {
	pos: number[] = [];
	col: number[] = [];
	sway: number[] = [];
	/** Ajoute une polyligne */
	line(pts: THREE.Vector3[], colA: THREE.Color, colB: THREE.Color, seed: number, swayFrom = 0) {
		for (let i = 0; i < pts.length - 1; i++) {
			for (const k of [i, i + 1]) {
				const t = k / (pts.length - 1);
				this.pos.push(pts[k].x, pts[k].y, pts[k].z);
				const c = colA.clone().lerp(colB, t);
				this.col.push(c.r, c.g, c.b);
				this.sway.push(Math.max(0, t - swayFrom) / Math.max(0.001, 1 - swayFrom), seed);
			}
		}
	}
	build(u: Record<string, THREE.IUniform>) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
		g.setAttribute('sway', new THREE.Float32BufferAttribute(this.sway, 2));
		const l = new THREE.LineSegments(g, strandMaterial(u));
		l.frustumCulled = false;
		return l;
	}
}

/** Tampon de points fleuris */
class Blooms {
	pos: number[] = [];
	col: number[] = [];
	info: number[] = [];
	add(p: THREE.Vector3, c: THREE.Color, size: number, kind: number, sway: number, seed: number) {
		this.pos.push(p.x, p.y, p.z);
		this.col.push(c.r, c.g, c.b);
		this.info.push(size, kind, sway, seed);
	}
	build(u: Record<string, THREE.IUniform>) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
		g.setAttribute('info', new THREE.Float32BufferAttribute(this.info, 4));
		const pts = new THREE.Points(g, bloomMaterial(u));
		pts.frustumCulled = false;
		return pts;
	}
}

/** Poussière de la fleur : du pollen qui se détache et dérive (braise) */
function pollen(origins: THREE.Vector3[], count: number, u: Record<string, THREE.IUniform>) {
	const pos = new Float32Array(count * 3);
	const seed = new Float32Array(count * 2);
	const rand = rng(5);
	for (let i = 0; i < count; i++) {
		const o = origins[Math.floor(rand() * origins.length)];
		pos.set([o.x, o.y, o.z], i * 3);
		seed.set([rand(), rand()], i * 2);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
	const mat = additive(
		new THREE.ShaderMaterial({
			uniforms: u,
			vertexShader: /* glsl */ `
				attribute vec2 seed;
				uniform float uTime;
				uniform float uScale;
				uniform float uFocusDist;
				varying float vAlpha;
				void main() {
					float t = fract(uTime * (0.05 + seed.x * 0.07) + seed.y);
					vec3 drift = vec3(0.55 + seed.y * 0.6, 0.25 + seed.x * 0.5, (seed.x - 0.5) * 0.8) * t;
					drift.x += sin(t * 6.0 + seed.y * 20.0) * 0.06;
					vec4 mv = modelViewMatrix * vec4(position + drift, 1.0);
					gl_Position = projectionMatrix * mv;
					float coc = abs(-mv.z - uFocusDist);
					gl_PointSize = (1.0 + seed.x * 1.8 + coc * 9.0) * uScale / -mv.z;
					vAlpha = sin(t * 3.14159) * (0.4 + seed.y * 0.6) / (1.0 + coc * coc * 3.0);
				}
			`,
			fragmentShader: /* glsl */ `
				varying float vAlpha;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					gl_FragColor = vec4(vec3(1.0, 0.5, 0.2) * smoothstep(0.5, 0.1, d) * vAlpha * 1.4, 0.0);
				}
			`,
		}),
	);
	const points = new THREE.Points(g, mat);
	points.frustumCulled = false;
	return points;
}

/** Spores en suspension, floues hors du plan de netteté (bokeh) */
function spores(count: number, u: Record<string, THREE.IUniform>) {
	const pos = new Float32Array(count * 3);
	const seed = new Float32Array(count * 2);
	const rand = rng(9);
	for (let i = 0; i < count; i++) {
		pos.set([(rand() - 0.5) * 10, (rand() - 0.5) * 6, -4 + rand() * 9.5], i * 3);
		seed.set([rand(), rand()], i * 2);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
	const mat = additive(
		new THREE.ShaderMaterial({
			uniforms: u,
			vertexShader: /* glsl */ `
				attribute vec2 seed;
				uniform float uTime;
				uniform float uScale;
				uniform float uFocusDist;
				varying float vAlpha;
				varying float vKind;
				void main() {
					vec3 p = position;
					p.y = mod(p.y + uTime * (0.025 + seed.x * 0.05) + 3.0, 6.0) - 3.0;
					p.x += sin(uTime * 0.3 + seed.y * 30.0) * 0.15;
					vec4 mv = modelViewMatrix * vec4(p, 1.0);
					gl_Position = projectionMatrix * mv;
					float coc = abs(-mv.z - uFocusDist);
					gl_PointSize = (1.2 + seed.x * 2.4 + coc * 7.0) * uScale / max(-mv.z, 0.3);
					vAlpha = (0.25 + seed.y * 0.6) / (1.0 + coc * coc * 0.7);
					vKind = seed.x;
				}
			`,
			fragmentShader: /* glsl */ `
				uniform vec3 uTint;
				varying float vAlpha;
				varying float vKind;
				void main() {
					float d = length(gl_PointCoord - 0.5);
					float a = smoothstep(0.5, 0.32, d) * vAlpha;
					vec3 c = vKind > 0.88 ? uTint : mix(vec3(0.72, 0.8, 0.78), vec3(0.6, 0.85, 0.9), vKind);
					gl_FragColor = vec4(c * a * 0.5, 0.0);
				}
			`,
		}),
	);
	const points = new THREE.Points(g, mat);
	points.frustumCulled = false;
	return points;
}

/** L'orbite : une ellipse en pointillés qui coule, des graduations comme un cadran */
function orbitRing(rx: number, rz: number, u: Record<string, THREE.IUniform>) {
	const n = 360;
	const pts: number[] = [];
	const t: number[] = [];
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2;
		pts.push(Math.cos(a) * rx, 0, Math.sin(a) * rz);
		t.push(i / n);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
	g.setAttribute('along', new THREE.Float32BufferAttribute(t, 1));

	const ticks: number[] = [];
	const tt: number[] = [];
	for (let i = 0; i < 120; i++) {
		const a = (i / 120) * Math.PI * 2;
		const len = i % 10 === 0 ? 0.1 : 0.035;
		const c = Math.cos(a);
		const s = Math.sin(a);
		ticks.push(c * rx * 0.94, 0, s * rz * 0.94, c * (rx * 0.94 - len), 0, s * (rz * 0.94 - len * (rz / rx)));
		tt.push(-1, -1);
	}
	const tg = new THREE.BufferGeometry();
	tg.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
	tg.setAttribute('along', new THREE.Float32BufferAttribute(tt, 1));

	const mat = additive(
		new THREE.ShaderMaterial({
			uniforms: u,
			vertexShader: /* glsl */ `
				attribute float along;
				varying float vAlong;
				varying float vFront;
				void main() {
					vAlong = along;
					vec4 world = modelMatrix * vec4(position, 1.0);
					vFront = clamp(world.z * 0.5 + 0.5, 0.0, 1.0);
					gl_Position = projectionMatrix * viewMatrix * world;
				}
			`,
			fragmentShader: /* glsl */ `
				uniform float uTime;
				uniform float uRing;
				varying float vAlong;
				varying float vFront;
				void main() {
					float dash = vAlong < 0.0 ? 1.0 : step(0.45, fract(vAlong * 240.0 - uTime * 0.6));
					float a = dash * mix(0.22, 0.75, vFront) * uRing;
					gl_FragColor = vec4(vec3(0.8, 0.84, 0.8) * a, 0.0);
				}
			`,
		}),
	);
	const group = new THREE.Group();
	group.add(new THREE.LineLoop(g, mat), new THREE.LineSegments(tg, mat));
	return group;
}

export async function createArtefact(opts: {
	renderer: THREE.WebGLRenderer;
	lowPower: boolean;
	onProgress?(fraction: number): void;
}) {
	const { lowPower } = opts;
	const scene = new THREE.Scene();
	// Rendre la main entre deux étapes de croissance, pour que le loader respire
	// (par message plutôt qu'à l'image : ça avance aussi dans un onglet caché)
	const step = async (f: number) => {
		opts.onProgress?.(f);
		await new Promise((r) => {
			const c = new MessageChannel();
			c.port1.onmessage = () => r(null);
			c.port2.postMessage(0);
		});
	};

	const u = {
		uTime: { value: 0 },
		uEnergy: { value: 0 },
		uDissolve: { value: 0 },
		uTint: { value: new THREE.Color(0.78, 0.96, 0.24) },
		uScale: { value: 1 },
		uFocusDist: { value: 7.4 },
		uRing: { value: 1 },
		uMotion: { value: 1 },
		/** Hauteur (monde) sous laquelle la plante s'efface : le haut du titre */
		uGround: { value: -100 },
	};

	const artefact = new THREE.Group();
	const spin = new THREE.Group();
	spin.scale.setScalar(SCALE);
	artefact.add(spin);
	scene.add(artefact);
	const rand = rng(31);
	const C = (hex: number) => new THREE.Color(hex);

	// ---------------------------------------------------------------- tige
	await step(0.08);
	const curve = stemCurve();
	const SEGS = lowPower ? 160 : 260;
	const frames = curve.computeFrenetFrames(SEGS, false);
	const stemGeo = taperedTube(curve, frames, SEGS, lowPower ? 14 : 22);
	const stem = new THREE.Mesh(stemGeo, stemMaterial(u));
	spin.add(stem);
	const at = (t: number) => {
		const i = Math.round(t * SEGS);
		return { p: curve.getPointAt(t), n: frames.normals[i], b: frames.binormals[i], tg: frames.tangents[i], r: stemRadius(t) };
	};
	const around = (f: ReturnType<typeof at>, a: number) => f.n.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.b, Math.sin(a));

	// Fibres : une fourrure d'herbes fines couchée le long de la tige
	await step(0.22);
	const strands = new Strands();
	const furCount = lowPower ? 4200 : 9000;
	const greens = [C(0x183a1c), C(0x2f5a24), C(0x1d4744), C(0x47702c)];
	const tmp = new THREE.Vector3();
	for (let i = 0; i < furCount; i++) {
		const t = Math.pow(rand(), 0.85) * 0.97;
		const f = at(t);
		const out = around(f, rand() * Math.PI * 2);
		const root = f.p.clone().addScaledVector(out, f.r * 0.92);
		const len = (0.05 + rand() * 0.13) * (1.25 - t * 0.6);
		const dir = f.tg.clone().multiplyScalar(0.85).addScaledVector(out, 0.35 + rand() * 0.35).add(tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.35)).normalize();
		const mid = root.clone().addScaledVector(dir, len * 0.5).addScaledVector(out, len * 0.1);
		const tip = root.clone().addScaledVector(dir, len).addScaledVector(out, len * 0.18);
		const base = greens[Math.floor(rand() * greens.length)].clone().multiplyScalar(0.45);
		strands.line([root, mid, tip], base, base.clone().multiplyScalar(2.2).lerp(C(0x9fd08a), 0.15), rand());
	}

	// Fleurs sauvages le long de la spirale : épis violets, petites fleurs, capitules
	await step(0.36);
	const blooms = new Blooms();
	const lavender = [C(0x7a5ce0), C(0x9a7cf0), C(0x5c4ac0), C(0xb39af5)];
	const smalls = [C(0xf07a2a), C(0xf2e6d0), C(0xe7a0c0), C(0xe9d27a)];
	const wildCount = lowPower ? 150 : 300;
	const up = new THREE.Vector3(0, 1, 0);
	for (let i = 0, tries = 0; i < wildCount && tries < wildCount * 6; tries++) {
		const t = 0.04 + rand() * 0.9;
		const f = at(t);
		const out = around(f, rand() * Math.PI * 2);
		if (out.y < -0.25) continue;
		i++;
		const root = f.p.clone().addScaledVector(out, f.r);
		const h = 0.08 + rand() * 0.26;
		const dir = out.clone().multiplyScalar(0.55).addScaledVector(up, 0.85).add(tmp.set(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(0.5)).normalize();
		const tip = root.clone().addScaledVector(dir, h);
		const mid = root.clone().addScaledVector(dir, h * 0.5).addScaledVector(out, h * 0.12);
		const seed = rand();
		strands.line([root, mid, tip], C(0x1e3a1a), C(0x5d7a3a), seed);
		const kind = rand();
		if (kind < 0.42) {
			// Épi : des grains serrés qui montent
			const c = lavender[Math.floor(rand() * lavender.length)];
			const n = 5 + Math.floor(rand() * 7);
			for (let k = 0; k < n; k++) {
				const q = tip.clone().addScaledVector(dir, k * 0.016).add(tmp.set(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(0.018));
				blooms.add(q, c.clone().multiplyScalar(0.9 + rand() * 0.6), 13 + rand() * 9 - k * 0.6, 0, 1, seed);
			}
		} else if (kind < 0.78) {
			blooms.add(tip, smalls[Math.floor(rand() * smalls.length)].clone().multiplyScalar(0.9 + rand() * 0.5), 30 + rand() * 30, 1, 1, seed);
		} else {
			blooms.add(tip, C(0x5a3a22).multiplyScalar(1.4), 18 + rand() * 12, 0, 1, seed);
		}
	}

	// ---------------------------------------------------------------- fleur
	await step(0.5);
	const headTilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.22, 0, -0.1));
	const headAt = new THREE.Matrix4().makeTranslation(HEAD.x, HEAD.y, HEAD.z).multiply(headTilt);
	const rings: { n: number; spec: Omit<PetalSpec, 'seed'>; off: number }[] = [
		{ n: 6, off: 0, spec: { len: 1.22, width: 0.82, base: 0.5, tip: -0.6, cup: 0.2, ruffle: 0.11, twist: 0.4 } },
		{ n: 5, off: 0.5, spec: { len: 0.9, width: 0.7, base: 0.95, tip: -0.15, cup: 0.24, ruffle: 0.08, twist: 0.3 } },
		{ n: 4, off: 0.2, spec: { len: 0.48, width: 0.5, base: 1.3, tip: 0.5, cup: 0.2, ruffle: 0.05, twist: 0.2 } },
	];
	const petalGeos: THREE.BufferGeometry[] = [];
	const tips: THREE.Vector3[] = [];
	rings.forEach((ring, ri) => {
		for (let k = 0; k < ring.n; k++) {
			const phi = ((k + ring.off) / ring.n) * Math.PI * 2 + (rand() - 0.5) * 0.25;
			const spec = { ...ring.spec, len: ring.spec.len * (0.9 + rand() * 0.2), seed: ri * 10 + k + rand() };
			const g = petalGeometry(spec, lowPower ? 32 : 44, lowPower ? 14 : 18);
			const m = new THREE.Matrix4()
				.copy(headAt)
				.multiply(new THREE.Matrix4().makeRotationY(-phi))
				.multiply(new THREE.Matrix4().makeTranslation(0.06, 0, 0));
			g.applyMatrix4(m);
			petalGeos.push(g);
			if (ri < 2) {
				const pa = g.attributes.position as THREE.BufferAttribute;
				const nv = (lowPower ? 14 : 18) + 1;
				tips.push(new THREE.Vector3().fromBufferAttribute(pa, pa.count - Math.ceil(nv / 2)));
			}
		}
	});
	const petals = new THREE.Mesh(
		mergeGeometries(petalGeos),
		veilMaterial(u, { base: C(0x9ab4f0), iris: 1, flutter: 1, grid: new THREE.Vector2(26, 14) }),
	);
	petals.frustumCulled = false;
	spin.add(petals);

	// Feuilles : longues lames qui partent de la tige et retombent
	const leafGeos: THREE.BufferGeometry[] = [];
	[0.16, 0.3, 0.47].forEach((t, k) => {
		const f = at(t);
		const out = around(f, k * 2.2 + 0.6);
		out.y = 0;
		out.normalize();
		const g = petalGeometry({ len: 1.25 - k * 0.2, width: 0.3, base: 0.75, tip: -0.55, cup: 0.1, ruffle: 0.035, twist: 0.8, seed: 40 + k }, 40, 8);
		const yaw = Math.atan2(-out.z, out.x);
		g.applyMatrix4(new THREE.Matrix4().makeTranslation(f.p.x, f.p.y, f.p.z).multiply(new THREE.Matrix4().makeRotationY(yaw)));
		leafGeos.push(g);
	});
	const leaves = new THREE.Mesh(
		mergeGeometries(leafGeos),
		veilMaterial(u, { base: C(0x6fcf8a), iris: 0.45, flutter: 0.6, grid: new THREE.Vector2(30, 6) }),
	);
	leaves.frustumCulled = false;
	spin.add(leaves);

	// Cœur : étamines qui jaillissent, anthères braise et acide, pollen en dôme
	await step(0.66);
	const centre = new THREE.Vector3(0, 0.02, 0).applyMatrix4(headAt);
	const axis = new THREE.Vector3(0, 1, 0).applyMatrix4(headTilt).normalize();
	const anthers: THREE.Vector3[] = [];
	for (let k = 0; k < (lowPower ? 34 : 56); k++) {
		const phi = rand() * Math.PI * 2;
		const r0 = 0.03 + rand() * 0.07;
		const h = 0.25 + rand() * 0.32;
		const reach = 0.12 + rand() * 0.28;
		const side = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi)).applyMatrix4(headTilt);
		const pts: THREE.Vector3[] = [];
		for (let s = 0; s <= 6; s++) {
			const q = s / 6;
			pts.push(centre.clone().addScaledVector(side, r0 + reach * q * q).addScaledVector(axis, h * Math.sin(q * 1.35)));
		}
		strands.line(pts, C(0x1a2418).multiplyScalar(0.6), C(0xd8e6c8).multiplyScalar(0.45), rand(), 0.3);
		const tip = pts[pts.length - 1];
		anthers.push(tip);
		blooms.add(tip, rand() > 0.35 ? C(0xff8a3a) : C(0xc8f53c), 12 + rand() * 9, 0, 1, rand());
	}
	for (let k = 0; k < (lowPower ? 380 : 800); k++) {
		const a = rand() * Math.PI * 2;
		const r = Math.sqrt(rand()) * 0.16;
		const side = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).applyMatrix4(headTilt);
		const q = centre.clone().add(side).addScaledVector(axis, 0.07 * (1 - (r / 0.16) ** 2) + rand() * 0.02);
		blooms.add(q, C(0xd4e07a).lerp(C(0x8fbf4a), rand()).multiplyScalar(0.25 + rand() * 0.25), 4 + rand() * 4, 0, 0.2, rand());
	}

	spin.add(strands.build(u), blooms.build(u));
	const flowerHead = centre.clone().addScaledVector(axis, 0.35);

	// ---------------------------------------------------------------- poussières
	await step(0.8);
	const dustSrc = mergeGeometries([stemGeo, petals.geometry, leaves.geometry].map((g) => {
		const c = new THREE.BufferGeometry();
		c.setAttribute('position', g.attributes.position);
		c.setAttribute('normal', g.attributes.normal);
		return c;
	}));
	spin.add(specimenDust(dustSrc, lowPower ? 5000 : 14000, u));
	spin.add(pollen([...anthers, ...tips], lowPower ? 140 : 320, u));
	scene.add(spores(lowPower ? 120 : 260, u));

	// Points d'ancrage pour l'analyse (boîtes de suivi) : la tige et la fleur
	const anchors: { p: THREE.Vector3; n: THREE.Vector3; kind: 'stem' | 'flower' }[] = [];
	for (let i = 0; i < 30; i++) {
		const f = at(0.42 + (i / 30) * 0.55);
		const n = around(f, rand() * Math.PI * 2);
		anchors.push({ p: f.p.clone().addScaledVector(n, f.r), n, kind: 'stem' });
	}
	for (let i = 0; i < 18; i++) {
		const src = i % 2 ? tips : anthers;
		anchors.push({ p: src[Math.floor(rand() * src.length)].clone(), n: new THREE.Vector3(0, 1, 0), kind: 'flower' });
	}

	// ---------------------------------------------------------------- orbite
	await step(0.92);
	const orbit = new THREE.Group();
	orbit.rotation.x = 0.22;
	orbit.position.y = HEAD.y * SCALE - 0.12;
	artefact.add(orbit);
	const ring = { rx: 2.55, rz: 1.7 };
	orbit.add(orbitRing(ring.rx, ring.rz, u));

	// Sur l'anneau, des pétales détachés qui dérivent, et quelques éclats
	const flakeCount = lowPower ? 14 : 26;
	const flakes = new THREE.InstancedMesh(
		petalGeometry({ len: 1, width: 0.55, base: 0.3, tip: -0.3, cup: 0.15, ruffle: 0.04, twist: 0.4, seed: 7 }, 12, 6),
		veilMaterial(u, { base: C(0xb4c8f5), iris: 1, flutter: 0, grid: new THREE.Vector2(10, 5) }),
		flakeCount,
	);
	flakes.frustumCulled = false;
	const glints = new THREE.InstancedMesh(
		new THREE.OctahedronGeometry(1, 0),
		new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 0.96, 0.24).multiplyScalar(2.2) }),
		6,
	);
	orbit.add(flakes, glints);
	const flakeData = Array.from({ length: flakeCount + 6 }, (_, i) => ({
		r: 1.5 + rand() * 1.5,
		a: rand() * Math.PI * 2,
		w: (0.05 + rand() * 0.12) * (rand() > 0.85 ? -1 : 1),
		y: (rand() - 0.5) * 0.7,
		s: i < flakeCount ? 0.07 + rand() * 0.1 : 0.012 + rand() * 0.014,
		spin: new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(1.4),
	}));
	const dummy = new THREE.Object3D();
	await step(1);

	const triangles = Math.round(
		[stemGeo, petals.geometry, leaves.geometry].reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count), 0) / 3,
	);

	const update = (s: ArtefactState) => {
		u.uTime.value = s.time;
		u.uEnergy.value = s.energy;
		u.uMotion.value = s.motion;
		flakeData.forEach((d, i) => {
			const a = d.a + s.time * d.w;
			dummy.position.set(Math.cos(a) * d.r * 1.15, d.y + Math.sin(s.time * 0.5 + i) * 0.06, Math.sin(a) * d.r * 0.8);
			dummy.rotation.set(s.time * d.spin.x, s.time * d.spin.y, s.time * d.spin.z);
			dummy.scale.setScalar(d.s);
			dummy.updateMatrix();
			if (i < flakeCount) flakes.setMatrixAt(i, dummy.matrix);
			else glints.setMatrixAt(i - flakeCount, dummy.matrix);
		});
		flakes.instanceMatrix.needsUpdate = true;
		glints.instanceMatrix.needsUpdate = true;
	};

	return {
		scene,
		artefact,
		spin,
		orbit,
		ring,
		flowerHead,
		/** Le cœur de la fleur, dans le repère de l'artefact : la plongée y entre */
		heart: HEAD.clone().multiplyScalar(SCALE),
		anchors,
		triangles,
		uniforms: u,
		update,
	};
}

export type Artefact = Awaited<ReturnType<typeof createArtefact>>;
