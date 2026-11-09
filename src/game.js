/* YANKI — arayüz, çizim, animasyon, ses. Kurallar core.js'te; burası yalnızca sunum. */
(function () {
  'use strict';
  const Core = window.YankiCore, LEVELS = window.YankiLevels, SOL = window.YankiSolutions;
  const { VOID, WALL, PLATE, DOOR, IDOOR, CORE, CRUMBLE, DX, DY } = Core;
  const TAU = Math.PI * 2;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeBack = p => { const c = 2.2; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const nf = n => n.toLocaleString('tr-TR');
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const c = hex(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  const mix = (a, b, p) => { const x = hex(a), y = hex(b); return 'rgb(' + Math.round(lerp(x[0], y[0], p)) + ',' + Math.round(lerp(x[1], y[1], p)) + ',' + Math.round(lerp(x[2], y[2], p)) + ')'; };

  const DC = ['#ff6f61', '#49b6ff', '#7ee081', '#b892ff'];
  const COL = { void: '#0a0c11', tile: '#222938', tileAlt: '#272f42', face: '#141926', amber: '#ffb84d', echo: '#a9bfe8', gold: '#ffd98a' };
  const ARROW = '<svg viewBox="0 0 12 12"><path d="M2 6h8M6.5 2.5L10 6 6.5 9.5"/></svg>';

  // ---------- bölümler ----------
  function makeLv(def, sol, i) {
    return { i, def, L: Core.parseLevel(def), sol, par: sol.par, bestSteps: sol.steps, maxSelves: Math.min(4, Math.max(2, sol.par + 1)), solInputs: sol.inputs.map(Core.decodeInputs), cache: null, lab: i < 0 };
  }
  const LV = LEVELS.map((def, i) => makeLv(def, SOL[def.id], i));
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  function prepLevel(lv) {
    if (lv.cache) return lv.cache;
    const L = lv.L, edge = new Uint8Array(L.n), dist = new Int16Array(L.n), distCore = new Int16Array(L.n);
    const tile = i => L.type[i] !== VOID && L.type[i] !== WALL;
    const sx = L.start % L.W, sy = (L.start / L.W) | 0;
    let maxDist = 0, x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      const i = y * L.W + x;
      if (!tile(i)) continue;
      let m = 0;
      if (y === 0 || !tile(i - L.W)) m |= 1;
      if (x === L.W - 1 || !tile(i + 1)) m |= 2;
      if (y === L.H - 1 || !tile(i + L.W)) m |= 4;
      if (x === 0 || !tile(i - 1)) m |= 8;
      edge[i] = m;
      dist[i] = Math.abs(x - sx) + Math.abs(y - sy);
      if (dist[i] > maxDist) maxDist = dist[i];
      let dc = 99;
      for (const c of L.cores) dc = Math.min(dc, Math.abs(x - c % L.W) + Math.abs(y - ((c / L.W) | 0)));
      distCore[i] = dc;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return (lv.cache = { edge, dist, distCore, maxDist, bx: x0, by: y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1, tile });
  }

  // ---------- kayıt ----------
  const store = {
    data: { best: {}, muted: false, tutorial: false },
    load() { try { const raw = localStorage.getItem('yanki.v1'); if (raw) Object.assign(this.data, JSON.parse(raw)); } catch (e) { /* özel pencere vb. */ } },
    save() { try { localStorage.setItem('yanki.v1', JSON.stringify(this.data)); } catch (e) { /* yok say */ } },
  };

  // ---------- durum ----------
  const G = { screen: 'title', li: 0, lv: null, L: null, inputs: [[]], active: 0, t: 0, states: [], evs: [], won: false, mode: 'play', introStart: 0, winToken: 0, lastWin: null, phDur: 130 };
  const V = { w: 0, h: 0, dpr: 1, S: 48, ox: 0, oy: 0, under: null, underM: 0, underKey: '', dots: null };
  const A = { q: [], cur: null, p: 1, fast: false };
  const FX = { door: null, plate: null, gone: null, core: null, parts: [], rings: [], fan: [0, 0, 0, 0], face: [3, 3, 3, 3], pop: null, winT: 0, idle: 0 };
  const IDLE = { from: null, to: null, kind: 'idle', ev: null, active: 0 };
  const SP = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, moving: false, horiz: false, bump: 0 }));
  const CP = [];

  const cv = $('#cv'), cx = cv.getContext('2d');
  const el = {
    hud: $('#hud'), dock: $('#dock'), tip: $('#tip'), lvNum: $('#lvNum'), lvName: $('#lvName'), chipK: $('#chipK'), chipPar: $('#chipPar'),
    clock: $('#tlClock'), ruler: $('#tlRuler'), rows: $('#tlRows'), tl: $('#tl'), ph: $('#ph'), toast: $('#toast'),
    grid: $('#grid'), selSub: $('#selSub'), proof: $('#proof'), winp: $('#winp'), help: $('#help'),
    winKicker: $('#winKicker'), winTitle: $('#winTitle'), winStars: $('#winStars'), wsK: $('#wsK'), wsT: $('#wsT'), winProof: $('#winProof'),
    btnNext: $('#btnNext'), btnAgain: $('#btnAgain'), btnWatch: $('#btnWatch'), btnMute: $('#btnMute'), hintLbl: $('#hintLbl'),
    coach: $('#coach'), coachStep: $('#coachStep'), coachText: $('#coachText'), btnCoachNext: $('#btnCoachNext'),
    genp: $('#genp'), genTitle: $('#genTitle'), genNote: $('#genNote'), genTried: $('#genTried'), genFound: $('#genFound'), genBar: $('#genBar'), genCv: $('#genCv'),
    dailyMeta: $('#dailyMeta'), dailyStars: $('#dailyStars'), dailyName: $('#dailyName'),
  };

  // ---------- ses ----------
  const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  const DELTA = [0, 1, 2, -1, -2], BASES = [5, 2, 7, 0];
  function pitchIdx(inp, upto, base) {
    let v = base;
    for (let i = 0; i <= upto; i++) v += DELTA[inp[i] | 0];
    const n = SCALE.length - 1, m = 2 * n;
    v = ((v % m) + m) % m;
    return v > n ? m - v : v;
  }
  const sfx = (() => {
    let ac = null, master = null, send = null, nbuf = null, muted = false;
    function init() {
      if (ac) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ac = new AC(); } catch (e) { ac = null; return false; }
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
      master.connect(comp); comp.connect(ac.destination);
      send = ac.createGain();
      const dl = ac.createDelay(1); dl.delayTime.value = 0.27;
      const fb = ac.createGain(); fb.gain.value = 0.34;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const wet = ac.createGain(); wet.gain.value = 0.3;
      send.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(master);
      nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      pad();
      return true;
    }
    function pad() {
      const g = ac.createGain(); g.gain.value = 0;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.4;
      [[110, 0, 'triangle', 0.5], [164.81, 5, 'triangle', 0.4], [220.4, -4, 'sine', 0.22], [329.4, 3, 'sine', 0.12]].forEach(v => {
        const o = ac.createOscillator(); o.type = v[2]; o.frequency.value = v[0]; o.detune.value = v[1];
        const og = ac.createGain(); og.gain.value = v[3]; o.connect(og); og.connect(lp); o.start();
      });
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
      const lg = ac.createGain(); lg.gain.value = 150; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      lp.connect(g); g.connect(master);
      g.gain.linearRampToValueAtTime(0.055, ac.currentTime + 5);
    }
    function tone(o) {
      if (!ac || muted) return;
      const t = ac.currentTime + (o.at || 0), dur = o.dur || 0.2;
      const osc = ac.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g, t + (o.a || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      let out = g;
      if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); out = p; }
      out.connect(master);
      if (o.send) { const s = ac.createGain(); s.gain.value = o.send; out.connect(s); s.connect(send); }
      osc.start(t); osc.stop(t + dur + 0.05);
    }
    function noise(o) {
      if (!ac || muted) return;
      const t = ac.currentTime + (o.at || 0), dur = o.dur || 0.2;
      const src = ac.createBufferSource(); src.buffer = nbuf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      f.Q.value = o.q || 0.7;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g, t + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master);
      if (o.send) { const s = ac.createGain(); s.gain.value = o.send; g.connect(s); s.connect(send); }
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }
    return {
      resume() { if (init() && ac.state === 'suspended') ac.resume(); },
      setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.03); },
      get muted() { return muted; },
      note(idx, active, pan) {
        const f = SCALE[idx];
        if (active) { tone({ f, type: 'triangle', g: 0.17, dur: 0.34, pan, send: 0.55 }); tone({ f: f * 2, g: 0.045, dur: 0.2, pan }); }
        else tone({ f: f / 2, type: 'sine', g: 0.085, dur: 0.42, pan, send: 0.7 });
      },
      bump(v) { tone({ f: 96, to: 52, g: 0.22 * v, dur: 0.11 }); noise({ f: 700, to: 200, g: 0.07 * v, dur: 0.07 }); },
      push() { noise({ f: 520, to: 180, g: 0.2, dur: 0.16, q: 1.2 }); tone({ f: 70, to: 55, g: 0.12, dur: 0.14 }); },
      plate(on) { if (on) { tone({ f: 659.25, g: 0.1, dur: 0.12, send: 0.4 }); tone({ f: 880, g: 0.1, dur: 0.2, at: 0.06, send: 0.5 }); } else { tone({ f: 587.33, g: 0.07, dur: 0.12 }); tone({ f: 440, g: 0.07, dur: 0.18, at: 0.06 }); } },
      door(open) { noise({ type: 'bandpass', f: open ? 300 : 1300, to: open ? 1500 : 260, g: 0.13, dur: 0.24, q: 2.5 }); tone({ f: open ? 130 : 196, to: open ? 196 : 130, g: 0.09, dur: 0.22, type: 'triangle' }); },
      crumble() { noise({ f: 1800, to: 120, g: 0.24, dur: 0.5 }); tone({ f: 80, to: 38, g: 0.2, dur: 0.4 }); },
      rewind(d) { tone({ f: 880, to: 150, type: 'triangle', g: 0.08, dur: d + 0.1, send: 0.5 }); noise({ type: 'bandpass', f: 3200, to: 400, g: 0.06, dur: d + 0.05, q: 3 }); },
      forward(d) { tone({ f: 180, to: 760, type: 'triangle', g: 0.07, dur: d + 0.1, send: 0.5 }); noise({ type: 'bandpass', f: 500, to: 2800, g: 0.05, dur: d + 0.05, q: 3 }); },
      spawn() { tone({ f: 659.25, g: 0.11, dur: 0.5, send: 0.9 }); tone({ f: 987.77, g: 0.07, dur: 0.6, at: 0.07, send: 0.9 }); },
      undo() { tone({ f: 392, to: 330, g: 0.07, dur: 0.08 }); },
      win() { [440, 554.37, 659.25, 880, 987.77, 1318.5].forEach((f, i) => tone({ f, type: i % 2 ? 'sine' : 'triangle', g: 0.13, dur: 1.1, at: i * 0.085, send: 1 })); tone({ f: 110, g: 0.16, dur: 1.4, type: 'triangle' }); },
      deny() { tone({ f: 170, to: 120, type: 'square', g: 0.04, dur: 0.12 }); },
      click() { tone({ f: 1320, g: 0.035, dur: 0.05 }); },
    };
  })();

  // ---------- yerleşim ----------
  function layout() {
    V.dpr = Math.min(2, window.devicePixelRatio || 1);
    V.w = window.innerWidth; V.h = window.innerHeight;
    const pw = Math.round(V.w * V.dpr), ph = Math.round(V.h * V.dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    if (!V.dots) {
      const d = document.createElement('canvas'); d.width = d.height = 30;
      const g = d.getContext('2d'); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(14, 14, 1.5, 1.5);
      V.dots = cx.createPattern(d, 'repeat');
    }
    if (!G.lv) return;
    const C = prepLevel(G.lv);
    let sx = 0, sy = 0, sw = V.w, sh = V.h;
    if (G.screen === 'play') {
      const coachBottom = G.mode === 'tutor' ? el.coach.offsetTop + el.coach.offsetHeight + 12 : 0;
      const top = Math.max(el.hud.offsetHeight + 6, coachBottom), dockH = el.dock.offsetHeight + 16;
      document.documentElement.style.setProperty('--dockh', dockH + 'px');
      sy = top; sh = V.h - top - dockH;
    } else { sy = V.h * 0.47; sh = V.h * 0.45; }
    const pad = 18;
    const S = Math.floor(Math.min((sw - pad * 2) / (C.bw + 0.5), (sh - pad * 2) / (C.bh + 0.85)));
    V.S = clamp(S, 16, G.screen === 'play' ? 84 : 58);
    V.ox = Math.round(sx + (sw - C.bw * V.S) / 2 - C.bx * V.S);
    V.oy = Math.round(sy + (sh - C.bh * V.S) / 2 - C.by * V.S - V.S * 0.06);
    buildUnder(C);
  }

  function buildUnder(C) {
    const key = G.lv.def.id + ':' + V.S + ':' + V.dpr;
    if (V.underKey === key) return;
    V.underKey = key;
    const L = G.L, S = V.S, m = Math.ceil(S * 1.4), w = C.bw * S + 2 * m, h = C.bh * S + 2 * m;
    const a = document.createElement('canvas'); a.width = Math.ceil(w * V.dpr); a.height = Math.ceil(h * V.dpr);
    const ga = a.getContext('2d'); ga.scale(V.dpr, V.dpr); ga.fillStyle = '#5f8fff';
    for (let i = 0; i < L.n; i++) {
      if (!C.tile(i)) continue;
      const x = i % L.W - C.bx, y = ((i / L.W) | 0) - C.by;
      ga.fillRect(m + x * S - 1, m + y * S + S * 0.35, S + 2, S + 2);
    }
    const b = document.createElement('canvas'); b.width = a.width; b.height = a.height;
    const gb = b.getContext('2d');
    if (!('filter' in gb)) { V.under = null; return; }
    gb.filter = 'blur(' + Math.round(S * 0.5 * V.dpr) + 'px)';
    gb.globalAlpha = 0.2;
    gb.drawImage(a, 0, 0);
    V.under = b; V.underM = m;
  }

  // ---------- animasyon kuyruğu ----------
  function qStep(from, to, ev, ti) {
    const notes = [];
    for (const e of ev) if (e.t === 'move') notes[e.k] = pitchIdx(G.inputs[e.k], ti, BASES[e.k]);
    A.q.push({ kind: 'step', from, to, ev, dur: RM ? 60 : 135, active: G.active, notes });
  }
  function qSeek(path, kind, active) {
    const n = path.length - 1;
    if (n < 1) return;
    const total = RM ? 120 : clamp(n * 48, 220, 660), per = total / n, quiet = G.mode === 'attract';
    G.phDur = total;
    A.q.push({ kind: 'fx', fn: () => { if (!quiet) (kind === 'rewind' ? sfx.rewind : sfx.forward)(total / 1000); } });
    for (let i = 0; i < n; i++) A.q.push({ kind, from: path[i], to: path[i + 1], ev: null, dur: per, active });
  }
  function qFx(fn) { A.q.push({ kind: 'fx', fn }); }

  function tickAnim(dt) {
    let rem = dt;
    for (let guard = 0; guard < 400; guard++) {
      if (!A.cur) {
        if (!A.q.length) { A.p = 1; return; }
        const it = A.q.shift();
        if (it.kind === 'fx') { it.fn(); continue; }
        A.cur = it; A.p = 0; animStart(it);
      }
      // yalnız birikmiş oyuncu hamleleri hızlandırır; sarma animasyonu kendi süresinde akar
      let backlog = 0;
      for (let i = 0; i < A.q.length; i++) if (A.q[i].kind === 'step' || A.q[i].kind === 'undo') backlog++;
      const speed = 1 + Math.max(0, backlog - 1) * 0.9;
      const dur = Math.max(1, A.cur.dur * (A.fast ? 0.02 : 1));
      const need = (1 - A.p) * dur / speed;
      if (rem < need) { A.p += rem * speed / dur; return; }
      rem -= need; A.cur = null;
    }
  }

  function panOf(c) { const C = G.lv.cache; return clamp((((c % G.L.W) - C.bx + 0.5) / C.bw - 0.5) * 1.3, -0.8, 0.8); }

  function animStart(it) {
    if (it.kind !== 'step') return;
    const L = G.L, quiet = G.mode === 'attract';
    for (const e of it.ev) {
      if (e.t === 'move') { FX.face[e.k] = e.d; dust(e.from); if (!quiet) sfx.note(it.notes[e.k], e.k === it.active, panOf(e.to)); }
      else if (e.t === 'bump') { FX.face[e.k] = e.d; if (!quiet) sfx.bump(e.k === it.active ? 1 : 0.55); }
      else if (e.t === 'push') { if (!quiet) sfx.push(); }
      else if (e.t === 'crumble') { crumbleFx(e.c); if (!quiet) sfx.crumble(); }
      else if (e.t === 'plates' && !quiet) { if (e.after & ~e.before) sfx.plate(true); if (e.before & ~e.after) sfx.plate(false); }
    }
    let opened = false, closed = false;
    for (const c of L.doors) {
      const a = Core.isOpen(L, it.from, c), b = Core.isOpen(L, it.to, c);
      if (a !== b) { if (b) opened = true; else closed = true; }
    }
    if (!quiet) { if (opened) sfx.door(true); if (closed) sfx.door(false); }
  }

  // ---------- efektler ----------
  function cellXY(c) { return [c % G.L.W + 0.5, ((c / G.L.W) | 0) + 0.5]; }
  function ringAt(c, color, max, life) { const p = cellXY(c); FX.rings.push({ x: p[0], y: p[1], color, max, life, t: 0 }); }
  function dust(c) {
    if (RM) return;
    const p = cellXY(c);
    for (let i = 0; i < 3; i++) FX.parts.push({ x: p[0] + (Math.random() - 0.5) * 0.3, y: p[1] + 0.26, vx: (Math.random() - 0.5) * 0.9, vy: -0.25 - Math.random() * 0.5, g: 0.6, life: 380 + Math.random() * 180, t: 0, color: 'rgba(190,205,235,', a: 0.4, size: 0.035 + Math.random() * 0.03 });
  }
  function crumbleFx(c) {
    const p = cellXY(c);
    for (let i = 0; i < 14; i++) FX.parts.push({ x: p[0] + (Math.random() - 0.5) * 0.8, y: p[1] + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 1.4, vy: -0.6 - Math.random(), g: 7, life: 650 + Math.random() * 300, t: 0, color: 'rgba(120,134,160,', a: 0.9, size: 0.06 + Math.random() * 0.07, sq: true });
  }
  function winBurst() {
    FX.winT = performance.now();
    for (const c of G.L.cores) {
      ringAt(c, COL.gold, 2.6, 900); ringAt(c, COL.amber, 1.5, 620);
      const p = cellXY(c);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * TAU, v = 1.2 + Math.random() * 3.4;
        FX.parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, g: 1.6, life: 700 + Math.random() * 600, t: 0, color: Math.random() < 0.5 ? 'rgba(255,217,138,' : 'rgba(255,244,214,', a: 1, size: 0.035 + Math.random() * 0.05 });
      }
    }
  }
  function resetFX() {
    const L = G.L, s = G.states[G.t];
    FX.door = new Float32Array(L.n); FX.plate = new Float32Array(L.n); FX.gone = new Float32Array(L.n); FX.core = new Float32Array(L.n);
    for (const c of L.doors) FX.door[c] = Core.isOpen(L, s, c) ? 1 : 0;
    for (const c of L.plates) FX.plate[c] = (s.pos.indexOf(c) >= 0 || s.crates.indexOf(c) >= 0) ? 1 : 0;
    FX.parts.length = 0; FX.rings.length = 0; FX.fan = [0, 0, 0, 0]; FX.face = [3, 3, 3, 3]; FX.pop = null; FX.winT = 0; FX.idle = 0;
  }
  function stepFX(dt, s, idle) {
    const L = G.L, k = 1 - Math.exp(-dt / 75), kg = 1 - Math.exp(-dt / 150);
    for (const c of L.doors) FX.door[c] += ((Core.isOpen(L, s, c) ? 1 : 0) - FX.door[c]) * k;
    for (const c of L.plates) FX.plate[c] += (((s.pos.indexOf(c) >= 0 || s.crates.indexOf(c) >= 0) ? 1 : 0) - FX.plate[c]) * k;
    for (const c of L.crumbles) FX.gone[c] += ((((s.gone >> L.cidx[c]) & 1) ? 1 : 0) - FX.gone[c]) * kg;
    for (const c of L.cores) FX.core[c] += ((s.pos.indexOf(c) >= 0 ? 1 : 0) - FX.core[c]) * k;
    FX.idle = idle ? Math.min(1, FX.idle + dt / 220) : 0;
    const sec = dt / 1000;
    for (let i = FX.parts.length - 1; i >= 0; i--) {
      const p = FX.parts[i]; p.t += dt;
      if (p.t >= p.life) { FX.parts.splice(i, 1); continue; }
      p.vy += p.g * sec; p.x += p.vx * sec; p.y += p.vy * sec;
    }
    for (let i = FX.rings.length - 1; i >= 0; i--) { const r = FX.rings[i]; r.t += dt; if (r.t >= r.life) FX.rings.splice(i, 1); }
  }

  // ---------- çizim ----------
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function glyph(ctx, idx, x, y, r) {
    ctx.beginPath();
    if (idx === 0) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    else if (idx === 1) ctx.arc(x, y, r * 0.86, 0, TAU);
    else if (idx === 2) { ctx.moveTo(x, y - r * 0.95); ctx.lineTo(x + r, y + r * 0.72); ctx.lineTo(x - r, y + r * 0.72); ctx.closePath(); }
    else ctx.rect(x - r * 0.78, y - r * 0.78, r * 1.56, r * 1.56);
  }
  function getView() {
    if (A.cur) return A.cur;
    const s = G.states[G.t];
    IDLE.from = s; IDLE.to = s; IDLE.active = G.active;
    return IDLE;
  }

  function drawTile(ctx, L, C, i, x, y, x0, y0, S, now) {
    const t = L.type[i], m = C.edge[i], r = S * 0.17, hf = S * 0.2;
    let alpha = ctx.globalAlpha;
    if (t === CRUMBLE) {
      const gn = FX.gone[i];
      if (gn > 0.985) return;
      if (gn > 0.001) { y0 += gn * gn * S * 0.9; alpha *= 1 - gn; ctx.globalAlpha = alpha; }
    }
    const rtl = (m & 1) && (m & 8) ? r : 0, rtr = (m & 1) && (m & 2) ? r : 0, rbr = (m & 4) && (m & 2) ? r : 0, rbl = (m & 4) && (m & 8) ? r : 0;
    if (m & 4) { ctx.fillStyle = COL.face; rrect(ctx, x0 + 0.5, y0 + S - r - 1, S - 1, hf + r + 1, [0, 0, rbr, rbl]); ctx.fill(); }
    ctx.fillStyle = t === CRUMBLE ? '#2c3344' : (((x + y) & 1) ? COL.tileAlt : COL.tile);
    rrect(ctx, x0 + 0.5, y0 + 0.5, S - 1, S - 1, [rtl, rtr, rbr, rbl]); ctx.fill();
    if (m & 1) { ctx.fillStyle = 'rgba(255,255,255,.085)'; ctx.fillRect(x0 + 0.5 + rtl, y0 + 0.5, S - 1 - rtl - rtr, 1.2); }
    const cxm = x0 + S / 2, cym = y0 + S / 2;
    if (t === PLATE) {
      const pr = FX.plate[i], col = DC[L.color[i]], mI = S * 0.19, sz = S - 2 * mI;
      rrect(ctx, x0 + mI, y0 + mI, sz, sz, S * 0.13);
      ctx.fillStyle = mix('#141922', col, 0.1 + pr * 0.6); ctx.fill();
      ctx.lineWidth = Math.max(1.5, S * 0.042); ctx.strokeStyle = rgba(col, 0.6 + pr * 0.4); ctx.stroke();
      glyph(ctx, L.color[i], cxm, cym, S * 0.115);
      ctx.fillStyle = pr > 0.5 ? 'rgba(10,12,17,.8)' : rgba(col, 0.9); ctx.fill();
    } else if (t === DOOR || t === IDOOR) {
      const col = DC[L.color[i]], mI = S * 0.07;
      rrect(ctx, x0 + mI, y0 + mI, S - 2 * mI, S - 2 * mI, S * 0.11);
      ctx.fillStyle = '#10141c'; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = rgba(col, 0.42);
      if (t === IDOOR) ctx.setLineDash([S * 0.1, S * 0.075]);
      ctx.stroke(); ctx.setLineDash([]);
      glyph(ctx, L.color[i], cxm, cym, S * 0.115);
      ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(col, 0.4); ctx.stroke();
    } else if (t === CORE) {
      const oc = FX.core[i], pulse = 0.5 + 0.5 * Math.sin(now / 520);
      ctx.beginPath(); ctx.arc(cxm, cym, S * 0.35, 0, TAU);
      ctx.fillStyle = 'rgba(255,217,138,' + (0.06 + 0.12 * oc) + ')'; ctx.fill();
      ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.lineCap = 'round'; ctx.strokeStyle = rgba(COL.gold, 0.55 + 0.45 * oc);
      const a0 = RM ? 0.4 : now / 900;
      ctx.beginPath(); ctx.arc(cxm, cym, S * 0.3, a0, a0 + 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cxm, cym, S * 0.3, a0 + Math.PI, a0 + Math.PI + 2.2); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(cxm, cym, S * (0.07 + 0.022 * pulse + 0.05 * oc), 0, TAU);
      ctx.fillStyle = '#ffeec4'; ctx.fill();
    } else if (t === CRUMBLE) {
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([S * 0.08, S * 0.08]);
      rrect(ctx, x0 + S * 0.1, y0 + S * 0.1, S * 0.8, S * 0.8, S * 0.1); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(8,10,14,.55)'; ctx.lineWidth = Math.max(1.2, S * 0.03); ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x0 + S * 0.24, y0 + S * 0.3); ctx.lineTo(x0 + S * 0.45, y0 + S * 0.46); ctx.lineTo(x0 + S * 0.38, y0 + S * 0.7);
      ctx.moveTo(x0 + S * 0.45, y0 + S * 0.46); ctx.lineTo(x0 + S * 0.72, y0 + S * 0.36);
      ctx.stroke();
    }
    if (i === L.start) {
      ctx.strokeStyle = 'rgba(255,255,255,.17)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      const a = S * 0.16, b = S * 0.3;
      ctx.beginPath();
      ctx.moveTo(x0 + a, y0 + b); ctx.lineTo(x0 + a, y0 + a); ctx.lineTo(x0 + b, y0 + a);
      ctx.moveTo(x0 + S - b, y0 + a); ctx.lineTo(x0 + S - a, y0 + a); ctx.lineTo(x0 + S - a, y0 + b);
      ctx.moveTo(x0 + S - a, y0 + S - b); ctx.lineTo(x0 + S - a, y0 + S - a); ctx.lineTo(x0 + S - b, y0 + S - a);
      ctx.moveTo(x0 + b, y0 + S - a); ctx.lineTo(x0 + a, y0 + S - a); ctx.lineTo(x0 + a, y0 + S - b);
      ctx.stroke(); ctx.lineCap = 'butt';
    }
    if (FX.winT) {
      const q = (now - FX.winT) / 1000 * 10 - C.distCore[i];
      if (q > 0 && q < 2) { ctx.fillStyle = 'rgba(255,226,160,' + (Math.sin(Math.PI * q / 2) * 0.2) + ')'; rrect(ctx, x0 + 0.5, y0 + 0.5, S - 1, S - 1, [rtl, rtr, rbr, rbl]); ctx.fill(); }
    }
  }

  function drawDoor(ctx, L, i, x0, y0, S) {
    const o = FX.door[i], hh = S * 0.36 * (1 - o);
    if (hh < 0.6) return;
    const col = DC[L.color[i]], inv = L.type[i] === IDOOR, mI = S * 0.07, w = S - 2 * mI, r = S * 0.11;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * clamp((1 - o) * 4, 0, 1);
    ctx.fillStyle = mix(col, '#0a0c11', 0.66);
    rrect(ctx, x0 + mI, y0 + S - mI - hh - r, w, hh + r, [0, 0, r, r]); ctx.fill();
    const ty = y0 + mI - hh;
    rrect(ctx, x0 + mI, ty, w, w, r);
    ctx.fillStyle = mix(col, '#11151d', inv ? 0.62 : 0.42); ctx.fill();
    if (inv) {
      ctx.save(); ctx.clip();
      ctx.strokeStyle = rgba(col, 0.5); ctx.lineWidth = S * 0.075;
      ctx.beginPath();
      for (let d = -w; d < w * 2; d += S * 0.24) { ctx.moveTo(x0 + mI + d, ty + w); ctx.lineTo(x0 + mI + d + w, ty); }
      ctx.stroke(); ctx.restore();
      rrect(ctx, x0 + mI, ty, w, w, r);
    }
    ctx.lineWidth = Math.max(1.5, S * 0.035); ctx.strokeStyle = rgba(col, 0.95); ctx.stroke();
    glyph(ctx, L.color[i], x0 + S / 2, ty + w / 2, S * 0.125);
    if (inv) { ctx.fillStyle = '#11151d'; ctx.fill(); ctx.lineWidth = Math.max(1.5, S * 0.04); ctx.strokeStyle = col; ctx.stroke(); }
    else { ctx.fillStyle = col; ctx.fill(); }
    ctx.globalAlpha = prev;
  }

  function drawCrate(ctx, px, py, S) {
    const mI = S * 0.15, w = S - 2 * mI, hc = S * 0.26, r = S * 0.09, x0 = px - S / 2, y0 = py - S / 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(px, y0 + S - mI + S * 0.02, w * 0.56, S * 0.09, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4c566b';
    rrect(ctx, x0 + mI, y0 + S - mI - hc - r, w, hc + r, [0, 0, r, r]); ctx.fill();
    const ty = y0 + mI - hc;
    rrect(ctx, x0 + mI, ty, w, w, r); ctx.fillStyle = '#8c97ad'; ctx.fill();
    ctx.lineWidth = Math.max(1.2, S * 0.03); ctx.strokeStyle = 'rgba(255,255,255,.28)';
    rrect(ctx, x0 + mI + w * 0.16, ty + w * 0.16, w * 0.68, w * 0.68, r * 0.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,25,38,.4)';
    ctx.beginPath(); ctx.moveTo(x0 + mI + w * 0.34, ty + w * 0.34); ctx.lineTo(x0 + mI + w * 0.66, ty + w * 0.66); ctx.moveTo(x0 + mI + w * 0.66, ty + w * 0.34); ctx.lineTo(x0 + mI + w * 0.34, ty + w * 0.66); ctx.stroke();
  }

  function drawSelf(ctx, k, px, py, S, now, o) {
    const act = o.active;
    let sx = 1, sy = 1, hop = 0;
    if (o.moving && o.step) {
      const w = Math.sin(Math.PI * o.p);
      hop = -w * S * 0.075;
      if (o.horiz) { sx = 1 + w * 0.13; sy = 1 - w * 0.08; } else { sy = 1 + w * 0.13; sx = 1 - w * 0.08; }
    } else if (!RM) { const b = Math.sin(now / 430 + k * 1.7); sy = 1 + b * 0.02; sx = 1 - b * 0.012; }
    if (o.pop < 1) { const e = Math.max(0.01, easeBack(o.pop)); sx *= e; sy *= e; }
    const bw = S * 0.46, bh = S * 0.57, base = py + S * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.34 * o.alpha) + ')';
    ctx.beginPath(); ctx.ellipse(px, base - S * 0.01, bw * 0.52 * sx, S * 0.075, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(px, base + hop); ctx.scale(sx, sy);
    ctx.globalAlpha *= o.alpha;
    rrect(ctx, -bw / 2, -bh, bw, bh, bw * 0.48);
    if (act) {
      const g = ctx.createLinearGradient(0, -bh, 0, 0);
      g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#f0d49b');
      ctx.fillStyle = g; ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(118,142,198,.92)'; ctx.fill();
      ctx.lineWidth = Math.max(1.3, S * 0.032); ctx.strokeStyle = 'rgba(208,222,252,.95)'; ctx.stroke();
    }
    const f = FX.face[k] || 3;
    if (f !== 1) {
      const ex = DX[f] * bw * 0.16, ey = DY[f] * bh * 0.06;
      const blink = !RM && ((now + k * 977) % 3900) < 110 ? 0.15 : 1;
      ctx.fillStyle = act ? '#1a1d27' : '#121829';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * bw * 0.17 + ex, -bh * 0.6 + ey, S * 0.034, S * 0.047 * blink, 0, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    if (o.label) {
      ctx.font = '600 ' + Math.round(S * 0.2) + 'px "Cascadia Mono",Consolas,ui-monospace,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = act ? COL.amber : 'rgba(169,191,232,' + (0.9 * o.alpha) + ')';
      ctx.fillText(String(k + 1), px, base + hop - bh * sy - S * 0.07);
    }
  }

  function draw(now, dt) {
    const ctx = cx, L = G.L;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COL.void; ctx.fillRect(0, 0, V.w, V.h);
    if (V.dots) { ctx.fillStyle = V.dots; ctx.fillRect(0, 0, V.w, V.h); }
    if (!L) return;
    const S = V.S, ox = V.ox, oy = V.oy, C = G.lv.cache, W = L.W;
    const view = getView(), idle = view === IDLE, p = idle ? 1 : A.p, s = view.to;
    stepFX(dt, s, idle);

    const mx = ox + (C.bx + C.bw / 2) * S, my = oy + (C.by + C.bh / 2) * S, R = Math.max(C.bw, C.bh) * S * 0.75 + 160;
    let g = ctx.createRadialGradient(mx, my, 0, mx, my, R);
    g.addColorStop(0, 'rgba(56,80,140,.24)'); g.addColorStop(1, 'rgba(56,80,140,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - R, my - R, R * 2, R * 2);
    if (V.under) ctx.drawImage(V.under, ox + C.bx * S - V.underM, oy + C.by * S - V.underM, V.under.width / V.dpr, V.under.height / V.dpr);

    const it0 = now - G.introStart, introOn = !RM && it0 < C.maxDist * 32 + 460;
    const ia = i => (introOn ? clamp((it0 - C.dist[i] * 32) / 400, 0, 1) : 1);

    // 1) karolar
    for (let i = 0; i < L.n; i++) {
      if (!C.tile(i)) continue;
      const a = ia(i);
      if (a <= 0) continue;
      const e = introOn ? easeOut(a) : 1, x = i % W, y = (i / W) | 0;
      ctx.globalAlpha = e;
      drawTile(ctx, L, C, i, x, y, ox + x * S, oy + y * S + (1 - e) * S * 0.55, S, now);
    }
    ctx.globalAlpha = 1;

    // konumlar
    const K = s.pos.length, act = view.active, step = view.kind === 'step';
    for (let k = 0; k < K; k++) {
      const to = s.pos[k], from = k < view.from.pos.length ? view.from.pos[k] : to, sp = SP[k];
      const e = step ? easeOut(p) : p, fx = from % W, fy = (from / W) | 0, tx = to % W, ty = (to / W) | 0;
      sp.x = lerp(fx, tx, e); sp.y = lerp(fy, ty, e); sp.moving = from !== to && !idle; sp.horiz = fy === ty; sp.bump = 0;
      if (step) for (const ev of view.ev) if (ev.k === k && ev.t === 'bump') { const o = Math.sin(Math.PI * p) * 0.17; sp.x += DX[ev.d] * o; sp.y += DY[ev.d] * o; sp.bump = 1; }
      let n = 0, idx = 0;
      for (let j = 0; j < K; j++) if (s.pos[j] === to) { if (j < k) idx++; n++; }
      const ft = (idx - (n - 1) / 2) * 0.21;
      FX.fan[k] += (ft - FX.fan[k]) * (1 - Math.exp(-dt / 90));
    }
    const NC = s.crates.length;
    for (let j = 0; j < NC; j++) {
      const to = s.crates[j], from = view.from.crates[j], e = step ? easeOut(p) : p;
      const cp = CP[j] || (CP[j] = { x: 0, y: 0 });
      cp.x = lerp(from % W, to % W, e); cp.y = lerp((from / W) | 0, (to / W) | 0, e);
    }

    // 2) ışık havuzları
    ctx.globalCompositeOperation = 'lighter';
    for (const c of L.cores) {
      const a = ia(c); if (a <= 0) continue;
      const px = ox + (c % W + 0.5) * S, py = oy + (((c / W) | 0) + 0.5) * S, oc = FX.core[c], rad = S * (1.25 + 0.12 * Math.sin(now / 520) + 0.5 * oc);
      g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(255,205,120,' + (0.2 + 0.22 * oc) * a + ')'); g.addColorStop(1, 'rgba(255,205,120,0)');
      ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    for (const c of L.plates) {
      const pr = FX.plate[c]; if (pr < 0.03) continue;
      const px = ox + (c % W + 0.5) * S, py = oy + (((c / W) | 0) + 0.5) * S, rad = S * 0.95;
      g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, rgba(DC[L.color[c]], 0.26 * pr)); g.addColorStop(1, rgba(DC[L.color[c]], 0));
      ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    if (act >= 0 && act < K) {
      const px = ox + (SP[act].x + 0.5 + FX.fan[act]) * S, py = oy + (SP[act].y + 0.62) * S, rad = S * 1.55;
      g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(255,184,77,.2)'); g.addColorStop(1, 'rgba(255,184,77,0)');
      ctx.fillStyle = g; ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';

    // sonraki hamle okları (yalnız dururken)
    if (FX.idle > 0.05 && G.mode === 'play' && !G.won && K > 1) {
      ctx.lineWidth = Math.max(1.5, S * 0.045); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let k = 0; k < K; k++) {
        if (k === act) continue;
        const d = G.inputs[k] ? (G.inputs[k][G.t] | 0) : 0;
        if (!d) continue;
        const px = ox + (SP[k].x + 0.5 + DX[d] * 0.5) * S, py = oy + (SP[k].y + 0.5 + DY[d] * 0.5) * S, a = S * 0.1;
        ctx.strokeStyle = 'rgba(169,191,232,' + 0.75 * FX.idle + ')';
        ctx.save(); ctx.translate(px, py); ctx.rotate([0, -Math.PI / 2, 0, Math.PI / 2, Math.PI][d]);
        ctx.beginPath(); ctx.moveTo(-a, -a); ctx.lineTo(0, 0); ctx.lineTo(-a, a); ctx.stroke(); ctx.restore();
      }
      ctx.lineCap = 'butt';
    }

    // 3) yüksek nesneler, satır satır
    const label = K > 1, seek = view.kind === 'rewind' || view.kind === 'ff';
    const popK = FX.pop ? FX.pop.k : -1, popP = FX.pop ? clamp((now - FX.pop.t0) / 340, 0, 1) : 1;
    const rise = a => (introOn ? (1 - easeOut(a)) * S * 0.55 : 0);
    const selfAt = (k, on) => {
      const sp = SP[k], a = ia(s.pos[k]);
      if (a <= 0) return;
      const px = ox + (sp.x + 0.5 + FX.fan[k]) * S, py = oy + (sp.y + 0.5) * S + rise(a);
      ctx.globalAlpha = introOn ? easeOut(a) : 1;
      if (seek && sp.moving && !RM) {
        const from = view.from.pos[k];
        drawSelf(ctx, k, ox + (from % W + 0.5 + FX.fan[k]) * S, oy + (((from / W) | 0) + 0.5) * S, S, now, { active: false, alpha: 0.28, moving: false, p: 0, pop: 1, label: false });
      }
      drawSelf(ctx, k, px, py, S, now, { active: on, alpha: on ? 1 : 0.9, moving: sp.moving, step, horiz: sp.horiz, p, pop: k === popK ? popP : 1, label });
      ctx.globalAlpha = 1;
    };
    for (let y = C.by; y < C.by + C.bh; y++) {
      for (const c of L.doors) if (((c / W) | 0) === y) { const a = ia(c); if (a > 0) { ctx.globalAlpha = introOn ? easeOut(a) : 1; drawDoor(ctx, L, c, ox + (c % W) * S, oy + y * S + rise(a), S); ctx.globalAlpha = 1; } }
      for (let j = 0; j < NC; j++) if (Math.round(CP[j].y) === y) { const a = ia(s.crates[j]); if (a > 0) { ctx.globalAlpha = introOn ? easeOut(a) : 1; drawCrate(ctx, ox + (CP[j].x + 0.5) * S, oy + (CP[j].y + 0.5) * S + rise(a), S); ctx.globalAlpha = 1; } }
      for (let k = 0; k < K; k++) if (k !== act && Math.round(SP[k].y) === y) selfAt(k, false);
      if (act >= 0 && act < K && Math.round(SP[act].y) === y) selfAt(act, true);
    }

    // 4) halkalar + parçacıklar
    for (const r of FX.rings) {
      const q = r.t / r.life, e = easeOut(q);
      ctx.lineWidth = Math.max(1, S * 0.05 * (1 - q)); ctx.strokeStyle = rgba(r.color, 0.7 * (1 - q));
      ctx.beginPath(); ctx.arc(ox + r.x * S, oy + r.y * S, Math.max(0.5, r.max * S * e), 0, TAU); ctx.stroke();
    }
    for (const q of FX.parts) {
      const a = q.a * (1 - q.t / q.life), sz = q.size * S;
      ctx.fillStyle = q.color + a + ')';
      if (q.sq) ctx.fillRect(ox + q.x * S - sz / 2, oy + q.y * S - sz / 2, sz, sz);
      else { ctx.beginPath(); ctx.arc(ox + q.x * S, oy + q.y * S, sz, 0, TAU); ctx.fill(); }
    }

    // 5) geri/ileri sarma taraması
    if (seek && !RM) {
      const rew = view.kind === 'rewind', bx0 = ox + C.bx * S - S, bw = (C.bw + 2) * S, by0 = oy + C.by * S - S, bh = (C.bh + 2) * S;
      ctx.fillStyle = rew ? 'rgba(120,160,255,.045)' : 'rgba(255,190,110,.04)';
      ctx.fillRect(0, 0, V.w, V.h);
      for (let n = 0; n < 4; n++) {
        let q = ((now / 420) + n / 4) % 1;
        if (rew) q = 1 - q;
        ctx.fillStyle = rew ? 'rgba(160,190,255,' + 0.1 * Math.sin(Math.PI * q) + ')' : 'rgba(255,205,140,' + 0.09 * Math.sin(Math.PI * q) + ')';
        ctx.fillRect(bx0, by0 + q * bh, bw, 2);
      }
    }
    // kenar karartma
    g = ctx.createRadialGradient(V.w / 2, V.h / 2, Math.min(V.w, V.h) * 0.35, V.w / 2, V.h / 2, Math.max(V.w, V.h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
  }

  // ---------- oyun mantığı ----------
  const canAct = force => !G.won && (force || (G.mode === 'play' && G.screen === 'play'));

  function doMove(d, force) {
    if (!canAct(force)) return false;
    const L = G.L;
    if (G.t >= L.T) { if (!force) { toast('Süre doldu. Geri al (Z) ya da yeni yankı aç (R).'); sfx.deny(); } return false; }
    const K = G.inputs.length, moves = new Array(K);
    for (let k = 0; k < K; k++) moves[k] = k === G.active ? d : (G.inputs[k][G.t] | 0);
    const ev = [], from = G.states[G.t], to = Core.step(L, from, moves, ev);
    G.inputs[G.active].push(d);
    G.states.push(to); G.evs.push(ev); G.t++;
    qStep(from, to, ev, G.t - 1);
    afterChange(true);
    if (Core.isWin(L, to)) win();
    return true;
  }
  function undo(force) {
    if (!canAct(force) || G.t === 0) return;
    const from = G.states[G.t], to = G.states[G.t - 1];
    G.inputs[G.active].pop(); G.t--; G.states.length = G.t + 1; G.evs.length = G.t;
    A.q.push({ kind: 'undo', from, to, ev: null, dur: 85, active: G.active });
    sfx.undo(); afterChange();
  }
  function newEcho(force) {
    if (!canAct(force)) return;
    if (G.inputs.length >= G.lv.maxSelves) { toast('Bu bölümde en fazla ' + G.lv.maxSelves + ' yankı var.'); sfx.deny(); return; }
    if (!force && G.t === 0) { toast('Bu yankı henüz boş. Önce onunla bir şey yap.'); sfx.deny(); return; }
    const path = G.states.slice(0, G.t + 1).reverse(), quiet = G.mode === 'attract';
    G.inputs.push([]); G.active = G.inputs.length - 1; G.t = 0;
    G.states = [Core.initState(G.L, G.inputs.length)]; G.evs = [];
    qSeek(path, 'rewind', -1);
    const k = G.active, start = G.L.start;
    qFx(() => { FX.pop = { k, t0: performance.now() }; FX.face[k] = 3; ringAt(start, COL.amber, 1.5, 620); if (!quiet) sfx.spawn(); });
    afterChange();
  }
  function switchTrack(k, force) {
    if (!canAct(force) || k === G.active || k < 0 || k >= G.inputs.length) return;
    const oldT = G.t, newT = G.inputs[k].length;
    G.active = k;
    const r = Core.simulate(G.L, G.inputs, Math.max(oldT, newT), true);
    let tgt = newT, won = false;
    if (r.winAt >= 0) { tgt = r.winAt; G.inputs[k].length = Math.min(G.inputs[k].length, tgt); won = true; }
    const path = tgt >= oldT ? r.states.slice(oldT, tgt + 1) : r.states.slice(tgt, oldT + 1).reverse();
    G.t = tgt; G.states = r.states.slice(0, tgt + 1); G.evs = r.events.slice(0, tgt);
    qSeek(path, tgt >= oldT ? 'ff' : 'rewind', k);
    afterChange();
    if (won) win();
  }
  // Silinen son şeyi bir kez geri getirebilmek için kayıtların kopyası.
  function stash(msg) { G.trash = { inputs: G.inputs.map(a => a.slice()), active: G.active }; if (G.mode === 'play') toast(msg + ' · U ile geri getir'); }
  function restore(force) {
    if (!canAct(force) || !G.trash) return;
    const back = G.states.slice(0, G.t + 1).reverse();
    G.inputs = G.trash.inputs; G.active = G.trash.active; G.trash = null;
    const newT = G.inputs[G.active].length, r = Core.simulate(G.L, G.inputs, newT, true);
    let tgt = newT, won = false;
    if (r.winAt >= 0) { tgt = r.winAt; G.inputs[G.active].length = Math.min(newT, tgt); won = true; }
    G.t = tgt; G.states = r.states.slice(0, tgt + 1); G.evs = r.events.slice(0, tgt);
    qSeek(back, 'rewind', -1);
    qFx(() => { FX.face = [3, 3, 3, 3]; });
    if (tgt > 0) qSeek(r.states.slice(0, tgt + 1), 'ff', G.active);
    afterChange();
    if (won) win();
  }
  function clearTrack(force) {
    if (!canAct(force) || G.t === 0) return;
    stash('Kayıt silindi');
    const path = G.states.slice(0, G.t + 1).reverse();
    G.inputs[G.active] = []; G.t = 0; G.states = [G.states[0]]; G.evs = [];
    qSeek(path, 'rewind', G.active); afterChange();
  }
  function deleteTrack(force) {
    if (!canAct(force)) return;
    if (G.inputs.length < 2) { clearTrack(force); return; }
    stash('Yankı kaldırıldı');
    const path = G.states.slice(0, G.t + 1).reverse(), start = G.L.start;
    G.inputs.splice(G.active, 1);
    G.active = G.inputs.length - 1;
    const newT = G.inputs[G.active].length, r = Core.simulate(G.L, G.inputs, newT, true);
    let tgt = newT, won = false;
    if (r.winAt >= 0) { tgt = r.winAt; G.inputs[G.active].length = Math.min(newT, tgt); won = true; }
    G.t = tgt; G.states = r.states.slice(0, tgt + 1); G.evs = r.events.slice(0, tgt);
    qSeek(path, 'rewind', -1);
    qFx(() => { FX.face = [3, 3, 3, 3]; ringAt(start, COL.echo, 1.2, 420); });
    if (tgt > 0) qSeek(r.states.slice(0, tgt + 1), 'ff', G.active);
    afterChange();
    if (won) win();
  }

  function effectiveInputs() {
    let inputs = G.inputs.map(a => a.slice()), changed = true;
    while (changed && inputs.length > 1) {
      changed = false;
      for (let k = inputs.length - 1; k >= 0; k--) {
        if (inputs[k].some(d => d)) continue;
        const rest = inputs.filter((_, j) => j !== k), r = Core.simulate(G.L, rest, G.t, false);
        if (r.winAt >= 0 && r.winAt <= G.t) { inputs = rest; changed = true; break; }
      }
    }
    return inputs;
  }
  const starsFor = (lv, selves, steps) => (selves <= lv.par ? (steps <= lv.bestSteps ? 3 : 2) : 1);
  // Bitişten sonra kayıtları koruyarak son adımın öncesine dön: çözümü iyileştirmek için.
  function resumeEdit() {
    if (!G.won || G.mode !== 'play' || G.t === 0) return;
    hideWin(); G.won = false; G.winToken++; FX.winT = 0;
    undo(true);
  }

  function win() {
    G.won = true;
    const lv = G.lv, mode = G.mode;
    qFx(() => { winBurst(); if (mode !== 'attract') sfx.win(); });
    if (mode === 'attract') return;
    if (mode === 'tutor') { afterChange(); return; }
    const selves = effectiveInputs().length, steps = G.t, stars = mode === 'watch' ? 0 : starsFor(lv, selves, steps);
    G.lastWin = { id: lv.def.id, selves, steps, stars, mode };
    if (mode === 'play') {
      const b = store.data.best[lv.def.id];
      if (!b || stars > b.stars || (stars === b.stars && (selves < b.selves || (selves === b.selves && steps < b.steps)))) { store.data.best[lv.def.id] = { selves, steps, stars }; store.save(); }
    }
    const token = ++G.winToken;
    qFx(() => setTimeout(() => { if (token === G.winToken && G.won) showWin(lv, selves, steps, stars, mode); }, A.fast ? 0 : 780));
    afterChange();
  }

  // ---------- betikler: makinenin çözümü + ana ekran gösterisi ----------
  let scriptId = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const cancelScript = () => { scriptId++; };
  const animIdle = () => !A.cur && !A.q.length;
  async function waitIdle(id) { while (!animIdle() && id === scriptId) await sleep(30); }
  async function runSolution(lv, id, stepMs) {
    const sol = lv.solInputs;
    for (let k = 0; k < sol.length; k++) {
      if (k > 0) { newEcho(true); await waitIdle(id); if (id !== scriptId) return false; await sleep(stepMs * 1.6); }
      for (let j = 0; j < sol[k].length; j++) {
        if (id !== scriptId) return false;
        doMove(sol[k][j], true);
        await sleep(stepMs);
        if (G.won) return true;
      }
    }
    while (!G.won && G.t < G.L.T) { if (id !== scriptId) return false; doMove(0, true); await sleep(stepMs); }
    return G.won;
  }
  async function attract() {
    const id = ++scriptId, order = [1, 9, 7, 11, 5, 4];
    for (let n = 0; id === scriptId; n++) {
      loadLevel(LV[order[n % order.length]], 'attract');
      layout();
      await sleep(1100);
      if (id !== scriptId) return;
      await runSolution(G.lv, id, 210);
      if (id !== scriptId) return;
      await sleep(1900);
    }
  }
  async function watch() {
    const lv = G.lv, id = ++scriptId;
    hideWin();
    loadLevel(lv, 'watch'); layout(); afterChange();
    await sleep(650);
    if (id !== scriptId) return;
    await runSolution(G.lv, id, 230);
  }

  // ---------- ilk açılış: oyunu kendi ekranında oynayarak anlatır ----------
  const TUT = { next: null, waiting: false, resolve: null, total: 6 };
  const tsleep = ms => sleep(A.fast ? 12 : ms);
  function pulse(sel) {
    for (const n of $$('.pulse')) n.classList.remove('pulse');
    const n = sel ? $(sel) : null;
    if (n) n.classList.add('pulse');
  }
  function tutorSay(n, text, btn) {
    el.coachStep.textContent = 'Nasıl oynanır · ' + n + '/' + TUT.total;
    el.coachText.textContent = text;
    el.btnCoachNext.firstChild.textContent = btn || 'Devam';
    layout();
  }
  function tutorWait() {
    TUT.waiting = true; el.btnCoachNext.disabled = false;
    return new Promise(res => { TUT.resolve = res; });
  }
  function tutorNext() {
    if (!TUT.waiting) return;
    TUT.waiting = false; el.btnCoachNext.disabled = true;
    sfx.click();
    const r = TUT.resolve;
    TUT.resolve = null;
    if (r) r();
  }
  function tutorSeen() { if (!store.data.tutorial) { store.data.tutorial = true; store.save(); } }
  function tutorEnd() {
    cancelScript(); TUT.waiting = false; TUT.resolve = null;
    tutorSeen();
    startLv(TUT.next || LV[0]);
  }
  async function tutorial(next) {
    const id = ++scriptId, alive = () => id === scriptId;
    genCancel(); hideWin(); hideHelp();
    TUT.next = next || LV[0]; TUT.waiting = false; TUT.resolve = null; el.btnCoachNext.disabled = true;
    loadLevel(LV[1], 'tutor'); setScreen('play'); afterChange();
    const go = async (seq, ms) => {
      for (const d of seq) { if (!alive()) return; doMove(d, true); await tsleep(ms || 300); }
      await waitIdle(id);
    };
    tutorSay(1, 'Bu sensin. Ok tuşları ya da WASD ile yürürsün. Amaç, ışıyan çekirdeğe ulaşmak.');
    await tsleep(700); if (!alive()) return;
    await tutorWait(); if (!alive()) return;

    tutorSay(2, 'Çekirdeğin önünde kapalı bir kapı var. Aynı renk ve şekildeki plakaya basınca açılır.');
    await go([2, 2, 2, 2]); if (!alive()) return;
    await tutorWait(); if (!alive()) return;

    tutorSay(3, 'Plakadan inince kapı yeniden kapanır: tek başına geçemezsin. Yanlış adımı Z ile geri alırsın.');
    await go([4], 420); await tsleep(650); if (!alive()) return;
    undo(true); await waitIdle(id); await tsleep(300); if (!alive()) return;
    await tutorWait(); if (!alive()) return;

    tutorSay(4, 'Attığın her adım aşağıdaki zaman çizgisine kaydedildi. Bu kayıt birazdan işe yarayacak.');
    pulse('#tl');
    await tsleep(500); if (!alive()) return;
    await tutorWait(); if (!alive()) return;

    tutorSay(5, 'R’ye basınca zaman başa sarar. Kaydın bir yankıya dönüşür ve aynı tuşlara, aynı sırayla yeniden basar.');
    pulse('.act[data-act="echo"]');
    await tsleep(1100); if (!alive()) return;
    newEcho(true); await waitIdle(id); if (!alive()) return;
    pulse();
    await tutorWait(); if (!alive()) return;

    tutorSay(6, 'Yankın plakaya yürüyüp kapıyı açık tutuyor. Sen de kapıdan geçip çekirdeğe ulaşırsın.');
    await go([2, 2, 2, 3, 3, 3], 330); if (!alive()) return;
    await tsleep(900); if (!alive()) return;
    tutorSay(6, 'Bölüm tamam. Bazı bölümler birden çok yankı ister; Tab ile aralarında geçersin. Sıra sende.', 'Başla');
    await tutorWait(); if (!alive()) return;
    tutorEnd();
  }
  // İlk kez oynayan önce anlatımı görür, sonra seçtiği bölüme geçer.
  const enter = lv => (store.data.tutorial ? startLv(lv) : tutorial(lv));
  const firstOpen = () => { const i = LV.findIndex(lv => !store.data.best[lv.def.id]); return LV[i < 0 ? 0 : i]; };

  // Duruma göre değişen yönlendirme satırı: ilk iki bölümde ne yapılacağını o an söyler.
  function tipFor() {
    const lv = G.lv, id = lv.def.id;
    if (G.mode !== 'play' || G.won) return { text: lv.def.tip };
    const s = G.states[G.t], K = G.inputs.length;
    if (id === 'ilk-adim') return { text: G.t === 0 ? lv.def.tip : 'Her adımın aşağıdaki zaman çizgisine yazılıyor. Yanlış adımı Z ile geri al, çekirdeğe ulaş.' };
    if (id === 'yanki') {
      if (K === 1) {
        if (s.pos[0] === lv.L.plates[0]) return { text: 'Kapı açıldı ama plakadan inersen kapanır. R’ye bas: zaman başa sarsın, bu kaydın yankı olarak plakada beklesin.', pulse: 'echo' };
        return { text: 'Kapı kapalı. Aynı renkteki plakaya yürü: basınca açılır, inince kapanır.' };
      }
      if (Core.isOpen(lv.L, s, lv.L.doors[0])) return { text: 'Yankın plakada, kapı açık. Geç ve çekirdeğe ulaş.' };
      return { text: 'Yankın az önceki tuşlarına yeniden basıyor. Sen kapıya doğru yürü; o plakaya varınca kapı açılacak.' };
    }
    return { text: lv.def.tip };
  }

  // ---------- ekranlar ----------
  function loadLevel(lv, mode) {
    const i = lv.i;
    prepLevel(lv);
    G.li = i; G.lv = lv; G.L = lv.L; G.inputs = [[]]; G.active = 0; G.t = 0; G.won = false; G.mode = mode;
    G.states = [Core.initState(lv.L, 1)]; G.evs = []; G.winToken++; G.phDur = 0; G.trash = null; G.hintAt = 0;
    A.q.length = 0; A.cur = null; A.p = 1;
    resetFX(); G.introStart = performance.now();
    document.body.classList.toggle('watching', mode === 'watch');
    document.body.classList.toggle('tutoring', mode === 'tutor');
    pulse();
    el.hintLbl.textContent = mode === 'watch' ? 'İzlemeyi bırak' : 'Çözümü izle';
    el.lvNum.textContent = lv.lab ? 'LAB' : String(i + 1).padStart(2, '0');
    el.lvName.textContent = lv.def.name;
    el.tip.textContent = lv.def.tip;
    el.chipPar.textContent = lv.par;
    let h = '';
    for (let n = 1; n <= lv.L.T; n++) h += '<span>' + (n === 1 || n % 5 === 0 ? n : '') + '</span>';
    el.ruler.innerHTML = h;
    el.rows.style.minHeight = (lv.maxSelves * 30) + 'px';
    el.tl.style.setProperty('--cw', (lv.L.T > 22 ? 19 : lv.L.T > 16 ? 22 : 24) + 'px');
  }
  function setScreen(name) {
    G.screen = name; document.body.dataset.screen = name;
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.blur) ae.blur();
  }
  function startLv(lv) {
    cancelScript(); genCancel(); hideWin(); hideHelp();
    loadLevel(lv, 'play'); setScreen('play'); afterChange(); layout();
  }
  const startLevel = i => startLv(LV[i]);
  function showTitle() { if (G.mode === 'tutor') tutorSeen(); genCancel(); hideWin(); hideHelp(); setScreen('title'); attract(); }
  function showSelect() { if (G.mode === 'tutor') tutorSeen(); cancelScript(); genCancel(); hideWin(); hideHelp(); buildSelect(); setScreen('select'); }

  // ---------- laboratuvar: oyun kendi bulmacasını üretir ----------
  const GEN = { job: null, timer: 0, t0: 0, shown: null, daily: false };
  const dailySeed = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  function labStart(daily, seed0) {
    cancelScript(); genCancel(); hideWin(); hideHelp();
    const d = new Date(), seed = seed0 || (daily ? dailySeed() : 100000 + Math.floor(Math.random() * 900000));
    const name = daily ? 'Günün Yankısı · ' + d.getDate() + ' ' + AYLAR[d.getMonth()] : 'Laboratuvar #' + seed;
    const tip = (daily ? 'Bugünün bulmacası herkeste aynı: tohumu tarihten gelir.' : 'Tohum ' + seed + ': aynı sayı her yerde aynı bulmacayı üretir.') + ' Bir makine üretti ve kanıtladı; ipucu yok.';
    GEN.job = window.YankiGen.start(seed, { name, tip });
    GEN.t0 = performance.now(); GEN.shown = null; GEN.daily = daily;
    el.genTitle.textContent = 'Bulmaca aranıyor';
    el.genNote.textContent = 'Tohum ' + seed + ' · her adayı çözücü sınıyor';
    el.genTried.textContent = '0'; el.genFound.textContent = '0'; el.genBar.style.width = '0%';
    el.genCv.getContext('2d').clearRect(0, 0, el.genCv.width, el.genCv.height);
    el.genp.classList.add('show');
    GEN.timer = setTimeout(genTick, 60);
  }
  function genTick() {
    const job = GEN.job;
    if (!job) return;
    job.step(A.fast ? 300 : 12);
    el.genTried.textContent = nf(job.tried); el.genFound.textContent = nf(job.found);
    el.genBar.style.width = Math.min(100, job.tried / 30) + '%';
    if (job.best && job.best !== GEN.shown) {
      GEN.shown = job.best;
      try { thumb(el.genCv, { L: Core.parseLevel({ id: 'p', T: 1, map: job.best.map }), cache: null }); } catch (e) { /* önizleme şart değil */ }
    }
    if (!job.done) { GEN.timer = setTimeout(genTick, 0); return; }
    const r = job.result;
    if (!r) { labStart(GEN.daily, job.seed + 1); return; }
    el.genTitle.textContent = 'Bulundu';
    el.genNote.textContent = 'Par ' + r.sol.par + ' yankı · en kısa ' + r.sol.steps + ' adım · ' + nf(job.found) + ' kanıtlı bulmacanın en iyisi';
    GEN.timer = setTimeout(() => { GEN.job = null; el.genp.classList.remove('show'); enter(makeLv(r.def, r.sol, -1)); }, A.fast ? 0 : Math.max(650, 1300 - (performance.now() - GEN.t0)));
  }
  function genCancel() { clearTimeout(GEN.timer); GEN.job = null; el.genp.classList.remove('show'); }
  function genAbort() { genCancel(); if (G.screen === 'title') attract(); }
  const genOpen = () => el.genp.classList.contains('show');

  function toast(msg) {
    el.toast.textContent = msg; el.toast.classList.add('show');
    clearTimeout(toast.tm); toast.tm = setTimeout(() => el.toast.classList.remove('show'), 2100);
  }
  function setDis(act, v) { const b = $('.act[data-act="' + act + '"]'); if (b) b.disabled = v; }

  function afterChange(appended) {
    const lv = G.lv;
    if (!lv) return;
    const K = G.inputs.length, T = G.L.T, play = G.mode === 'play' && !G.won;
    el.chipK.textContent = K + '/' + lv.maxSelves;
    el.clock.innerHTML = '<b>' + G.t + '</b> / ' + T;
    const bump = G.inputs.map(() => ({}));
    for (let i = 0; i < G.evs.length; i++) for (const e of G.evs[i]) if (e.t === 'bump') bump[e.k][i] = 1;
    let h = '';
    for (let k = 0; k < K; k++) {
      const inp = G.inputs[k], act = k === G.active;
      h += '<button class="tl-row' + (act ? ' active' : '') + '" data-k="' + k + '" tabindex="-1" aria-label="Yankı ' + (k + 1) + '"><span class="tl-id">' + (k + 1) + '</span><span class="tl-cells">';
      for (let i = 0; i < T; i++) {
        if (i < inp.length) {
          const d = inp[i];
          h += '<i class="c d' + d + (i < G.t ? ' p' : '') + (bump[k][i] ? ' b' : '') + (appended && act && i === G.t - 1 ? ' last' : '') + '">' + (d ? ARROW : '<b></b>') + '</i>';
        } else h += '<i class="c' + (i < G.t ? ' p' : ' e') + '"></i>';
      }
      h += '</span></button>';
    }
    if (K < lv.maxSelves && play) h += '<button class="tl-row add" data-add="1" tabindex="-1"><span class="tl-id">+</span><span class="tl-addtxt">Yeni yankı<kbd>R</kbd></span></button>';
    el.rows.innerHTML = h;
    el.ph.style.height = (K * 30) + 'px';
    el.ph.style.setProperty('--pd', (G.phDur || 130) + 'ms');
    el.tl.style.setProperty('--t', G.t);
    G.phDur = 130;
    setDis('undo', !play || G.t === 0); setDis('wait', !play || G.t >= T); setDis('echo', !play || K >= lv.maxSelves);
    setDis('tab', !play || K < 2); setDis('clear', !play || G.t === 0); setDis('del', !play || K < 2);
    const tip = tipFor();
    if (el.tip.textContent !== tip.text) el.tip.textContent = tip.text;
    if (G.mode !== 'tutor') pulse(tip.pulse ? '.act[data-act="' + tip.pulse + '"]' : null);
  }

  function thumb(c, lv) {
    const L = lv.L, C = prepLevel(lv), g = c.getContext('2d'), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const s = Math.floor(Math.min((w - 44) / C.bw, (h - 44) / C.bh, 44)), ox = (w - C.bw * s) / 2 - C.bx * s, oy = (h - C.bh * s) / 2 - C.by * s;
    for (let i = 0; i < L.n; i++) {
      if (!C.tile(i)) continue;
      const x0 = ox + (i % L.W) * s, y0 = oy + ((i / L.W) | 0) * s, t = L.type[i], col = DC[L.color[i]], cxm = x0 + s / 2, cym = y0 + s / 2;
      g.fillStyle = t === CRUMBLE ? '#303748' : '#262e3f';
      rrect(g, x0 + 1, y0 + 1, s - 2, s - 2, s * 0.16); g.fill();
      if (t === PLATE) { g.lineWidth = Math.max(1.5, s * 0.08); g.strokeStyle = col; rrect(g, x0 + s * 0.27, y0 + s * 0.27, s * 0.46, s * 0.46, s * 0.1); g.stroke(); }
      else if (t === DOOR) { g.fillStyle = col; rrect(g, x0 + s * 0.14, y0 + s * 0.14, s * 0.72, s * 0.72, s * 0.14); g.fill(); }
      else if (t === IDOOR) { g.lineWidth = Math.max(1.5, s * 0.1); g.strokeStyle = col; g.setLineDash([s * 0.16, s * 0.1]); rrect(g, x0 + s * 0.17, y0 + s * 0.17, s * 0.66, s * 0.66, s * 0.14); g.stroke(); g.setLineDash([]); }
      else if (t === CORE) { g.strokeStyle = COL.gold; g.lineWidth = Math.max(1.5, s * 0.1); g.beginPath(); g.arc(cxm, cym, s * 0.26, 0, TAU); g.stroke(); g.fillStyle = COL.gold; g.beginPath(); g.arc(cxm, cym, s * 0.08, 0, TAU); g.fill(); }
      else if (t === CRUMBLE) { g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.2; g.setLineDash([s * 0.12, s * 0.12]); rrect(g, x0 + s * 0.18, y0 + s * 0.18, s * 0.64, s * 0.64, s * 0.1); g.stroke(); g.setLineDash([]); }
      if (i === L.start) { g.fillStyle = '#fbf1d9'; rrect(g, cxm - s * 0.15, cym - s * 0.22, s * 0.3, s * 0.42, s * 0.14); g.fill(); }
      if (L.crates0.indexOf(i) >= 0) { g.fillStyle = '#8c97ad'; rrect(g, x0 + s * 0.22, y0 + s * 0.22, s * 0.56, s * 0.56, s * 0.1); g.fill(); }
    }
  }
  function buildSelect() {
    el.grid.innerHTML = '';
    let done = 0, gems = 0;
    LV.forEach((lv, i) => {
      const best = store.data.best[lv.def.id];
      if (best) { done++; gems += best.stars; }
      const b = document.createElement('button');
      b.className = 'card'; b.style.animationDelay = (i * 26) + 'ms';
      b.innerHTML = '<canvas width="430" height="242"></canvas><div class="row"><span class="n">' + String(i + 1).padStart(2, '0') + '</span><span class="stars">' +
        [1, 2, 3].map(n => '<i class="' + (best && best.stars >= n ? 'on' : '') + '"></i>').join('') + '</span></div><div class="nm">' + lv.def.name + '</div><div class="meta">' +
        (best ? 'en iyin · ' + best.selves + ' yankı · ' + best.steps + ' adım' : 'par ' + lv.par + ' yankı · ' + lv.bestSteps + ' adım') + '</div>';
      b.addEventListener('click', () => { sfx.resume(); sfx.click(); enter(LV[i]); });
      el.grid.appendChild(b);
      thumb($('canvas', b), lv);
    });
    el.selSub.textContent = LV.length + ' bölüm · ' + done + ' tamamlandı · ' + gems + '/' + LV.length * 3 + ' elmas';
    const d = new Date(), db = store.data.best['lab-' + dailySeed()];
    el.dailyName.textContent = 'Günün Yankısı · ' + d.getDate() + ' ' + AYLAR[d.getMonth()];
    el.dailyMeta.textContent = db ? 'en iyin · ' + db.selves + ' yankı · ' + db.steps + ' adım' : 'bugün herkese aynı bulmaca';
    $$('i', el.dailyStars).forEach((s, n) => s.classList.toggle('on', !!db && db.stars > n));
  }
  function buildProof() {
    let h = '<h3>Makine kanıtı</h3><p>Yankılar yolu değil tuşları tekrarladığı için, K yankılı bir bölüm K ajanın aynı anda yürüdüğü tek bir durum uzayına denktir. Çözücü bu uzayı katman katman tarar: par, çözümü olan en küçük K’dır; bir altındaki K için uzayın tamamı tükenir ve çözüm çıkmaz. Oyun ile çözücü aynı adım fonksiyonunu çalıştırır.</p><table><tr><th>Bölüm</th><th>Par</th><th>En kısa</th><th>Taranan durumlar</th></tr>';
    LV.forEach((lv, i) => {
      const pr = lv.sol.proof.map(q => (q.trivial ? 'K' + q.K + ': çekirdek sayısı yetmez' : 'K' + q.K + ': ' + nf(q.states) + ' durum, ' + (q.solvable ? '<b>çözüm var</b>' : '<span class="no">çözüm yok</span>'))).join(' · ');
      h += '<tr><td>' + (i + 1) + '. ' + lv.def.name + '</td><td><b>' + lv.par + '</b> yankı</td><td>' + lv.bestSteps + ' adım</td><td>' + pr + '</td></tr>';
    });
    el.proof.innerHTML = h + '</table>';
  }
  function proofLine(lv, selves, steps, mode) {
    const below = lv.sol.proof.find(q => q.K === lv.par - 1);
    const base = lv.par === 1 ? 'Bu bölüm tek yankıyla çözülür.' : below.trivial ? lv.L.cores.length + ' çekirdek için en az ' + lv.par + ' yankı gerekir.' : 'Kanıt: ' + (lv.par - 1) + ' yankıyla çözüm yok; ' + nf(below.states) + ' durumun tamamı tarandı.';
    if (mode === 'watch') return base + ' En kısa çözüm ' + lv.bestSteps + ' adım.';
    if (selves > lv.par) return base + ' Sen ' + selves + ' kullandın; ' + lv.par + ' ile de çözülüyor.';
    if (steps > lv.bestSteps) return base + ' Par tamam. Makine ' + lv.bestSteps + ' adımda bitiriyor.';
    return base + ' Makineyle aynı sonuç: daha iyisi yok.';
  }
  function showWin(lv, selves, steps, stars, mode) {
    const last = !lv.lab && lv.i === LV.length - 1, w = mode === 'watch';
    el.winKicker.textContent = w ? 'Makinenin çözümü' : stars === 3 ? 'Kusursuz' : stars === 2 ? 'Par' : 'Bölüm tamam';
    el.winTitle.textContent = w ? 'Böyle çözülüyor' : 'Çekirdek açıldı';
    el.winStars.hidden = w;
    const gems = $$('i', el.winStars);
    gems.forEach(s => s.classList.remove('on'));
    el.wsK.innerHTML = '<b>' + selves + '</b><span>yankı · par ' + lv.par + '</span>';
    el.wsK.classList.toggle('good', !w && selves <= lv.par);
    el.wsT.innerHTML = '<b>' + steps + '</b><span>adım · en iyi ' + lv.bestSteps + '</span>';
    el.wsT.classList.toggle('good', !w && selves <= lv.par && steps <= lv.bestSteps);
    el.winProof.textContent = proofLine(lv, selves, steps, mode);
    el.btnNext.firstChild.textContent = lv.lab ? 'Yeni bulmaca üret' : last ? 'Bölümler' : 'Sonraki bölüm';
    el.btnAgain.firstChild.textContent = w ? 'Şimdi sen dene' : 'Tekrar';
    el.btnWatch.hidden = w;
    $('#btnEdit').hidden = w;
    el.winp.classList.add('show');
    setTimeout(() => gems.forEach((s, n) => s.classList.toggle('on', n < stars)), 60);
  }
  function hideWin() { el.winp.classList.remove('show'); }
  const winOpen = () => el.winp.classList.contains('show');
  function showHelp() { el.help.classList.add('show'); }
  function hideHelp() { el.help.classList.remove('show'); }
  const helpOpen = () => el.help.classList.contains('show');
  function nextLevel() { if (G.lv.lab) labStart(false); else if (G.li < LV.length - 1) startLevel(G.li + 1); else showSelect(); }
  function toggleMute() {
    const m = !sfx.muted;
    sfx.setMuted(m); store.data.muted = m; store.save();
    el.btnMute.classList.toggle('off', m);
  }
  function hint() {
    if (G.mode === 'watch') { startLv(G.lv); return; }
    if (G.screen !== 'play' || G.mode === 'tutor') return;
    // emek verilmiş kayıtlar varken tek tuşla silinmesin: ikinci basışta izle
    const now = performance.now();
    if ((G.t > 0 || G.inputs.length > 1) && !G.won && !(G.hintAt && now - G.hintAt < 3000)) { G.hintAt = now; toast('Kayıtların silinir. İzlemek için H’ye bir daha bas.'); return; }
    watch();
  }

  // ---------- girdi ----------
  const KEYMOVE = { ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2, ArrowDown: 3, KeyS: 3, ArrowLeft: 4, KeyA: 4 };
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const c = e.code, ok = c === 'Enter' || c === 'Space' || c === 'NumpadEnter';
    const ae = document.activeElement, onBtn = !!ae && ae.tagName === 'BUTTON';
    sfx.resume();
    if (genOpen()) { if (c === 'Escape') { genAbort(); e.preventDefault(); } return; }
    if (helpOpen()) { if (c === 'Escape' || (ok && !onBtn)) { hideHelp(); e.preventDefault(); } return; }
    if (G.mode === 'tutor' && G.screen === 'play') {
      if (c === 'Escape') tutorEnd(); else if (c === 'KeyM') toggleMute(); else if ((ok && !onBtn) || c === 'ArrowRight') tutorNext();
      e.preventDefault();
      return;
    }
    if (G.screen === 'title') { if (ok && !onBtn) { e.preventDefault(); play(); } return; }
    if (G.screen === 'select') { if (c === 'Escape') { e.preventDefault(); showTitle(); } return; }
    if (c === 'Escape') { e.preventDefault(); showSelect(); return; }
    if (c === 'KeyM') { toggleMute(); return; }
    if (G.won) {
      if (!winOpen()) return;
      if (ok && !onBtn) { e.preventDefault(); nextLevel(); }
      else if (c === 'KeyR') startLv(G.lv);
      else if (c === 'KeyZ' || c === 'Backspace') { e.preventDefault(); resumeEdit(); }
      return;
    }
    if (c === 'KeyH') { hint(); return; }
    if (G.mode !== 'play') return;
    if (c in KEYMOVE) { e.preventDefault(); if (!e.repeat) doMove(KEYMOVE[c]); return; }
    if (c === 'Space') { e.preventDefault(); if (!e.repeat || A.q.length < 2) doMove(0); return; }
    if (c === 'KeyZ' || c === 'Backspace') { e.preventDefault(); if (!e.repeat || A.q.length < 2) undo(); return; }
    if (e.repeat) return;
    if (c === 'KeyR' || c === 'Enter') { e.preventDefault(); newEcho(); }
    else if (c === 'Tab') { e.preventDefault(); if (G.inputs.length > 1) switchTrack((G.active + (e.shiftKey ? G.inputs.length - 1 : 1)) % G.inputs.length); }
    else if (c === 'KeyQ') clearTrack();
    else if (c === 'KeyX' || c === 'Delete') deleteTrack();
    else if (c === 'KeyU') restore();
    else if (/^Digit[1-4]$/.test(c)) switchTrack(+c.slice(5) - 1);
  });
  window.addEventListener('keydown', e => { if (e.code === 'Tab' && G.screen === 'play') e.preventDefault(); }, true);

  function play() {
    sfx.resume(); sfx.click();
    enter(firstOpen());
  }
  const noFocus = e => e.preventDefault();
  $('#acts').addEventListener('pointerdown', noFocus);
  el.rows.addEventListener('pointerdown', noFocus);
  $('#acts').addEventListener('click', e => {
    const b = e.target.closest('.act');
    if (!b) return;
    sfx.resume();
    const a = b.dataset.act;
    if (a === 'undo') undo(); else if (a === 'wait') doMove(0); else if (a === 'echo') newEcho();
    else if (a === 'tab') switchTrack((G.active + 1) % G.inputs.length); else if (a === 'clear') clearTrack(); else if (a === 'del') deleteTrack(); else if (a === 'hint') hint();
  });
  el.rows.addEventListener('click', e => {
    const r = e.target.closest('.tl-row');
    if (!r) return;
    sfx.resume();
    if (r.dataset.add) newEcho(); else switchTrack(+r.dataset.k);
  });
  $('#btnPlay').addEventListener('click', play);
  $('#btnLevels').addEventListener('click', () => { sfx.resume(); sfx.click(); showSelect(); });
  $('#btnBack').addEventListener('click', () => { sfx.click(); showSelect(); });
  $('#btnHome').addEventListener('click', () => { sfx.click(); showTitle(); });
  $('#btnProof').addEventListener('click', () => { sfx.click(); if (el.proof.hidden) { buildProof(); el.proof.hidden = false; el.proof.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' }); } else el.proof.hidden = true; });
  $('#btnHelp').addEventListener('click', () => { sfx.click(); showHelp(); });
  $('#btnHelpOk').addEventListener('click', hideHelp);
  el.help.addEventListener('click', e => { if (e.target === el.help) hideHelp(); });
  el.btnMute.addEventListener('click', toggleMute);
  el.btnNext.addEventListener('click', nextLevel);
  el.btnAgain.addEventListener('click', () => startLv(G.lv));
  el.btnWatch.addEventListener('click', () => watch());
  $('#btnDaily').addEventListener('click', () => { sfx.resume(); sfx.click(); labStart(true); });
  $('#btnRandom').addEventListener('click', () => { sfx.resume(); sfx.click(); labStart(false); });
  $('#btnGenCancel').addEventListener('click', genAbort);
  $('#btnDailyT').addEventListener('click', () => { sfx.resume(); sfx.click(); labStart(true); });
  $('#btnEdit').addEventListener('click', resumeEdit);
  el.btnCoachNext.addEventListener('click', tutorNext);
  $('#btnCoachSkip').addEventListener('click', tutorEnd);
  $('#btnHowTo').addEventListener('click', () => { sfx.resume(); sfx.click(); tutorial(firstOpen()); });
  $('#btnHelpDemo').addEventListener('click', () => { hideHelp(); tutorial(G.lv); });
  for (const b of $$('#hud button, #winp button, #help button, #genp button, #coach button')) b.addEventListener('pointerdown', noFocus);

  // dokunmatik: kaydırarak yürü
  let touch = null;
  cv.addEventListener('pointerdown', e => { sfx.resume(); touch = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', e => {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : (dy > 0 ? 3 : 1));
  });

  // ---------- döngü ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, Math.max(0, now - last));
    last = now;
    tickAnim(dt);
    draw(now, dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(el.dock);

  store.load();
  if (store.data.muted) { sfx.setMuted(true); el.btnMute.classList.add('off'); }
  window.__yanki = {
    G, A, LV, V, Core, store, startLevel, showSelect, showTitle, labStart, GEN, TUT, tutorial,
    act: { move: doMove, undo, echo: newEcho, tab: switchTrack, clear: clearTrack, del: deleteTrack, restore },
    idle: animIdle,
    snap: () => ({ screen: G.screen, li: G.li, id: G.lv ? G.lv.def.id : null, map: G.lv ? G.lv.def.map : null, sol: G.lv ? G.lv.sol.inputs : null, gen: genOpen(), t: G.t, K: G.inputs.length, active: G.active, won: G.won, mode: G.mode, inputs: G.inputs.map(Core.encodeInputs), q: A.q.length, last: G.lastWin, winOpen: winOpen() }),
  };
  layout();
  showTitle();
  requestAnimationFrame(frame);
})();
