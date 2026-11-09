/* YANKI — çekirdek kurallar. Tarayıcı ve Node aynı dosyayı kullanır:
   oyun da, bölümleri kanıtlayan çözücü de tam olarak bu adım fonksiyonunu çalıştırır. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YankiCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VOID = 0, FLOOR = 1, WALL = 2, PLATE = 3, DOOR = 4, IDOOR = 5, CORE = 6, CRUMBLE = 7;
  // 0 bekle, 1 yukarı, 2 sağ, 3 aşağı, 4 sol
  const DX = [0, 0, 1, 0, -1], DY = [0, -1, 0, 1, 0];
  const DIR_CHARS = '.URDL';

  function parseLevel(def) {
    const rows = def.map;
    const H = rows.length;
    let W = 0;
    for (const r of rows) W = Math.max(W, r.length);
    const n = W * H;
    const type = new Uint8Array(n);
    const color = new Int8Array(n).fill(-1);
    const cidx = new Int8Array(n).fill(-1);
    const nb = new Int16Array(n * 5).fill(-1);
    const cores = [], plates = [], crates0 = [], crumbles = [], doors = [];
    let start = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rows[y][x] || ' ';
      const i = y * W + x;
      let t = FLOOR;
      if (ch === ' ') t = VOID;
      else if (ch === '#') t = WALL;
      else if (ch === '.') t = FLOOR;
      else if (ch === 'S') start = i;
      else if (ch === '@') { t = CORE; cores.push(i); }
      else if (ch === 'x') crates0.push(i);
      else if (ch === '~') { t = CRUMBLE; cidx[i] = crumbles.length; crumbles.push(i); }
      else if (ch >= 'a' && ch <= 'd') { t = PLATE; color[i] = ch.charCodeAt(0) - 97; plates.push(i); }
      else if (ch >= 'A' && ch <= 'D') { t = DOOR; color[i] = ch.charCodeAt(0) - 65; doors.push(i); }
      else if (ch >= '1' && ch <= '4') { t = IDOOR; color[i] = ch.charCodeAt(0) - 49; doors.push(i); }
      else throw new Error('Bilinmeyen karo: "' + ch + '" (' + def.id + ')');
      type[i] = t;
    }
    if (start < 0) throw new Error('Başlangıç yok: ' + def.id);
    if (!cores.length) throw new Error('Çekirdek yok: ' + def.id);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let d = 1; d <= 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (type[j] !== VOID && type[j] !== WALL) nb[i * 5 + d] = j;
      }
    }
    return { def, id: def.id, W, H, n, type, color, cidx, nb, cores, plates, crates0, crumbles, doors, start, T: def.T };
  }

  function computePressed(L, pos, crates) {
    let m = 0;
    const P = L.plates;
    for (let i = 0; i < P.length; i++) {
      const c = P[i];
      if (pos.indexOf(c) >= 0 || crates.indexOf(c) >= 0) m |= 1 << L.color[c];
    }
    return m;
  }

  function initState(L, K) {
    const pos = new Array(K).fill(L.start);
    const crates = L.crates0.slice();
    return { pos, crates, gone: 0, pressed: computePressed(L, pos, crates) };
  }

  // Kapı, plakası basılıyken ya da içinde biri/bir sandık dururken açıktır (ters kapıda tersi).
  function isOpen(L, s, c) {
    const t = L.type[c];
    const on = (s.pressed >> L.color[c]) & 1;
    if (t === DOOR ? on === 1 : on === 0) return true;
    return s.pos.indexOf(c) >= 0 || s.crates.indexOf(c) >= 0;
  }

  // Adım başındaki duruma (s) göre geçilebilirlik: ekranda ne görünüyorsa o geçerlidir.
  function passable(L, s, c) {
    const t = L.type[c];
    if (t === DOOR || t === IDOOR) return isOpen(L, s, c);
    if (t === CRUMBLE) return ((s.gone >> L.cidx[c]) & 1) === 0;
    return true;
  }

  // Tek zaman adımı. Benlikler kayıt sırasıyla (en eski önce) hareket eder.
  function step(L, s, moves, ev) {
    const K = s.pos.length;
    const pos = s.pos.slice();
    let crates = s.crates, copied = false;
    for (let k = 0; k < K; k++) {
      const d = moves[k] | 0;
      if (d === 0) continue;
      const from = pos[k];
      const to = L.nb[from * 5 + d];
      if (to < 0 || !passable(L, s, to)) { if (ev) ev.push({ t: 'bump', k, d }); continue; }
      const ci = crates.indexOf(to);
      if (ci >= 0) {
        const to2 = L.nb[to * 5 + d];
        const tt = to2 < 0 ? WALL : L.type[to2];
        if (to2 < 0 || tt === CRUMBLE || tt === CORE || !passable(L, s, to2) ||
            crates.indexOf(to2) >= 0 || pos.indexOf(to2) >= 0) {
          if (ev) ev.push({ t: 'bump', k, d });
          continue;
        }
        if (!copied) { crates = crates.slice(); copied = true; }
        crates[ci] = to2;
        if (ev) ev.push({ t: 'push', k, d, ci, from: to, to: to2 });
      }
      pos[k] = to;
      if (ev) ev.push({ t: 'move', k, d, from, to });
    }
    let gone = s.gone;
    if (L.crumbles.length) {
      for (let k = 0; k < K; k++) {
        const c = s.pos[k];
        if (L.type[c] === CRUMBLE && pos.indexOf(c) < 0 && !((gone >> L.cidx[c]) & 1)) {
          gone |= 1 << L.cidx[c];
          if (ev) ev.push({ t: 'crumble', c });
        }
      }
    }
    const pressed = computePressed(L, pos, crates);
    if (ev && pressed !== s.pressed) ev.push({ t: 'plates', before: s.pressed, after: pressed });
    return { pos, crates, gone, pressed };
  }

  function isWin(L, s) {
    for (let i = 0; i < L.cores.length; i++) if (s.pos.indexOf(L.cores[i]) < 0) return false;
    return true;
  }

  // inputs: her benlik için yön dizisi. Eksik adım = bekle.
  function simulate(L, inputs, maxT, wantEvents) {
    const K = inputs.length;
    let s = initState(L, K);
    const states = [s], events = [];
    let winAt = isWin(L, s) ? 0 : -1;
    const moves = new Array(K);
    for (let t = 0; t < maxT && winAt < 0; t++) {
      for (let k = 0; k < K; k++) moves[k] = inputs[k][t] | 0;
      const ev = wantEvents ? [] : null;
      s = step(L, s, moves, ev);
      states.push(s);
      if (ev) events.push(ev);
      if (isWin(L, s)) winAt = t + 1;
    }
    return { states, events, winAt };
  }

  function encodeInputs(arr) { let o = ''; for (let i = 0; i < arr.length; i++) o += DIR_CHARS[arr[i] | 0]; return o; }
  function decodeInputs(str) { const a = []; for (let i = 0; i < str.length; i++) a.push(Math.max(0, DIR_CHARS.indexOf(str[i]))); return a; }

  return {
    VOID, FLOOR, WALL, PLATE, DOOR, IDOOR, CORE, CRUMBLE, DX, DY, DIR_CHARS,
    parseLevel, initState, computePressed, isOpen, passable, step, isWin, simulate, encodeInputs, decodeInputs,
  };
});
