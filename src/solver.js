/* YANKI — çözücü (tarayıcı ve Node ortak).
   K yankılı bulmaca = K ajanın aynı anda yürüdüğü ortak durum uzayı; girdi tekrarı deterministik
   olduğu için birebir denk. Katmanlı arama: önce en az adım, eşitlikte en az hamle.
   Bir bölümün par'ı, çözümü olan en küçük K'dır; K-1 için uzayın tamamı taranır. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.YankiSolver = factory(root.YankiCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';

  function solveK(L, K, T, limit) {
    const C = L.crates0.length, G = L.crumbles.length;
    const cid = new Int16Array(L.n).fill(-1);
    let N = 0;
    for (let i = 0; i < L.n; i++) if (L.type[i] !== Core.VOID && L.type[i] !== Core.WALL) cid[i] = N++;
    const useNum = Math.pow(N, K + C) * Math.pow(2, G) < 9e15;
    const GP = Math.pow(2, G);
    function key(s) {
      let cr = s.crates;
      if (C > 1) cr = cr.slice().sort((a, b) => a - b);
      if (useNum) {
        let k = 0;
        for (let i = 0; i < K; i++) k = k * N + cid[s.pos[i]];
        for (let i = 0; i < C; i++) k = k * N + cid[cr[i]];
        return k * GP + s.gone;
      }
      return s.pos.join(',') + '|' + cr.join(',') + '|' + s.gone;
    }
    const init = Core.initState(L, K);
    const nodes = [{ s: init, parent: -1, mv: null, m: 0 }];
    const seen = new Map([[key(init), 0]]);
    if (Core.isWin(L, init)) return { solved: true, steps: 0, moves: 0, inputs: Array.from({ length: K }, () => []), explored: 1 };
    let layer = [0];
    const moves = new Array(K).fill(0), opts = new Array(K);
    for (let depth = 0; depth < T; depth++) {
      const next = new Map();
      for (let li = 0; li < layer.length; li++) {
        const idx = layer[li], node = nodes[idx], s = node.s;
        // duvara yürümek beklemekle aynıdır: baştan ele
        for (let k = 0; k < K; k++) {
          const o = [0];
          for (let d = 1; d <= 4; d++) if (L.nb[s.pos[k] * 5 + d] >= 0) o.push(d);
          opts[k] = o;
        }
        const rec = (k, cnt) => {
          if (k === K) {
            if (cnt === 0) return;
            const s2 = Core.step(L, s, moves, null), k2 = key(s2);
            if (seen.has(k2)) return;
            const m2 = node.m + cnt, ex = next.get(k2);
            if (!ex || ex.m > m2) next.set(k2, { s: s2, parent: idx, mv: moves.slice(), m: m2 });
            return;
          }
          const o = opts[k];
          for (let i = 0; i < o.length; i++) { moves[k] = o[i]; rec(k + 1, cnt + (o[i] ? 1 : 0)); }
          moves[k] = 0;
        };
        rec(0, 0);
        if (limit && nodes.length + next.size > limit) return { solved: false, explored: nodes.length + next.size, aborted: true };
      }
      layer = [];
      let best = -1;
      for (const [k2, nd] of next) {
        const idx = nodes.length;
        nodes.push(nd); seen.set(k2, idx); layer.push(idx);
        if (Core.isWin(L, nd.s) && (best < 0 || nd.m < nodes[best].m)) best = idx;
      }
      if (best >= 0) {
        const seq = [];
        for (let i = best; nodes[i].parent >= 0; i = nodes[i].parent) seq.push(nodes[i].mv);
        seq.reverse();
        const inputs = Array.from({ length: K }, (_, k) => seq.map(mv => mv[k]));
        for (const inp of inputs) while (inp.length && inp[inp.length - 1] === 0) inp.pop();
        return { solved: true, steps: seq.length, moves: nodes[best].m, inputs, explored: nodes.length };
      }
      if (!layer.length) break;
    }
    return { solved: false, explored: nodes.length };
  }

  // Çözüm "geleceğe güvenerek" kayıt gerektiriyor mu? Öyle bir kayıt sırası varsa ki
  // hiçbir yankı kaydedilirken boşa çarpmıyor, gerekmiyor demektir.
  function needsBlind(L, inputs, T) {
    const K = inputs.length, perms = [];
    const gen = (a, rest) => { if (!rest.length) perms.push(a); rest.forEach((x, i) => gen(a.concat(x), rest.filter((_, j) => j !== i))); };
    gen([], inputs.map((_, i) => i));
    for (const p of perms) {
      let ok = true;
      for (let n = 1; n <= K && ok; n++) {
        const order = p.slice(0, n).slice().sort((a, b) => a - b);
        const sim = Core.simulate(L, order.map(i => inputs[i]), T, true), who = order.indexOf(p[n - 1]);
        for (const ev of sim.events) for (const e of ev) if (e.t === 'bump' && e.k === who) ok = false;
      }
      if (ok) return false;
    }
    return true;
  }

  function solveLevel(def, maxK, limit) {
    const L = Core.parseLevel(def), proof = [], t0 = Date.now();
    for (let K = 1; K <= maxK; K++) {
      if (K < L.cores.length) { proof.push({ K, solvable: false, states: 0, trivial: true }); continue; }
      const r = solveK(L, K, L.T, limit);
      proof.push({ K, solvable: r.solved, states: r.explored, aborted: !!r.aborted });
      if (r.aborted) return { id: def.id, par: null, proof, aborted: true, ms: Date.now() - t0 };
      if (r.solved) {
        const check = Core.simulate(L, r.inputs, L.T, false);
        if (check.winAt !== r.steps) throw new Error('Çözüm doğrulanamadı: ' + def.id);
        return { id: def.id, par: K, steps: r.steps, moves: r.moves, raw: r.inputs, inputs: r.inputs.map(Core.encodeInputs), blind: needsBlind(L, r.inputs, L.T), proof, ms: Date.now() - t0 };
      }
    }
    return { id: def.id, par: null, proof, ms: Date.now() - t0 };
  }

  return { solveK, solveLevel, needsBlind };
});
