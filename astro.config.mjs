// @ts-check
import { readFile } from 'node:fs/promises';

import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { transform } from 'esbuild';

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
  site: 'https://studiohyphe.be',
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: {
    plugins: [tailwindcss(), inlineScript()],
  },
});
