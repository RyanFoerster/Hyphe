// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import { site } from './src/data/site.ts';

// https://astro.build/config
export default defineConfig({
  site: site.url,
  // Chaque planche est un fichier (`work/loum.html`), servie sans barre
  // finale (`/work/loum`) — la forme qu'emploient tous les liens du site et
  // celle qu'attend `html_handling` dans wrangler.jsonc.
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: {
    plugins: [tailwindcss()],
  },
});
