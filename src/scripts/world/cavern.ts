// L'intérieur de la fleur : une galerie végétale qu'on traverse au défilement.
// Parois en cellules et en fibres où la sève circule, étamines plantées dans
// les parois, pollen en suspension, et dans la matière, les projets du studio :
// des spécimens qui se recomposent tuile par tuile quand on s'en approche.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE, additive, noise3, rng } from './shared';

export interface SpecimenInput {
	slug: string;
	accent: string;
	/** Image du spécimen (SVG généré ou vrai média) */
	cover: string;
}

const CHAPTER_GAP = 9;
const FIRST = 6;
/** Distance entre la caméra (au chapitre) et son spécimen */
export const SPECIMEN_AHEAD = 4.4;

const WALL_VERT = /* glsl */ `
	varying vec3 vW;
	varying vec3 vN;
	varying float vAlong;
	varying float vAround;
	void main() {
		vec4 w = modelMatrix * vec4(position, 1.0);
		vW = w.xyz;
		vN = normalize(mat3(modelMatrix) * normal);
		vAlong = uv.x;
		vAround = uv.y;
		gl_Position = projectionMatrix * viewMatrix * w;
	}
`;

const WALL_FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uLen;
	uniform vec3 uTint;
	varying vec3 vW;
	varying vec3 vN;
	varying float vAlong;
	varying float vAround;
	${NOISE}
	// Cellules végétales : distance au centre le plus proche et au suivant
	vec2 cells(vec3 p) {
		vec3 i = floor(p);
		vec3 f = fract(p);
		float d1 = 8.0;
		float d2 = 8.0;
		for (int x = -1; x <= 1; x++)
		for (int y = -1; y <= 1; y++)
		for (int z = -1; z <= 1; z++) {
			vec3 g = vec3(float(x), float(y), float(z));
			vec3 o = vec3(h3(i + g), h3(i + g + 17.3), h3(i + g + 41.7));
			vec3 r = g + o - f;
			float d = dot(r, r);
			if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
		}
		return vec2(sqrt(d1), sqrt(d2));
	}
	void main() {
		vec3 toCam = cameraPosition - vW;
		float dist = length(toCam);
		float fog = exp(-dist * 0.085);
		float n = fbm3(vW * 0.8);
		vec3 base = mix(vec3(0.006, 0.014, 0.012), vec3(0.03, 0.06, 0.045), n);

		// Les cellules, étirées le long de la galerie comme dans une tige
		vec2 c = cells(vW * vec3(1.3, 1.3, 0.5));
		float wall = 1.0 - smoothstep(0.02, 0.1, c.y - c.x);
		float body = smoothstep(0.55, 0.0, c.x);

		// Les fibres, et la sève qui les remonte
		float fk = vAround * 96.0 + n3(vW * 0.6) * 4.0;
		float fib = 1.0 - smoothstep(0.0, fwidth(fk) * 1.4, abs(fract(fk) - 0.5));
		float wave = pow(0.5 + 0.5 * sin(vAlong * uLen * 0.7 - uTime * 2.0 + vAround * 12.566), 6.0);

		// Chloroplastes : des grains qui palpitent dans les cellules
		vec3 sid = floor(vW * 14.0);
		float chl = step(0.986, h3(sid)) * (0.55 + 0.45 * sin(uTime * 2.0 + h3(sid + 3.0) * 40.0)) * body;

		float lamp = max(dot(-normalize(vN), normalize(toCam)), 0.0);
		vec3 col = base * (0.25 + lamp * 0.9) * (0.7 + body * 0.5)
			+ wall * vec3(0.09, 0.16, 0.1) * (0.4 + n)
			+ fib * vec3(0.03, 0.06, 0.045)
			+ fib * wave * uTint * 1.1
			+ wall * wave * uTint * 0.35
			+ chl * vec3(0.55, 0.95, 0.5) * 1.6;
		gl_FragColor = vec4(col * fog, 1.0);
	}
