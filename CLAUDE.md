@AGENTS.md

# Studio Hyphe — portfolio

Site vitrine d'un studio d'expériences digitales (fictif : « Studio Hyphe »),
construit avec Astro 7, Tailwind 4, three.js r187 et Lenis. Déployé en statique
sur Cloudflare (voir `wrangler.jsonc`). Dépôt : github.com/RyanFoerster/Hyphe.

## Façon de travailler (préférences de Ryan)

- Échanger **en français**, sans longue narration : faire, vérifier, résumer.
- Quand une demande est terminée : **commit sur `main`, mais ne pas pousser**
  à chaque modif — pousser seulement quand Ryan le demande (chaque push
  redéploie le site).
  Messages de commit en français, qui décrivent le résultat visible
  (ex. « Le défilement ne fait plus de bruit »), terminés par
  `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Commentaires du code en français, dans le ton du projet (métaphore botanique).
- **Toujours vérifier visuellement** avant d'annoncer : le rendu WebGL ne se
  juge qu'en capture. Utiliser `scripts/cdp-shot.mjs` (Chrome sans interface,
  voir l'en-tête du script) — le panneau navigateur caché donne des captures
  figées. `npx astro check` et `npx astro build` doivent passer.
- Ne jamais rien écrire dans d'autres dépôts (ex. Farmlize) : on capture le
  site en ligne.

## Commandes

```
npm install
npx astro dev --background  # serveur de dev (http://localhost:4321)
npx astro check             # types
npx astro build             # build statique dans dist/
```

## Direction artistique (ce qui a été validé)

- **Univers** : une fleur botanique transparente, procédurale (voile tramé et
  irisé, tige spiralée, étamines, pollen), dans un monde ASCII discret.
  Fond unique partout : `--color-void` #090c0a (pas de dégradé, pas de cassure
  entre sections). Accent acide #c8f53c, os #e6e4dc.
- **Typo** : titres en Parceh (`titre`), texte en Instrument Sans, méta en
  Fragment Mono (`meta`). Sous-titres en style « texte sélectionné » : classe
  `.kicker` (fond acide, texte sombre).
- **Formes** : tout est carré/rectangulaire. **Jamais de coins arrondis ni de
  pastilles/tags.** Les cadres ont des coins de visée (`.tick`). Les infos
  supplémentaires s'ouvrent dans une fenêtre rectangulaire au survol.
- **Animations** : titres qui « germent » (`[data-split]`, lettres-graines
  avec tiges vertes), textes mono qui se déplient (`[data-scramble]`),
  transitions de page en **mosaïque de tuiles carrées** (`tiles.ts`),
  cadres acides au survol des mots (`[data-frame-word]`).
- **Ton des textes** (réécrits en novembre 2026, à la demande de Ryan) : anglais
  simple, à la première personne (« we »), humain. **Plus de latin** : ni faux
  noms d'espèces, ni « Hyphae floralis », ni « Fam. / Leg. / Loc. / Cult. / Det. »,
  ni « specimen » ou « herbarium » à l'écran (on dit « project » et « work »).
  Un seul fil du loader au contact : une idée, des racines, une tige, des
  feuilles, des pétales, la fleur (étapes du loader, loupe du hero, titres :
  « We grow websites people remember. », « Come in, look around. », « Grow
  something with us. »). Chaque projet a une accroche courte (`tagline` dans
  `projects.ts`) qui sert de titre à sa fiche. Titres en Parceh : lettres,
  espaces, virgules et points seulement (pas d'apostrophe ni de « ? »).
- **Refusé par Ryan (ne pas réintroduire)** : roche (remplacée par la fleur),
  cercles partout (seule la section studio est circulaire), morceaux de
  « code » dans le hero, le grand « 01 » derrière « Enter the specimen »,
  la section Seed/Grow/Bloom, le fil animé « mycelium » en haut du studio,
  le filigrane « Hyphe » et la barre du bas du footer, les voiles/ombres sous
  l'en-tête, le son lié à la vitesse de défilement, les tags arrondis.

## Carte du code

- `src/pages/index.astro` : World (WebGL) + Hero + Work (galerie), puis Studio
  et Footer.
- `src/pages/work/index.astro` : l'herbier, deux lectures. **Sheets** : grille
  serrée (4 colonnes ≥ 1280 px, 3, 2, 1), planches toutes en 4:5 avec
  l'étiquette d'herbier *dans* la photo (dépliée au survol), une ligne « nom —
  année » dessous ; la dernière case est une planche vide « Yours? » qui mène au
  contact. Ryan a refusé une fleur 3D par projet et les grandes cartes larges.
  **Index** : liste, l'aperçu image suit le curseur (coins de visée, accroche du projet).
- `src/pages/work/[slug].astro` : fiche projet (`ProjectHero` plein écran). **Pas de
  pied de page au fond d'un projet**, décidé par Ryan : la fiche se termine sur
  `NextSpecimen.astro`, un seul écran épinglé avec, à gauche, le nom du projet
  suivant, une phrase et « Enter … → », et à droite sa planche en miniature dans
  son cadre (sur téléphone : la planche en haut, le texte dessous). En continuant
  de défiler (« keep scrolling »), le texte s'efface, la planche grandit jusqu'à
  remplir l'écran (c'est le hero suivant, `ProjectHero` en mode `next`), puis on
  change de page sans que rien ne bouge. Le bouton et la planche font défiler
  jusque-là. Ryan a refusé deux autres fins : le contact à gauche et le projet
  suivant à droite dans le même écran (« bizarre, le projet dans le footer »),
  puis le vrai pied de page sous le bloc avec changement de page au clic (il
  tient au changement de page au défilement). `Ticker.astro` : le bandeau qui
  ouvre le pied de page des autres pages.
- `src/pages/404.astro` + `src/scripts/lost.ts` : la page perdue est un jeu qui
  prend toute la page (chargé sur cette page seulement), piloté à la souris.
  **On dessine ses plantes** : on appuie sur le sol et on tire, la tige suit le
  curseur, des feuilles sortent en chemin, la fleur s'ouvre quand on relâche.
  Dans le ciel, « 4 0 4 » en blocs de caractères : une plante qui atteint un
  chiffre le remplace par une fleur. La sève est comptée (le premier chiffre est
  à portée, les deux autres demandent de passer par les grains de pollen, qui en
  redonnent). Sans appuyer, la souris fait du **vent**, écrit en caractères
  derrière le curseur : il pousse le pollen et couche les plantes. Chrono,
  meilleur temps (`localStorage hyphe:lost-best`), puis on plante librement.
  Clavier : flèches + espace (viseur à coins). Ryan a refusé une première
  version à un seul bouton (« maintenir pour pousser ») : pas assez interactive.
  La terre, les chiffres et le vent sont une couche de caractères calée sur la
  grille de `createPost` ; le vent est un champ d'une case par caractère. Sons
  composés avec `kit` (`sound.ts`). Sans WebGL, ou sous
  `prefers-reduced-motion`, la page reste fixe (graine en caractères, mêmes
  liens, bouton « Play anyway »). En dev, `window.__lost` (`auto`, `blow`,
  `win`, `state`) pilote la partie pour les captures ; `cdp-shot.mjs` accepte
  `"media"` pour simuler `prefers-reduced-motion`.
- `src/pages/visuals/` : SVG génératifs calculés au build
  (`/visuals/<slug>.svg` et 6 déclinaisons `/visuals/<slug>/<n>.svg`), tracés
  par `src/lib/generative.ts` (familles topo, strata, bloom).
- `src/components/` aussi : `Herbarium.astro` (étiquette d'herbier d'un
  projet), `Figure.astro` (image qui se recompose en tuiles, légende de
  planche), `os/Window.astro` (fenêtres de la galerie).
- `src/data/projects.ts` : les projets, **tous réels** : Loum (studioloum.com,
  captures du site uniquement, jamais les projets de Loum), Farmlize
  (farmlize.ryanfoerster.dev ; source sur le Mac dans
  `~/Documents/Dev/farmlize`) et Road to Glory (belgium.ryanfoerster.dev,
  « Belgium 2018 », slug `belgium-2018` ; source sur le PC dans
  `Documents/EditoBelgique`, lecture seule). Les cinq projets fictifs du début ont été
  retirés en novembre 2026, à la demande de Ryan : ne pas en réinventer. La
  galerie de l'accueil montre les quatre premiers ; tant qu'il y en a moins,
  la fin de galerie dit « That was all of them, for now ».
  Les images de la fiche Farmlize sont sept planches fixes composées (pages,
  composants isolés, illustrations), dans l'esprit des références de Ryan : tout
  vient de captures du site en ligne, sans texte ajouté. Leur source
  (`cases/farmlize/planches.html` et ses pièces) reste hors git, comme `social/`.
  **Road to Glory** est un projet du studio, pas une commande : `client:
  'Ourselves'`, aucun client à inventer. Son nom s'écrit sans « 2018 » parce que
  Parceh n'a pas de chiffres. Sa fiche a sept planches du même style et trois
  courtes boucles vidéo (l'écran enregistré, posé sur le même aplat que les
  planches), plus la vidéo du haut de page. Sources dans `cases/belgium/` (hors
  git) : `pick.mjs` isole un élément du site sur fond transparent, `pages.mjs`
  capture des vues, `rec.mjs` enregistre une séquence, `planches.html` compose,
  `export.mjs` puis `finals.mjs` exportent en webp avec `sharp`, `montage.sh`
  monte les vidéos avec `ffmpeg`. Le site montre des photos de Wikimedia Commons
  (CC BY-SA 3.0 et CC BY 4.0) : celles que l'on voit dans les images de la fiche
  sont relevées dans `cases/belgium/credits.json` et créditées par le champ
  `credits` du projet, affiché sous « What we did ». **À refaire si une planche
  ou une vidéo change.**
- `src/lib/seo.ts` : tout ce que lisent les moteurs et les réseaux — titres et
  descriptions des fiches, textes alternatifs des couvertures, données
  structurées JSON-LD (studio, site, page, fil d'Ariane, projet). Le `<head>`
  est dans `Layout.astro` (props `title` complet, `description`, `image`,
  `noindex`, `schema`). `src/pages/sitemap.xml.ts` et `robots.txt.ts` sont
  écrits à la main ; `public/_headers` règle le cache chez Cloudflare.
  **Honnêteté** : pas d'adresse postale, de téléphone, d'avis ni de client dans
  le JSON-LD ; les projets fictifs portent `concept: true` (`projects.ts`) et
  sortent en `creativeWorkStatus: Concept` ; les réseaux n'entrent dans
  `sameAs` que lorsque `site.socials` pointe vers de vrais profils.
- `public/og/*.jpg` : images de partage 1200 × 630 (l'accueil et chaque
  projet), des captures du hero. À refaire quand un hero change :
  `astro build`, `astro preview --port 4322`, Chrome sans interface, puis
  `node scripts/cdp-shot.mjs 9333 public/og scripts/og-jobs.json` (ajouter le
  projet dans `og-jobs.json`). Un projet sans son `.jpg` a une carte cassée.
- `src/data/site.ts` : coordonnées (provisoires), savoir-faire avec texte et
  spécialités (affichés dans les fenêtres de la corolle du studio).
- `src/scripts/world/` : le monde 3D du hero.
  - `artefact.ts` : la fleur procédurale (+ `petalGeometry`, `veilMaterial`,
    `Strands`, `Blooms` réutilisés ailleurs).
  - `post.ts` : chaîne de rendu (tons ACES, halo, aura en caractères, ASCII,
    lentilles, fondus). Uniforms `uBg`, `uVignette`, `uFloor` pour les toiles
    isolées.
  - `index.ts` : orbite à la main, loupe qui nomme les parties de la plante,
    plongée dans la fleur (`d`), galerie intérieure, transition typo hero →
    galerie (`--hx`, `--tin`, `--tout`, `--num`).
  - `cavern.ts`, `overlay.ts` : intérieur de la fleur, annotations.
  - `shared.ts` : bruit GLSL, mélange additif, atlas de caractères, et la
    convention d'alpha de la cible (0 vide, 1 matière → ASCII, 2 image nette).
- `src/scripts/specimen.ts` : fleurs isolées hors du monde, rendues avec
  `createPost` (même look que le hero) : `corolla` (studio, repères au bout des
  pétales + fenêtres), `footer`, `drift` (fin de galerie : pétales et pollen
  qui flottent ; ils fondent avant les bords de la toile).
  `plant()` accepte aussi `veil` (teinte), `shape` (port des pétales), `variant`.
- `src/scripts/loader.ts` : loader en planche de germination, plein écran, au
  rythme du chargement : graine, racines en caractères sous la ligne de sol,
  tige le long d'une règle d'herbier (mm), voile irisé avec halo et aura en
  caractères (comme le hero), légendes « fig. a–f », étiquette d'herbier qui
  se remplit (≥ 1280 px), grand compteur. À la première visite de la session :
  choix « Enter with sound / in silence ». Sortie : la planche se consume en
  caractères, front **carré** depuis le cœur de la fleur, la vraie fleur se
  recompose derrière. En dev, `?loader=0.4` fige la croissance et
  `?loader=burn:0.4` la sortie (pour les captures).
- `src/scripts/sound.ts` : ambiance sonore 100 % synthétisée (Web Audio, aucun
  fichier) : nappe d'accords, air, pollen, sons de survol/clic/menu/pages/
  plongée/spécimens/loader. Bouton `[data-sound-toggle]` dans l'en-tête
  (à droite), choix mémorisé (`localStorage hyphe:sound`). Le défilement ne
  doit jamais déclencher de sons en rafale.
- `src/scripts/` aussi : `tiles.ts` (transitions), `text.ts` (split/scramble),
  `scroll.ts` (Lenis), `island.ts` (menu en île), `ascii.ts`.
- `src/components/Nav.astro` : logo + Son + heure en `mix-blend-mode:
  exclusion` (hors du header), l'île de menu au centre.

## Pièges connus

- Les toiles WebGL isolées : la lumière additive à alpha nul disparaît sur une
  toile transparente dans Chrome → passer par `createPost` (qui écrit sa
  propre opacité) ou une toile opaque.
- `scramble()` garde le texte final en cache (`data-scramble-text`) : le
  mettre à jour avant de rappeler `scramble` avec un nouveau texte.
- Les styles scopés Astro l'emportent sur les utilitaires Tailwind
  (`md:hidden` sur un élément qui a un `display` dans `<style>` ne marche pas).
- Le hero attend `html.is-unveiling` (fin des tuiles du loader) pour germer.
- Les navigateurs exigent un geste avant de jouer du son ; la molette ne
  compte pas.
- Pages écrites en fichiers (`build.format: 'file'`, `trailingSlash:
  'never'`) : liens internes sans barre finale (`/work/loum`), et
  `Astro.url.pathname` vaut `/work/loum.html` (et `/index.html`) au build :
  toujours passer par `pagePath()` (`src/lib/path.ts`). `wrangler.jsonc` sert ces fichiers sans
  extension ; rien ne tourne côté serveur.
- Déploiement : Workers Builds de Cloudflare, à chaque push sur `main`. Un
  échec « 504 Gateway Timeout » sur `…/workers/scripts/hyphe/versions` vient
  de leur API, pas du site : relancer le build (ou pousser à nouveau).
  L'état de chaque commit se lit dans les checks GitHub
  (`api.github.com/repos/RyanFoerster/Hyphe/commits/<sha>/check-runs`).

## À relire / ouvert

- Textes rédigés par Claude à valider : fiches Farmlize et Road to Glory (et
  son nom, choisi faute de chiffres en Parceh), savoir-faire du studio
  (`site.ts`), coordonnées provisoires.
- Road to Glory : les photos des planches sont sous CC BY-SA (partage à
  l'identique). Elles sont créditées sur la fiche ; à Ryan de dire s'il veut
  aller plus loin (planches sans photo, ou mention de licence sur les images).
- Les fenêtres de la galerie (`os/Window.astro`) gardent de petits coins
  arrondis : à rendre carrés si Ryan le souhaite.
- Les volumes du son sont un premier réglage (Claude ne peut pas écouter).
