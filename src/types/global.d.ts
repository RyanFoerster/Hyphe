/** Contrat entre le moteur de loupe inliné (`scripts/mix-runtime.js`) et les modules. */
interface EcoMix {
  /** Position de la loupe restaurée depuis la session, ou déduite du système. */
  read(): number;
  /** Applique un régime : 0 = planche imprimée, 1 = station de nuit. */
  apply(t: number): void;
  /** Dernière valeur appliquée. */
  t: number;
  /** Sa courbe d'encre (= `--mix`), telle qu'appliquée. */
  encre: number;
}

interface Window {
  __ecoMix: EcoMix;
  /** Route courante, telle que la lit le canevas pour choisir sa composition. */
  __ecoMode?: string;
  /** Le canevas a dessiné son premier frame (posé avant l'évènement eco:ready). */
  __ecoReady?: boolean;
  /** La dormance a déjà eu lieu dans cette fenêtre — jamais deux fois. */
  __okgDormance?: boolean;
  /** Le site a le droit d'animer. Posé avec `eco:pret`, pour qui arrive après. */
  __ecoPret?: boolean;
  /** Poignée de recette, en développement seulement. */
  __ecoMotion?: {
    battement(): { abonnes: number; source: 'propre' | 'moteur' | 'arrete' };
    moteurCharge(): boolean;
    pret(): boolean;
    scenes(): { page: number; durables: number; total: number } | null;
  };
}

interface WindowEventMap {
  /** Régime de la loupe : `t` la position du curseur, `encre` la courbe
      raide qui pilote `--mix` (0 = naturaliste pur, 1 = télémétrie pure). */
  'eco:mix': CustomEvent<{ t: number; encre: number }>;
  /** Progression du scroll → croissance de l'organisme. */
  'eco:growth': CustomEvent<{ g: number }>;
  /** Changement de route → recomposition du canevas. */
  'eco:route': CustomEvent<{ mode: string }>;
  /** Premier frame du canevas dessiné — la dormance s'y accroche. */
  'eco:ready': CustomEvent;
  /** Fin de la dormance : le site peut animer. `loader` dit si elle a été vue —
      montrée, l'entrée enchaîne sans pause ; sautée, après un bref souffle. */
  'eco:pret': CustomEvent<{ loader: boolean }>;
}

/** Voir le plugin `inlineScript` dans astro.config.mjs. */
declare module '*?inline-script' {
  const source: string;
  export default source;
}
