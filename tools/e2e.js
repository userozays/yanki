/* YANKI — uçtan uca test. Oyunu penceresiz Chrome'da açar ve gerçek klavye olaylarıyla oynar.
   1) Her bölümü çözücünün bulduğu çözümle bitirir: 3 elmas, par ve en kısa adım tutmalı.
   2) Tab ile yankı değiştirerek (insan gibi) çözer.
   3) Geri al / sil / kaldır / değiştir eylemlerini rastgele sırayla dener (fuzz) ve her adımda
      arayüz durumunu çekirdek simülasyonuyla karşılaştırır.
   4) Kayıt, çözümü izleme, ekran geçişleri ve konsol hataları. */
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const { launch, sleep } = require('./cdp.js');
const SOL = require('../src/solutions.json');
const LEVELS = require('../src/levels.js');

const root = path.join(__dirname, '..');
const html = process.env.YANKI_HTML || path.join(root, 'index.html');
// --live (ya da YANKI_URL): yereldeki dosya yerine yayındaki siteyi sına
const live = process.argv.includes('--live') ? require('../package.json').homepage : '';
const target = process.env.YANKI_URL || live || pathToFileURL(html).href;
const DIR = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft', '.': 'Space' };
const WASD = { U: 'KeyW', R: 'KeyD', D: 'KeyS', L: 'KeyA', '.': 'Space' };

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } };

