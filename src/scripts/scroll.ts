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
