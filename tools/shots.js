/* Görsel kontrol: oyunu penceresiz Chrome'da açar, seçili anların ekran görüntüsünü alır. */
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const { launch, sleep } = require('./cdp.js');

const root = path.join(__dirname, '..');
const html = process.env.YANKI_HTML || path.join(root, 'index.html');
const target = process.env.YANKI_URL || pathToFileURL(html).href;
const outDir = process.env.YANKI_SHOTS || path.join(root, 'shots');
const which = (process.argv[2] || 'all').split(',');
const want = n => which.includes('all') || which.includes(n);
const DIR = { U: 'ArrowUp', R: 'ArrowRight', D: 'ArrowDown', L: 'ArrowLeft', '.': 'Space' };

(async () => {
  const br = await launch({ width: 1280, height: 800 });
  let failed = false;
  try {
    const page = await br.newPage(target, { width: 1280, height: 800, dpr: 1 });
    const idle = () => page.waitFor('__yanki.idle()', 15000);
    const play = async (seq, gap) => { for (const ch of seq) { await page.key(DIR[ch]); await sleep(gap || 170); } };
    const shot = async n => { await page.shot(path.join(outDir, n + '.png')); console.log('görüntü: ' + n); };

    if (which.includes('og')) {   // paylaşım önizleme görseli: 1200x630, proje köküne
      await page.setViewport(1200, 630, 1); await sleep(5600);
      await page.shot(path.join(root, 'og.png')); console.log('görüntü: og.png');
      await page.setViewport(1280, 800, 1); await sleep(300);
    }
    if (which.includes('tutor')) {   // ilk açılış anlatımının adımları
      await page.eval('__yanki.store.data.tutorial = false; 1');
      await page.key('Enter');
      for (let n = 1; n <= 6; n++) {
        await page.waitFor('__yanki.TUT.waiting', 30000); await sleep(450);
        await shot('t' + n + '-anlatim');
        if (n === 5) { await page.key('Enter'); await sleep(1300); await shot('t5b-anlatim'); } else await page.key('Enter');
      }
      await sleep(900); await shot('t7-ilk-bolum');
      await page.eval('__yanki.startLevel(1)'); await sleep(1200);
      await play('RRRR'); await idle(); await sleep(500); await shot('t8-yonlendirme');
      await page.eval('__yanki.showTitle()'); await sleep(600);
    }
    if (want('title')) { await sleep(5200); await shot('01-title'); }
    if (want('select')) { await page.eval('__yanki.showSelect()'); await sleep(900); await shot('02-select'); }
    if (want('l1')) { await page.eval('__yanki.startLevel(0)'); await sleep(1300); await shot('03-l1-start'); await play('RRD'); await idle(); await shot('04-l1-mid'); }
    if (want('l2')) {
      await page.eval('__yanki.startLevel(1)'); await sleep(1200);
      await play('RRRR'); await idle(); await shot('05-l2-plate');
      await page.key('KeyR'); await sleep(260); await shot('06-l2-rewind');
      await idle(); await sleep(400); await play('RRRDD'); await idle(); await sleep(250); await shot('07-l2-door');
      await play('D'); await sleep(1800); await shot('08-l2-win');
    }
    if (want('l3')) { await page.eval('__yanki.startLevel(2)'); await sleep(1200); await play('RDRR'); await idle(); await shot('09-l3-crate'); }
    if (want('l5')) { await page.eval('__yanki.startLevel(4)'); await sleep(1200); await play('LL'); await page.key('KeyR'); await idle(); await sleep(300); await play('RRR'); await idle(); await shot('10-ritim'); }
    if (want('l6')) { await page.eval('__yanki.startLevel(5)'); await sleep(1200); await play('RRRRU'); await idle(); await sleep(500); await shot('11-kopru'); }
    if (want('l9')) { await page.eval('__yanki.startLevel(8)'); await sleep(1300); await shot('12-kargo'); }
    if (want('l12')) { await page.eval('__yanki.startLevel(11)'); await sleep(1500); await shot('13-koro'); }
    if (want('help')) { await page.eval('document.querySelector("#btnHelp").click()'); await sleep(700); await shot('14-help'); await page.key('Escape'); }
    if (want('proof')) { await page.eval('__yanki.showSelect()'); await sleep(500); await page.eval('document.querySelector("#btnProof").click()'); await sleep(900); await page.eval('document.querySelector("#select").scrollTo(0, 99999)'); await sleep(400); await shot('15-proof'); }
    if (want('lab')) {
      await page.eval('__yanki.showSelect()'); await sleep(600);
      await page.eval('document.querySelector("#select").scrollTo(0, 99999)'); await sleep(400); await shot('18-lab-section');
      await page.eval('__yanki.labStart(false, 20261112)'); await sleep(520); await shot('19-lab-search');
      await page.waitFor('__yanki.snap().screen === "play"', 30000); await sleep(1500); await shot('20-lab-level');
      await play('LLL'); await page.key('KeyR'); await idle(); await sleep(300); await play('LLL'); await idle(); await sleep(300); await shot('21-lab-play');
    }
    if (want('intro')) { await page.eval('__yanki.startLevel(8)'); await sleep(230); await shot('25-intro'); }
    if (want('fx')) {
      await page.eval('__yanki.startLevel(9)'); await sleep(1300);
      await play('RRRRRRRR', 150); await idle();
      await page.key('KeyR'); await sleep(170); await shot('22-rewind-mid');
      await idle(); await sleep(200);
      await page.eval('__yanki.startLevel(0)'); await sleep(1200);
      await play('RRDRR', 150); await idle(); await page.key('ArrowRight'); await sleep(330); await shot('23-win-burst');
      await sleep(1600); await shot('24-win-panel');
    }
    if (want('small')) { await page.setViewport(900, 620, 1); await page.eval('__yanki.startLevel(8)'); await sleep(1400); await shot('16-small'); await page.setViewport(390, 780, 2); await sleep(600); await page.eval('__yanki.startLevel(1)'); await sleep(1400); await shot('17-phone'); }

    console.log('durum: ' + JSON.stringify(await page.eval('__yanki.snap()')));
    if (page.errors.length) { failed = true; console.log('HATALAR:\n' + page.errors.join('\n')); } else console.log('konsol hatası yok');
  } catch (e) { failed = true; console.log('BAŞARISIZ: ' + e.message); }
  await br.close();
  process.exit(failed ? 1 : 0);
})();
