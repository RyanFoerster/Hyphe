// L'artefact, vu de dehors : une roche scannée qui lévite, une fleur qui en
// sort, des veines de lumière, des éclats en orbite, de la poussière.
// Quand on plonge, la roche se dissout en particules par l'avant.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { NOISE, additive, rng, smoothstep as smoothstep01 } from './shared';

/** Orientation de départ de la roche, en radians */
const ROCK_TURN = { x: 0, y: 0.6 };
/** Taille de la roche (plus grande dimension), en unités du monde */
export const ROCK_SIZE = 2.3;

export interface ArtefactState {
	dt: number;
	time: number;
	/** Curseur lissé, -1 → 1 */
	px: number;
	py: number;
	/** Plongée 0 → 1 */
	dive: number;
	/** Lumière des veines (survol d'un projet, approche) */
	energy: number;
	motion: number;
}

// Même champ de dissolution dans la roche (fragment) et ses particules (sommet)
const DISSOLVE = /* glsl */ `
	float dissolveField(vec3 objP, float worldZ) {
		float n = n3(objP * 3.0) * 0.7 + n3(objP * 9.0) * 0.3;
		return n * 0.72 + 0.28 * (0.5 - 0.5 * clamp(worldZ / 1.2, -1.0, 1.0));
	}
`;

/** Pierre ramenée vers le minéral, mousse sur le dessus, base polie, veines
 *  de lumière qui pulsent dans les creux, scintillements, dissolution. */
