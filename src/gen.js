/* YANKI — bulmaca üreteci (tarayıcı ve Node ortak).
   Tohumdan rastgele aday haritalar kurar, her adayı çözücüyle sınar ve yalnızca kanıtlı olanları tutar:
   çözülebilir, par >= 2, her parça gerekli (gereksizler sökülür), kullanılmayan zemin budanır.
   Aynı tohum her yerde aynı bulmacayı verir. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./solver.js'));
  else root.YankiGen = factory(root.YankiCore, root.YankiSolver);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core, Solver) {
  'use strict';

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const NB = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const isF = (g, x, y) => y >= 0 && y < g.length && x >= 0 && x < g[0].length && g[y][x] !== '#';
  const isDoor = ch => (ch >= 'A' && ch <= 'D') || (ch >= '1' && ch <= '4');
  const isPlate = ch => ch >= 'a' && ch <= 'd';
  const colorOf = ch => (isPlate(ch) ? ch.charCodeAt(0) - 97 : ch >= 'A' && ch <= 'D' ? ch.charCodeAt(0) - 65 : ch.charCodeAt(0) - 49);

  function flood(g, sx, sy, pass) {
    const H = g.length, W = g[0].length, d = new Int16Array(W * H).fill(-1), q = [sx + sy * W];
    d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy, n = nx + ny * W;
        if (!isF(g, nx, ny) || d[n] >= 0 || (pass && !pass(g[ny][nx], nx, ny))) continue;
        d[n] = d[c] + 1; q.push(n);
      }
    }
    return d;
  }

  // Gevşetilmiş ön eleme: yeterince yankı olsa bile çekirdeklere ulaşılamıyorsa hiç çözme.
  function plausible(g) {
    const H = g.length, W = g[0].length;
    let sx = -1, sy = -1;
    const cores = [], plates = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = g[y][x];
      if (ch === 'S') { sx = x; sy = y; } else if (ch === '@') cores.push(x + y * W); else if (isPlate(ch)) plates.push([x + y * W, colorOf(ch)]);
    }
    let open = 0;
    for (let it = 0; it < 5; it++) {
      const d = flood(g, sx, sy, ch => !isDoor(ch) || (ch >= '1' && ch <= '4') || ((open >> colorOf(ch)) & 1) === 1);
      let o2 = open;
      for (const [c, col] of plates) if (d[c] >= 0) o2 |= 1 << col;
      if (o2 === open) return cores.every(c => d[c] >= 0);
      open = o2;
    }
    return false;
  }

  function candidate(R) {
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const W = ri(6, 9) + 2, H = ri(3, 5) + 2, g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill('#'));
    const rooms = [], n = ri(2, 4);
    for (let i = 0; i < n; i++) {
      const w = ri(1, 4), h = ri(1, 3), x = ri(1, W - 1 - w), y = ri(1, H - 1 - h);
      rooms.push([x + (w >> 1), y + (h >> 1)]);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy][xx] = '.';
    }
    for (let i = 1; i < n; i++) {
      let x = rooms[i - 1][0], y = rooms[i - 1][1];
      const tx = rooms[i][0], ty = rooms[i][1];
      const hx = () => { while (x !== tx) { x += Math.sign(tx - x); g[y][x] = '.'; } };
      const vy = () => { while (y !== ty) { y += Math.sign(ty - y); g[y][x] = '.'; } };
      if (R() < 0.5) { hx(); vy(); } else { vy(); hx(); }
    }
    const F = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === '.') F.push([x, y]);
    if (F.length < 11 || F.length > 26) return null;
    const straight = ([x, y]) => {
      const h = isF(g, x - 1, y) && isF(g, x + 1, y), v = isF(g, x, y - 1) && isF(g, x, y + 1);
      const deg = (isF(g, x - 1, y) ? 1 : 0) + (isF(g, x + 1, y) ? 1 : 0) + (isF(g, x, y - 1) ? 1 : 0) + (isF(g, x, y + 1) ? 1 : 0);
      return deg === 2 && (h || v);
    };
    const corridor = F.filter(straight);
    const cut = corridor.filter(([cx, cy]) => {
      const o = F.find(p => p[0] !== cx || p[1] !== cy), d = flood(g, o[0], o[1], (ch, x, y) => x !== cx || y !== cy);
      let cnt = 0;
      for (const p of F) if (d[p[0] + p[1] * W] >= 0) cnt++;
      return cnt < F.length - 1;
    });
    if (!cut.length) return null;
    const used = new Set();
    const take = (list, ok) => {
      const c = list.filter(p => !used.has(p[0] + p[1] * W) && (!ok || ok(p)));
      if (!c.length) return null;
      const p = pick(c);
      used.add(p[0] + p[1] * W);
      return p;
    };
    const put = (p, ch) => { g[p[1]][p[0]] = ch; };
    const nCol = R() < 0.5 ? 1 : 2;
    for (let c = 0; c < nCol; c++) {
      const d = take(cut);
      if (!d) break;
      put(d, R() < 0.24 ? String(c + 1) : 'ABCD'[c]);
      if (R() < 0.25) { const d2 = take(cut); if (d2) put(d2, R() < 0.5 ? String(c + 1) : 'ABCD'[c]); }
      const pl = take(F);
      if (!pl) return null;
      put(pl, 'abcd'[c]);
    }
    const S = take(F);
    if (!S) return null;
    put(S, 'S');
    const dist = flood(g, S[0], S[1]);
    const nCore = R() < 0.6 ? 1 : 2;
    for (let i = 0; i < nCore; i++) { const c = take(F, p => dist[p[0] + p[1] * W] >= 3); if (!c) return null; put(c, '@'); }
    if (R() < 0.4) { const c = take(F, ([x, y]) => (isF(g, x - 1, y) && isF(g, x + 1, y)) || (isF(g, x, y - 1) && isF(g, x, y + 1))); if (c) put(c, 'x'); }
    if (R() < 0.32) { const k = ri(1, 2); for (let i = 0; i < k; i++) { const c = take(corridor); if (c) put(c, '~'); } }
    return g;
  }

  const toMap = g => g.map(r => r.join(''));
  function solve(g, limit) {
    if (!plausible(g)) return null;
    const sol = Solver.solveLevel({ id: 'gen', T: 22, map: toMap(g) }, 3, limit);
    return sol.par == null ? null : sol;
  }

  // Bir parçayı söküp aynı par ve aynı en kısa adım çıkıyorsa o parça süstür: at.
  function strip(g, sol, limit) {
    let changed = true;
    for (let pass = 0; pass < 3 && changed; pass++) {
      changed = false;
      for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
        const ch = g[y][x];
        if (ch === '.' || ch === '#' || ch === 'S' || ch === '@') continue;
        const v = g.map(r => r.slice());
        v[y][x] = '.';
        if (isPlate(ch)) {
          const col = colorOf(ch);
          let other = false;
          for (const r of v) for (const c of r) if (isPlate(c) && colorOf(c) === col) other = true;
          if (!other) for (let yy = 0; yy < v.length; yy++) for (let xx = 0; xx < v[0].length; xx++) {
            const c = v[yy][xx];
            if (isDoor(c) && colorOf(c) === col) v[yy][xx] = c >= 'A' ? '#' : '.';
          }
        }
        const s2 = solve(v, limit);
        if (s2 && s2.par === sol.par && s2.steps === sol.steps) { g = v; sol = s2; changed = true; }
      }
    }
    return { g, sol };
  }

  function visited(L, sol) {
    const sim = Core.simulate(L, sol.raw, sol.steps, false), seen = new Uint8Array(L.n);
    for (const s of sim.states) { for (const p of s.pos) seen[p] = 1; for (const c of s.crates) seen[c] = 1; }
    return seen;
  }

  // Çözümde hiç kullanılmayan ve kullanılan bir kareye komşu olmayan zemini duvar yap; sonra kırp.
  function prune(g, sol) {
    const L = Core.parseLevel({ id: 'gen', T: 22, map: toMap(g) }), seen = visited(L, sol), W = L.W;
    const out = g.map(r => r.slice());
    for (let y = 0; y < g.length; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== '.') continue;
      const i = y * W + x;
      let near = seen[i];
      for (const [dx, dy] of NB) { const nx = x + dx, ny = y + dy; if (isF(g, nx, ny) && seen[ny * W + nx]) near = 1; }
      if (!near) out[y][x] = '#';
    }
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    for (let y = 0; y < out.length; y++) for (let x = 0; x < W; x++) if (out[y][x] !== '#') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const res = [];
    for (let y = y0 - 1; y <= y1 + 1; y++) { const row = []; for (let x = x0 - 1; x <= x1 + 1; x++) row.push(out[y] && out[y][x] ? out[y][x] : '#'); res.push(row); }
    return res;
  }

  function refine(g0, limit) {
    let sol = solve(g0, limit);
    if (!sol || sol.par < 2) return null;
    let st = strip(g0, sol, limit);
    let g = prune(st.g, st.sol);
    sol = solve(g, limit);
    if (!sol || sol.par !== st.sol.par || sol.steps !== st.sol.steps) return null;
    if (sol.steps < 8 || sol.steps > 18) return null;
    let doors = 0, crates = 0, crumbles = 0, floor = 0;
    for (const r of g) for (const c of r) { if (c !== '#') floor++; if (isDoor(c)) doors++; else if (c === 'x') crates++; else if (c === '~') crumbles++; }
    if (doors + crates + crumbles === 0) return null;
    for (const inp of sol.raw) if (inp.filter(d => d).length < 2) return null;
    const below = sol.proof.find(p => p.K === sol.par - 1), hard = below && !below.trivial;
    if (!hard && doors + crates < 1) return null;
    const L = Core.parseLevel({ id: 'gen', T: 22, map: toMap(g) }), seen = visited(L, sol);
    let unused = 0;
    for (let i = 0; i < L.n; i++) if (L.type[i] !== Core.WALL && L.type[i] !== Core.VOID && !seen[i]) unused++;
    if (unused > floor * 0.4) return null;
    const score = sol.steps + (hard ? 6 : 0) + (sol.blind ? 3 : 0) + (sol.par === 3 ? 3 : 0) + 2 * Math.min(2, doors) + 2.5 * crates + 1.5 * Math.min(2, crumbles) - 0.3 * unused;
    return { map: toMap(g), sol, score, doors, crates, crumbles };
  }

  // Adım adım çalışan iş: tarayıcıda arayüzü dondurmadan ilerlesin diye.
  function start(seed, opts) {
    opts = opts || {};
    const R = rng(seed), tries = opts.tries || 3000, want = opts.want || Infinity, limit = opts.limit || 30000;
    const job = { seed, tried: 0, found: 0, best: null, done: false };
    job.step = function (budgetMs) {
      const t0 = Date.now();
      while (!job.done && Date.now() - t0 < budgetMs) {
        if (job.tried >= tries || job.found >= want) { job.done = true; break; }
        job.tried++;
        const g = candidate(R);
        if (!g) continue;
        let res = null;
        try { res = refine(g, limit); } catch (e) { res = null; }
        if (!res) continue;
        job.found++;
        if (!job.best || res.score > job.best.score) job.best = res;
      }
      if (job.done && job.best && !job.result) {
        const b = job.best, s = b.sol;
        job.result = {
          def: { id: 'lab-' + seed, name: opts.name || 'Laboratuvar #' + seed, T: Math.min(26, s.steps + 6), map: b.map, tip: opts.tip || 'Bu bulmacayı bir makine üretti ve kanıtladı. İpucu yok.' },
          sol: { par: s.par, steps: s.steps, moves: s.moves, inputs: s.inputs, proof: s.proof.map(p => ({ K: p.K, solvable: p.solvable, states: p.states, trivial: !!p.trivial })) },
          tried: job.tried, found: job.found, score: b.score,
        };
      }
      return job;
    };
    return job;
  }
  function generate(seed, opts) { const j = start(seed, opts); while (!j.done) j.step(1000); return j.result || null; }

  return { rng, start, generate, candidate, refine };
});
