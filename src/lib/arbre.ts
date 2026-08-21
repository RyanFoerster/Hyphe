import type { Specimen } from '~/types/content';

/**
 * L'arbre de collecte — module topologique partagé.
 *
 * Une seule source de vérité pour la structure de la collection :
 * tronc = le studio (nœud racine), branches maîtresses = années (éclatées en
 * saisons quand la densité le justifie), fruits = les projets (nœuds
 * feuilles). La vue naturaliste projette ce graphe en planche gravée ; la vue
 * télémétrie le projettera en arêtes tendues (étape 3) — mêmes nœuds, mêmes
 * liens, deux rendus.
 *
 * Tout est calculé, rien n'est codé à la main : le layout tient de 4 à 20
 * projets. Le bruit est un LCG seedé (même famille que l'organisme de fond et
 * les sparklines) : le même contenu produit toujours le même arbre.
 */

export interface EntreeArbre {
  slug: string;
  num: string;
  nom: string;
  latin: string;
  /** Le libellé littéral du livrable — la première lecture du fruit. */
  tag: string;
  famille: 'site' | 'app';
  client: string;
  collecte: string;
  annee: number;
  mois: number;
  /** Projet mené à deux (design + dev) : le rameau est greffé. */
  greffe: boolean;
  /** Une ligne de description — l'annotation de survol la porte. */
  resume: string;
  techs: string[];
  mission: string;
  /** URL du visuel optimisé ; absent → hachures de planche vierge. */
  imageHref?: string;
}

interface Pt {
  x: number;
  y: number;
}

/** Un trait de plume : l'épaisseur décroît segment par segment. */
export interface SegmentTrait {
  d: string;
  largeur: number;
}

export interface FruitPlace {
  entree: EntreeArbre;
  /** Coin haut-gauche du cartouche. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  /** Le pédoncule : de la branche au sommet du cartouche. */
  pedoncule: string;
  attache: Pt;
  /** La ligature de greffe, dessinée sur le pédoncule. */
  greffe?: string;
  compact: boolean;
  /** L'annotation de survol : position calculée, jamais coupée par le bord.
      En espalier, elle se déplie sous le fruit (`sous`). */
  note: { x: number; y: number; versDroite: boolean; sous?: boolean };
}

export interface BranchePlacee {
  id: string;
  /** « été 2025 », « 2024 »… l'anneau de datation le porte. */
  label: string;
  cote: -1 | 1;
  depart: Pt;
  bout: Pt;
  segments: SegmentTrait[];
  /** Petits rameaux de plume, non porteurs — la richesse du trait. */
  brindilles: string[];
  /** L'axe échantillonné de la branche — la charpente s'en sert. */
  axe: Pt[];
  anneau: Pt;
  labelPos: Pt;
  fruits: FruitPlace[];
  grappe: boolean;
}

export interface ArbreLayout {
  largeur: number;
  hauteur: number;
  /** Forme fermée du tronc — hachures + contour. */
  troncPath: string;
  /** Racines évasées au pied + ligne de sol. */
  racines: string[];
  sol: { x1: number; x2: number; y: number };
  /** L'axe du tronc, du sol vers la cime (sert au redressement, étape 3). */
  troncAxe: Pt[];
  branches: BranchePlacee[];
  bourgeon: { path: string; pointe: Pt; label: Pt };
  etiquette: { x: number; y: number; w: number; h: number };
  depuis: number;
  graduations: { y: number; majeure: boolean; valeur: number }[];
}

/**
 * La charpente : le squelette animable de l'arbre — la même hiérarchie
 * (tronc → branches → fruits) que les deux vues, sérialisée pour le client.
 * Le runtime (`scripts/charpente.ts`) interpole ces points vers les lignes
 * du tableau au passage de la loupe : le redressement.
 */
