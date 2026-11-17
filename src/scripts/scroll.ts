// Défilement adouci (Lenis). Une seule instance par page, partagée par les
// scripts qui ont besoin de faire défiler. Rien sous prefers-reduced-motion.
import Lenis from 'lenis';

let lenis: Lenis | null = null;

export function mountScroll() {
	if (lenis || matchMedia('(prefers-reduced-motion: reduce)').matches) return lenis;
	lenis = new Lenis({
		lerp: 0.09,
		wheelMultiplier: 0.95,
		anchors: true,
		autoRaf: true,
	});
	// Le loader fige la page : Lenis s'arrête avec lui
	const html = document.documentElement;
	const sync = () => (html.classList.contains('is-loading') ? lenis!.stop() : lenis!.start());
	new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });
	sync();
	return lenis;
}

/** Vrai quand Lenis adoucit déjà le défilement */
export const smoothed = () => !!lenis;

/** Faire défiler jusqu'à une position, en douceur si possible */
export function scrollToY(top: number) {
	if (lenis) lenis.scrollTo(top, { duration: 1.6 });
	else scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

/** Amener la page à une position et l'y tenir, le temps d'une scène qui se joue
 *  seule (le visiteur ne peut plus défiler) ; `releaseScroll` la lui rend */
export function pinScrollAt(top: number, duration = 0.7) {
	if (!lenis) return scrollTo({ top });
	if (Math.abs(lenis.scroll - top) < 1) return lenis.stop();
	lenis.scrollTo(top, { duration, lock: true, force: true, onComplete: () => lenis?.stop() });
}

export const releaseScroll = () => lenis?.start();
