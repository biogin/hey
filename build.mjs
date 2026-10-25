// Bundles the app into two self-contained outputs:
//   dist/index.html     a complete page (GitHub Pages, Vercel, any static host)
//   dist/artifact.html  the same page as a body fragment for hosts that supply their own skeleton
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const result = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: ['es2020'], charset: 'utf8', write: false, legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles[0].text;
const css = readFileSync('styles.css', 'utf8');
const page = readFileSync('src/page.html', 'utf8');
const title = 'Kairos Engine';
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Golos+Text:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,500;1,500;1,600&family=JetBrains+Mono:wght@400;600&display=swap">';

mkdirSync('dist', { recursive: true });
const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="An interactive 3D time machine through music epochs. Travel Chronos, find Kairos: the moments when skill, environment and cultural need aligned.">
<meta name="theme-color" content="#060912">
${fonts}
<style>
${css}
</style>
</head>
<body>
${page}
<script>
${js}
</script>
</body>
</html>`;
writeFileSync('dist/index.html', full);

const fragment = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>
${css}
</style>
${page}
<script>
${js}
</script>`;
writeFileSync('dist/artifact.html', fragment);
console.log(`built dist/index.html (${(full.length / 1024).toFixed(0)} KB) and dist/artifact.html (${(fragment.length / 1024).toFixed(0)} KB)`);