export interface CharpenteArbre {
  w: number;
  h: number;
  tronc: [number, number][];
  branches: {
    pts: [number, number][];
    fruits: { slug: string; attache: [number, number]; centre: [number, number] }[];
  }[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export const charpente = (a: ArbreLayout): CharpenteArbre => ({
  w: a.largeur,
  h: a.hauteur,
  tronc: a.troncAxe.map((p) => [r1(p.x), r1(p.y)]),
  branches: a.branches.map((b) => ({
    pts: b.axe.filter((_, i) => i % 2 === 0).map((p) => [r1(p.x), r1(p.y)] as [number, number]),
    fruits: b.fruits.map((f) => ({
      slug: f.entree.slug,
      attache: [r1(f.attache.x), r1(f.attache.y)] as [number, number],
      centre: [r1(f.x + f.w / 2), r1(f.y + f.h / 2)] as [number, number],
    })),
  })),
});

/* ── Aléa contrôlé — même générateur que le reste de la station ── */
const lcg = (seed: number) => {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/* ── Dates de collecte ─────────────────────────────────────────── */
const MOIS: [RegExp, number][] = [
  [/janv/i, 1], [/févr/i, 2], [/mars/i, 3], [/avril/i, 4], [/\bmai\b/i, 5], [/juin/i, 6],
  [/juil/i, 7], [/août/i, 8], [/sept/i, 9], [/oct/i, 10], [/nov/i, 11], [/déc/i, 12],
];

/** Lit « [Liège, mars 2025] » (sinon `prod` « [04/2025] ») → année + mois. */
export const dateDeCollecte = (collecte: string, prod = ''): { annee: number; mois: number } => {
  const annee = Number((collecte.match(/20\d\d/) ?? prod.match(/20\d\d/) ?? ['2025'])[0]);
  const moisNomme = MOIS.find(([re]) => re.test(collecte));
  if (moisNomme) return { annee, mois: moisNomme[1] };
  const mm = prod.match(/(\d\d)\/20\d\d/);
  return { annee, mois: mm ? Number(mm[1]) : 6 };
};

const SAISONS = [
  { nom: 'hiver', mois: [1, 2], ordre: 0 },
  { nom: 'printemps', mois: [3, 4, 5], ordre: 1 },
  { nom: 'été', mois: [6, 7, 8], ordre: 2 },
  { nom: 'automne', mois: [9, 10, 11], ordre: 3 },
  { nom: 'hiver', mois: [12], ordre: 4 },
];

const saisonDe = (mois: number) => SAISONS.find((s) => s.mois.includes(mois)) ?? SAISONS[2]!;

export const entreeDepuisSpecimen = (s: Specimen, imageHref?: string): EntreeArbre => ({
  slug: s.slug,
  num: s.num,
  nom: s.nom.replace(/^\[|\]$/g, ''),
  latin: s.latin,
  tag: s.livrable.label,
  famille: s.livrable.famille,
  client: s.client,
  collecte: s.collecte,
  ...dateDeCollecte(s.collecte, s.prod),
  greffe: s.mission === 'design + dev',
  resume: s.resume,
  techs: s.techs,
  mission: s.mission,
  imageHref,
});

/* ── Géométrie ─────────────────────────────────────────────────── */
const lisser = (pts: Pt[], fermer = false): string => {
  if (pts.length < 2) return '';
  let d = `M${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return fermer ? `${d} Z` : d;
};

const surCubique = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const e = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + e * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + e * p3.y,
  };
};

/** La découpe en trois traits d'épaisseur décroissante — partagée partout. */
const segmenterBranche = (pts: Pt[]): string[] => [
  lisser(pts.slice(0, 6)),
  lisser(pts.slice(5, 10)),
  lisser(pts.slice(9)),
];

const seCoupent = (a: FruitPlace, b: FruitPlace, marge: number) =>
  a.x < b.x + b.w + marge &&
  a.x + a.w + marge > b.x &&
  a.y < b.y + b.h + marge &&
  a.y + a.h + marge > b.y;

/* ── Construction ──────────────────────────────────────────────── */
interface Groupe {
  id: string;
  label: string;
  cle: number;
  entrees: EntreeArbre[];
}

/** Années entières ; une année trop chargée s'éclate en saisons. */
const grouper = (entrees: EntreeArbre[]): Groupe[] => {
  const parAnnee = new Map<number, EntreeArbre[]>();
  for (const e of entrees) {
    const arr = parAnnee.get(e.annee);
    if (arr) arr.push(e);
    else parAnnee.set(e.annee, [e]);
  }
  const groupes: Groupe[] = [];
  for (const [annee, arr] of parAnnee) {
    if (arr.length <= 2) {
      groupes.push({ id: `a${annee}`, label: String(annee), cle: annee * 10, entrees: arr });
      continue;
    }
    const parSaison = new Map<number, { nom: string; entrees: EntreeArbre[] }>();
    for (const e of arr) {
      const s = saisonDe(e.mois);
      const g = parSaison.get(s.ordre);
      if (g) g.entrees.push(e);
      else parSaison.set(s.ordre, { nom: s.nom, entrees: [e] });
    }
    for (const [ordre, g] of parSaison) {
      groupes.push({
        id: `a${annee}s${ordre}`,
        label: `${g.nom} ${annee}`,
        cle: annee * 10 + ordre,
        entrees: g.entrees,
      });
    }
  }
  groupes.sort((a, b) => a.cle - b.cle);
  for (const g of groupes) g.entrees.sort((a, b) => a.mois - b.mois);
  return groupes;
};

export interface OptionsArbre {
  largeur?: number;
  seed?: number;
  /**
   * `portrait` : la planche pleine page, branches alternées de part et
   * d'autre du tronc. `espalier` : l'arbre palissé du mobile — tronc à
   * gauche, branches courtes vers la droite, fruits empilés le long du
   * scroll vertical. Même topologie, deux ports.
   */
  mode?: 'portrait' | 'espalier';
}

export const construireArbre = (entrees: EntreeArbre[], options: OptionsArbre = {}): ArbreLayout => {
  const espalier = options.mode === 'espalier';
  const W = options.largeur ?? (espalier ? 640 : 1200);
  const rng = lcg(options.seed ?? 47);
  const groupes = grouper(entrees);

  /* Dimensions de cartouche : plein pour l'arbre aéré, resserré en grappe.
     En espalier, un seul gabarit, large pour le pouce (≥ 44px rendus). */
  /* Hauteur = bande haute (22) + image 16/9 + bloc textes — le ratio de
     l'image égale celui de la planche d'en-tête : le zoom est continu. */
  const NORMAL = espalier ? { w: 210, h: 194, dx: 0 } : { w: 176, h: 175, dx: 196 };
  const COMPACT = espalier ? NORMAL : { w: 142, h: 146, dx: 96 };

  const espacement = (g: Groupe) =>
    espalier
      ? 70 + g.entrees.length * (NORMAL.h + 28) + 30
      : g.entrees.length > 3
        ? 344
        : 266;
  const margeBas = espalier ? 150 : 168;
  const margeHaut = espalier ? 170 : 190;
  const H = margeHaut + groupes.reduce((acc, g) => acc + espacement(g), 0) + margeBas + 60;

  /* ── Le tronc : sinueux, effilé vers la cime ── */
  const yBase = H - margeBas;
  const ySommet = margeHaut - 50;
  const cx = espalier ? 132 : W / 2;
  const ampli = espalier ? 9 : 22;
  const axe: Pt[] = [];
  const n = Math.max(4, Math.round((yBase - ySommet) / 120));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    axe.push({
      x: cx + Math.sin(t * Math.PI * 1.7 + 0.4) * ampli + (rng() - 0.5) * (ampli * 0.6),
      y: yBase - t * (yBase - ySommet),
    });
  }
  const xTronc = (y: number): number => {
    for (let i = 0; i < axe.length - 1; i++) {
      const a = axe[i]!;
      const b = axe[i + 1]!;
      if (y <= a.y && y >= b.y) return a.x + ((b.x - a.x) * (a.y - y)) / (a.y - b.y || 1);
    }
    return cx;
  };
  const demiLargeur = (t: number) => (espalier ? 19 - t * 14 : 25 - t * 19);
  const gauche = axe.map((p, i) => ({ x: p.x - demiLargeur(i / n), y: p.y }));
  const droite = axe.map((p, i) => ({ x: p.x + demiLargeur(i / n), y: p.y })).reverse();
  const troncPath = lisser([...gauche, ...droite], true);

  /* ── Les branches : anciennes en bas, récentes vers la cime ── */
  const branches: BranchePlacee[] = [];
  let yCursor = yBase - 130;
  let cote: -1 | 1 = espalier ? 1 : rng() < 0.5 ? -1 : 1;

  for (const groupe of groupes) {
    const nb = groupe.entrees.length;
    const grappe = !espalier && nb > 3;
    const dims = grappe ? COMPACT : NORMAL;
    const yB = yCursor;
    const depart = { x: xTronc(yB), y: yB };
    const longueur = espalier ? 170 : Math.min(90 + nb * dims.dx + 40, W / 2 - 90);
    const montee = espalier ? 30 + rng() * 14 : 84 + rng() * 40;
    /* L'arc du fruitier : la branche s'élance, culmine, puis retombe. */
    const p1 = { x: depart.x + cote * longueur * 0.2, y: yB - montee * 0.55 };
    const p2 = { x: depart.x + cote * longueur * 0.62, y: yB - montee * 1.1 };
    const bout = { x: depart.x + cote * longueur, y: yB - montee * 0.84 };

    const pts: Pt[] = [];
    for (let i = 0; i <= 12; i++) pts.push(surCubique(depart, p1, p2, bout, i / 12));

    const [seg1, seg2, seg3] = segmenterBranche(pts);
    const segments: SegmentTrait[] = [
      { d: seg1!, largeur: 3.6 },
      { d: seg2!, largeur: 2.2 },
      { d: seg3!, largeur: 1.25 },
    ];

    const brindilles: string[] = [];
    for (let k = 0; k < 2 + Math.round(rng()); k++) {
      const b = pts[5 + Math.floor(rng() * 7)]!;
      const long = 22 + rng() * 22;
      const vers = rng() < 0.75 ? -1 : 1;
      brindilles.push(
        `M${b.x.toFixed(1)} ${b.y.toFixed(1)} C${(b.x + cote * long * 0.4).toFixed(1)} ${(b.y + vers * long * 0.3).toFixed(1)}, ${(b.x + cote * long * 0.8).toFixed(1)} ${(b.y + vers * long * 0.85).toFixed(1)}, ${(b.x + cote * long).toFixed(1)} ${(b.y + vers * long).toFixed(1)}`,
      );
    }

    /* Les fruits pendent du rameau ; en grappe, deux niveaux en quinconce. */
    const fruits: FruitPlace[] = [];
    groupe.entrees.forEach((entree, k) => {
      /* Espalier : les fruits pendent en pile sous la branche, un par étage. */
      const t = espalier
        ? Math.min(0.92, 0.55 + k * 0.13)
        : nb === 1
          ? 0.82
          : 0.3 + (0.66 * k) / (nb - 1);
      const attache = surCubique(depart, p1, p2, bout, t);
      const pend = espalier
        ? 28 + k * (dims.h + 28)
        : grappe
          ? k % 2 === 0
            ? 34
            : 138
          : 36 + rng() * 22;
      const fx = espalier
        ? depart.x + 178 + (rng() - 0.5) * 10
        : attache.x + cote * 10 + (rng() - 0.5) * 14;
      const fyTop = attache.y + pend;
      const x = Math.min(Math.max(fx - dims.w / 2, 54), W - dims.w - (espalier ? 18 : 54));
      const cxF = x + dims.w / 2;
      fruits.push({
        entree,
        x,
        y: fyTop,
        w: dims.w,
        h: dims.h,
        rotation: (rng() - 0.5) * (grappe ? 3.4 : 2),
        pedoncule: `M${attache.x.toFixed(1)} ${attache.y.toFixed(1)} C${(attache.x + cote * 4).toFixed(1)} ${(attache.y + pend * 0.45).toFixed(1)}, ${cxF.toFixed(1)} ${(fyTop - pend * 0.4).toFixed(1)}, ${cxF.toFixed(1)} ${fyTop.toFixed(1)}`,
        attache,
        greffe: entree.greffe
          ? (() => {
              const gx = (attache.x + cxF) / 2;
              const gy = attache.y + pend * 0.42;
              return `M${(gx - 6).toFixed(1)} ${(gy - 4).toFixed(1)} L${(gx + 6).toFixed(1)} ${(gy + 1).toFixed(1)} M${(gx - 6).toFixed(1)} ${(gy + 2).toFixed(1)} L${(gx + 6).toFixed(1)} ${(gy + 7).toFixed(1)}`;
            })()
          : undefined,
        compact: grappe,
        note: { x: 0, y: 0, versDroite: true },
      });
    });

    branches.push({
      id: groupe.id,
      label: groupe.label,
      cote,
      depart,
      bout,
      segments,
      brindilles,
      axe: pts,
      anneau: { x: depart.x + cote * 22, y: yB - 4 },
      /* En espalier, le label s'écarte du trait qui monte à travers. */
      labelPos: espalier
        ? { x: depart.x + 44, y: yB - montee - 14 }
        : { x: depart.x + cote * 40, y: yB - 16 },
      fruits,
      grappe,
    });

    yCursor -= espacement(groupe);
    cote = (cote * -1) as -1 | 1;
  }

  /* ── Anti-chevauchement : on allonge le pédoncule du fruit le plus bas ── */
  const tous = branches.flatMap((b) => b.fruits);
  for (let passe = 0; passe < 3; passe++) {
    for (let i = 0; i < tous.length; i++) {
      for (let j = i + 1; j < tous.length; j++) {
        const a = tous[i]!;
        const b = tous[j]!;
        if (!seCoupent(a, b, 14)) continue;
        const bas = a.y >= b.y ? a : b;
        const haut = bas === a ? b : a;
        const pousse = haut.y + haut.h + 16 - bas.y;
        bas.y += pousse;
        const cxF = bas.x + bas.w / 2;
        bas.pedoncule = `M${bas.attache.x.toFixed(1)} ${bas.attache.y.toFixed(1)} C${bas.attache.x.toFixed(1)} ${(bas.attache.y + (bas.y - bas.attache.y) * 0.45).toFixed(1)}, ${cxF.toFixed(1)} ${(bas.y - (bas.y - bas.attache.y) * 0.4).toFixed(1)}, ${cxF.toFixed(1)} ${bas.y.toFixed(1)}`;
      }
    }
  }

  /* ── Annotations : côté libre en portrait, sous le fruit en espalier ── */
  const NOTE_W = 248;
  for (const f of tous) {
    if (espalier) {
      f.note = {
        x: Math.min(Math.max(f.x + f.w / 2 - NOTE_W / 2, 12), W - NOTE_W - 12),
        y: f.y + f.h + 12,
        versDroite: true,
        sous: true,
      };
      continue;
    }
    const versDroite = f.x + f.w + 16 + NOTE_W < W - 24;
    f.note = {
      x: versDroite ? f.x + f.w + 14 : f.x - 14 - NOTE_W,
      y: Math.max(24, f.y + 4),
      versDroite,
    };
  }

  /* ── Le bourgeon : la collecte continue ── */
  const cime = axe[axe.length - 1]!;
  const pointe = { x: cime.x + 26, y: cime.y - 44 };
  const bourgeon = {
    path: `M${cime.x.toFixed(1)} ${cime.y.toFixed(1)} C${(cime.x + 4).toFixed(1)} ${(cime.y - 20).toFixed(1)}, ${(pointe.x - 8).toFixed(1)} ${(pointe.y + 14).toFixed(1)}, ${pointe.x.toFixed(1)} ${pointe.y.toFixed(1)}`,
    pointe,
    label: { x: pointe.x + 14, y: pointe.y + 4 },
  };

  /* ── Étiquette gravée à la base + échelle de relevé ── */
  const etiquetteW = Math.min(460, W - 90);
  const etiquette = {
    x: espalier ? 45 : W / 2 - etiquetteW / 2,
    y: H - 116,
    w: etiquetteW,
    h: 70,
  };
  const graduations: ArbreLayout['graduations'] = [];
  for (let y = yBase; y >= ySommet - 40; y -= 40) {
    const majeure = Math.round((yBase - y) / 40) % 5 === 0;
    graduations.push({ y, majeure, valeur: Math.round((yBase - y) / 10) });
  }

  const pied = axe[0]!;
  const racines = [-1, 1].flatMap((r) => [
    `M${(pied.x + r * 14).toFixed(1)} ${(pied.y - 22).toFixed(1)} C${(pied.x + r * 30).toFixed(1)} ${(pied.y - 6).toFixed(1)}, ${(pied.x + r * 52).toFixed(1)} ${pied.y.toFixed(1)}, ${(pied.x + r * 74).toFixed(1)} ${(pied.y + 4).toFixed(1)}`,
    `M${(pied.x + r * 8).toFixed(1)} ${(pied.y - 8).toFixed(1)} C${(pied.x + r * 20).toFixed(1)} ${(pied.y + 2).toFixed(1)}, ${(pied.x + r * 34).toFixed(1)} ${(pied.y + 6).toFixed(1)}, ${(pied.x + r * 46).toFixed(1)} ${(pied.y + 8).toFixed(1)}`,
  ]);
  const sol = { x1: pied.x - 130, x2: pied.x + 130, y: pied.y + 10 };

  return {
    largeur: W,
    hauteur: H,
    troncPath,
    racines,
    sol,
    troncAxe: axe,
    branches,
    bourgeon,
    etiquette,
    depuis: Math.min(...entrees.map((e) => e.annee)),
    graduations,
  };
};