(async () => {
  const br = await launch({ width: 1280, height: 800 });
  try {
    console.log('Hedef: ' + target);
    const page = await br.newPage(target, { width: 1280, height: 800, dpr: 1 });
    const snap = () => page.eval('__yanki.snap()');
    await page.waitFor('!!window.__yanki');
    await page.eval('localStorage.clear(); __yanki.store.data.best = {}; __yanki.store.data.tutorial = false; __yanki.A.fast = true; 1');

    // ---- 0) ilk açılış: Oyna önce oynanışı anlatır, sonra ilk bölümü açar
    await page.key('Enter');
    let s = await snap();
    ok(s.screen === 'play' && s.mode === 'tutor' && s.id === 'yanki', 'ilk Oyna anlatımı başlatır', JSON.stringify(s));
    await page.key('ArrowLeft'); await page.key('KeyR');
    s = await snap();
    ok(s.mode === 'tutor' && s.K === 1, 'anlatım sırasında oyuncu tuşları yok sayılır', JSON.stringify(s));
    let beats = 0, sawWin = null;
    for (let n = 0; n < 12; n++) {
      await page.waitFor('__yanki.TUT.waiting || __yanki.snap().mode !== "tutor"', 30000);
      s = await snap();
      if (s.mode !== 'tutor') break;
      if (s.won) sawWin = s.inputs.join('|');
      beats++;
      await page.key('Enter');
    }
    s = await snap();
    ok(beats === 6 && sawWin === 'RRRR|RRRDDD', 'anlatım 6 adımı oynar ve bölümü yankıyla bitirir', beats + ' ' + sawWin);
    ok(s.screen === 'play' && s.mode === 'play' && s.li === 0 && s.t === 0, 'anlatım bitince ilk bölüm açılır', JSON.stringify(s));
    ok(await page.eval('__yanki.store.data.tutorial === true && JSON.parse(localStorage.getItem("yanki.v1")).tutorial === true'), 'anlatım görüldü olarak kaydedilir');
    await page.eval('__yanki.store.data.tutorial = false; __yanki.showTitle(); 1');
    await page.key('Enter'); await page.key('Escape');
    s = await snap();
    ok(s.mode === 'play' && s.li === 0 && await page.eval('__yanki.store.data.tutorial'), 'Esc anlatımı atlar ve ilk bölümü açar', JSON.stringify(s));

    // ---- 1) başlık -> Enter -> ilk bölüm (anlatım bir kez görüldükten sonra doğrudan)
    await page.eval('__yanki.showTitle(); 1');
    await page.key('Enter');
    s = await snap();
    ok(s.screen === 'play' && s.li === 0 && s.mode === 'play', 'Enter ilk bölümü açar', JSON.stringify(s));

    // ---- 1b) ikinci bölümde duruma göre yönlendirme
    await page.eval('__yanki.startLevel(1)');
    const tipNow = () => page.eval('document.querySelector("#tip").textContent + "|" + !!document.querySelector(".act[data-act=echo].pulse")');
    let tp = await tipNow();
    ok(/plakaya yürü/i.test(tp) && /\|false$/.test(tp), 'yönlendirme: önce plakaya', tp);
    for (const ch of 'RRRR') await page.key(DIR[ch]);
    tp = await tipNow();
    ok(/R’ye bas/.test(tp) && /\|true$/.test(tp), 'yönlendirme: plakadayken R vurgulanır', tp);
    await page.key('KeyR');
    tp = await tipNow();
    ok(/Yankın/.test(tp) && /\|false$/.test(tp), 'yönlendirme: yankıdan sonra kapıya', tp);

    // ---- 2) her bölüm, çözücünün çözümüyle, gerçek tuşlarla
    console.log('Bölümler (klavye ile, çözücünün çözümü):');
    for (let i = 0; i < LEVELS.length; i++) {
      const def = LEVELS[i], sol = SOL[def.id], keys = i % 2 ? WASD : DIR;
      await page.eval('__yanki.startLevel(' + i + ')');
      for (let k = 0; k < sol.inputs.length; k++) {
        if (k > 0) await page.key('KeyR');
        for (const ch of sol.inputs[k]) await page.key(keys[ch]);
      }
      for (let n = 0; n < def.T; n++) { s = await snap(); if (s.won) break; await page.key('Space'); }
      s = await snap();
      const l = s.last || {};
      const good = s.won && l.id === def.id && l.stars === 3 && l.selves === sol.par && l.steps === sol.steps;
      ok(good, def.id + ' 3 elmasla bitti', JSON.stringify(s));
      await page.waitFor('__yanki.snap().winOpen', 6000).catch(() => {});
      s = await snap();
      ok(s.winOpen, def.id + ' bitiş paneli açıldı');
      console.log('  ' + (good ? '✓' : '✗') + ' ' + String(i + 1).padStart(2) + '. ' + def.name.padEnd(11) + ' ' + l.selves + ' yankı, ' + l.steps + ' adım, ' + l.stars + ' elmas');
    }

    // ---- 3) kayıt: 12 bölüm, 36 elmas
    const best = await page.eval('JSON.parse(localStorage.getItem("yanki.v1")).best');
    ok(Object.keys(best).length === LEVELS.length && Object.values(best).every(b => b.stars === 3), 'kayıt: tüm bölümler 3 elmas', JSON.stringify(best));

    // ---- 4) bitişte Enter sonraki bölüme geçer
    await page.eval('__yanki.startLevel(0)');
    for (const ch of SOL['ilk-adim'].inputs[0]) await page.key(DIR[ch]);
    await page.waitFor('__yanki.snap().winOpen');
    await page.key('Enter');
    s = await snap();
    ok(s.li === 1 && !s.won && s.t === 0 && !s.winOpen, 'bitişte Enter sonraki bölüme geçer', JSON.stringify(s));

    // ---- 4b) boş yankıdan yeni yankı açılmaz; bitişten sonra Z ile düzenlemeye dönülür
    await page.key('KeyR');
    s = await snap();
    ok(s.K === 1, 'boş yankıdan yeni yankı açılmaz', JSON.stringify(s));
    for (const ch of 'RRRR') await page.key(DIR[ch]);
    await page.key('KeyR');
    for (const ch of 'RRRDDD') await page.key(DIR[ch]);
    await page.waitFor('__yanki.snap().winOpen');
    await page.key('KeyZ');
    s = await snap();
    ok(!s.won && !s.winOpen && s.t === 5 && s.inputs.join('|') === 'RRRR|RRRDD', 'bitişten sonra Z: kayıtlar korunur, son adım geri alınır', JSON.stringify(s));
    await page.key('ArrowDown');
    s = await snap();
    ok(s.won && s.last.stars === 3, 'düzenlemeden sonra yeniden bitirilebilir', JSON.stringify(s));

    // ---- 5) "Güven": Tab ile yankı değiştirerek, körleme kayıt olmadan
    const guven = LEVELS.findIndex(l => l.id === 'guven');
    await page.eval('__yanki.startLevel(' + guven + ')');
    for (const ch of 'RR') await page.key(DIR[ch]);            // 1. yankı: a plakasına
    await page.key('KeyR');                                      // 2. yankı
    for (const ch of 'L.LLL') await page.key(DIR[ch]);          // A kapısından geç, b plakasına
    s = await snap();
    ok(s.inputs[1] === 'L.LLL' && s.t === 5 && !s.won, 'Güven: 2. yankı b plakasında', JSON.stringify(s));
    await page.key('Tab');                                       // 1. yankının kaydını sürdür
    s = await snap();
    ok(s.active === 0 && s.t === 2, 'Tab: 1. yankıya dönüldü, zaman onun sonuna gitti', JSON.stringify(s));
    for (const ch of '...RRDD') await page.key(DIR[ch]);        // bekle, sonra B kapısından çekirdeğe
    s = await snap();
    ok(s.won && s.last.selves === 2 && s.last.stars >= 2, 'Güven: Tab ile 2 yankıda çözüldü', JSON.stringify(s));

    // ---- 6) eylemler: geri al, kaydı sil, yankıyı kaldır, sınırlar
    await page.eval('__yanki.startLevel(1)');
    for (const ch of 'RRRR') await page.key(DIR[ch]);
    await page.key('KeyZ'); await page.key('Backspace');
    s = await snap();
    ok(s.inputs[0] === 'RR' && s.t === 2, 'Z ve Backspace geri alır', JSON.stringify(s));
    await page.key('KeyR'); await page.key('ArrowRight'); await page.key('KeyR');
    s = await snap();
    ok(s.K === 3 && s.active === 2 && s.t === 0, 'R yeni yankı açar', JSON.stringify(s));
    await page.key('KeyR');
    s = await snap();
    ok(s.K === 3, 'yankı sınırı aşılmaz', JSON.stringify(s));
    await page.key('Digit2');
    s = await snap();
    ok(s.active === 1 && s.t === 1, 'rakam tuşu yankı seçer', JSON.stringify(s));
    await page.key('KeyQ');
    s = await snap();
    ok(s.inputs[1] === '' && s.t === 0 && s.K === 3, 'Q kaydı siler', JSON.stringify(s));
    await page.key('KeyU');
    s = await snap();
    ok(s.inputs.join('|') === 'RR|R|' && s.active === 1 && s.t === 1, 'U silinen kaydı geri getirir', JSON.stringify(s));
    await page.key('KeyQ');
    await page.key('KeyX');
    s = await snap();
    ok(s.K === 2 && s.active === 1 && s.inputs.join('|') === 'RR|', 'X yankıyı kaldırır', JSON.stringify(s));
    await page.key('KeyU');
    s = await snap();
    ok(s.K === 3 && s.inputs.join('|') === 'RR||', 'U kaldırılan yankıyı geri getirir', JSON.stringify(s));
    await page.key('KeyX');
    await page.key('KeyH');
    s = await snap();
    ok(s.mode === 'play' && s.K === 2, 'kayıt varken H ilk basışta yalnız uyarır', JSON.stringify(s));
    for (let n = 0; n < 14; n++) await page.key('Space');
    s = await snap();
    ok(s.t === 10 && s.inputs[1].length === 10, 'süre sınırı (T) aşılmaz', JSON.stringify(s));

    // ---- 7) fuzz: rastgele eylemler, her adımda çekirdekle karşılaştır
    const fuzz = await page.eval(`(() => {
      const Y = __yanki, C = Y.Core, G = Y.G;
      let seed = 20261110; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      const same = (a, b) => a.pos.join() === b.pos.join() && a.crates.join() === b.crates.join() && a.gone === b.gone && a.pressed === b.pressed;
      let acts = 0, wins = 0;
      for (let round = 0; round < 240; round++) {
        const li = Math.floor(rnd() * Y.LV.length);
        Y.startLevel(li);
        if (round % 2) {   // çözümün rastgele bir ön ekini oynat: kazanma ve Tab ile kazanma yolları da sınansın
          const sol = Y.LV[li].solInputs;
          for (let k = 0; k < sol.length && !G.won; k++) {
            if (k > 0) Y.act.echo(true);
            const cut = rnd() < 0.5 ? sol[k].length : Math.floor(rnd() * (sol[k].length + 1));
            for (let j = 0; j < cut && !G.won; j++) Y.act.move(sol[k][j], true);
          }
          if (G.won) { const sim = C.simulate(G.L, G.inputs, G.t, false); if (sim.winAt !== G.t) return 'yanlış kazanma (çözüm) ' + li; wins++; continue; }
        }
        for (let n = 0; n < 60; n++) {
          const r = rnd();
          if (r < 0.6) Y.act.move(Math.floor(rnd() * 5));
          else if (r < 0.7) Y.act.undo();
          else if (r < 0.8) Y.act.echo();
          else if (r < 0.9) Y.act.tab(Math.floor(rnd() * G.inputs.length));
          else if (r < 0.93) Y.act.clear();
          else if (r < 0.97) Y.act.del();
          else Y.act.restore();
          acts++;
          if (G.inputs[G.active].length !== G.t) return 'değişmez bozuldu: uzunluk ' + li + ' ' + JSON.stringify(G.inputs) + ' t=' + G.t;
          if (G.states.length !== G.t + 1 || G.evs.length !== G.t) return 'değişmez bozuldu: geçmiş ' + li;
          const sim = C.simulate(G.L, G.inputs, G.t, false);
          if (G.won) { if (sim.winAt !== G.t) return 'yanlış kazanma ' + li + ' ' + sim.winAt + ' ' + G.t; wins++; break; }
          if (sim.winAt >= 0) return 'kaçan kazanma ' + li + ' ' + JSON.stringify(G.inputs);
          if (!same(sim.states[G.t], G.states[G.t])) return 'durum sapması ' + li + ' ' + JSON.stringify(G.inputs);
        }
      }
      return 'tamam ' + acts + ' eylem, ' + wins + ' rastgele kazanma';
    })()`);
    ok(/^tamam/.test(fuzz), 'fuzz: arayüz durumu çekirdekle hep aynı', fuzz);
    console.log('Fuzz: ' + fuzz);

    // ---- 7b) laboratuvar: tarayıcıda üretilen bulmaca Node'dakiyle aynı mı, çözülüyor mu
    const Gen = require('../src/gen.js');
    for (const seed of [424242, 777]) {
      const expect = Gen.generate(seed);
      await page.eval('__yanki.labStart(false, ' + seed + ')');
      await page.waitFor('__yanki.snap().screen === "play" && __yanki.snap().id === "lab-' + seed + '"', 60000);
      s = await snap();
      ok(JSON.stringify(s.map) === JSON.stringify(expect.def.map) && JSON.stringify(s.sol) === JSON.stringify(expect.sol.inputs), 'lab ' + seed + ': tarayıcı ve Node aynı bulmacayı üretti', JSON.stringify(s.map));
      for (let k = 0; k < s.sol.length; k++) {
        if (k > 0) await page.key('KeyR');
        for (const ch of s.sol[k]) await page.key(DIR[ch]);
      }
      for (let n = 0; n < 30; n++) { s = await snap(); if (s.won) break; await page.key('Space'); }
      s = await snap();
      ok(s.won && s.last.stars === 3 && s.last.selves === expect.sol.par && s.last.steps === expect.sol.steps, 'lab ' + seed + ': üretilen bulmaca 3 elmasla çözüldü', JSON.stringify(s.last));
      console.log('Laboratuvar #' + seed + ': par ' + expect.sol.par + ', ' + expect.sol.steps + ' adım, ' + expect.tried + ' aday / ' + expect.found + ' kanıtlı — ' + (s.won ? '✓' : '✗'));
    }
    await page.waitFor('__yanki.snap().winOpen');
    await page.key('Enter');
    s = await snap();
    ok(s.gen, 'lab bitişinde Enter yeni bulmaca üretir', JSON.stringify(s));
    await page.key('Escape');
    s = await snap();
    ok(!s.gen, 'Esc üretimi iptal eder');
    await page.eval('__yanki.showSelect()');
    await page.eval('document.querySelector("#btnDaily").click()');
    await page.waitFor('__yanki.snap().screen === "play" && /^lab-20\\d{6}$/.test(__yanki.snap().id)', 60000);
    s = await snap();
    ok(/^lab-20\d{6}$/.test(s.id) && s.t === 0 && !s.won, 'günün bulmacası üretildi ve açıldı', s.id);

    // ---- 8) çözümü izle (H), gerçek hızda
    await page.eval('__yanki.A.fast = false; __yanki.startLevel(1)');
    await page.key('KeyH');
    s = await snap();
    ok(s.mode === 'watch', 'H izleme kipini açar', JSON.stringify(s));
    await page.key('ArrowRight');
    s = await snap();
    ok(s.mode === 'watch', 'izlerken hamle yok sayılır');
    await page.waitFor('__yanki.snap().winOpen', 15000);
    s = await snap();
    ok(s.won && s.mode === 'watch' && s.last.stars === 0, 'makinenin çözümü oynadı', JSON.stringify(s));
    const bestAfter = await page.eval('JSON.parse(localStorage.getItem("yanki.v1")).best.yanki.stars');
    ok(bestAfter === 3, 'izlemek kaydı değiştirmez');

    // ---- 9) ekranlar
    await page.key('Escape');
    s = await snap();
    ok(s.screen === 'select', 'Esc bölümlere döner', JSON.stringify(s));
    const cards = await page.eval('document.querySelectorAll("#grid .card").length + ":" + document.querySelectorAll("#grid .stars i.on").length');
    ok(cards === '12:36', 'bölüm ekranı 12 kart, 36 elmas gösterir', cards);
    await page.key('Escape');
    s = await snap();
    ok(s.screen === 'title' && s.mode === 'attract', 'Esc ana ekrana döner', JSON.stringify(s));
    await sleep(2500);
    s = await snap();
    ok(s.screen === 'title' && (s.t > 0 || s.K > 1), 'ana ekran gösterisi oynuyor', JSON.stringify(s));

    // ---- 10) yeniden yükle: kayıt duruyor
    await page.send('Page.reload');
    await sleep(1200);
    await page.waitFor('!!window.__yanki');
    const kept = await page.eval('Object.keys(__yanki.store.data.best).length');
    ok(kept === 14, 'yeniden yüklemede kayıt korunur (12 bölüm + 2 laboratuvar)', String(kept));

    ok(page.errors.length === 0, 'konsol hatası yok', page.errors.join(' | '));
  } catch (e) { fail++; console.log('  ✗ test çöktü: ' + e.message); }
  await br.close();
  console.log('\n' + pass + ' geçti, ' + fail + ' kaldı');
  process.exit(fail ? 1 : 0);
})();