function enchant(material: THREE.MeshStandardMaterial, base: number, height: number, u: Record<string, THREE.IUniform>) {
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, u, { uBase: { value: base }, uHeight: { value: height } });
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vObjN;\nvarying vec3 vObjP;\nvarying float vWz;')
			.replace(
				'#include <worldpos_vertex>',
				'#include <worldpos_vertex>\nvObjN = normal;\nvObjP = position;\nvWz = (modelMatrix * vec4(position, 1.0)).z;',
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>
				varying vec3 vObjN;
				varying vec3 vObjP;
				varying float vWz;
				uniform float uBase;
				uniform float uHeight;
				uniform float uTime;
				uniform float uEnergy;
				uniform float uDissolve;
				uniform vec3 uTint;
				${NOISE}
				${DISSOLVE}`,
			)
			.replace(
				'#include <map_fragment>',
				`#include <map_fragment>
				float dField = dissolveField(vObjP, vWz) - (uDissolve * 1.15 - 0.05);
				if (dField < 0.0) discard;
				float burn = (1.0 - smoothstep(0.0, 0.05, dField)) * step(0.001, uDissolve);
				float nMoss = n3(vObjP * 7.0) * 0.6 + n3(vObjP * 23.0) * 0.4;
				float up = normalize(vObjN).y;
				float cut = smoothstep(uBase + uHeight * 0.12, uBase + uHeight * 0.04, vObjP.y);
				float moss = smoothstep(0.66, 0.95, up + (nMoss - 0.5) * 0.8) * (1.0 - cut);
				float luma0 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
				vec3 mineral = mix(vec3(luma0), diffuseColor.rgb, 0.22) * vec3(0.6, 0.64, 0.68);
				vec3 mossCol = mix(vec3(0.014, 0.02, 0.01), vec3(0.05, 0.068, 0.024), n3(vObjP * 41.0));
				float kv = (n3(vObjP * 1.7) * 0.75 + n3(vObjP * 6.0) * 0.25) * 16.0;
				float cutVein = 1.0 - smoothstep(0.0, fwidth(kv) * 1.3, abs(fract(kv + 0.5) - 0.5));
				vec3 polished = vec3(0.006, 0.009, 0.009) + cutVein * vec3(0.06, 0.085, 0.07);
				diffuseColor.rgb = mix(mix(mineral, mossCol, moss), polished, cut);`,
			)
			.replace(
				'#include <roughnessmap_fragment>',
				'#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(roughnessFactor, 1.0, moss), 0.16, cut);',
			)
			.replace(
				'#include <normal_fragment_maps>',
				'#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, max(moss * 0.5, cut)));',
			)
			.replace(
				'#include <emissivemap_fragment>',
				`#include <emissivemap_fragment>
				{
					vec3 q = vObjP;
					float r1 = 1.0 - abs(n3(q * 2.3 + vec3(0.0, uTime * 0.012, 0.0)) * 2.0 - 1.0);
					float r2 = 1.0 - abs(n3(q * 5.3 + 7.1) * 2.0 - 1.0);
					float vein = smoothstep(0.962, 0.994, r1) * smoothstep(0.35, 0.85, r2);
					float cavity = 1.0 - smoothstep(0.04, 0.2, luma0);
					float pulse = 0.5 + 0.5 * sin(q.y * 6.0 - uTime * 1.3 + n3(q * 2.0) * 6.28);
					float glowV = vein * mix(0.3, 1.0, cavity) * (0.35 + 0.65 * pulse) * (1.0 - cut * 0.6);
					vec3 sid = floor(q * 150.0);
					float spark = step(0.994, h3(sid)) * pow(0.5 + 0.5 * sin(uTime * 1.7 + h3(sid + 3.0) * 40.0), 6.0);
					float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
					totalEmissiveRadiance += mix(vec3(0.75, 1.0, 0.9), uTint, 0.55 + pulse * 0.45) * glowV * (0.9 + uEnergy * 2.6)
						+ uTint * (spark * 3.5 + burn * 6.0)
						+ mix(vec3(0.5, 0.75, 0.8), uTint, 0.4) * fres * (0.1 + uEnergy * 0.3);
				}`,
			);
	};
}

/** Particules de dissolution : un point par sommet, détaché quand la roche brûle */
function rockDust(geo: THREE.BufferGeometry, count: number, u: Record<string, THREE.IUniform>) {
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
					vec3 c = mix(vec3(0.85, 0.88, 0.82), uTint, step(0.6, vSeed)) * 1.6;
					gl_FragColor = vec4(c * a, 0.0);
				}
			`,
		}),
	);
	const points = new THREE.Points(g, mat);
	points.frustumCulled = false;
	return points;
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
	const { renderer, lowPower } = opts;
	const scene = new THREE.Scene();

	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environmentIntensity = 0.3;
	pmrem.dispose();

	const u = {
		uTime: { value: 0 },
		uEnergy: { value: 0 },
		uDissolve: { value: 0 },
		uTint: { value: new THREE.Color(0.78, 0.96, 0.24) },
		uScale: { value: 1 },
		uFocusDist: { value: 7.4 },
		uRing: { value: 1 },
	};

	// Lumières : clé froide comme en studio macro, contre-jours, lueur sous la roche
	const key = new THREE.DirectionalLight(0xf4f1ea, 2.0);
	// La fleur a sa propre lumière de studio, comme en macro
	const spot = new THREE.SpotLight(0xfff4e6, 9, 6, 0.32, 0.6, 1.5);
	spot.position.set(-0.6, 3.6, 2.4);
	key.position.set(-3, 4.5, 3);
	key.castShadow = !lowPower;
	key.shadow.mapSize.set(1024, 1024);
	key.shadow.camera.left = key.shadow.camera.bottom = -2;
	key.shadow.camera.right = key.shadow.camera.top = 2;
	key.shadow.bias = -0.0004;
	key.shadow.normalBias = 0.02;
	const rim = new THREE.DirectionalLight(0xb8f0ff, 4.2);
	rim.position.set(3.2, 1.8, -4);
	const rim2 = new THREE.DirectionalLight(0xd7ffb0, 2.2);
	rim2.position.set(-3.5, 0.5, -3);
	const hemi = new THREE.HemisphereLight(0x2a3a3c, 0x040506, 0.8);
	const cursorLight = new THREE.PointLight(0xeaffef, 5, 7, 2);
	const under = new THREE.PointLight(0x9ef0e0, 3, 5, 2);
	under.position.set(0, -1.9, 0.6);
	scene.add(key, rim, rim2, hemi, cursorLight, under, spot, spot.target);

	const artefact = new THREE.Group();
	const spin = new THREE.Group();
	artefact.add(spin);
	scene.add(artefact);

	// Chargement des deux scans (meshopt)
	const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
	const loaded = [0, 0];
	const totals = [1.5e6, 0.2e6];
	const track = (i: number) => (e: ProgressEvent) => {
		loaded[i] = e.loaded;
		if (e.lengthComputable) totals[i] = e.total;
		opts.onProgress?.(Math.min(1, (loaded[0] + loaded[1]) / (totals[0] + totals[1])));
	};
	const [rockGltf, flowerGltf] = await Promise.all([
		loader.loadAsync('/artefact/rock.glb', track(0)),
		loader.loadAsync('/artefact/flower.glb', track(1)),
	]);

	// Roche : orientation naturelle du scan, la face coupée au sol reste dessous.
	let rock!: THREE.Mesh;
	rockGltf.scene.traverse((o) => {
		if ((o as THREE.Mesh).isMesh && !rock) rock = o as THREE.Mesh;
	});
	const geo = rock.geometry;
	// Les sommets arrivent quantifiés (entiers normalisés entre -1 et 1) : on les
	// repasse en flottants, sinon toute transformation écrête la géométrie.
	for (const name of Object.keys(geo.attributes)) {
		const attr = geo.attributes[name] as THREE.BufferAttribute;
		if (attr.array instanceof Float32Array) continue;
		const out = new Float32Array(attr.count * attr.itemSize);
		for (let i = 0; i < attr.count; i++)
			for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k);
		geo.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
	}
	rock.updateWorldMatrix(true, false);
	geo.applyMatrix4(rock.matrixWorld);
	geo.rotateX(ROCK_TURN.x);
	geo.rotateY(ROCK_TURN.y);
	geo.computeBoundingBox();
	const size = geo.boundingBox!.getSize(new THREE.Vector3());
	const centre = geo.boundingBox!.getCenter(new THREE.Vector3());
	geo.translate(-centre.x, -centre.y, -centre.z);
	const scale = ROCK_SIZE / Math.max(size.x, size.y, size.z);
	geo.scale(scale, scale, scale);
	geo.computeBoundingBox();
	const bb = geo.boundingBox!;
	const rockMat = rock.material as THREE.MeshStandardMaterial;
	rockMat.side = THREE.FrontSide;
	enchant(rockMat, bb.min.y, bb.max.y - bb.min.y, u);
	const rockMesh = new THREE.Mesh(geo, rockMat);
	rockMesh.castShadow = rockMesh.receiveShadow = true;
	spin.add(rockMesh);
	const triangles = Math.round((geo.index ? geo.index.count : geo.attributes.position.count) / 3);

	// Fleur : posée au point le plus haut du plateau, près du centre
	const ray = new THREE.Raycaster();
	let top = new THREE.Vector3(0, bb.max.y, 0);
	let best = -Infinity;
	for (let i = 0; i < 25; i++) {
		ray.set(new THREE.Vector3(((i % 5) - 2) * 0.09, 5, (Math.floor(i / 5) - 2) * 0.09), new THREE.Vector3(0, -1, 0));
		const hit = ray.intersectObject(rockMesh)[0];
		if (hit && hit.point.y > best) {
			best = hit.point.y;
			top = hit.point;
		}
	}
	const flower = flowerGltf.scene;
	flower.scale.setScalar(4.1);
	flower.position.copy(top).add(new THREE.Vector3(0, -0.015, 0));
	flower.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (!mesh.isMesh) return;
		mesh.castShadow = true;
		const m = mesh.material as THREE.MeshStandardMaterial;
		m.envMapIntensity = 0.8;
		// Le cœur de la fleur luit doucement, comme éclairé de l'intérieur
		m.emissive = new THREE.Color(0xf07a2a);
		m.emissiveIntensity = 0.05;
	});
	spin.add(flower);
	spin.updateMatrixWorld(true);
	const flowerBox = new THREE.Box3().setFromObject(flower);
	const flowerHead = new THREE.Vector3(top.x, flowerBox.max.y - 0.02, top.z);
	const flowerLight = new THREE.PointLight(0xff8a3a, 1.2, 1.4, 2);
	flowerLight.position.copy(flowerHead).add(new THREE.Vector3(0, 0.05, 0.12));
	spin.add(flowerLight);
	spot.target.position.copy(flowerHead);

	// Points d'ancrage pour l'analyse (boîtes de suivi) : sommets de la roche
	// bien répartis, et des points de la fleur
	const rand = rng(31);
	const rp = geo.attributes.position as THREE.BufferAttribute;
	const rn = geo.attributes.normal as THREE.BufferAttribute;
	const anchors: { p: THREE.Vector3; n: THREE.Vector3; kind: 'rock' | 'flower' }[] = [];
	for (let i = 0; i < 46; i++) {
		const k = Math.floor(rand() * rp.count);
		anchors.push({
			p: new THREE.Vector3().fromBufferAttribute(rp, k),
			n: new THREE.Vector3().fromBufferAttribute(rn, k),
			kind: 'rock',
		});
	}
	const flowerPts: THREE.Vector3[] = [];
	flower.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (!mesh.isMesh) return;
		const fp = mesh.geometry.attributes.position as THREE.BufferAttribute;
		mesh.updateWorldMatrix(true, false);
		const toSpin = new THREE.Matrix4().copy(spin.matrixWorld).invert().multiply(mesh.matrixWorld);
		for (let i = 0; i < fp.count; i += Math.max(1, Math.floor(fp.count / 600))) {
			flowerPts.push(new THREE.Vector3().fromBufferAttribute(fp, i).applyMatrix4(toSpin));
		}
	});
	const upper = flowerPts.filter((p) => p.y > flowerHead.y - 0.18);
	for (let i = 0; i < 14 && upper.length; i++) {
		anchors.push({ p: upper[Math.floor(rand() * upper.length)].clone(), n: new THREE.Vector3(0, 1, 0), kind: 'flower' });
	}

	// Poussières
	spin.add(rockDust(geo, lowPower ? 5000 : 14000, u));
	if (upper.length) spin.add(pollen(upper, lowPower ? 140 : 320, u));
	const spore = spores(lowPower ? 120 : 260, u);
	scene.add(spore);

	// Orbite : anneau incliné, éclats de pierre qui tournent dessus
	const orbit = new THREE.Group();
	orbit.rotation.x = 0.22;
	artefact.add(orbit);
	const ring = { rx: 2.55, rz: 1.7 };
	const ringMesh = orbitRing(ring.rx, ring.rz, u);
	orbit.add(ringMesh);

	const shardCount = lowPower ? 14 : 26;
	const shardGeo = new THREE.IcosahedronGeometry(1, 0);
	const sp = shardGeo.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < sp.count; i++) {
		const f = 0.7 + rand() * 0.6;
		sp.setXYZ(i, sp.getX(i) * f, sp.getY(i) * f * 1.3, sp.getZ(i) * f);
	}
	shardGeo.computeVertexNormals();
	const shards = new THREE.InstancedMesh(
		shardGeo,
		new THREE.MeshStandardMaterial({ color: 0x40463f, roughness: 0.5, metalness: 0.15, flatShading: true }),
		shardCount,
	);
	const glints = new THREE.InstancedMesh(
		new THREE.OctahedronGeometry(1, 0),
		new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 0.96, 0.24).multiplyScalar(2.2) }),
		6,
	);
	orbit.add(shards, glints);
	const shardData = Array.from({ length: shardCount + 6 }, (_, i) => ({
		r: 1.5 + rand() * 1.5,
		a: rand() * Math.PI * 2,
		w: (0.05 + rand() * 0.12) * (rand() > 0.85 ? -1 : 1),
		y: (rand() - 0.5) * 0.7,
		s: i < shardCount ? 0.025 + rand() * 0.06 : 0.012 + rand() * 0.014,
		spin: new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(1.4),
	}));
	const dummy = new THREE.Object3D();

	const update = (s: ArtefactState) => {
		u.uTime.value = s.time;
		u.uEnergy.value = s.energy;
		cursorLight.position.set(s.px * 3.2, s.py * 2 + 0.4, 2.6);
		under.intensity = 2.5 + Math.sin(s.time * 0.9) * 0.8 + s.energy * 3;
		// La fleur se replie quand la roche se dissout
		flower.scale.setScalar(4.1 * (1 - smoothstep01(0.3, 0.7, s.dive)));
		flower.visible = s.dive < 0.7;
		flowerLight.intensity = 1 + Math.sin(s.time * 1.7) * 0.35 + s.energy * 0.8;
		flower.rotation.z = (Math.sin(s.time * 1.1) * 0.035 + s.px * 0.04) * s.motion;
		flower.rotation.x = Math.sin(s.time * 0.8 + 1.3) * 0.025 * s.motion;

		shardData.forEach((d, i) => {
			const a = d.a + s.time * d.w;
			dummy.position.set(Math.cos(a) * d.r * 1.15, d.y + Math.sin(s.time * 0.5 + i) * 0.06, Math.sin(a) * d.r * 0.8);
			dummy.rotation.set(s.time * d.spin.x, s.time * d.spin.y, s.time * d.spin.z);
			dummy.scale.setScalar(d.s);
			dummy.updateMatrix();
			if (i < shardCount) shards.setMatrixAt(i, dummy.matrix);
			else glints.setMatrixAt(i - shardCount, dummy.matrix);
		});
		shards.instanceMatrix.needsUpdate = true;
		glints.instanceMatrix.needsUpdate = true;
	};

	return {
		scene,
		artefact,
		spin,
		orbit,
		ring,
		flower,
		rockMesh,
		flowerHead,
		anchors,
		triangles,
		uniforms: u,
		update,
	};
}

export type Artefact = Awaited<ReturnType<typeof createArtefact>>;
