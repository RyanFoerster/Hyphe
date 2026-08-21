/**
 * Générateurs déterministes pour la vue télémétrie : une même entrée produit
 * toujours la même courbe, côté serveur comme côté client.
 */

/** Générateur congruentiel linéaire — même suite que la maquette d'origine. */
const lcg = (seed: number) => {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const seedOf = (input: string) => [...input].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

/** Micro-courbe « charge 30 j » d'une ligne de tableau (viewBox 72×18). */
export const sparkline = (slug: string, points = 12): string => {
  const rand = lcg(seedOf(slug));
  let y = 9;
  const pts: string[] = [];
  for (let i = 0; i <= points; i++) {
    y = Math.max(2, Math.min(16, y + (rand() - 0.5) * 7));
    pts.push(`${i * 6},${y.toFixed(1)}`);
  }
  return pts.join(' ');
};

/** Extrait la première valeur numérique d'une donnée affichée (« [99,96 %] » → 99.96). */
export const numericOf = (value: string): number => {
  const match = String(value).replace(',', '.').match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]) : -1;
};

/** Léger décalage de rotation des planches épinglées : −0,7° / 0° / +0,7°. */
export const pinRotation = (index: number): string => `${((index % 3) - 1) * 0.7}deg`;