`;

const STAMEN_VERT = /* glsl */ `
	varying vec3 vN;
	varying vec3 vV;
	varying float vSeed;
	varying float vH;
	void main() {
		vSeed = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);
		mat4 m = modelMatrix * instanceMatrix;
		vec4 w = m * vec4(position, 1.0);
		vN = normalize(mat3(m) * normal);
		vV = cameraPosition - w.xyz;
		vH = position.y;
		gl_Position = projectionMatrix * viewMatrix * w;
	}
`;

// Filet sombre, anthère qui luit au bout
const STAMEN_FRAG = /* glsl */ `
	uniform vec3 uTint;
	uniform float uTime;
	varying vec3 vN;
	varying vec3 vV;
	varying float vSeed;
	varying float vH;
	void main() {
		vec3 n = normalize(vN);
		vec3 v = normalize(vV);
		float fres = pow(1.0 - abs(dot(n, v)), 2.2);
		float pulse = 0.55 + 0.45 * sin(uTime * 1.2 + vSeed * 30.0);
		float tip = smoothstep(0.86, 0.95, vH);
		vec3 c = vSeed > 0.7 ? vec3(1.0, 0.5, 0.18) : mix(uTint, vec3(0.62, 0.94, 0.7), vSeed);
		vec3 stalk = vec3(0.05, 0.1, 0.07) * (0.3 + fres * 1.5);
		vec3 col = mix(stalk, c * (0.5 + fres * 1.2) * (0.6 + pulse * 1.2), tip);
		gl_FragColor = vec4(col * exp(-length(vV) * 0.08), 1.0);
	}
`;

const SPECIMEN_VERT = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

// L'image, recomposée tuile par tuile ; les tuiles pas encore là restent en
// matière (alpha 1) et la passe finale les dessine en caractères.
const SPECIMEN_FRAG = /* glsl */ `
	uniform sampler2D tMap;
	uniform float uReveal;
	uniform float uHover;
	uniform float uTime;
	uniform vec3 uAccent;
	varying vec2 vUv;
	float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	void main() {
		const float M = 0.05;
		vec2 uv = (vUv - M) / (1.0 - 2.0 * M);
		bool inImage = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
		if (!inImage) {
			// Coins de cadrage, comme une mire
			vec2 d = min(vUv, 1.0 - vUv);
			vec2 e = abs(vUv - 0.5) * 2.0;
			float h = M * 0.45;
			float vLine = step(abs(d.x - h), 0.0035) * step(0.74, e.y) * step(h - 0.0035, d.y);
			float hLine = step(abs(d.y - h), 0.0055) * step(0.84, e.x) * step(h - 0.0055, d.x);
			if (max(vLine, hLine) < 0.5) discard;
			gl_FragColor = vec4(uAccent * (1.6 + uHover * 2.0), 1.0);
			return;
		}
		vec3 tex = texture2D(tMap, uv).rgb;
		vec2 tile = floor(uv * vec2(8.0, 5.0));
		float th = hash(tile + 0.37);
		float on = step(th * 0.85, uReveal * 1.1 - 0.12);
		vec2 tf = fract(uv * vec2(8.0, 5.0));
		float edge = step(min(min(tf.x, 1.0 - tf.x) * 8.0, min(tf.y, 1.0 - tf.y) * 5.0), 0.02);
		float settling = on * (1.0 - step(th * 0.85 + 0.12, uReveal * 1.1 - 0.12));
		vec3 col = tex * (on > 0.5 ? 1.35 + uHover * 0.35 : 1.1);
		col += uAccent * edge * settling * 1.5;
		gl_FragColor = vec4(col, on > 0.5 ? 2.0 : 1.0);
	}
