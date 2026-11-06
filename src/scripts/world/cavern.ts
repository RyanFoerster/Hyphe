// L'intérieur de la roche : une galerie minérale qu'on traverse au défilement.
// Parois en strates et veines de lumière, cristaux, poussière, et dans la
// matière, les projets du studio : des spécimens qui se recomposent tuile par
// tuile quand on s'en approche.

import * as THREE from 'three';
import { NOISE, additive, noise3, rng } from './shared';

export interface SpecimenInput {
	slug: string;
	accent: string;
}

const CHAPTER_GAP = 9;
const FIRST = 6;
/** Distance entre la caméra (au chapitre) et son spécimen */
export const SPECIMEN_AHEAD = 4.4;

const WALL_VERT = /* glsl */ `
	varying vec3 vW;
	varying vec3 vN;
	varying float vAlong;
	void main() {
		vec4 w = modelMatrix * vec4(position, 1.0);
		vW = w.xyz;
		vN = normalize(mat3(modelMatrix) * normal);
		vAlong = uv.x;
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
	${NOISE}
	void main() {
		vec3 toCam = cameraPosition - vW;
		float dist = length(toCam);
		float fog = exp(-dist * 0.085);
		float rockN = fbm3(vW * 1.2);
		vec3 base = mix(vec3(0.008, 0.011, 0.012), vec3(0.05, 0.056, 0.055), rockN);

		// Strates : les lignes de niveau de la roche, vues de l'intérieur
		float k = (vW.y * 1.5 + vW.x * 0.3 + fbm3(vW * 0.3) * 3.0) * 2.4;
		float strata = 1.0 - smoothstep(0.0, fwidth(k) * 1.3, abs(fract(k + 0.5) - 0.5));

		// Veines : une énergie qui remonte la galerie
		float r = 1.0 - abs(fbm3(vW * 0.5 + vec3(0.0, 0.0, uTime * 0.03)) * 2.0 - 1.0);
		float vein = smoothstep(0.86, 0.975, r);
		float wave = pow(0.5 + 0.5 * sin(vAlong * uLen * 0.7 + uTime * 2.0), 3.0);

		vec3 sid = floor(vW * 20.0);
		float spark = step(0.988, h3(sid)) * pow(0.5 + 0.5 * sin(uTime * 2.4 + h3(sid) * 50.0), 4.0);

		float lamp = max(dot(-normalize(vN), normalize(toCam)), 0.0);
		vec3 col = base * (0.2 + lamp * 0.9)
			+ strata * vec3(0.06, 0.065, 0.06) * (0.3 + rockN)
			+ vein * uTint * (0.35 + wave * 2.2)
			+ spark * vec3(0.8, 1.0, 0.95) * 2.0;
		gl_FragColor = vec4(col * fog, 1.0);
	}
`;

const CRYSTAL_VERT = /* glsl */ `
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

const CRYSTAL_FRAG = /* glsl */ `
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
		vec3 c = mix(uTint, vec3(0.62, 0.94, 0.88), vSeed);
		vec3 col = c * (0.04 + fres * 1.6 * pulse) + c * smoothstep(0.2, 1.0, vH) * 1.4 * pulse;
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

function svgTexture(url: string, w: number, h: number) {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	const img = new Image();
	img.decoding = 'async';
	img.onload = () => {
		canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
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

	// Cristaux plantés dans les parois, pointés vers le centre
	const rand = rng(77);
	const crystalCount = lowPower ? 70 : 150;
	const crystalGeo = new THREE.OctahedronGeometry(1, 0);
	const crystals = new THREE.InstancedMesh(
		crystalGeo,
		new THREE.ShaderMaterial({ uniforms: u, vertexShader: CRYSTAL_VERT, fragmentShader: CRYSTAL_FRAG }),
		crystalCount,
	);
	const dummy = new THREE.Object3D();
	const centre = new THREE.Vector3();
	for (let i = 0; i < crystalCount; i++) {
		const k = Math.floor(rand() * tp.count);
		const s = (tube.attributes.uv as THREE.BufferAttribute).getX(k) * length;
		if (s < 3) {
			i--;
			continue;
		}
		dummy.position.fromBufferAttribute(tp, k);
		at(s, centre);
		dummy.lookAt(centre);
		dummy.rotateX(Math.PI / 2 + (rand() - 0.5) * 0.8);
		dummy.rotateZ((rand() - 0.5) * 0.8);
		const len = 0.25 + rand() * rand() * 1.1;
		dummy.scale.set(len * 0.18, len, len * 0.18);
		dummy.updateMatrix();
		crystals.setMatrixAt(i, dummy.matrix);
	}
	scene.add(crystals);

	// Poussière en suspension dans la galerie
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
						vec3 c = vS > 0.85 ? uTint : vec3(0.7, 0.78, 0.76);
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
				if (!mat.uniforms.tMap.value) mat.uniforms.tMap.value = svgTexture(`/visuals/${item.slug}.svg`, texW, Math.round(texW / 1.6));
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
