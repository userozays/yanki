/* YANKI — tek dosyalık çıktıyı üretir: src/* -> index.html (bağımlılık yok).
   package.json'daki "homepage" (ya da SITE_URL) varsa paylaşım önizlemesi için og etiketlerini ekler. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const sol = JSON.parse(read('solutions.json'));
const slim = {};
for (const id of Object.keys(sol)) {
  const s = sol[id];
  if (s.par == null) throw new Error('Çözümsüz bölüm: ' + id);
  slim[id] = { par: s.par, steps: s.steps, moves: s.moves, inputs: s.inputs, proof: s.proof.map(p => ({ K: p.K, solvable: p.solvable, states: p.states, trivial: !!p.trivial })) };
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const site = String(process.env.SITE_URL || pkg.homepage || '').replace(/\/+$/, '');
const og = site ? [
  '<meta property="og:url" content="' + site + '/">',
  '<meta property="og:image" content="' + site + '/og.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
].join('\n') : '';
const parts = {
  '<!--__OG__-->': og,
  '/*__CSS__*/': read('style.css'),
  '/*__CORE__*/': read('core.js'),
  '/*__LEVELS__*/': read('levels.js'),
  '/*__SOLUTIONS__*/': JSON.stringify(slim),
  '/*__SOLVER__*/': read('solver.js'),
  '/*__GEN__*/': read('gen.js'),
  '/*__GAME__*/': read('game.js'),
};
let html = read('shell.tpl');
for (const k of Object.keys(parts)) {
  if (!html.includes(k)) throw new Error('Şablonda yer tutucu yok: ' + k);
  html = html.replace(k, () => parts[k]);
}
const out = process.argv[2] || path.join(root, 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('yazıldı: ' + out + ' (' + (html.length / 1024).toFixed(1) + ' KB)' + (site ? ' · site: ' + site : ''));
