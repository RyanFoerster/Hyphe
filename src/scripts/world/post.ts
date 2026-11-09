// Chaîne de rendu : scène → cible HDR (couleur + profondeur), halo lumineux sur
// trois niveaux de flou, puis la passe finale qui compose tout le langage
// visuel du site :
//   · photo : tone mapping ACES, halo, vignette, grain
//   · aura : la lumière de l'artefact dessinée en caractères, en rayons
//   · mosaïque : des tuiles qui basculent en ASCII ou en scan LED
//   · lentilles : fenêtres de verre et curseur qui révèlent le relief chiffré
//   · ASCII intégral : quand on plonge dans la fleur, tout devient caractère

import * as THREE from 'three';
import { FULLSCREEN_VERT, GLYPH_SLOTS, fullscreenTriangle, glyphAtlas } from './shared';

export const MAX_LENSES = 6;

const BRIGHT_FRAG = /* glsl */ `
	uniform sampler2D tMap;
	uniform vec2 uTexel;
	uniform float uThreshold;
	varying vec2 vUv;
	void main() {
		vec3 c = texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb
			+ texture2D(tMap, vUv + uTexel * vec2(1.0, -1.0)).rgb
			+ texture2D(tMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb
			+ texture2D(tMap, vUv + uTexel * vec2(1.0, 1.0)).rgb;
		c *= 0.25;
		float br = max(c.r, max(c.g, c.b));
		float knee = uThreshold * 0.5 + 1e-4;
		float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
		soft = soft * soft / (4.0 * knee);
		float w = max(soft, br - uThreshold) / max(br, 1e-4);
		gl_FragColor = vec4(c * max(w, 0.0), 1.0);
	}
`;

const BLUR_FRAG = /* glsl */ `
	uniform sampler2D tMap;
	uniform vec2 uDir;
	varying vec2 vUv;
	void main() {
		vec3 c = texture2D(tMap, vUv).rgb * 0.2270270270;
		c += texture2D(tMap, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
		c += texture2D(tMap, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
		c += texture2D(tMap, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
		c += texture2D(tMap, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
		gl_FragColor = vec4(c, 1.0);
	}
`;

