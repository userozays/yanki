/* Üreteci dener: birkaç tohum için bulmaca üretir, süreyi ve sonucu yazar; belirlenimciliği sınar. */
'use strict';
try { require('os').setPriority(require('os').constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* önemli değil */ }
const Gen = require('../src/gen.js');
const Core = require('../src/core.js');
const Solver = require('../src/solver.js');

const from = +(process.argv[2] || 1), count = +(process.argv[3] || 8), quiet = process.argv[4] === 'q';
let fails = 0, tot = 0, none = 0;
const hist = {};
for (let seed = from; seed < from + count; seed++) {
  const t0 = Date.now(), r = Gen.generate(seed), ms = Date.now() - t0;
  tot += ms;
  if (!r) { none++; console.log('tohum ' + seed + ': bulunamadı (' + ms + 'ms)'); continue; }
  const again = Gen.generate(seed);
  if (JSON.stringify(again.def.map) !== JSON.stringify(r.def.map)) { fails++; console.log('BELİRLENİMCİ DEĞİL: ' + seed); }
  // bağımsız doğrulama: çözüm gerçekten kazanıyor mu, par bir altı gerçekten imkânsız mı
  const L = Core.parseLevel(r.def), sim = Core.simulate(L, r.sol.inputs.map(Core.decodeInputs), L.T, false);
  if (sim.winAt !== r.sol.steps) { fails++; console.log('ÇÖZÜM TUTMUYOR: ' + seed); }
  if (r.sol.par > L.cores.length && r.sol.par > 1) {
    const lower = Solver.solveK(L, r.sol.par - 1, L.T, 2e6);
    if (lower.solved || lower.aborted) { fails++; console.log('PAR YANLIŞ: ' + seed); }
  }
  hist[r.sol.par] = (hist[r.sol.par] || 0) + 1;
  if (!quiet) {
    console.log('tohum ' + seed + ': par=' + r.sol.par + ' adım=' + r.sol.steps + ' puan=' + r.score.toFixed(1) + ' aday=' + r.tried + ' uygun=' + r.found + ' ' + ms + 'ms  kanıt=' + r.sol.proof.map(p => 'K' + p.K + ':' + (p.trivial ? 'sayım' : p.states)).join(' '));
    console.log(r.def.map.map(l => '    ' + l).join('\n'));
    console.log('    çözüm: ' + r.sol.inputs.join(' | '));
  }
}
console.log('\n' + count + ' tohum, ortalama ' + Math.round(tot / count) + 'ms, bulunamayan ' + none + ', hata ' + fails + ', par dağılımı ' + JSON.stringify(hist));
process.exit(fails ? 1 : 0);
