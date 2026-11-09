// L'ambiance sonore, entièrement synthétisée (Web Audio) : rien à télécharger,
// aucun droit à gérer, et le son réagit au site en direct.
//
//   nappe      quatre accords qui se relaient lentement, filtrés : la plongée
//              dans la fleur ouvre le filtre et fait monter une basse
//   air        un souffle filtré, plus présent dans la plongée
//   pollen     de rares notes cristallines, au hasard, dans la réverbération
//   gestes     survol, clic, menu, sortie et arrivée de page (avec le
//              crépitement des tuiles), entrée dans la fleur, un spécimen
//
// Les navigateurs n'autorisent le son qu'après un geste : le contexte démarre
// au premier clic ou à la première touche. Le choix (son ou silence) est
// mémorisé ; le bouton [data-sound-toggle] le change partout.

const KEY = 'hyphe:sound';
const LIVE = 'hyphe:sound-live';

// Ré mineur, couleurs suspendues : D, E, F, G, A, C
const NOTE = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const CHORDS = [
	[38, 45, 53, 60, 64], // Dm9
	[34, 41, 50, 57, 64], // Bbmaj9(#11)
	[41, 48, 55, 57, 64], // Fadd9
	[43, 50, 53, 58, 62], // Gm(add9)
];
const SCALE = [74, 76, 77, 79, 81, 84, 86, 88, 89, 93]; // aigus pour les cristaux

type Ctx = {
	ac: AudioContext;
	master: GainNode;
	duck: GainNode;
	verb: GainNode;
	padBus: GainNode;
	padFilter: BiquadFilterNode;
	air: GainNode;
	airFilter: BiquadFilterNode;
	sub: GainNode;
	noise: AudioBuffer;
};

let enabled = true;
let c: Ctx | null = null;
let chordTimer = 0;
let sparkleTimer = 0;
let chordIndex = 0;
let dive = 0;
let inside = false;
let lastSpecimen = -1;
let specimenTimer = 0;
let lastScroll = -1e9;
let mounted = false;

try {
	enabled = localStorage.getItem(KEY) !== 'off';
} catch {}

const html = () => document.documentElement;
const reflect = () => {
	const live = !!c && c.ac.state === 'running' && enabled;
	html().dataset.sound = !enabled ? 'off' : live ? 'live' : 'on';
	document.querySelectorAll<HTMLElement>('[data-sound-toggle]').forEach((b) => {
		b.setAttribute('aria-pressed', String(enabled));
		const label = b.querySelector('[data-sound-label]');
		if (label) label.textContent = enabled ? 'Sound on' : 'Sound off';
	});
	try {
		sessionStorage.setItem(LIVE, live ? '1' : '');
	} catch {}
};

function impulse(ac: AudioContext, seconds: number, decay: number) {
	const len = Math.floor(ac.sampleRate * seconds);
	const buf = ac.createBuffer(2, len, ac.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const d = buf.getChannelData(ch);
		for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
	}
	return buf;
}

function noiseBuffer(ac: AudioContext) {
	// Bruit rose (approximation de Paul Kellet) : plus doux qu'un bruit blanc
	const len = ac.sampleRate * 3;
	const buf = ac.createBuffer(1, len, ac.sampleRate);
	const d = buf.getChannelData(0);
	let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
	for (let i = 0; i < len; i++) {
		const w = Math.random() * 2 - 1;
		b0 = 0.99886 * b0 + w * 0.0555179;
		b1 = 0.99332 * b1 + w * 0.0750759;
		b2 = 0.969 * b2 + w * 0.153852;
		b3 = 0.8665 * b3 + w * 0.3104856;
		b4 = 0.55 * b4 + w * 0.5329522;
		b5 = -0.7616 * b5 - w * 0.016898;
		d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
		b6 = w * 0.115926;
	}
	return buf;
}