const COMPOSITE_FRAG = /* glsl */ `
	precision highp float;
	uniform sampler2D tColor;
	uniform sampler2D tDepth;
	uniform sampler2D tB1;
	uniform sampler2D tB2;
	uniform sampler2D tB3;
	uniform sampler2D tGlyphs;
	uniform vec2 uRes;
	uniform vec2 uCell;
	uniform vec2 uFocus;
	uniform float uTime;
	uniform float uNear;
	uniform float uFar;
	uniform float uExposure;
	uniform vec4 uLenses[${MAX_LENSES}];
	uniform int uLensCount;
	uniform vec4 uCursor;
	uniform float uAscii;
	uniform float uInside;
	uniform float uAura;
	uniform float uRays;
	uniform float uBloom;
	uniform float uFlash;
	uniform float uFade;
	uniform float uWipe;
	uniform float uScanAll;
	uniform float uTile;
	uniform float uReveal;
	uniform float uMosaic;
	uniform float uDpr;
	uniform vec3 uTint;
	uniform vec3 uScan;
	varying vec2 vUv;

	float linDepth(float d) {
		float z = d * 2.0 - 1.0;
		return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
	}
	vec3 aces(vec3 x) {
		return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
	}
	vec3 toSRGB(vec3 c) {
		c = max(c, 0.0);
		return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
	}
	float hash(vec2 p) {
		return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
	}
	float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
	vec3 display(vec3 linear) { return toSRGB(aces(linear * uExposure)); }
	float glyph(float index, vec2 uv) {
		uv = clamp(uv, 0.0, 1.0);
		return texture2D(tGlyphs, vec2((index + uv.x) / ${GLYPH_SLOTS}.0, uv.y)).r;
	}
	vec3 bloomAt(vec2 uv) {
		return texture2D(tB1, uv).rgb * 0.55 + texture2D(tB2, uv).rgb * 0.75 + texture2D(tB3, uv).rgb * 0.95;
	}
	vec3 hueOf(vec3 c) {
		return c / max(max(c.r, max(c.g, c.b)), 0.035);
	}

	// Rayons : la lumière large de l'artefact, étirée depuis son centre
	vec3 rays(vec2 uv) {
		if (uRays <= 0.0) return vec3(0.0);
		vec2 stepUv = (uv - uFocus) * (0.8 / 22.0);
		vec2 p = uv;
		vec3 acc = vec3(0.0);
		float w = 1.0;
		for (int i = 0; i < 22; i++) {
			p -= stepUv;
			acc += texture2D(tB3, p).rgb * w;
			w *= 0.93;
		}
		return acc * (uRays / 22.0);
	}

	// Densité : chaque cellule devient un caractère, des chiffres s'y allument
	vec4 asciiRamp(vec2 px) {
		vec2 cell = floor(px / uCell);
		vec2 f = fract(px / uCell);
		vec2 cuv = (cell + 0.5) * uCell / uRes;
		vec4 cs = texture2D(tColor, cuv);
		vec3 cd = display(cs.rgb + bloomAt(cuv) * uBloom * 1.3);
		float lum = luma(cd);
		float t = floor(uTime * 2.2 + hash(cell) * 7.0);
		float lumA = smoothstep(0.035, 0.85, lum);
		float idx = 10.0 + floor(clamp(pow(lumA, 0.85) * 1.15, 0.0, 0.999) * 12.0);
		if (hash(cell + t) < lumA * 0.1) idx = floor(hash(cell * 1.31 + t) * 10.0);
		float g = glyph(idx, f);
		vec3 ink = mix(vec3(0.66, 0.7, 0.64), hueOf(cd), 0.7) * (0.12 + 1.0 * pow(lumA, 0.6));
		return vec4(cd * 0.08 + ink * g, smoothstep(1.05, 1.95, cs.a));
	}

	// Scan LED : colonnes verticales, deux tons, comme une capture de capteur
	vec3 scanView(vec2 px) {
		float w = 3.0 * uDpr;
		vec2 q = (floor(px / w) + 0.5) * w;
		vec2 quv = q / uRes;
		vec3 c = display(texture2D(tColor, quv).rgb + bloomAt(quv) * uBloom);
		float l = pow(luma(c), 0.85);
		float fx = fract(px.x / w);
		float stripe = smoothstep(0.0, 0.3, fx) * smoothstep(1.0, 0.62, fx);
		vec3 duo = mix(vec3(0.0, 0.025, 0.03), uScan, clamp(l * 1.6, 0.0, 1.0));
		duo += vec3(1.0) * smoothstep(0.75, 1.0, l) * 0.35;
		return duo * (0.25 + 0.75 * stripe);
	}

	// Relief chiffré : isolignes de profondeur et chiffres par bandes
	vec3 topo(vec2 px, float raw, vec3 col) {
		vec2 cell = floor(px / uCell);
		vec2 inCell = fract(px / uCell);
		vec2 cuv = (cell + 0.5) * uCell / uRes;
		float cDepth = texture2D(tDepth, cuv).r;
		vec3 cSrc = display(texture2D(tColor, cuv).rgb);
		float lum = luma(cSrc);
		vec3 lens = vec3(0.02, 0.03, 0.03) + scanView(px) * 0.28;
		if (raw < 0.99999) {
			float k = linDepth(raw) * 22.0 - uTime * 0.12;
			float dist = abs(fract(k + 0.5) - 0.5);
			float line = 1.0 - smoothstep(0.0, fwidth(k) * 1.1, dist);
			lens = mix(lens, vec3(0.86, 0.88, 0.82), line * 0.7);
		}
		if (cDepth < 0.99999) {
			float band = floor(linDepth(cDepth) * 22.0 - uTime * 0.12);
			float digit = mod(band * 3.0 + floor(uTime * 1.3 - band * 0.45), 10.0);
			float show = step(hash(cell + band), 0.05 + lum * 0.6);
			float g = glyph(digit, inCell) * show;
			float sat = max(cSrc.r, max(cSrc.g, cSrc.b)) - min(cSrc.r, min(cSrc.g, cSrc.b));
			float warm = smoothstep(0.18, 0.4, sat) * step(cSrc.g, cSrc.r);
			vec3 ink = mix(uTint, vec3(0.94, 0.48, 0.16), warm);
			lens = mix(lens, ink, g * 0.92);
		} else if (mod(cell.x, 4.0) == 0.0 && mod(cell.y, 3.0) == 0.0) {
			lens = mix(lens, vec3(0.55), glyph(11.0, inCell) * 0.35);
		}
		return lens;
	}

	// Aura : le halo et les rayons de la fleur, en caractères
	vec3 aura(vec2 px) {
		vec2 cell = floor(px / uCell);
		vec2 f = fract(px / uCell);
		vec2 cuv = (cell + 0.5) * uCell / uRes;
		float cover = clamp(texture2D(tColor, cuv).a, 0.0, 1.0);
		vec3 e = texture2D(tB2, cuv).rgb * 0.5 + texture2D(tB3, cuv).rgb * 1.1 + rays(cuv) * 1.4;
		vec3 d = display(e * 1.2);
		float l = luma(d);
		float idx = 10.0 + floor(clamp(l * 2.8, 0.0, 0.999) * 12.0);
		float flick = hash(cell + floor(uTime * 2.5 + hash(cell) * 10.0));
		if (flick < l * 0.3) idx = floor(flick * 33.0);
		float g = glyph(idx, f) * step(0.03, l);
		return mix(vec3(0.85, 0.87, 0.8), hueOf(d), 0.55) * g * (0.22 + l * 1.5) * (1.0 - cover);
	}

	void main() {
		vec2 px = vUv * uRes;
		vec4 s = texture2D(tColor, vUv);
		float raw = texture2D(tDepth, vUv).r;
		float cover = clamp(s.a, 0.0, 1.0);
		float crisp = smoothstep(1.05, 1.95, s.a);
		vec3 col = display(s.rgb + bloomAt(vUv) * uBloom);

		// Lentilles : rectangles de verre + disque du curseur
		float rm = 0.0;
		for (int i = 0; i < ${MAX_LENSES}; i++) {
			if (i >= uLensCount) break;
			vec4 r = uLenses[i];
			vec2 inside = step(r.xy, px) * step(px, r.xy + r.zw);
			rm = max(rm, inside.x * inside.y);
		}
		float dc = length(px - uCursor.xy);
		float disc = (1.0 - smoothstep(uCursor.z - 1.5, uCursor.z, dc)) * uCursor.w;
		float m = max(rm, disc);

		// Mosaïque : la fleur apparaît tuile par tuile, puis quelques tuiles
		// restent vivantes et basculent en ASCII ou en scan
		vec2 tp = (px - uFocus * uRes) / uTile;
		vec2 tid = floor(tp);
		vec2 tf = fract(tp);
		float th = hash(tid + 3.17);
		float rev = smoothstep(th * 0.7, th * 0.7 + 0.3, uReveal);
		float near = step(length(tid + 0.5), 3.4) * (1.0 - uInside);
		float slot = floor(uTime * 0.28 + th * 11.0);
		float tileCover = texture2D(tColor, ((tid + 0.5) * uTile + uFocus * uRes) / uRes).a;
		float live = near * step(1.0 - uMosaic, hash(tid * 1.3 + slot)) * step(0.5, tileCover);
		float revealing = step(0.001, rev) * step(rev, 0.999) * (1.0 - uInside);
		// Roche scannée par défaut : les tuiles vivantes montrent alors la matière
		float tileMode = max(live * (1.0 - uScanAll), revealing) * (1.0 - uAscii);
		if (tileMode > 0.0) {
			vec3 dig = hash(tid + slot * 0.37) > 0.5 ? scanView(px) : asciiRamp(px).rgb;
			col = mix(col, dig, tileMode);
			vec2 e = min(tf, 1.0 - tf) * uTile;
			float edge = 1.0 - smoothstep(0.0, 1.0 * uDpr, min(e.x, e.y));
			col += vec3(0.8, 0.82, 0.78) * edge * 0.4 * tileMode;
			cover = max(cover, edge * 0.4 * tileMode);
		}
		float shown = mix(1.0, step(0.001, rev), 1.0 - uInside);
		col *= shown;
		cover *= shown;

		if (uAura > 0.0) col += aura(px) * uAura * shown;

		// Plongée : tout devient caractère (sauf les images nettes) ;
		// dedans, la lentille montre au contraire la matière
		float amt = uAscii * (1.0 - crisp) * (1.0 - m * 0.9 * uInside);
		if (amt > 0.001) {
			vec4 a = asciiRamp(px);
			if (raw < 0.99999) {
				float k = linDepth(raw) * mix(18.0, 1.4, uInside) - uTime * 0.3;
				float dist = abs(fract(k + 0.5) - 0.5);
				a.rgb += vec3(0.5, 0.52, 0.46) * (1.0 - smoothstep(0.0, fwidth(k) * 1.2, dist)) * 0.16;
			}
			col = mix(col, a.rgb, amt * (1.0 - a.a));
			cover = mix(cover, 1.0, uAscii);
		}

		// Dehors, la lentille révèle le relief chiffré
		// Par défaut, toute la tige est vue au scan ; le curseur, les fenêtres
		// et les tuiles vivantes y ouvrent des trouées sur la vraie matière
		float scanned = clamp(s.a, 0.0, 1.0) * uScanAll * (1.0 - disc) * (1.0 - rm) * (1.0 - live);
		float lensOut = max(scanned, m * (1.0 - uScanAll)) * (1.0 - uInside) * (1.0 - uAscii);
		if (lensOut > 0.0) {
			col = mix(col, topo(px, raw, col), lensOut);
			cover = max(cover, lensOut);
		}
		float ring = (1.0 - smoothstep(0.0, 1.2, abs(dc - uCursor.z))) * uCursor.w;
		col = mix(col, vec3(0.9, 0.92, 0.88), ring * 0.6);
		cover = max(cover, ring * 0.6);

		// Fin de la galerie : les caractères s'éteignent un à un, le fond revient
		if (uFade > 0.0) {
			float keep = smoothstep(uFade, uFade + 0.14, hash(floor(px / uCell) + 7.31) * 0.86 + 0.14 * (1.0 - uFade));
			col *= keep;
			cover *= keep;
		}

		// Passage dans la fleur : un front de caractères. Dehors il s'éteint du
		// centre vers les bords ; dedans, la galerie se rallume des bords au centre.
		// Au point de bascule l'écran est noir : le changement de scène ne se voit pas.
		if (uWipe > 0.0) {
			vec2 cell = floor(px / uCell);
			vec2 cc = (cell + 0.5) * uCell;
			float r = length((cc - uFocus * uRes) / uRes.y);
			float order = clamp(r / 0.95, 0.0, 1.0) * 0.82 + hash(cell + 1.7) * 0.18;
			float w = mix(-0.1, 1.1, uWipe);
			float keep = smoothstep(w - 0.1, w, order);
			float front = (1.0 - smoothstep(0.0, 0.07, abs(order - w + 0.05))) * step(0.001, uWipe) * step(uWipe, 0.999);
			col *= keep;
			cover *= keep;
			// Le front : une rangée de caractères qui brûle à la teinte
			vec2 g = fract(px / uCell);
			float glyph = step(0.25, g.x) * step(g.x, 0.75) * step(0.2, g.y) * step(g.y, 0.8) * step(0.45, hash(cell + floor(uTime * 12.0)));
			col += (uTint * 0.8 + 0.2) * front * glyph * 0.9;
			cover = max(cover, front * glyph * 0.9);
		}

		// Passage de la surface : éclair de la teinte
		col += (uTint * 0.7 + 0.3) * uFlash * 0.55;

		float vig = smoothstep(1.3, 0.35, length((vUv - 0.5) * vec2(1.1, 1.0)));
		col *= mix(0.5, 1.0, vig);
		col += (hash(px + fract(uTime) * 61.0) - 0.5) * 0.026;
		col = max(col, 0.0);
		gl_FragColor = vec4(col, max(cover, max(col.r, max(col.g, col.b))));
	}
`;

