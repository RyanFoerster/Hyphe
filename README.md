# Studio Hyphe

Site vitrine d'un studio d'expériences digitales (fictif). Une fleur
botanique transparente, procédurale, pousse dans un monde ASCII discret ;
les projets se lisent comme des planches d'herbier.

En ligne : https://hyphe.ryanfoerster.dev

## Pile

Astro 7 (statique) · Tailwind 4 · three.js r187 · Lenis · Web Audio
(ambiance 100 % synthétisée). Déployé sur Cloudflare (assets statiques,
voir `wrangler.jsonc`).

## Commandes

Node ≥ 22.23 (`.nvmrc`).

| Commande              | Effet                                          |
| :-------------------- | :--------------------------------------------- |
| `npm install`         | installe les dépendances                       |
| `npm run dev`         | serveur de dev sur http://localhost:4321       |
| `npx astro check`     | vérifie les types                              |
| `npm run build`       | build statique dans `dist/`                    |
| `npm run preview`     | sert `dist/` en local                          |

Les pages sont écrites en fichiers (`work/loum.html`) et servies sans
extension ni barre finale (`/work/loum`).

## Vérifier le rendu

Le WebGL ne se juge qu'en capture : `scripts/cdp-shot.mjs` pilote un Chrome
sans interface (mode d'emploi en tête du script).

## Structure

- `src/pages/` : accueil, herbier (`/work`), fiches projet
  (`/work/[slug]`), 404, visuels SVG générés (`/visuals/…`).
- `src/components/` : sections et éléments de page.
- `src/scripts/world/` : le monde 3D du hero (la fleur, la chaîne de rendu,
  l'intérieur de la fleur).
- `src/scripts/` : loader, son, transitions, texte, défilement, menu.
- `src/data/` : projets et coordonnées du studio.

Le détail (direction artistique, pièges connus, carte du code) est dans
[`CLAUDE.md`](CLAUDE.md).