function build(): Ctx | null {
	const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AC) return null;
	const ac = new AC({ latencyHint: 'playback' });
	const comp = ac.createDynamicsCompressor();
	comp.threshold.value = -18;
	comp.ratio.value = 3;
	comp.connect(ac.destination);
	const master = ac.createGain();
	master.gain.value = 0;
	master.connect(comp);
	// Le « duck » : la nappe s'efface un instant pendant une transition
	const duck = ac.createGain();
	duck.connect(master);

	const convolver = ac.createConvolver();
	convolver.buffer = impulse(ac, 5.5, 2.6);
	const verb = ac.createGain();
	verb.gain.value = 1;
	verb.connect(convolver);
	const wet = ac.createGain();
	wet.gain.value = 0.55;
	convolver.connect(wet).connect(duck);

	// La nappe
	const padFilter = ac.createBiquadFilter();
	padFilter.type = 'lowpass';
	padFilter.frequency.value = 650;
	padFilter.Q.value = 0.6;
	const padBus = ac.createGain();
	padBus.gain.value = 0.16;
	padBus.connect(padFilter);
	padFilter.connect(duck);
	const padSend = ac.createGain();
	padSend.gain.value = 0.7;
	padFilter.connect(padSend).connect(verb);
	// Respiration lente du filtre
	const lfo = ac.createOscillator();
	lfo.frequency.value = 0.045;
	const lfoAmt = ac.createGain();
	lfoAmt.gain.value = 220;
	lfo.connect(lfoAmt).connect(padFilter.frequency);
	lfo.start();

	// L'air
	const noise = noiseBuffer(ac);
	const src = ac.createBufferSource();
	src.buffer = noise;
	src.loop = true;
	const airFilter = ac.createBiquadFilter();
	airFilter.type = 'bandpass';
	airFilter.frequency.value = 700;
	airFilter.Q.value = 0.8;
	const air = ac.createGain();
	air.gain.value = 0.035;
	src.connect(airFilter).connect(air).connect(duck);
	const airSend = ac.createGain();
	airSend.gain.value = 0.4;
	air.connect(airSend).connect(verb);
	src.start();
	const airLfo = ac.createOscillator();
	airLfo.frequency.value = 0.07;
	const airAmt = ac.createGain();
	airAmt.gain.value = 260;
	airLfo.connect(airAmt).connect(airFilter.frequency);
	airLfo.start();

	// La basse de la plongée
	const sub = ac.createGain();
	sub.gain.value = 0;
	sub.connect(duck);
	for (const [f, g] of [
		[NOTE(26), 0.7],
		[NOTE(38), 0.35],
	] as const) {
		const o = ac.createOscillator();
		o.type = 'sine';
		o.frequency.value = f;
		const og = ac.createGain();
		og.gain.value = g;
		o.connect(og).connect(sub);
		o.start();
	}

	return { ac, master, duck, verb, padBus, padFilter, air, airFilter, sub, noise };
}

/** Un accord de la nappe : chaque note, deux oscillateurs désaccordés, entre et sort lentement */
function playChord(notes: number[], hold: number) {
	if (!c) return;
	const { ac, padBus } = c;
	const t = ac.currentTime;
	for (const n of notes) {
		const g = ac.createGain();
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(0.12, t + 5);
		g.gain.setValueAtTime(0.12, t + hold);
		g.gain.linearRampToValueAtTime(0, t + hold + 7);
		g.connect(padBus);
		for (const [type, cents] of [
			['triangle', -7],
			['sawtooth', 6],
		] as const) {
			const o = ac.createOscillator();
			o.type = type;
			o.frequency.value = NOTE(n);
			o.detune.value = cents + (Math.random() - 0.5) * 4;
			const og = ac.createGain();
			og.gain.value = type === 'sawtooth' ? 0.35 : 0.8;
			o.connect(og).connect(g);
			o.start(t);
			o.stop(t + hold + 7.2);
		}
	}
}

function loopChords() {
	if (!c) return;
	playChord(CHORDS[chordIndex % CHORDS.length], 9);
	chordIndex++;
	chordTimer = window.setTimeout(loopChords, 12_000);
}