export function createPost(renderer: THREE.WebGLRenderer, { lowPower }: { lowPower: boolean }) {
	const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
		type: THREE.HalfFloatType,
		samples: lowPower ? 2 : 4,
		depthTexture: new THREE.DepthTexture(1, 1),
	});
	const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
	const levels = [
		[rt(), rt()],
		[rt(), rt()],
		[rt(), rt()],
	];

	const tri = fullscreenTriangle();
	const mesh = new THREE.Mesh(tri);
	mesh.frustumCulled = false;
	const scene = new THREE.Scene();
	scene.add(mesh);
	const cam = new THREE.OrthographicCamera();
	const run = (material: THREE.Material, target: THREE.WebGLRenderTarget | null) => {
		mesh.material = material;
		renderer.setRenderTarget(target);
		renderer.render(scene, cam);
	};

	const bright = new THREE.ShaderMaterial({
		vertexShader: FULLSCREEN_VERT,
		fragmentShader: BRIGHT_FRAG,
		uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.7 } },
		depthTest: false,
		depthWrite: false,
	});
	const blur = new THREE.ShaderMaterial({
		vertexShader: FULLSCREEN_VERT,
		fragmentShader: BLUR_FRAG,
		uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } },
		depthTest: false,
		depthWrite: false,
	});

	const lenses = Array.from({ length: MAX_LENSES }, () => new THREE.Vector4());
	const composite = new THREE.ShaderMaterial({
		vertexShader: FULLSCREEN_VERT,
		fragmentShader: COMPOSITE_FRAG,
		depthTest: false,
		depthWrite: false,
		uniforms: {
			tColor: { value: sceneTarget.texture },
			tDepth: { value: sceneTarget.depthTexture },
			tB1: { value: levels[0][0].texture },
			tB2: { value: levels[1][0].texture },
			tB3: { value: levels[2][0].texture },
			tGlyphs: { value: glyphAtlas() },
			uRes: { value: new THREE.Vector2() },
			uCell: { value: new THREE.Vector2() },
			uFocus: { value: new THREE.Vector2(0.5, 0.5) },
			uTime: { value: 0 },
			uNear: { value: 0.1 },
			uFar: { value: 30 },
			uExposure: { value: 1.2 },
			uLenses: { value: lenses },
			uLensCount: { value: 0 },
			uCursor: { value: new THREE.Vector4(-1e3, -1e3, 0, 0) },
			uAscii: { value: 0 },
			uInside: { value: 0 },
			uAura: { value: 1 },
			uRays: { value: lowPower ? 0 : 0.9 },
			uBloom: { value: 1 },
			uFlash: { value: 0 },
			uFade: { value: 0 },
			uWipe: { value: 0 },
			uScanAll: { value: 1 },
			uTile: { value: 120 },
			uReveal: { value: 0 },
			uMosaic: { value: 0.12 },
			uDpr: { value: 1 },
			uTint: { value: new THREE.Color(0.78, 0.96, 0.24) },
			uScan: { value: new THREE.Color(0.62, 0.94, 0.88) },
		},
	});
	const u = composite.uniforms;

	let w = 1;
	let h = 1;
	const setSize = (width: number, height: number, dpr: number) => {
		w = Math.max(1, Math.round(width * dpr));
		h = Math.max(1, Math.round(height * dpr));
		sceneTarget.setSize(w, h);
		levels.forEach((pair, i) => {
			const d = 4 << i;
			pair.forEach((t) => t.setSize(Math.max(1, Math.round(w / d)), Math.max(1, Math.round(h / d))));
		});
		u.uRes.value.set(w, h);
		u.uDpr.value = dpr;
	};

	const render = (world: THREE.Scene, camera: THREE.Camera) => {
		renderer.setRenderTarget(sceneTarget);
		renderer.setClearColor(0x000000, 0);
		renderer.clear();
		renderer.render(world, camera);

		// Halo : extraction des hautes lumières puis trois niveaux de flou
		bright.uniforms.tMap.value = sceneTarget.texture;
		bright.uniforms.uTexel.value.set(1 / w, 1 / h);
		run(bright, levels[0][0]);
		levels.forEach(([a, b], i) => {
			if (i > 0) {
				bright.uniforms.tMap.value = levels[i - 1][0].texture;
				bright.uniforms.uTexel.value.set(1 / levels[i - 1][0].width, 1 / levels[i - 1][0].height);
				const t = bright.uniforms.uThreshold.value;
				bright.uniforms.uThreshold.value = 0;
				run(bright, a);
				bright.uniforms.uThreshold.value = t;
			}
			blur.uniforms.tMap.value = a.texture;
			blur.uniforms.uDir.value.set(1.4 / a.width, 0);
			run(blur, b);
			blur.uniforms.tMap.value = b.texture;
			blur.uniforms.uDir.value.set(0, 1.4 / a.height);
			run(blur, a);
		});

		run(composite, null);
	};

	return {
		uniforms: u,
		bright: bright.uniforms,
		lenses,
		setSize,
		render,
		dispose() {
			sceneTarget.dispose();
			levels.flat().forEach((t) => t.dispose());
		},
	};
}
