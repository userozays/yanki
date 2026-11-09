<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0a0c11">
<title>Yankı · kendinle iş birliği yap</title>
<meta name="description" content="Kendi geçmişinle iş birliği yaptığın zaman döngüsü bulmacası. 12 bölüm ve her gün yeni bir bulmaca; hepsinin çözümü makineyle kanıtlı.">
<meta property="og:type" content="website">
<meta property="og:title" content="Yankı · kendinle iş birliği yap">
<meta property="og:description" content="Kendi geçmişinle iş birliği yaptığın zaman döngüsü bulmacası. 12 bölüm ve her gün yeni bir bulmaca; hepsinin çözümü makineyle kanıtlı.">
<!--__OG__-->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a0c11'/%3E%3Cpath d='M9 8l7 9 7-9M16 17v8' stroke='%23ffb84d' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E">
<style>
/*__CSS__*/
</style>
</head>
<body data-screen="title">
<canvas id="cv" aria-hidden="true"></canvas>

<header id="hud">
  <div class="hud-row">
    <div class="hud-left">
      <button class="ghost" id="btnBack" tabindex="-1"><svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5"/></svg>Bölümler<kbd>Esc</kbd></button>
    </div>
    <div class="lv-title"><span class="lv-num" id="lvNum">01</span><span class="lv-name" id="lvName"></span></div>
    <div class="hud-right">
      <span class="chip" id="chipKWrap">Yankı<b id="chipK">1/2</b></span>
      <span class="chip">Par<b id="chipPar">1</b></span>
      <button class="icon" id="btnMute" tabindex="-1" aria-label="Sesi aç/kapat"><svg viewBox="0 0 16 16"><path d="M2.5 6v4h2.5l3.5 3V3L5 6z"/><path class="wave" d="M11 5.5a3.5 3.5 0 010 5M12.8 3.6a6 6 0 010 8.8"/></svg></button>
      <button class="icon" id="btnHelp" tabindex="-1" aria-label="Nasıl oynanır">?</button>
    </div>
  </div>
  <p id="tip"></p>
</header>
<div id="watchBadge">Makinenin çözümü oynuyor</div>
<div id="coach" role="region" aria-live="polite" aria-label="Nasıl oynanır">
  <p class="kicker" id="coachStep">Nasıl oynanır</p>
  <p id="coachText"></p>
  <div class="coach-btns">
    <button class="btn small primary" id="btnCoachNext" tabindex="-1">Devam<kbd>Enter</kbd></button>
    <button class="btn small" id="btnCoachSkip" tabindex="-1">Atla<kbd>Esc</kbd></button>
  </div>
</div>

<section id="dock" aria-label="Zaman çizgisi ve eylemler">
  <div id="tl">
    <div class="tl-head"><span>Zaman çizgisi</span><span id="tlClock"></span></div>
    <div class="tl-ruler" id="tlRuler"></div>
    <div class="tl-rowswrap"><div id="tlRows"></div><div class="playhead" id="ph"></div></div>
  </div>
  <div id="acts">
    <button class="act" data-act="undo" tabindex="-1"><kbd>Z</kbd>Geri al</button>
    <button class="act" data-act="wait" tabindex="-1"><kbd>Boşluk</kbd>Bekle</button>
    <button class="act primary" data-act="echo" tabindex="-1"><kbd>R</kbd>Yeni yankı</button>
    <button class="act" data-act="tab" tabindex="-1"><kbd>Tab</kbd>Yankı değiştir</button>
    <button class="act" data-act="clear" tabindex="-1"><kbd>Q</kbd>Kaydı sil</button>
    <button class="act" data-act="del" tabindex="-1"><kbd>X</kbd>Yankıyı kaldır</button>
    <button class="act" data-act="hint" tabindex="-1"><kbd>H</kbd><span id="hintLbl">Çözümü izle</span></button>
  </div>
</section>

<section id="title" class="screen">
  <svg class="wm" viewBox="-14 -8 276 84" role="img" aria-label="YANKI">
    <defs><g id="wmg" fill="none" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 4L22 30L42 4M22 30V60"/>
      <path d="M62 60L84 4L106 60M71 40H97"/>
      <path d="M126 60V4L166 60V4"/>
      <path d="M186 4V60M224 4L187 35M201 24L226 60"/>
      <path d="M246 4V60"/>
    </g></defs>
    <use href="#wmg" class="e e3"/><use href="#wmg" class="e e2"/><use href="#wmg" class="e e1"/><use href="#wmg" class="m"/>
  </svg>
  <p class="tag">Kendinle iş birliği yap.</p>
  <div class="btns">
    <button class="btn primary" id="btnPlay">Oyna<kbd>Enter</kbd></button>
    <button class="btn" id="btnLevels">Bölümler</button>
    <button class="btn" id="btnDailyT">Günün yankısı</button>
    <button class="btn" id="btnHowTo">Nasıl oynanır</button>
  </div>
  <p class="foot">Claude Fable 5.2 yazdı · tek dosya, sıfır bağımlılık · her bölüm makineyle kanıtlandı · <a href="https://github.com/userozays/yanki" target="_blank" rel="noopener">kaynak kod</a></p>
</section>

