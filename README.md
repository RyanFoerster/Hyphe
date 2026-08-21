# studio Hyphe

Site de la station d'observation « studio Hyphe » — Liège.
Portage en **Astro + Tailwind CSS v4** de la maquette Claude Design
(`ok les gars.dc.html`, design system *Écosystème*).

## Le principe : la loupe de terrain

Tout le site est piloté par un seul curseur, `t ∈ [0,1]`, en bas à droite.

| `t` | Régime | Ce qu'on voit |
| --- | --- | --- |
| `0` | **papier** | Planche imprimée, encre noire sur papier crème, voix du naturaliste |
| `1` | **nuit** | Station de nuit, bioluminescence sur humus, voix de l'instrument |

Deux fondus **décorrélés** tournent en parallèle :

- les **surfaces** (fonds, scrims) suivent `t` linéairement ;
- l'**encre** (texte, accents, courbes) suit `uInk`, une bascule raide autour de
  0,5 — sans quoi le texte croiserait le fond dans la zone morte de contraste,
  au milieu du fondu.

`uInk` est exposé aux composants par `--mix` (0→1) et `--mixp` (0%→100%, pour
`color-mix()`). Le motif signature du site en découle : deux couches empilées
(`.stack`), l'une en `.fade-nat`, l'autre en `.fade-tel` — le même fait, dit par
le naturaliste puis par la machine.

## Architecture

```
src/
├── assets/plates/       planches gravées (Haeckel, domaine public)
├── components/
│   ├── chrome/          en-tête, rail de position, loupe, canevas, pied
│   ├── ui/              primitives du design system (Button, Field, Card…)
│   ├── home/            les six stades de la page d'accueil
│   ├── herbier/         filtres, planches épinglées, tableau de télémétrie
│   ├── specimen/        les huit blocs d'une fiche de spécimen
│   ├── espece/          les blocs d'une fiche d'espèce
│   ├── contact/         relevé de contact
│   └── legal/           gabarit des pages légales
├── data/                le contenu, une entrée par spécimen / espèce
├── layouts/             BaseLayout — head, chrome persistant, entrée client
├── lib/                 helpers purs (télémétrie déterministe, navigation)
├── pages/               les routes
├── scripts/             le comportement client
├── styles/global.css    tokens du design system → thème Tailwind
└── types/               le contrat de contenu
```

### Le contenu vit dans `src/data/`

Aucun texte n'est écrit en dur dans un composant. Les placeholders
`[entre crochets]` attendent le contenu réel :

- `specimens.ts` — un objet par projet, avec sa planche et sa télémétrie ;
- `especes.ts` — les deux moitiés de l'organisme ;
- `site.ts`, `navigation.ts`, `seasons.ts`, `manifesto.ts`, `legal.ts`,
  `contact.ts`, `annotations.ts`.

`types/content.ts` décrit ces formes ; le build échoue si une fiche est
incomplète.

### Le comportement vit dans `src/scripts/`

| Fichier | Rôle |
| --- | --- |
| `mix-runtime.js` | Le moteur de régime. **Injecté en clair dans le `<head>`** : le régime doit être posé sur la première frame, sinon la page clignote. Expose `window.__ecoMix`. |
| `dormance-runtime.js` | Le stade zéro : la dormance. **Injecté en clair en tête de `<body>`**, avant tout paint — voir ci-dessous. |
| `eco-canvas.ts` | `<eco-canvas>` — l'organisme de fond : racines ramifiées, mycélium, pollen, trace du curseur. Écoute `eco:mix`, `eco:growth`, `eco:route`. |
| `loupe.ts` | Branche le curseur sur le moteur. |
| `growth.ts` | Le scroll fait pousser l'organisme et accumule de la biomasse. |
| `stage-rail.ts` | Le rail de gauche suit le stade traversé (IntersectionObserver). |
| `route.ts` | Annonce la route au canevas, qui recompose sa disposition. |
| `herbier.ts` | Filtres et tri, partagés par les deux vues de l'herbier. |
| `contact-form.ts` | Validation puis remise au client mail (aucun serveur). |
| `app.ts` | Point d'entrée : remonte tout à chaque `astro:page-load`. |

Le canevas est marqué `transition:persist` : il ne repousse jamais depuis zéro
quand on change de page. Le régime est reposé sur `astro:after-swap`, avant que
la nouvelle vue ne soit peinte.

### L'arbre de collecte — la vue naturaliste de l'herbier

La collection est un seul grand arbre gravé : tronc = le studio, branches =
les années (éclatées en saisons quand la densité le justifie), fruits = les
projets. La topologie vit dans `lib/arbre.ts` — layout entièrement calculé
(4 à 20 projets sans refonte, anti-chevauchement, grappes en quinconce,
bruit LCG déterministe) — et sert les deux projections :

- **portrait** (desktop) : la planche pleine page, branches alternées ;
- **espalier** (mobile, `< md`) : tronc à gauche, fruits empilés le long du
  scroll vertical — pas de pan 2D, cibles tactiles ≥ 44 px.

