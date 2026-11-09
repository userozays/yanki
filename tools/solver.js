/* YANKI — elle tasarlanan bölümleri çözer ve kanıt verisini src/solutions.json'a yazar.
   Kullanım: node tools/solver.js [bölüm-id] */
'use strict';
const path = require('path');
const fs = require('fs');
const LEVELS = require('../src/levels.js');
const Solver = require('../src/solver.js');

const only = process.argv[2];
const out = {};
let bad = 0;
for (const def of LEVELS) {
  if (only && only !== 'all' && def.id !== only) continue;
  const r = Solver.solveLevel(def, 4, 6e6);
  delete r.raw;
  out[def.id] = r;
  if (r.par == null) bad++;
  const pr = r.proof.map(p => 'K' + p.K + ':' + (p.trivial ? 'sayım' : p.states) + (p.solvable ? '✓' : p.aborted ? '?' : '✗')).join(' ');
  console.log(def.id.padEnd(12) + ' par=' + r.par + ' adım=' + r.steps + ' hamle=' + r.moves + ' kör=' + r.blind + ' T=' + def.T + ' [' + pr + '] ' + r.ms + 'ms');
  if (r.inputs) r.inputs.forEach((s, i) => console.log('   ' + (i + 1) + ': ' + s));
}
if (!only || only === 'all') fs.writeFileSync(path.join(__dirname, '..', 'src', 'solutions.json'), JSON.stringify(out, null, 1));
process.exit(bad ? 1 : 0);
