// @ts-check
import { readFile } from 'node:fs/promises';

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { transform } from 'esbuild';

import { site } from './src/data/site.ts';

/**
 * `import source from './x.js?inline-script'` → le code de `x.js`, minifié,
 * sous forme de chaîne. Sert aux scripts qu'on injecte en clair dans le
 * `<head>` : la source reste commentée, la page ne transporte que l'essentiel.
 * @returns {import('vite').Plugin}
 */
const inlineScript = () => ({
  name: 'hyphe:inline-script',
  async load(id) {
    const [file, query] = id.split('?');
    if (query !== 'inline-script' || !file) return null;
    const { code } = await transform(await readFile(file, 'utf8'), {
      loader: 'js',
      minify: true,
    });
    return `export default ${JSON.stringify(code)};`;
  },
});

export default defineConfig({
  site: site.url,
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss(), inlineScript()],
  },
});