/** Une note cristalline : un son de cloche court, surtout dans la réverbération */
function bell(freq: number, vol = 0.06, decay = 1.6, wet = 0.6, when = 0) {
	if (!c || !enabled) return;
	const { ac, duck, verb } = c;
	const t = ac.currentTime + when;
	const g = ac.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(vol, t + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
	const dry = ac.createGain();
	dry.gain.value = 1 - wet * 0.6;
	const send = ac.createGain();
	send.gain.value = wet;
	g.connect(dry).connect(duck);
	g.connect(send).connect(verb);
	for (const [ratio, amp] of [
		[1, 1],
		[2.01, 0.28],
		[3.98, 0.08],
	] as const) {
		const o = ac.createOscillator();
		o.type = 'sine';
		o.frequency.value = freq * ratio;
		const og = ac.createGain();
		og.gain.value = amp;
		o.connect(og).connect(g);
		o.start(t);
		o.stop(t + decay + 0.05);
	}
}

/** Un souffle filtré dont la fréquence glisse de `from` à `to` */
function whoosh(from: number, to: number, dur: number, vol = 0.18, when = 0) {
	if (!c || !enabled) return;
	const { ac, duck, verb, noise } = c;
	const t = ac.currentTime + when;
	const src = ac.createBufferSource();
	src.buffer = noise;
	src.playbackRate.value = 1.3;
	const f = ac.createBiquadFilter();
	f.type = 'bandpass';
	f.Q.value = 1.4;
	f.frequency.setValueAtTime(from, t);
	f.frequency.exponentialRampToValueAtTime(to, t + dur);
	const g = ac.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(vol, t + dur * 0.55);
	g.gain.linearRampToValueAtTime(0, t + dur);
	src.connect(f).connect(g);
	g.connect(duck);
	const s = ac.createGain();
	s.gain.value = 0.5;
	g.connect(s).connect(verb);
	src.start(t, Math.random() * 2);
	src.stop(t + dur + 0.05);
}

/** Le crépitement des tuiles : de minuscules clics, de plus en plus serrés */
function ticks(count: number, dur: number, vol = 0.05) {
	if (!c || !enabled) return;
	const { ac, duck } = c;
	for (let i = 0; i < count; i++) {
		const t = ac.currentTime + dur * Math.sqrt(Math.random());
		const o = ac.createOscillator();
		o.type = 'square';
		o.frequency.value = 1800 + Math.random() * 2600;
		const g = ac.createGain();
		g.gain.setValueAtTime(vol * (0.4 + Math.random() * 0.6), t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
		o.connect(g).connect(duck);
		o.start(t);
		o.stop(t + 0.02);
	}
}

/** Un coup sourd : l'entrée dans la fleur */
function thump(vol = 0.35) {
	if (!c || !enabled) return;
	const { ac, duck, verb } = c;
	const t = ac.currentTime;
	const o = ac.createOscillator();
	o.type = 'sine';
	o.frequency.setValueAtTime(110, t);
	o.frequency.exponentialRampToValueAtTime(38, t + 0.7);
	const g = ac.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(vol, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
	o.connect(g).connect(duck);
	const s = ac.createGain();
	s.gain.value = 0.4;
	g.connect(s).connect(verb);
	o.start(t);
	o.stop(t + 1.5);
}

function duckFor(seconds: number, depth = 0.25) {
	if (!c) return;
	const g = c.duck.gain;
	const t = c.ac.currentTime;
	g.cancelScheduledValues(t);
	g.setTargetAtTime(depth, t, 0.08);
	g.setTargetAtTime(1, t + seconds, 0.6);
}

function sparkle() {
	if (c && enabled && document.visibilityState === 'visible') {
		const n = SCALE[Math.floor(Math.random() * SCALE.length)];
		bell(NOTE(n), 0.018 + dive * 0.02, 3.2, 0.9);
	}
	sparkleTimer = window.setTimeout(sparkle, 2600 + Math.random() * (5200 - dive * 2500));
}

const fadeMaster = (to: number, tc = 0.5) => {
	if (!c) return;
	const t = c.ac.currentTime;
	c.master.gain.cancelScheduledValues(t);
	c.master.gain.setTargetAtTime(to, t, tc);
};

async function start() {
	if (!enabled) return;
	if (!c) {
		c = build();
		if (!c) return;
		c.ac.addEventListener('statechange', reflect);
		loopChords();
		sparkle();
	}
	try {
		await c.ac.resume();
	} catch {}
	if (c.ac.state === 'running') fadeMaster(document.visibilityState === 'visible' ? 0.9 : 0, 1.2);
	reflect();
}

function setEnabled(on: boolean) {
	enabled = on;
	try {
		localStorage.setItem(KEY, on ? 'on' : 'off');
	} catch {}
	if (on) {
		void start().then(() => bell(NOTE(81), 0.05, 1.4, 0.5));
	} else {
		fadeMaster(0, 0.25);
	}
	reflect();
}

// ------------------------------------------------------------ API publique

export const sound = {
	get enabled() {
		return enabled;
	},
	toggle() {
		setEnabled(!enabled);
	},
	/** Le choix d'entrée (fin du loader) : c'est un geste, le son peut partir */
	choose(on: boolean) {
		setEnabled(on);
		if (on) void start().then(() => sound.bloom());
	},
	/** Survol d'un élément vivant : une note de la gamme, plus grave pour les grands blocs */
	hover(index?: number) {
		const n = index === undefined ? SCALE[Math.floor(Math.random() * 6)] : SCALE[index % SCALE.length];
		bell(NOTE(n), 0.03, 0.9, 0.55);
	},
	click() {
		if (!c || !enabled) return;
		bell(NOTE(62), 0.06, 0.5, 0.3);
		ticks(3, 0.04, 0.04);
	},
	menu(open: boolean) {
		if (open) {
			whoosh(500, 2400, 0.45, 0.06);
			bell(NOTE(81), 0.04, 1.2, 0.6);
			bell(NOTE(86), 0.04, 1.4, 0.6, 0.09);
		} else {
			whoosh(2200, 500, 0.4, 0.05);
			bell(NOTE(86), 0.03, 1, 0.6);
			bell(NOTE(79), 0.03, 1.2, 0.6, 0.08);
		}
	},
	/** Départ vers une autre page : la nappe s'efface sous le crépitement des tuiles */
	leave() {
		if (!c || !enabled) return;
		whoosh(300, 4200, 0.75, 0.2);
		ticks(26, 0.7);
		duckFor(1.2, 0.2);
		fadeMaster(0.0, 0.35);
	},
	/** Arrivée : la page se recompose, la nappe revient dans un souffle */
	arrive() {
		whoosh(4200, 380, 1.1, 0.16);
		ticks(20, 0.9, 0.035);
		[62, 69, 74, 77].forEach((n, i) => bell(NOTE(n + 12), 0.03, 2.4, 0.8, 0.25 + i * 0.12));
	},
	/** La plongée (0 → 1) et l'intérieur de la fleur */
	dive(d: number, isInside: boolean) {
		const was = inside;
		dive = d;
		inside = isInside;
		if (!c) return;
		const t = c.ac.currentTime;
		const open = isInside ? 0.55 : d;
		c.padFilter.frequency.setTargetAtTime(650 + open * 2600, t, 0.4);
		c.sub.gain.setTargetAtTime(isInside ? 0.05 : d * 0.16, t, 0.5);
		c.air.gain.setTargetAtTime(0.03 + (isInside ? 0.01 : d * 0.02), t, 0.6);
		c.airFilter.frequency.setTargetAtTime(600 + (isInside ? 300 : d * 600), t, 0.6);
		if (isInside && !was) {
			thump();
			whoosh(5000, 200, 1.6, 0.2);
			[50, 57, 62, 65, 69].forEach((n, i) => bell(NOTE(n + 12), 0.035, 3, 0.9, i * 0.07));
		} else if (!isInside && was) {
			whoosh(200, 3000, 1.2, 0.12);
		}
	},
	/** Un spécimen de la galerie : sa note à lui, seulement quand on s'y arrête
	 *  (défiler vite à travers la galerie ne fait pas sonner chaque projet) */
	specimen(i: number) {
		if (i === lastSpecimen) return;
		lastSpecimen = i;
		clearTimeout(specimenTimer);
		specimenTimer = window.setTimeout(() => {
			if (performance.now() - lastScroll < 250) return;
			const n = SCALE[(i * 2) % SCALE.length] - 12;
			bell(NOTE(n), 0.05, 2.6, 0.75);
			bell(NOTE(n + 7), 0.025, 2.2, 0.75, 0.12);
		}, 450);
	},
	/** Les étapes du loader : la fleur monte d'une note à chaque étape */
	stage(i: number) {
		bell(NOTE([62, 65, 69, 72, 74, 77][i % 6] + 12), 0.04, 2, 0.7);
	},
	/** La fleur est prête : un accord qui s'ouvre */
	bloom() {
		whoosh(600, 3600, 1, 0.08);
		[62, 69, 72, 76, 81].forEach((n, i) => bell(NOTE(n + 12), 0.035, 3.2, 0.85, i * 0.09));
	},
};

// ------------------------------------------------------------ branchement

const HOVER = 'a[href], button, [data-petal-label], [data-orbit-item], [role="button"]';


export function mountSound() {
	if (mounted) return;
	mounted = true;

	// Le bouton, partout où il est posé : il coupe ou rend le son, même avant
	// que quoi que ce soit n'ait joué
	document.addEventListener(
		'click',
		(e) => {
			const t = (e.target as HTMLElement).closest('[data-sound-toggle]');
			if (!t) return;
			e.preventDefault();
			sound.toggle();
		},
		true,
	);

	// Premier geste : on démarre (si le visiteur n'a pas choisi le silence)
	const wake = (e: Event) => {
		if ((e.target as HTMLElement | null)?.closest?.('[data-sound-toggle], [data-enter]')) return;
		if (enabled && (!c || c.ac.state !== 'running')) void start();
	};
	for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, wake, { passive: true, capture: true });

	// Arrivée d'une page alors que le son jouait : on tente de reprendre tout de
	// suite (le navigateur peut exiger un nouveau geste ; le premier clic suffira)
	const arriving = html().classList.contains('tiles-cover');
	let wasLive = false;
	try {
		wasLive = sessionStorage.getItem(LIVE) === '1';
	} catch {}
	if (wasLive && enabled) {
		void start().then(() => {
			if (arriving && c?.ac.state === 'running') sound.arrive();
		});
	}

	// Survol : une note par élément, jamais deux fois de suite le même
	let lastEl: Element | null = null;
	let lastAt = 0;
	let lastMove = -1e9;
	addEventListener('pointermove', () => (lastMove = performance.now()), { passive: true });
	document.addEventListener(
		'pointerover',
		(e) => {
			if ((e as PointerEvent).pointerType !== 'mouse') return;
			const el = (e.target as HTMLElement).closest(HOVER);
			if (!el || el === lastEl) return;
			lastEl = el;
			const now = performance.now();
			// Pendant un défilement, les éléments passent sous la souris sans
			// qu'elle bouge : on se tait
			if (now - lastScroll < 220 || now - lastMove > 120) return;
			if (now - lastAt < 90) return;
			lastAt = now;
			const idx = el.hasAttribute('data-petal-label') ? [...el.parentElement!.children].indexOf(el) : undefined;
			sound.hover(idx);
		},
		{ passive: true },
	);
	document.addEventListener(
		'pointerout',
		(e) => {
			const el = (e.target as HTMLElement).closest(HOVER);
			if (el && !el.contains(e.relatedTarget as Node)) lastEl = null;
		},
		{ passive: true },
	);
	document.addEventListener('click', (e) => {
		if ((e.target as HTMLElement).closest('button, a[href]') && !(e.target as HTMLElement).closest('[data-sound-toggle]')) sound.click();
	});

	// Le défilement ne fait aucun son : on le note seulement, pour faire taire
	// les survols et les spécimens tant qu'il dure
	addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true });

	// Onglet caché : silence ; retour : la nappe revient
	document.addEventListener('visibilitychange', () => {
		if (!c || !enabled) return;
		fadeMaster(document.visibilityState === 'visible' ? 0.9 : 0, document.visibilityState === 'visible' ? 0.8 : 0.15);
	});
	// Retour arrière depuis le cache : la page revient, le son aussi
	addEventListener('pageshow', (e) => {
		if (e.persisted && c && enabled) fadeMaster(0.9, 0.6);
	});

	reflect();
}