La vérité sémantique est une liste de liens (`ListeSpecimens`), rendue une
fois ; les deux SVG sont `aria-hidden`. Le focus clavier parcourt la liste
et active le fruit correspondant. La croissance d'entrée (≤ 1,5 s, cadence
calculée selon la densité) parle le langage de la radicule du loader ;
`prefers-reduced-motion` montre l'arbre déjà poussé. Un clic sur un fruit
est une navigation ordinaire : le cartouche est un vrai `<a href>`, le
routeur d'Astro fait le reste — aucune chorégraphie de transition. Au
survol, le **hover sporulant** (`scripts/sporulation.ts`) fait respirer la
planche : turbulence de plume (feTurbulence + feDisplacementMap sur le seul
cartouche survolé), contour dédoublé qui dérive, encre qui respire, spores
qui montent — scanline et aberration cyan/corail en télémétrie. Pointeur
fin uniquement, jamais en reduced-motion, coupé si le frame budget est
dépassé ; `?hover=slow` (0,25×) et `?hover=2x` (amplitude double) pour la
mise au point. Au repos, les styles inline écrits par l'effet rendent la
main à la valeur du markup (le *socle* : `--img-filter` sur la planche,
l'axe `WONK` sur le latin) plutôt que d'être vidés. Le filtre et les spores
sont uniques par planche : seul le foyer *porteur* les pilote, et un fruit
qui se calme ne les remet pas à zéro sous les pieds du suivant. Re-survoler
un fruit encore en train de se calmer reprend son enveloppe où elle en est.

Les deux vues sont empilées dans la même cellule de grille (le motif
`.stack`), donc le conteneur suivait la plus haute des deux — l'arbre fait
~1300 px, le tableau ~240 : en télémétrie on héritait d'un scroll vide.
Celle qui est effacée **sort du flux** (`.vue-repliee`), aux extrêmes de la
courbe d'encre seulement — là où son opacité est déjà nulle, donc rien ne
saute. La courbe voyage dans `eco:mix` (`detail.encre`) plutôt que d'être
recalculée : un seul endroit la définit, `mix-runtime.js`.

Au passage de la loupe, la **charpente** (`scripts/charpente.ts`) redresse le même graphe vers les lignes du tableau
de télémétrie — une source topologique, deux rendus.

La page `/dev/arbre` (hors navigation) montre les silhouettes à 4, 12 et
20 projets, portrait et espalier — l'outil de recette du layout.

### La dormance — le loader d'entrée

Avant la spore du hero, le stade zéro : une graine germe pendant que le site
charge, dans le régime que la loupe impose (gravure à l'encre sur papier /
nœud bioluminescent dans la nuit — même géométrie, seul le rendu change).
La radicule descend au rythme du **vrai** chargement, par paliers pondérés :

| Étape | Signal réel | Poids |
| --- | --- | --- |
| typographies | `document.fonts.check()` sur Fraunces + JetBrains Mono | 0,45 |
| simulation | `eco:ready` — premier frame dessiné par `<eco-canvas>` | 0,35 |
| collecte | l'évènement `load` de la fenêtre | 0,20 |

Les textes (compteur, « profondeur : NN mm », boot log avec latences mesurées)
disent les paliers bruts ; seule la géométrie est lissée, et ne recule jamais.

Règles de conduite :

- **première visite de la session** (flag `dormance-vue` absent du
  sessionStorage) : la dormance se joue toujours, 1,2 s, en mode narratif —
  la radicule pousse sur la durée, les paliers sur le temps ; le boot log,
  lui, dit toujours les vraies latences. La scène est dévoilée deux frames
  après le premier paint, pour que FCP et LCP restent mesurés sur un paint
  léger. Le flag est posé à la fin ;
- chargements suivants : prêt en moins de **300 ms** → rien n'est montré ;
- scène montrée → **1,2 s** minimum de lisibilité ;
- chien de garde à **8 s** → entrée forcée, l'organisme se densifie après coup ;
- chargement initial uniquement — les échanges de vue ne le remontent jamais ;
- le site reste peint sous le voile opaque : le LCP est mesuré sur le vrai
  contenu, pas sur le loader (vérifié par Lighthouse, score inchangé) ;
- `prefers-reduced-motion` : prioritaire — jamais de dormance forcée, graine
  fixe + barre fine par paliers, durée minimale à zéro ;
- sans JavaScript, le loader n'existe pas — c'est lui qui est monté par JS ;
- tout est inline (SVG + CSS), aucun asset propre ; tout est démonté à la fin.

Le handoff : la radicule plonge rejoindre la bande mycélium, la graine se
contracte puis rejoint la position **mesurée** de la spore du hero
(`[data-hero-spore]`, même référentiel DOM), et le voile s'efface sur un site
déjà peint — jamais de fondu au blanc ou au noir.

Recette : `?loader=slow` simule un réseau lent (paliers visibles),
`?loader=force` remontre la dormance même en cache chaud.

### Les tokens vivent dans `src/styles/global.css`

Les jetons du design system sont déclarés une seule fois, dans `@theme`, et
deviennent des utilitaires Tailwind : `text-nat-100`, `bg-bg-1`, `shadow-card`,
`ease-eco`, `duration-fast`, `rounded-plate`… Le moteur de régime réécrit
exactement ces mêmes variables en style inline sur `<html>`, ce qui fait tenir
le fondu sans une seule ligne de CSS dupliquée.

## Routes

| URL | Contenu |
| --- | --- |
| `/` | Les six stades : spore, germination, symbiose, spécimens, saisons, pollinisation |
| `/herbier` | La collection — l'arbre de collecte ⇄ tableau de télémétrie |
| `/herbier/[slug]` | Fiche de spécimen, huit blocs |
| `/espece/designer`, `/espece/dev` | Fiches d'espèce |
| `/pollinisation` | Relevé de contact |
| `/mentions-legales`, `/confidentialite` | Pages légales |
| `/404` | Spécimen non répertorié |

## Développement

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
npm run check
```

Le site est entièrement statique : `npm run build` produit `dist/` (format
fichier, sans slash final).

## Reste à faire

- Remplacer les placeholders `[entre crochets]` de `src/data/`.
- Remplacer les planches de `src/assets/plates/` par les visuels projet
  (les gravures de Haeckel sont provisoires — domaine public).
- Compléter les textes légaux avec votre conseil.
- Auto-héberger les trois familles typographiques (Fraunces, JetBrains Mono,
  Figtree) si vous voulez couper la dépendance à Google Fonts.
