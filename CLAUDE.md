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
  année » dessous ; la 8e case est une planche vide « Yours? » qui mène au
  contact. Ryan a refusé une fleur 3D par projet et les grandes cartes larges.
  **Index** : liste, l'aperçu image suit le curseur (coins de visée, nom latin).
- `src/pages/work/[slug].astro` : fiche projet (`ProjectHero` plein écran),
  qui se termine sur `NextSpecimen` (le hero du projet suivant pousse en
  bas de page, puis on change de page sans que rien ne bouge).
- `src/pages/visuals/` : SVG génératifs calculés au build
  (`/visuals/<slug>.svg` et 6 déclinaisons `/visuals/<slug>/<n>.svg`), tracés
  par `src/lib/generative.ts` (familles topo, strata, bloom).
- `src/components/` aussi : `Herbarium.astro` (étiquette d'herbier d'un
  projet), `Figure.astro` (image qui se recompose en tuiles, légende de
  planche), `os/Window.astro` (fenêtres de la galerie).
- `src/data/projects.ts` : les 7 projets. **Réels** : Loum (studioloum.com,
  captures du site uniquement, jamais les projets de Loum) et Farmlize
  (farmlize.ryanfoerster.dev ; source sur le Mac dans
  `~/Documents/Dev/farmlize`). Les 5 autres sont fictifs.
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

- Textes rédigés par Claude à valider : fiches Farmlize, savoir-faire du
  studio (`site.ts`), coordonnées provisoires.
- Les fenêtres de la galerie (`os/Window.astro`) gardent de petits coins
  arrondis : à rendre carrés si Ryan le souhaite.
- Les volumes du son sont un premier réglage (Claude ne peut pas écouter).
