export type Regime = 'naturaliste' | 'telemetrie';

/** Paire de libellés : le même fait, dit par le naturaliste puis par l'instrument. */
export interface DualLabel {
  nat: string;
  tel: string;
}

export interface Pigment {
  /** Couleur relevée, en hexadécimal. */
  hex: string;
  /** Nom du pigment tel que noté sur le carnet. */
  nom?: string;
}

export interface Resultat {
  valeur: string;
  label: string;
}

export interface Temoignage {
  texte: string;
  nom: string;
  fonction: string;
  /** Horodatage affiché en vue télémétrie. */
  ts: string;
}

export type StatutSpecimen = 'stable' | 'croissance' | 'dormance';

/** Famille de livrable — sert aux filtres de l'herbier et aux offres. */
export type FamilleLivrable = 'site' | 'app';

/** Le nom commun du livrable : ce que le client a réellement reçu. */
export interface Livrable {
  /** Libellé de tous les jours : « Site e-commerce », « Application SaaS »… */
  label: string;
  famille: FamilleLivrable;
}

export interface Specimen {
  slug: string;
  num: string;
  nom: string;
  latin: string;
  client: string;
  collecte: string;
  mission: string;
  techs: string[];
  statut: StatutSpecimen;
  livrable: Livrable;
  resume: string;

  /* Télémétrie */
  stack: string;
  prod: string;
  uptime: string;
  bundle: string;
  lighthouse: string;
  ttfb: string;
  requetes: string;
  cout: string;

  /* Fiche */
  planche: ImageMetadata;
  noteNat: string;
  noteTel: string;
  pigments: Pigment[];
  typo: string;
  espacement: string;
  morpho: DualLabel[];
  rejets: string[];
  migrations: string[];
  resultats: Resultat[];
  temoignage: Temoignage;
}

export interface Competence {
  nom: string;
  tel: string;
  niveau: number;
}

export interface EtapeFrise extends DualLabel {
  annee: string;
}

export type EspeceSlug = 'designer' | 'dev';

export interface Espece {
  slug: EspeceSlug;
  strate: string;
  eyebrow: string;
  nom: string;
  latin: string;
  annee: string;
  /** Le rôle, en toutes lettres — la première lecture de la fiche. */
  role: string;
  habitat: string;
  regime: string;
  comportement: string;
  activite: string;
  dispo: string;
  inventaire: string[];
  competences: Competence[];
  frise: EtapeFrise[];
  /** Slugs des spécimens auxquels l'espèce a contribué. */
  specimens: string[];
  /** L'autre moitié de l'organisme. */
  autre: EspeceSlug;
}

export interface Stade extends DualLabel {
  /** Ancre de la section sur la page d'accueil. */
  id: string;
}

/**
 * Libellé de navigation à double étiquetage : comme sur une planche de guide
 * naturaliste, le nom commun (littéral) précède le nom latin (poétique).
 * Sur mobile, seul le littéral survit.
 */
export interface NavLink {
  href: string;
  /** Le nom commun : « Projets », « Contact »… Toujours affiché. */
  lit: string;
  /** Le nom d'usage de la station : « l'Herbier », « Pollinisation »… */
  poetique: string;
  /** La voix télémétrie : « data.store », « net.broadcast »… */
  tel: string;
  /** Préfixes d'URL qui allument ce lien. */
  match: string[];
}

/** Une variété cultivée — l'une des trois offres du studio. */
export interface Offre {
  id: string;
  /** Le titre littéral, en grand : « Sites web », « Applications web »… */
  titre: string;
  /** La nomenclature poétique, en annotation : « floraison annuelle »… */
  poetique: string;
  /** La voix télémétrie de l'annotation. */
  tel: string;
  /** Ce que ça recouvre : « vitrines, e-commerce, portfolios ». */
  detail: string;
  /** Pour qui, quel résultat — une phrase. */
  phrase: string;
  /** Fourchette de délai indicative (placeholder accepté). */
  delai?: string;
  /** Stacks associées, montrées en vue télémétrie. */
  stacks: string;
  /** L'herbier filtré sur ce type de livrable. */
  href: string;
}

export interface Saison extends DualLabel {
  color: string;
  desc: string;
}