`;

/** Image dessinée dans une toile au format du spécimen, recadrée sans déformer */
function imageTexture(url: string, w: number, h: number) {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	const img = new Image();
	img.decoding = 'async';
	img.onload = () => {
		const iw = img.naturalWidth || w;
		const ih = img.naturalHeight || h;
		const k = Math.max(w / iw, h / ih);
		canvas.getContext('2d')!.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
		tex.needsUpdate = true;
	};
	img.src = url;
	return tex;
}

export function createCavern(items: SpecimenInput[], { lowPower }: { lowPower: boolean }) {
	const scene = new THREE.Scene();
	const sChap = items.map((_, i) => FIRST + i * CHAPTER_GAP);
	const sEnd = sChap[sChap.length - 1] + CHAPTER_GAP;
	const span = sEnd + 10;

	// Le chemin : une galerie qui serpente vers le fond
	const pts: THREE.Vector3[] = [];
	for (let i = 0; i <= 26; i++) {
		const z = -(i / 26) * span;
		pts.push(new THREE.Vector3(Math.sin(i * 0.62) * 1.3, Math.cos(i * 0.5) * 0.6, z));
	}
	const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
	const length = curve.getLength();
	const at = (s: number, out = new THREE.Vector3()) => curve.getPointAt(THREE.MathUtils.clamp(s / length, 0, 1), out);

	const u = {
		uTime: { value: 0 },
		uLen: { value: length },
		uTint: { value: new THREE.Color(0.78, 0.96, 0.24) },
		uScale: { value: 1 },
	};

	// Parois : un tube creusé de bosses
	const tube = new THREE.TubeGeometry(curve, lowPower ? 220 : 380, 3.3, lowPower ? 28 : 44, false);
	const tp = tube.attributes.position as THREE.BufferAttribute;
	const tn = tube.attributes.normal as THREE.BufferAttribute;
	for (let i = 0; i < tp.count; i++) {
		const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
		const d = (noise3(x * 0.45, y * 0.45, z * 0.45) * 0.7 + noise3(x * 1.3, y * 1.3, z * 1.3) * 0.3) * 1.6 - 0.55;
		tp.setXYZ(i, x + tn.getX(i) * d, y + tn.getY(i) * d, z + tn.getZ(i) * d);
	}
	tube.computeVertexNormals();
	const walls = new THREE.Mesh(
		tube,
		new THREE.ShaderMaterial({ uniforms: u, vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, side: THREE.BackSide }),
	);
	scene.add(walls);

	// Étamines plantées dans les parois, tendues vers le centre
	const rand = rng(77);
	const stamenCount = lowPower ? 90 : 190;
	const stalkGeo = new THREE.CylinderGeometry(0.025, 0.05, 0.9, 6, 1, true).translate(0, 0.45, 0);
	stalkGeo.deleteAttribute('uv');
	const antherGeo = new THREE.SphereGeometry(0.09, 8, 6).scale(1, 1.6, 1).translate(0, 0.94, 0);
	antherGeo.deleteAttribute('uv');
	const stamens = new THREE.InstancedMesh(
		mergeGeometries([stalkGeo, antherGeo]),
		new THREE.ShaderMaterial({ uniforms: u, vertexShader: STAMEN_VERT, fragmentShader: STAMEN_FRAG }),
		stamenCount,
	);
	const dummy = new THREE.Object3D();
	const centre = new THREE.Vector3();
	for (let i = 0; i < stamenCount; i++) {
		const k = Math.floor(rand() * tp.count);
		const s = (tube.attributes.uv as THREE.BufferAttribute).getX(k) * length;
		if (s < 3) {
			i--;
			continue;
		}
		dummy.position.fromBufferAttribute(tp, k);
		at(s, centre);
		dummy.lookAt(centre);
		dummy.rotateX(Math.PI / 2 + (rand() - 0.5) * 0.9);
		dummy.rotateZ((rand() - 0.5) * 0.9);
		const len = 0.35 + rand() * rand() * 1.5;
		const w = 0.7 + rand() * 0.6;
		dummy.scale.set(w, len, w);
		dummy.updateMatrix();
		stamens.setMatrixAt(i, dummy.matrix);
	}
	scene.add(stamens);

	// Pollen en suspension dans la galerie
	const dustCount = lowPower ? 700 : 1600;
	const dpos = new Float32Array(dustCount * 3);
	const dseed = new Float32Array(dustCount);
	const tmp = new THREE.Vector3();
	for (let i = 0; i < dustCount; i++) {
		at(rand() * length, tmp);
		dpos.set([tmp.x + (rand() - 0.5) * 5, tmp.y + (rand() - 0.5) * 4, tmp.z + (rand() - 0.5) * 2], i * 3);
		dseed[i] = rand();
	}
	const dg = new THREE.BufferGeometry();
	dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
	dg.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
	const dust = new THREE.Points(
		dg,
		additive(
			new THREE.ShaderMaterial({
				uniforms: u,
				vertexShader: /* glsl */ `
					attribute float seed;
					uniform float uTime;
					uniform float uScale;
					varying float vA;
					varying float vS;
					void main() {
						vec3 p = position + vec3(sin(uTime * 0.2 + seed * 40.0), cos(uTime * 0.17 + seed * 23.0), 0.0) * 0.2;
						vec4 mv = modelViewMatrix * vec4(p, 1.0);
						gl_Position = projectionMatrix * mv;
						float coc = abs(-mv.z - 4.4);
						gl_PointSize = (1.0 + seed * 2.0 + coc * 5.0) * uScale / max(-mv.z, 0.2);
						vA = exp(-(-mv.z) * 0.07) / (1.0 + coc * coc * 0.4);
						vS = seed;
					}
				`,
				fragmentShader: /* glsl */ `
					uniform vec3 uTint;
					varying float vA;
					varying float vS;
					void main() {
						float d = length(gl_PointCoord - 0.5);
						vec3 c = vS > 0.85 ? uTint : vS > 0.7 ? vec3(1.0, 0.6, 0.25) : vec3(0.7, 0.8, 0.68);
						gl_FragColor = vec4(c * smoothstep(0.5, 0.3, d) * vA * 0.7, 0.0);
					}
				`,
			}),
		),
	);
	dust.frustumCulled = false;
	scene.add(dust);

	// Au bout : la sortie, une lumière blanche
	const exitLight = new THREE.Mesh(
		new THREE.CircleGeometry(4, 48),
		new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 0.85).multiplyScalar(6) }),
	);
	at(span - 1.5, exitLight.position);
	exitLight.lookAt(at(span - 6));
	scene.add(exitLight);

	// Spécimens : les projets dans la matière
	const texW = lowPower ? 768 : 1280;
	const specimens = items.map((item, i) => {
		const accent = new THREE.Color(item.accent);
		const mat = new THREE.ShaderMaterial({
			vertexShader: SPECIMEN_VERT,
			fragmentShader: SPECIMEN_FRAG,
			uniforms: {
				tMap: { value: null as THREE.Texture | null },
				uReveal: { value: 0 },
				uHover: { value: 0 },
				uTime: u.uTime,
				uAccent: { value: accent.clone().multiplyScalar(1.2) },
			},
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6 / 0.9, 1 / 0.9), mat);
		scene.add(mesh);
		return {
			slug: item.slug,
			accent,
			mesh,
			mat,
			s: sChap[i],
			side: i % 2 === 0 ? -1 : 1,
			load() {
				if (!mat.uniforms.tMap.value) mat.uniforms.tMap.value = imageTexture(item.cover, texW, Math.round(texW / 1.6));
			},
		};
	});

	// Mise en page des spécimens : à côté du texte sur grand écran, au-dessus sur mobile
	const layout = (narrow: boolean) => {
		const cam = new THREE.Vector3();
		for (const sp of specimens) {
			at(sp.s + SPECIMEN_AHEAD, sp.mesh.position);
			at(sp.s, cam);
			if (narrow) {
				sp.mesh.position.y += 0.42;
				sp.mesh.scale.setScalar(0.62);
			} else {
				sp.mesh.position.x += sp.side * 1.0;
				sp.mesh.position.y += 0.05;
				sp.mesh.scale.setScalar(1.22);
			}
			sp.mesh.userData.base = sp.mesh.position.clone();
			sp.mesh.lookAt(cam);
			sp.mesh.rotateY(-sp.side * (narrow ? 0 : 0.12));
		}
	};

	/** La sortie ne s'allume qu'une fois le dernier spécimen passé */
	const setExit = (s: number) => {
		const k = THREE.MathUtils.smoothstep(s, sEnd - 3, sEnd + 3);
		exitLight.material.color.setRGB(0.9, 0.95, 0.85).multiplyScalar(0.05 + k * 0.5);
	};

	return { scene, curve, length, at, sChap, sEnd, span, specimens, uniforms: u, layout, setExit };
}

export type Cavern = ReturnType<typeof createCavern>;