<section id="select" class="screen">
  <div class="sel-head">
    <div>
      <p class="kicker">Yankı</p>
      <h2>Bölümler</h2>
      <p class="sub" id="selSub"></p>
    </div>
    <div class="sel-actions">
      <button class="ghost" id="btnProof">Makine kanıtı</button>
      <button class="ghost" id="btnHome">Ana ekran<kbd>Esc</kbd></button>
    </div>
  </div>
  <div class="grid" id="grid"></div>
  <div class="lab">
    <div class="lab-head">
      <p class="kicker">Laboratuvar</p>
      <h3>Oyun kendi bulmacasını üretsin</h3>
      <p class="sub">Bir tohumdan 3.000 rastgele harita kurar, her birini çözücüyle sınar, gereksiz parçaları söker ve kanıtlı olanların en iyisini önüne koyar. Bir saniye kadar sürer; aynı tohum herkeste aynı bulmacayı verir.</p>
    </div>
    <div class="lab-cards">
      <button class="card labcard" id="btnDaily">
        <div class="row"><span class="n">GÜNLÜK</span><span class="stars" id="dailyStars"><i></i><i></i><i></i></span></div>
        <div class="nm" id="dailyName">Günün Yankısı</div>
        <div class="meta" id="dailyMeta">bugün herkese aynı bulmaca</div>
      </button>
      <button class="card labcard" id="btnRandom">
        <div class="row"><span class="n">SONSUZ</span></div>
        <div class="nm">Yeni bulmaca üret</div>
        <div class="meta">her seferinde yeni tohum</div>
      </button>
    </div>
  </div>
  <div id="proof" hidden></div>
</section>

<div id="winp" class="modal" role="dialog" aria-modal="true" aria-labelledby="winTitle">
  <div class="mcard">
    <p class="kicker" id="winKicker">Bölüm tamam</p>
    <h3 class="wt" id="winTitle">Çekirdek açıldı</h3>
    <div class="wstars" id="winStars"><i></i><i></i><i></i></div>
    <div class="wstats">
      <div class="wstat" id="wsK"><b>2</b><span>yankı · par 2</span></div>
      <div class="wstat" id="wsT"><b>8</b><span>adım · en iyi 8</span></div>
    </div>
    <p class="wproof" id="winProof"></p>
    <div class="wbtns">
      <button class="btn small primary" id="btnNext">Sonraki bölüm<kbd>Enter</kbd></button>
      <button class="btn small" id="btnEdit">Düzenle<kbd>Z</kbd></button>
      <button class="btn small" id="btnAgain">Tekrar<kbd>R</kbd></button>
      <button class="btn small" id="btnWatch">Makinenin çözümü</button>
    </div>
  </div>
</div>

<div id="help" class="modal" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
  <div class="mcard">
    <p class="kicker">Nasıl oynanır</p>
    <h3 id="helpTitle">Kendi geçmişinle çalış</h3>
    <ul>
      <li><b>Her yankı bir kayıttır.</b> Attığın adımlar zaman çizgisine yazılır. Yeni yankı açtığında zaman başa sarar; öncekiler aynı tuşlara aynı sırayla yeniden basar.</li>
      <li><b>Yankılar tuşları tekrarlar, yolu değil.</b> Kapalı bir kapıya yürüyen yankı, sen o kapıyı açarsan bu sefer geçer.</li>
      <li><b>Plaka ve kapı</b> aynı renk ve şekli taşır. Çizgili kapı ters çalışır. İçinde biri duran kapı kapanamaz.</li>
      <li><b>Bütün çekirdekler aynı anda</b> bir yankıyla dolunca bölüm biter.</li>
      <li><b>Par</b>, o bölümün en az kaç yankıyla çözülebildiğidir. Bir bilgisayar araması bunu kanıtladı: daha azıyla çözüm yok.</li>
    </ul>
    <div class="keys">
      <kbd>W A S D</kbd><span>ya da ok tuşları: yürü</span>
      <kbd>Boşluk</kbd><span>bekle (zaman akar)</span>
      <kbd>Z</kbd><span>son adımı geri al</span>
      <kbd>R</kbd><span>yeni yankı, zamanı başa sar</span>
      <kbd>Tab</kbd><span>başka bir yankının kaydını sürdür</span>
      <kbd>Q</kbd><span>bu yankının kaydını sil</span>
      <kbd>X</kbd><span>bu yankıyı kaldır</span>
      <kbd>U</kbd><span>son silineni geri getir</span>
      <kbd>H</kbd><span>makinenin çözümünü izle</span>
      <kbd>M</kbd><span>sesi aç / kapat</span>
    </div>
    <div class="wbtns"><button class="btn small primary" id="btnHelpOk">Anladım<kbd>Enter</kbd></button><button class="btn small" id="btnHelpDemo">Gösterimi izle</button></div>
  </div>
</div>

<div id="genp" class="modal" role="dialog" aria-modal="true" aria-labelledby="genTitle">
  <div class="mcard">
    <p class="kicker">Laboratuvar</p>
    <h3 class="wt" id="genTitle">Bulmaca aranıyor</h3>
    <canvas id="genCv" width="430" height="200"></canvas>
    <div class="wstats">
      <div class="wstat"><b id="genTried">0</b><span>aday denendi</span></div>
      <div class="wstat good"><b id="genFound">0</b><span>kanıtlı bulmaca</span></div>
    </div>
    <div class="bar"><i id="genBar"></i></div>
    <p class="wproof" id="genNote"></p>
    <div class="wbtns"><button class="btn small" id="btnGenCancel">Vazgeç<kbd>Esc</kbd></button></div>
  </div>
</div>

<div id="toast" role="status" aria-live="polite"></div>

<script>
/*__CORE__*/
</script>
<script>
/*__LEVELS__*/
</script>
<script>
window.YankiSolutions = /*__SOLUTIONS__*/;
</script>
<script>
/*__SOLVER__*/
</script>
<script>
/*__GEN__*/
</script>
<script>
/*__GAME__*/
</script>
</body>
</html>
